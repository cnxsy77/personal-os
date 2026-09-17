package store

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"strings"

	"github.com/google/uuid"

	"personal-os/server/internal/model"
)

func (s *Store) RecordTransaction(ctx context.Context, input model.TransactionInput) error {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()

	orderID, err := resolveTransactionOrder(ctx, tx, input)
	if err != nil {
		return err
	}
	item, err := validateTransaction(ctx, tx, model.TransactionUpdateInput(input), nil)
	if err != nil {
		return err
	}
	item.ID = uuid.NewString()
	item.OrderID = orderID
	if err := insertTransaction(ctx, tx, item); err != nil {
		return err
	}
	return tx.Commit()
}

func (s *Store) UpdateTransaction(ctx context.Context, id string, input model.TransactionUpdateInput) error {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()

	var existingID string
	err = tx.QueryRowContext(ctx, `SELECT id FROM transactions WHERE id = ?`, id).Scan(&existingID)
	if errors.Is(err, sql.ErrNoRows) {
		return errors.New("记账记录不存在")
	}
	if err != nil {
		return err
	}

	orderID := optionalID(input.OrderID)
	if input.OrderID != nil && *input.OrderID != "" {
		if err := ensureOrderExists(ctx, tx, *input.OrderID); err != nil {
			return err
		}
	}
	item, err := validateTransaction(ctx, tx, input, &id)
	if err != nil {
		return err
	}
	item.ID = id
	item.OrderID = orderID
	item.ImportID = nil
	if _, err = tx.ExecContext(ctx, `
		UPDATE transactions SET kind = ?, amount_cents = ?, category = ?, date = ?, note = ?, tag = ?,
		  order_id = ?, stage = ?, recurring_id = ?, related_transaction_id = ?, counterparty = ?,
		  source = ?, source_trade_no = ?, occurred_at = ?, import_id = NULL
		WHERE id = ?
	`, string(item.Kind), item.AmountCents, item.Category, item.Date, nullStringFromValue(item.Note),
		string(item.Tag), nullStringValue(item.OrderID), string(item.Stage), nullStringValue(item.RecurringID),
		nullStringValue(item.RelatedTransactionID), nullStringFromValue(item.Counterparty), string(item.Source),
		nullStringFromValue(item.SourceTradeNo), nullStringFromValue(item.OccurredAt), id); err != nil {
		return uniqueBillError(err)
	}
	return tx.Commit()
}

func (s *Store) DeleteTransaction(ctx context.Context, id string) error {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()

	importIDs := []string{}
	importRows, err := tx.QueryContext(ctx, `SELECT import_id FROM bill_import_transactions WHERE transaction_id = ?`, id)
	if err != nil {
		return err
	}
	for importRows.Next() {
		var importID string
		if err = importRows.Scan(&importID); err != nil {
			importRows.Close()
			return err
		}
		importIDs = append(importIDs, importID)
	}
	if err = importRows.Err(); err != nil {
		importRows.Close()
		return err
	}
	importRows.Close()

	result, err := tx.ExecContext(ctx, `DELETE FROM transactions WHERE id = ?`, id)
	if err := checkAffected(result, err, "记账记录不存在"); err != nil {
		return err
	}
	for _, importID := range importIDs {
		if _, err = tx.ExecContext(ctx, `
		DELETE FROM bill_imports
			WHERE id = ? AND NOT EXISTS (
			SELECT 1 FROM bill_import_transactions child
			WHERE child.import_id = bill_imports.id AND child.transaction_id <> ?
		)
		`, importID, id); err != nil {
			return err
		}
	}
	if err = tx.Commit(); err != nil {
		return err
	}
	return nil
}

func (s *Store) SaveRecurringTransaction(ctx context.Context, input model.RecurringInput) error {
	validated, err := validateRecurring(input)
	if err != nil {
		return err
	}
	note := optionalText(input.Note)
	active := input.Active == nil || *input.Active

	if input.ID != nil && *input.ID != "" {
		id := *input.ID
		var existingNote sql.NullString
		err := s.db.QueryRowContext(ctx, `SELECT note FROM recurring_transactions WHERE id = ?`, id).Scan(&existingNote)
		if errors.Is(err, sql.ErrNoRows) {
			return errors.New("周期记录不存在")
		}
		if err != nil {
			return err
		}
		if note == nil {
			noteValue := ""
			if existingNote.Valid {
				noteValue = existingNote.String
			}
			note = &noteValue
		}
		result, err := s.db.ExecContext(ctx, `
			UPDATE recurring_transactions SET name = ?, kind = ?, amount_cents = ?, category = ?, frequency = ?, next_date = ?, note = ?, active = ?
			WHERE id = ?
		`, validated.Name, validated.Kind, validated.AmountCents, validated.Category, validated.Frequency,
			validated.NextDate, nullStringValue(note), boolToInt(active), id)
		return checkAffected(result, err, "周期记录不存在")
	}

	_, err = s.db.ExecContext(ctx, `
		INSERT INTO recurring_transactions (id, name, kind, amount_cents, category, frequency, next_date, note, active, created_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	`, uuid.NewString(), validated.Name, validated.Kind, validated.AmountCents, validated.Category,
		validated.Frequency, validated.NextDate, nullStringValue(note), boolToInt(active), nowTimestamp())
	return err
}

func (s *Store) SetRecurringTransactionStatus(ctx context.Context, id string, active bool) error {
	result, err := s.db.ExecContext(ctx, `UPDATE recurring_transactions SET active = ? WHERE id = ?`, boolToInt(active), id)
	return checkAffected(result, err, "周期记录不存在")
}

func (s *Store) RecordRecurringTransaction(ctx context.Context, id string, date string) error {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()

	var item model.Recurring
	var note sql.NullString
	var active int
	err = tx.QueryRowContext(ctx, `
		SELECT id, name, kind, amount_cents, category, frequency, next_date, note, active
		FROM recurring_transactions WHERE id = ?
	`, id).Scan(&item.ID, &item.Name, &item.Kind, &item.AmountCents, &item.Category,
		&item.Frequency, &item.NextDate, &note, &active)
	if errors.Is(err, sql.ErrNoRows) {
		return errors.New("周期记录不存在")
	}
	if err != nil {
		return err
	}
	item.Note = note.String
	item.Active = active == 1
	paidDate := item.NextDate
	if cleanString(date) != "" {
		paidDate = cleanString(date)
	}
	if !isValidDate(paidDate) {
		return errors.New("请选择有效的记录日期")
	}
	nextDate, err := nextRecurringDate(item.NextDate, item.Frequency)
	if err != nil {
		return err
	}
	recurringID := id
	transaction := model.Transaction{
		ID: uuid.NewString(), Kind: model.TransactionKind(item.Kind), AmountCents: item.AmountCents,
		Category: item.Category, Date: paidDate, Tag: model.TransactionTag("subscription"),
		RecurringID: &recurringID, Counterparty: item.Name, Source: model.BillSource("manual"),
	}
	if item.Note != "" {
		transaction.Note = item.Note
	}
	if err := insertTransaction(ctx, tx, transaction); err != nil {
		return err
	}
	if _, err = tx.ExecContext(ctx, `UPDATE recurring_transactions SET next_date = ? WHERE id = ?`, nextDate, id); err != nil {
		return err
	}
	return tx.Commit()
}

func (s *Store) DeleteRecurringTransaction(ctx context.Context, id string) error {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()
	result, err := tx.ExecContext(ctx, `DELETE FROM recurring_transactions WHERE id = ?`, id)
	if err := checkAffected(result, err, "周期记录不存在"); err != nil {
		return err
	}
	if _, err = tx.ExecContext(ctx, `UPDATE transactions SET recurring_id = NULL WHERE recurring_id = ?`, id); err != nil {
		return err
	}
	return tx.Commit()
}

func (s *Store) CreatePaymentOrder(ctx context.Context, input model.PaymentOrderInput) (string, error) {
	validated, err := validatePaymentOrder(input)
	if err != nil {
		return "", err
	}
	id := uuid.NewString()
	_, err = s.db.ExecContext(ctx, `
		INSERT INTO payment_orders (id, name, expected_total_cents, created_at) VALUES (?, ?, ?, ?)
	`, id, validated.Name, validated.ExpectedTotalCents, localDate(localToday()))
	return id, err
}

func (s *Store) UpdatePaymentOrder(ctx context.Context, id string, input model.PaymentOrderInput) error {
	validated, err := validatePaymentOrder(input)
	if err != nil {
		return err
	}
	result, err := s.db.ExecContext(ctx, `
		UPDATE payment_orders SET name = ?, expected_total_cents = ? WHERE id = ?
	`, validated.Name, validated.ExpectedTotalCents, id)
	return checkAffected(result, err, "订单不存在")
}

func (s *Store) DeletePaymentOrder(ctx context.Context, id string) error {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()
	result, err := tx.ExecContext(ctx, `DELETE FROM payment_orders WHERE id = ?`, id)
	if err := checkAffected(result, err, "订单不存在"); err != nil {
		return err
	}
	if _, err = tx.ExecContext(ctx, `UPDATE transactions SET order_id = NULL, stage = '' WHERE order_id = ?`, id); err != nil {
		return err
	}
	return tx.Commit()
}

func (s *Store) ImportBillTransactions(ctx context.Context, input model.BillImportInput) (model.BillImportResult, error) {
	if !isExternalBillSource(string(input.Source)) {
		return model.BillImportResult{}, errors.New("账单来源无效")
	}
	fileName := cleanString(input.FileName)
	if fileName == "" {
		return model.BillImportResult{}, errors.New("账单文件名不能为空")
	}

	existing, err := s.loadBillDuplicateKeys(ctx)
	if err != nil {
		return model.BillImportResult{}, err
	}
	imported := make([]model.Transaction, 0)
	ids := make([]string, 0)
	duplicates := 0
	for index, draft := range input.Transactions {
		if draft.AmountCents <= 0 || !isValidDate(draft.Date) || !isTransactionKind(string(draft.Kind)) ||
			cleanString(draft.Category) == "" || !isValidDate(draft.Date) {
			return model.BillImportResult{}, errors.New("账单中存在无效记录")
		}
		tradeNo := ""
		if draft.SourceTradeNo != nil {
			tradeNo = cleanString(*draft.SourceTradeNo)
		}
		counterparty := ""
		if draft.Counterparty != nil {
			counterparty = cleanString(*draft.Counterparty)
		}
		key := billDuplicateKey(string(input.Source), tradeNo, draft.Date, counterparty, draft.AmountCents, string(draft.Kind))
		if existing[key] {
			duplicates++
			continue
		}
		existing[key] = true
		id := uuid.NewString()
		item := model.Transaction{
			ID: id, Kind: draft.Kind, AmountCents: draft.AmountCents, Category: cleanString(draft.Category),
			Date: draft.Date, Tag: draft.Tag, Counterparty: counterparty, Source: input.Source,
			SourceTradeNo: tradeNo,
		}
		if item.Tag == "normal" {
			item.Tag = ""
		}
		if draft.Note != nil {
			item.Note = cleanString(*draft.Note)
		}
		if draft.OccurredAt != nil {
			item.OccurredAt = cleanString(*draft.OccurredAt)
		}
		imported = append(imported, item)
		ids = append(ids, id)
		_ = index
	}
	if len(imported) == 0 {
		return model.BillImportResult{ImportedCount: 0, DuplicateCount: duplicates}, nil
	}

	importID := uuid.NewString()
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return model.BillImportResult{}, err
	}
	defer tx.Rollback()
	if _, err = tx.ExecContext(ctx, `
		INSERT INTO bill_imports (id, source, file_name, imported_at) VALUES (?, ?, ?, ?)
	`, importID, string(input.Source), fileName, nowTimestamp()); err != nil {
		return model.BillImportResult{}, err
	}
	for sortIndex, item := range imported {
		item.ImportID = &importID
		if err := insertTransaction(ctx, tx, item); err != nil {
			return model.BillImportResult{}, err
		}
		if _, err = tx.ExecContext(ctx, `
			INSERT INTO bill_import_transactions (import_id, transaction_id, sort_order) VALUES (?, ?, ?)
		`, importID, item.ID, sortIndex); err != nil {
			return model.BillImportResult{}, err
		}
	}
	if err = tx.Commit(); err != nil {
		return model.BillImportResult{}, err
	}
	return model.BillImportResult{ImportedCount: len(imported), DuplicateCount: duplicates, ImportID: &importID}, nil
}

func (s *Store) UndoBillImport(ctx context.Context, importID string) error {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()

	if _, err = tx.ExecContext(ctx, `DELETE FROM transactions WHERE import_id = ?`, importID); err != nil {
		return err
	}
	result, err := tx.ExecContext(ctx, `DELETE FROM bill_imports WHERE id = ?`, importID)
	if err := checkAffected(result, err, "导入批次不存在"); err != nil {
		return err
	}
	return tx.Commit()
}

func resolveTransactionOrder(ctx context.Context, tx *sql.Tx, input model.TransactionInput) (*string, error) {
	if input.NewOrder == nil {
		if input.OrderID != nil && *input.OrderID != "" {
			if err := ensureOrderExists(ctx, tx, *input.OrderID); err != nil {
				return nil, err
			}
			return input.OrderID, nil
		}
		return nil, nil
	}
	validated, err := validatePaymentOrder(*input.NewOrder)
	if err != nil {
		return nil, err
	}
	id := uuid.NewString()
	if _, err = tx.ExecContext(ctx, `
		INSERT INTO payment_orders (id, name, expected_total_cents, created_at) VALUES (?, ?, ?, ?)
	`, id, validated.Name, validated.ExpectedTotalCents, localDate(localToday())); err != nil {
		return nil, err
	}
	return &id, nil
}

func validateTransaction(ctx context.Context, tx *sql.Tx, input model.TransactionUpdateInput, currentID *string) (model.Transaction, error) {
	item := model.Transaction{
		Kind: input.Kind, AmountCents: input.AmountCents, Category: cleanString(input.Category),
		Date: input.Date, Tag: input.Tag, Stage: input.Stage, Source: input.Source,
	}
	if item.Source == "" {
		item.Source = model.BillSource("manual")
	}
	if item.Tag == "normal" {
		item.Tag = ""
	}
	if item.AmountCents <= 0 {
		return item, errors.New("金额必须是大于 0 的整数金额")
	}
	if item.Category == "" {
		return item, errors.New("请选择有效分类")
	}
	if !isValidDate(item.Date) {
		return item, errors.New("请选择有效的记账日期")
	}
	if !isTransactionKind(string(item.Kind)) {
		return item, errors.New("请选择有效的收支类型")
	}
	if item.Stage != "" && !isPaymentStage(string(item.Stage)) {
		return item, errors.New("请选择有效的支付阶段")
	}
	if !isBillSource(string(item.Source)) {
		return item, errors.New("账单来源无效")
	}
	if item.Tag != "" && !isTransactionTag(string(item.Tag)) {
		return item, errors.New("记录标签无效")
	}
	if input.RelatedTransactionID != nil && *input.RelatedTransactionID != "" {
		var relatedID string
		err := tx.QueryRowContext(ctx, `SELECT id FROM transactions WHERE id = ?`, *input.RelatedTransactionID).Scan(&relatedID)
		if errors.Is(err, sql.ErrNoRows) || (currentID != nil && relatedID == *currentID) {
			return item, errors.New("退款关联的原记录不存在")
		}
		if err != nil {
			return item, err
		}
		item.RelatedTransactionID = input.RelatedTransactionID
	}
	if input.RecurringID != nil && *input.RecurringID != "" {
		var recurringID string
		err := tx.QueryRowContext(ctx, `SELECT id FROM recurring_transactions WHERE id = ?`, *input.RecurringID).Scan(&recurringID)
		if errors.Is(err, sql.ErrNoRows) {
			return item, errors.New("周期记录不存在")
		}
		if err != nil {
			return item, err
		}
		item.RecurringID = input.RecurringID
	}
	item.Note = textFromPtr(input.Note)
	item.Counterparty = textFromPtr(input.Counterparty)
	item.SourceTradeNo = textFromPtr(input.SourceTradeNo)
	item.OccurredAt = textFromPtr(input.OccurredAt)
	return item, nil
}

func insertTransaction(ctx context.Context, tx *sql.Tx, item model.Transaction) error {
	_, err := tx.ExecContext(ctx, `
		INSERT INTO transactions (
			id, kind, amount_cents, category, date, note, tag, order_id, stage, recurring_id,
			related_transaction_id, counterparty, source, source_trade_no, occurred_at, import_id, created_at
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	`, item.ID, string(item.Kind), item.AmountCents, item.Category, item.Date, nullStringFromValue(item.Note),
		string(item.Tag), nullStringValue(item.OrderID), string(item.Stage), nullStringValue(item.RecurringID),
		nullStringValue(item.RelatedTransactionID), nullStringFromValue(item.Counterparty), string(item.Source),
		nullStringFromValue(item.SourceTradeNo), nullStringFromValue(item.OccurredAt), nullStringValue(item.ImportID), nowTimestamp())
	return uniqueBillError(err)
}

func validateRecurring(input model.RecurringInput) (model.RecurringInput, error) {
	input.Name = cleanString(input.Name)
	input.Category = cleanString(input.Category)
	input.NextDate = cleanString(input.NextDate)
	if input.Name == "" {
		return input, errors.New("周期记录名称不能为空")
	}
	if input.Category == "" {
		return input, errors.New("请选择有效分类")
	}
	if input.Kind != "expense" && input.Kind != "income" {
		return input, errors.New("周期记录类型无效")
	}
	if input.AmountCents <= 0 {
		return input, errors.New("周期金额必须是大于 0 的整数金额")
	}
	if input.Frequency != "weekly" && input.Frequency != "monthly" && input.Frequency != "yearly" {
		return input, errors.New("请选择有效的重复频率")
	}
	if !isValidDate(input.NextDate) {
		return input, errors.New("请选择有效的下次记录日期")
	}
	return input, nil
}

func ensureOrderExists(ctx context.Context, tx *sql.Tx, id string) error {
	var orderID string
	err := tx.QueryRowContext(ctx, `SELECT id FROM payment_orders WHERE id = ?`, id).Scan(&orderID)
	if errors.Is(err, sql.ErrNoRows) {
		return errors.New("关联订单不存在")
	}
	return err
}

func validatePaymentOrder(input model.PaymentOrderInput) (model.PaymentOrderInput, error) {
	input.Name = cleanString(input.Name)
	if input.Name == "" {
		return input, errors.New("订单名称不能为空")
	}
	if input.ExpectedTotalCents <= 0 {
		return input, errors.New("订单总额必须是大于 0 的整数金额")
	}
	return input, nil
}

func (s *Store) loadBillDuplicateKeys(ctx context.Context) (map[string]bool, error) {
	rows, err := s.db.QueryContext(ctx, `
		SELECT source, source_trade_no, date, counterparty, amount_cents, kind FROM transactions
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	keys := map[string]bool{}
	for rows.Next() {
		var source, kind, date string
		var tradeNo, counterparty sql.NullString
		var amount int64
		if err = rows.Scan(&source, &tradeNo, &date, &counterparty, &amount, &kind); err != nil {
			return nil, err
		}
		key := billDuplicateKey(source, tradeNo.String, date, counterparty.String, amount, kind)
		keys[key] = true
	}
	return keys, rows.Err()
}

func billDuplicateKey(source, tradeNo, date, counterparty string, amount int64, kind string) string {
	if tradeNo != "" {
		return source + ":" + tradeNo
	}
	return fmt.Sprintf("%s:%s:%s:%d:%s", source, date, counterparty, amount, kind)
}

func optionalID(value *string) *string {
	if value == nil || *value == "" {
		return nil
	}
	copied := *value
	return &copied
}

func isTransactionKind(value string) bool {
	return value == "expense" || value == "income" || value == "transfer"
}

func isPaymentStage(value string) bool {
	return value == "deposit" || value == "final" || value == "full"
}

func isBillSource(value string) bool {
	return value == "manual" || value == "alipay" || value == "wechat"
}

func isExternalBillSource(value string) bool {
	return value == "alipay" || value == "wechat"
}

func isTransactionTag(value string) bool {
	return value == "" || value == "normal" || value == "subscription" || value == "refund"
}

func uniqueBillError(err error) error {
	if err != nil && strings.Contains(err.Error(), "transactions_source_trade_no_unique") {
		return errors.New("账单交易单号已存在")
	}
	return err
}

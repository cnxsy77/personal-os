package api_test

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"personal-os/server/internal/model"
)

func decodeState(t *testing.T, response *TestResponse) model.State {
	t.Helper()
	var state model.State
	if err := json.Unmarshal(response.Body.Bytes(), &state); err != nil {
		t.Fatalf("unmarshal state: %v", err)
	}
	return state
}

type TestResponse = httptest.ResponseRecorder

func TestSettingsAndFinanceWriteAPIs(t *testing.T) {
	handler := newTestServer(t)
	headers := map[string]string{"X-Personal-OS-Client": "local"}

	settingsResponse := request(t, handler, http.MethodPatch, "/api/settings", map[string]any{
		"weeklyWorkoutTarget": 4,
		"fontScale":           "large",
		"reducedMotion":       true,
		"expenseCategories":   []string{" 餐饮 ", "交通", "餐饮"},
	}, headers)
	if settingsResponse.Code != http.StatusOK {
		t.Fatalf("settings status = %d, body = %s", settingsResponse.Code, settingsResponse.Body.String())
	}
	settings := decodeState(t, settingsResponse)
	if settings.Settings.WeeklyWorkoutTarget != 4 || settings.Settings.FontScale != "large" || !settings.Settings.ReducedMotion {
		t.Fatalf("unexpected settings: %+v", settings.Settings)
	}
	if len(settings.Settings.ExpenseCategories) != 2 || settings.Settings.ExpenseCategories[0] != "餐饮" {
		t.Fatalf("categories were not normalized: %+v", settings.Settings.ExpenseCategories)
	}

	created := request(t, handler, http.MethodPost, "/api/transactions", map[string]any{
		"kind":        "expense",
		"amountCents": 250000,
		"category":    "电子设备",
		"date":        "2026-09-17",
		"note":        "笔记本定金",
		"tag":         "installment",
		"stage":       "deposit",
		"newOrder":    map[string]any{"name": "笔记本", "expectedTotalCents": 1000000},
	}, headers)
	if created.Code != http.StatusCreated {
		t.Fatalf("create transaction status = %d, body = %s", created.Code, created.Body.String())
	}
	state := decodeState(t, created)
	if len(state.Transactions) != 1 || len(state.PaymentOrders) != 1 {
		t.Fatalf("unexpected transaction state: %+v", state)
	}
	transactionID := state.Transactions[0].ID
	orderID := state.PaymentOrders[0].ID
	if state.Transactions[0].OrderID == nil || *state.Transactions[0].OrderID != orderID {
		t.Fatalf("transaction was not linked to its new order")
	}
	if state.Transactions[0].Tag != model.TransactionTag("installment") {
		t.Fatalf("transaction tag was not retained: %+v", state.Transactions[0])
	}

	updated := request(t, handler, http.MethodPatch, "/api/transactions/"+transactionID, map[string]any{
		"kind": "expense", "amountCents": 260000, "category": "电子设备", "date": "2026-09-18",
		"orderId": orderID, "stage": "deposit", "source": "manual", "tag": "installment",
	}, headers)
	if updated.Code != http.StatusOK {
		t.Fatalf("update transaction status = %d, body = %s", updated.Code, updated.Body.String())
	}
	if got := decodeState(t, updated); len(got.Transactions) != 1 || got.Transactions[0].AmountCents != 260000 || got.Transactions[0].Date != "2026-09-18" || got.Transactions[0].Tag != model.TransactionTag("installment") {
		t.Fatalf("transaction update failed: %+v", got.Transactions)
	}

	recurringResponse := request(t, handler, http.MethodPost, "/api/recurring-transactions", map[string]any{
		"name": "房租", "kind": "expense", "amountCents": 300000, "category": "居住",
		"frequency": "monthly", "nextDate": "2026-10-01", "note": "每月一号",
	}, headers)
	if recurringResponse.Code != http.StatusCreated {
		t.Fatalf("create recurring status = %d, body = %s", recurringResponse.Code, recurringResponse.Body.String())
	}
	recurringState := decodeState(t, recurringResponse)
	if len(recurringState.RecurringTransactions) != 1 {
		t.Fatalf("recurring was not created")
	}
	recurringID := recurringState.RecurringTransactions[0].ID
	recorded := request(t, handler, http.MethodPost, "/api/recurring-transactions/"+recurringID+"/record", map[string]any{"date": ""}, headers)
	if recorded.Code != http.StatusCreated {
		t.Fatalf("record recurring status = %d, body = %s", recorded.Code, recorded.Body.String())
	}
	recordedState := decodeState(t, recorded)
	if len(recordedState.Transactions) != 2 || recordedState.RecurringTransactions[0].NextDate != "2026-11-01" {
		t.Fatalf("unexpected recurring record state: %+v", recordedState)
	}

	importResponse := request(t, handler, http.MethodPost, "/api/bill-imports", map[string]any{
		"source": "alipay", "fileName": "alipay.csv",
		"transactions": []any{
			map[string]any{"kind": "expense", "amountCents": 4200, "category": "餐饮", "date": "2026-09-17", "sourceTradeNo": "trade-1"},
			map[string]any{"kind": "expense", "amountCents": 4200, "category": "餐饮", "date": "2026-09-17", "sourceTradeNo": "trade-1"},
		},
	}, headers)
	if importResponse.Code != http.StatusOK {
		t.Fatalf("import status = %d, body = %s", importResponse.Code, importResponse.Body.String())
	}
	var importResult model.BillImportResult
	if err := json.Unmarshal(importResponse.Body.Bytes(), &importResult); err != nil {
		t.Fatalf("unmarshal import result: %v", err)
	}
	if importResult.ImportedCount != 1 || importResult.DuplicateCount != 1 || importResult.ImportID == nil {
		t.Fatalf("unexpected import result: %+v", importResult)
	}
	importedState := decodeState(t, request(t, handler, http.MethodGet, "/api/state", nil, nil))
	if len(importedState.BillImports) != 1 || len(importedState.Transactions) != 3 {
		t.Fatalf("imported state changed incorrectly: transactions=%d imports=%d", len(importedState.Transactions), len(importedState.BillImports))
	}

	undoResponse := request(t, handler, http.MethodDelete, "/api/bill-imports/"+*importResult.ImportID, nil, headers)
	if undoResponse.Code != http.StatusOK {
		t.Fatalf("undo import status = %d, body = %s", undoResponse.Code, undoResponse.Body.String())
	}
	undoState := decodeState(t, undoResponse)
	if len(undoState.BillImports) != 0 || len(undoState.Transactions) != 2 {
		t.Fatalf("undo did not remove only imported transactions: %+v", undoState)
	}

	deletedOrder := request(t, handler, http.MethodDelete, "/api/payment-orders/"+orderID, nil, headers)
	if deletedOrder.Code != http.StatusOK {
		t.Fatalf("delete order status = %d", deletedOrder.Code)
	}
	orderState := decodeState(t, deletedOrder)
	if len(orderState.PaymentOrders) != 0 || orderState.Transactions[0].OrderID != nil || orderState.Transactions[0].Stage != "" {
		t.Fatalf("order deletion did not clear its links: %+v", orderState.Transactions[0])
	}

	deletedRecurring := request(t, handler, http.MethodDelete, "/api/recurring-transactions/"+recurringID, nil, headers)
	if deletedRecurring.Code != http.StatusOK {
		t.Fatalf("delete recurring status = %d", deletedRecurring.Code)
	}
	recurringDeleteState := decodeState(t, deletedRecurring)
	if len(recurringDeleteState.RecurringTransactions) != 0 || recurringDeleteState.Transactions[0].RecurringID != nil {
		t.Fatalf("recurring deletion did not preserve its transaction")
	}

	if invalid := request(t, handler, http.MethodPost, "/api/transactions", map[string]any{
		"kind": "expense", "amountCents": 0, "category": "", "date": "bad",
	}, headers); invalid.Code != http.StatusBadRequest {
		t.Fatalf("invalid transaction status = %d", invalid.Code)
	}
	if missing := request(t, handler, http.MethodDelete, "/api/transactions/not-found", nil, headers); missing.Code != http.StatusNotFound {
		t.Fatalf("missing transaction status = %d", missing.Code)
	}
}

func TestRenameCategoryUpdatesSettingsAndRecords(t *testing.T) {
	handler := newTestServer(t)
	headers := map[string]string{"X-Personal-OS-Client": "local"}
	created := request(t, handler, http.MethodPost, "/api/transactions", map[string]any{
		"kind": "expense", "amountCents": 1000, "category": "餐饮", "date": "2026-09-17",
	}, headers)
	if created.Code != http.StatusCreated {
		t.Fatalf("create status = %d", created.Code)
	}
	renamed := request(t, handler, http.MethodPost, "/api/settings/categories/rename", map[string]any{
		"kind": "expense", "from": "餐饮", "to": "吃饭",
	}, headers)
	if renamed.Code != http.StatusOK {
		t.Fatalf("rename status = %d, body = %s", renamed.Code, renamed.Body.String())
	}
	state := decodeState(t, renamed)
	if state.Transactions[0].Category != "吃饭" || !containsString(state.Settings.ExpenseCategories, "吃饭") || containsString(state.Settings.ExpenseCategories, "餐饮") {
		t.Fatalf("rename failed: %+v", state)
	}
}

func containsString(values []string, expected string) bool {
	for _, value := range values {
		if value == expected {
			return true
		}
	}
	return false
}

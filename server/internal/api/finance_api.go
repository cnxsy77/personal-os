package api

import (
	"net/http"

	"personal-os/server/internal/model"
)

func (s *Server) createTransaction(w http.ResponseWriter, r *http.Request) {
	var input model.TransactionInput
	if err := decode(r, &input); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_input", err.Error())
		return
	}
	if err := s.store.RecordTransaction(r.Context(), input); err != nil {
		writeStoreError(w, err)
		return
	}
	s.returnState(w, r, http.StatusCreated)
}

func (s *Server) updateTransaction(w http.ResponseWriter, r *http.Request) {
	var input model.TransactionUpdateInput
	if err := decode(r, &input); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_input", err.Error())
		return
	}
	if err := s.store.UpdateTransaction(r.Context(), r.PathValue("id"), input); err != nil {
		writeStoreError(w, err)
		return
	}
	s.returnState(w, r, http.StatusOK)
}

func (s *Server) deleteTransaction(w http.ResponseWriter, r *http.Request) {
	if err := s.store.DeleteTransaction(r.Context(), r.PathValue("id")); err != nil {
		writeStoreError(w, err)
		return
	}
	s.returnState(w, r, http.StatusOK)
}

func (s *Server) saveRecurringTransaction(w http.ResponseWriter, r *http.Request) {
	var input model.RecurringInput
	if err := decode(r, &input); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_input", err.Error())
		return
	}
	if err := s.store.SaveRecurringTransaction(r.Context(), input); err != nil {
		writeStoreError(w, err)
		return
	}
	if input.ID == nil || *input.ID == "" {
		s.returnState(w, r, http.StatusCreated)
		return
	}
	s.returnState(w, r, http.StatusOK)
}

func (s *Server) setRecurringTransactionStatus(w http.ResponseWriter, r *http.Request) {
	var input struct {
		Active bool `json:"active"`
	}
	if err := decode(r, &input); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_input", err.Error())
		return
	}
	if err := s.store.SetRecurringTransactionStatus(r.Context(), r.PathValue("id"), input.Active); err != nil {
		writeStoreError(w, err)
		return
	}
	s.returnState(w, r, http.StatusOK)
}

func (s *Server) recordRecurringTransaction(w http.ResponseWriter, r *http.Request) {
	var input struct {
		Date string `json:"date"`
	}
	if err := decode(r, &input); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_input", err.Error())
		return
	}
	if err := s.store.RecordRecurringTransaction(r.Context(), r.PathValue("id"), input.Date); err != nil {
		writeStoreError(w, err)
		return
	}
	s.returnState(w, r, http.StatusCreated)
}

func (s *Server) deleteRecurringTransaction(w http.ResponseWriter, r *http.Request) {
	if err := s.store.DeleteRecurringTransaction(r.Context(), r.PathValue("id")); err != nil {
		writeStoreError(w, err)
		return
	}
	s.returnState(w, r, http.StatusOK)
}

func (s *Server) createPaymentOrder(w http.ResponseWriter, r *http.Request) {
	var input model.PaymentOrderInput
	if err := decode(r, &input); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_input", err.Error())
		return
	}
	if _, err := s.store.CreatePaymentOrder(r.Context(), input); err != nil {
		writeStoreError(w, err)
		return
	}
	s.returnState(w, r, http.StatusCreated)
}

func (s *Server) updatePaymentOrder(w http.ResponseWriter, r *http.Request) {
	var input model.PaymentOrderInput
	if err := decode(r, &input); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_input", err.Error())
		return
	}
	if err := s.store.UpdatePaymentOrder(r.Context(), r.PathValue("id"), input); err != nil {
		writeStoreError(w, err)
		return
	}
	s.returnState(w, r, http.StatusOK)
}

func (s *Server) deletePaymentOrder(w http.ResponseWriter, r *http.Request) {
	if err := s.store.DeletePaymentOrder(r.Context(), r.PathValue("id")); err != nil {
		writeStoreError(w, err)
		return
	}
	s.returnState(w, r, http.StatusOK)
}

func (s *Server) importBillTransactions(w http.ResponseWriter, r *http.Request) {
	var input model.BillImportInput
	if err := decode(r, &input); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_input", err.Error())
		return
	}
	result, err := s.store.ImportBillTransactions(r.Context(), input)
	if err != nil {
		writeStoreError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, result)
}

func (s *Server) undoBillImport(w http.ResponseWriter, r *http.Request) {
	if err := s.store.UndoBillImport(r.Context(), r.PathValue("id")); err != nil {
		writeStoreError(w, err)
		return
	}
	s.returnState(w, r, http.StatusOK)
}

func (s *Server) updateSettings(w http.ResponseWriter, r *http.Request) {
	var input model.SettingsInput
	if err := decode(r, &input); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_input", err.Error())
		return
	}
	if err := s.store.UpdateSettings(r.Context(), input); err != nil {
		writeStoreError(w, err)
		return
	}
	s.returnState(w, r, http.StatusOK)
}

func (s *Server) updateMonthlyBudget(w http.ResponseWriter, r *http.Request) {
	var input struct {
		AmountCents int64 `json:"amountCents"`
	}
	if err := decode(r, &input); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_input", err.Error())
		return
	}
	if err := s.store.UpdateMonthlyBudget(r.Context(), input.AmountCents); err != nil {
		writeStoreError(w, err)
		return
	}
	s.returnState(w, r, http.StatusOK)
}

func (s *Server) renameCategory(w http.ResponseWriter, r *http.Request) {
	var input model.RenameCategoryInput
	if err := decode(r, &input); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_input", err.Error())
		return
	}
	if err := s.store.RenameCategory(r.Context(), input.Kind, input.From, input.To); err != nil {
		writeStoreError(w, err)
		return
	}
	s.returnState(w, r, http.StatusOK)
}

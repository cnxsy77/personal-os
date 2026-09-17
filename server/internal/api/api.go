package api

import (
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"net/url"
	"strings"

	"personal-os/server/internal/model"
	"personal-os/server/internal/store"
)

type Server struct {
	store *store.Store
}

func New(store *store.Store) *Server {
	return &Server{store: store}
}

func (s *Server) Handler() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /api/state", s.getState)
	mux.HandleFunc("POST /api/quick-task", s.write(func(w http.ResponseWriter, r *http.Request) {
		s.createQuickTask(w, r)
	}))
	mux.HandleFunc("POST /api/tasks", s.write(func(w http.ResponseWriter, r *http.Request) {
		s.createTask(w, r)
	}))
	mux.HandleFunc("POST /api/tasks/{id}/toggle", s.write(func(w http.ResponseWriter, r *http.Request) {
		s.toggleTask(w, r)
	}))
	mux.HandleFunc("PATCH /api/tasks/{id}", s.write(func(w http.ResponseWriter, r *http.Request) {
		s.updateTask(w, r)
	}))
	mux.HandleFunc("DELETE /api/tasks/{id}", s.write(func(w http.ResponseWriter, r *http.Request) {
		s.deleteTask(w, r)
	}))
	mux.HandleFunc("POST /api/projects", s.write(s.createProject))
	mux.HandleFunc("PATCH /api/projects/{id}", s.write(s.updateProject))
	mux.HandleFunc("PATCH /api/projects/{id}/status", s.write(s.setProjectStatus))
	mux.HandleFunc("DELETE /api/projects/{id}", s.write(s.deleteProject))
	mux.HandleFunc("PATCH /api/settings", s.write(s.updateSettings))
	mux.HandleFunc("PATCH /api/settings/budget", s.write(s.updateMonthlyBudget))
	mux.HandleFunc("POST /api/settings/categories/rename", s.write(s.renameCategory))
	mux.HandleFunc("POST /api/transactions", s.write(s.createTransaction))
	mux.HandleFunc("PATCH /api/transactions/{id}", s.write(s.updateTransaction))
	mux.HandleFunc("DELETE /api/transactions/{id}", s.write(s.deleteTransaction))
	mux.HandleFunc("POST /api/recurring-transactions", s.write(s.saveRecurringTransaction))
	mux.HandleFunc("PATCH /api/recurring-transactions/{id}/status", s.write(s.setRecurringTransactionStatus))
	mux.HandleFunc("POST /api/recurring-transactions/{id}/record", s.write(s.recordRecurringTransaction))
	mux.HandleFunc("DELETE /api/recurring-transactions/{id}", s.write(s.deleteRecurringTransaction))
	mux.HandleFunc("POST /api/payment-orders", s.write(s.createPaymentOrder))
	mux.HandleFunc("PATCH /api/payment-orders/{id}", s.write(s.updatePaymentOrder))
	mux.HandleFunc("DELETE /api/payment-orders/{id}", s.write(s.deletePaymentOrder))
	mux.HandleFunc("POST /api/bill-imports", s.write(s.importBillTransactions))
	mux.HandleFunc("DELETE /api/bill-imports/{id}", s.write(s.undoBillImport))
	mux.HandleFunc("GET /healthz", func(w http.ResponseWriter, r *http.Request) {
		writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
	})
	return s.securityMiddleware(mux)
}

func (s *Server) securityMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		origin := r.Header.Get("Origin")
		if origin != "" && !isAllowedOrigin(origin) {
			writeError(w, http.StatusForbidden, "forbidden_origin", "只允许本机开发页面访问")
			return
		}
		if r.Method != http.MethodGet && r.Method != http.MethodHead && r.Method != http.MethodOptions {
			if r.Header.Get("X-Personal-OS-Client") != "local" {
				writeError(w, http.StatusForbidden, "missing_client_header", "缺少本地客户端标识")
				return
			}
		}
		if origin != "" {
			w.Header().Set("Access-Control-Allow-Origin", origin)
			w.Header().Set("Vary", "Origin")
		}
		next.ServeHTTP(w, r)
	})
}

func isAllowedOrigin(origin string) bool {
	parsed, err := url.Parse(origin)
	if err != nil || parsed.Scheme != "http" {
		return false
	}
	switch parsed.Hostname() {
	case "localhost", "127.0.0.1", "::1":
		return true
	default:
		return false
	}
}

func (s *Server) write(handler http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		handler(w, r)
	}
}

func (s *Server) getState(w http.ResponseWriter, r *http.Request) {
	state, err := s.store.LoadState(r.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, "state_error", err.Error())
		return
	}
	writeJSON(w, http.StatusOK, state)
}

func (s *Server) createTask(w http.ResponseWriter, r *http.Request) {
	var input model.TaskInput
	if err := decode(r, &input); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_input", err.Error())
		return
	}
	if _, err := s.store.CreateTask(r.Context(), input, false); err != nil {
		writeStoreError(w, err)
		return
	}
	s.returnState(w, r, http.StatusCreated)
}

func (s *Server) createQuickTask(w http.ResponseWriter, r *http.Request) {
	var input struct {
		Title string `json:"title"`
	}
	if err := decode(r, &input); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_input", err.Error())
		return
	}
	if strings.TrimSpace(input.Title) == "" {
		writeError(w, http.StatusBadRequest, "invalid_input", "快速记录内容不能为空")
		return
	}
	if _, err := s.store.CreateQuickTask(r.Context(), input.Title); err != nil {
		writeStoreError(w, err)
		return
	}
	s.returnState(w, r, http.StatusCreated)
}

func (s *Server) toggleTask(w http.ResponseWriter, r *http.Request) {
	if err := s.store.ToggleTask(r.Context(), r.PathValue("id")); err != nil {
		writeStoreError(w, err)
		return
	}
	s.returnState(w, r, http.StatusOK)
}

func (s *Server) updateTask(w http.ResponseWriter, r *http.Request) {
	var input model.TaskInput
	if err := decode(r, &input); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_input", err.Error())
		return
	}
	if err := s.store.UpdateTask(r.Context(), r.PathValue("id"), input); err != nil {
		writeStoreError(w, err)
		return
	}
	s.returnState(w, r, http.StatusOK)
}

func (s *Server) deleteTask(w http.ResponseWriter, r *http.Request) {
	if err := s.store.DeleteTask(r.Context(), r.PathValue("id")); err != nil {
		writeStoreError(w, err)
		return
	}
	s.returnState(w, r, http.StatusOK)
}

func (s *Server) createProject(w http.ResponseWriter, r *http.Request) {
	var input model.ProjectInput
	if err := decode(r, &input); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_input", err.Error())
		return
	}
	if err := s.store.CreateProject(r.Context(), input); err != nil {
		writeStoreError(w, err)
		return
	}
	s.returnState(w, r, http.StatusCreated)
}

func (s *Server) updateProject(w http.ResponseWriter, r *http.Request) {
	var input model.ProjectInput
	if err := decode(r, &input); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_input", err.Error())
		return
	}
	if err := s.store.UpdateProject(r.Context(), r.PathValue("id"), input); err != nil {
		writeStoreError(w, err)
		return
	}
	s.returnState(w, r, http.StatusOK)
}

func (s *Server) setProjectStatus(w http.ResponseWriter, r *http.Request) {
	var input struct {
		Status model.ProjectStatus `json:"status"`
	}
	if err := decode(r, &input); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_input", err.Error())
		return
	}
	if err := s.store.SetProjectStatus(r.Context(), r.PathValue("id"), input.Status); err != nil {
		writeStoreError(w, err)
		return
	}
	s.returnState(w, r, http.StatusOK)
}

func (s *Server) deleteProject(w http.ResponseWriter, r *http.Request) {
	if err := s.store.DeleteProject(r.Context(), r.PathValue("id")); err != nil {
		writeStoreError(w, err)
		return
	}
	s.returnState(w, r, http.StatusOK)
}

func (s *Server) returnState(w http.ResponseWriter, r *http.Request, status int) {
	state, err := s.store.LoadState(r.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, "state_error", err.Error())
		return
	}
	writeJSON(w, status, state)
}

func decode(r *http.Request, value any) error {
	decoder := json.NewDecoder(io.LimitReader(r.Body, 1024*1024))
	defer r.Body.Close()
	if err := decoder.Decode(value); err != nil {
		return errors.New("请求体不是有效 JSON")
	}
	return nil
}

func writeStoreError(w http.ResponseWriter, err error) {
	message := err.Error()
	switch message {
	case "计划任务不存在", "项目不存在", "记账记录不存在", "周期记录不存在", "订单不存在", "导入批次不存在":
		writeError(w, http.StatusNotFound, "not_found", message)
	default:
		writeError(w, http.StatusBadRequest, "invalid_input", message)
	}
}

func writeError(w http.ResponseWriter, status int, code, message string) {
	writeJSON(w, status, map[string]string{"code": code, "message": message})
}

func writeJSON(w http.ResponseWriter, status int, value any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(value)
}

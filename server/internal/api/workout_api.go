package api

import (
	"net/http"

	"personal-os/server/internal/model"
)

func (s *Server) createWorkout(w http.ResponseWriter, r *http.Request) {
	var input model.WorkoutInput
	if err := decode(r, &input); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_input", err.Error())
		return
	}
	if err := s.store.RecordWorkout(r.Context(), input); err != nil {
		writeStoreError(w, err)
		return
	}
	s.returnState(w, r, http.StatusCreated)
}

func (s *Server) updateWorkout(w http.ResponseWriter, r *http.Request) {
	var input model.WorkoutInput
	if err := decode(r, &input); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_input", err.Error())
		return
	}
	if err := s.store.UpdateWorkout(r.Context(), r.PathValue("id"), input); err != nil {
		writeStoreError(w, err)
		return
	}
	s.returnState(w, r, http.StatusOK)
}

func (s *Server) deleteWorkout(w http.ResponseWriter, r *http.Request) {
	if err := s.store.DeleteWorkout(r.Context(), r.PathValue("id")); err != nil {
		writeStoreError(w, err)
		return
	}
	s.returnState(w, r, http.StatusOK)
}

func (s *Server) setWorkoutStatus(w http.ResponseWriter, r *http.Request) {
	var input struct {
		Status model.WorkoutStatus `json:"status"`
	}
	if err := decode(r, &input); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_input", err.Error())
		return
	}
	if err := s.store.SetWorkoutStatus(r.Context(), r.PathValue("id"), input.Status); err != nil {
		writeStoreError(w, err)
		return
	}
	s.returnState(w, r, http.StatusOK)
}

func (s *Server) saveHealthMetric(w http.ResponseWriter, r *http.Request) {
	var input model.HealthMetricInput
	if err := decode(r, &input); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_input", err.Error())
		return
	}
	if pathID := r.PathValue("id"); pathID != "" {
		if err := s.store.UpdateHealthMetric(r.Context(), pathID, input); err != nil {
			writeStoreError(w, err)
			return
		}
		s.returnState(w, r, http.StatusOK)
		return
	}
	if err := s.store.SaveHealthMetric(r.Context(), input); err != nil {
		writeStoreError(w, err)
		return
	}
	s.returnState(w, r, http.StatusCreated)
}

func (s *Server) deleteHealthMetric(w http.ResponseWriter, r *http.Request) {
	if err := s.store.DeleteHealthMetric(r.Context(), r.PathValue("id")); err != nil {
		writeStoreError(w, err)
		return
	}
	s.returnState(w, r, http.StatusOK)
}

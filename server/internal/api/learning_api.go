package api

import (
	"net/http"

	"personal-os/server/internal/model"
)

func (s *Server) createStudyLog(w http.ResponseWriter, r *http.Request) {
	var input model.StudyLogInput
	if err := decode(r, &input); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_input", err.Error())
		return
	}
	if err := s.store.RecordStudyLog(r.Context(), input); err != nil {
		writeStoreError(w, err)
		return
	}
	s.returnState(w, r, http.StatusCreated)
}

func (s *Server) updateStudyLog(w http.ResponseWriter, r *http.Request) {
	var input model.StudyLogInput
	if err := decode(r, &input); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_input", err.Error())
		return
	}
	if err := s.store.UpdateStudyLog(r.Context(), r.PathValue("id"), input); err != nil {
		writeStoreError(w, err)
		return
	}
	s.returnState(w, r, http.StatusOK)
}

func (s *Server) deleteStudyLog(w http.ResponseWriter, r *http.Request) {
	if err := s.store.DeleteStudyLog(r.Context(), r.PathValue("id")); err != nil {
		writeStoreError(w, err)
		return
	}
	s.returnState(w, r, http.StatusOK)
}

func (s *Server) createLearningPath(w http.ResponseWriter, r *http.Request) {
	var input model.LearningPathInput
	if err := decode(r, &input); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_input", err.Error())
		return
	}
	if err := s.store.CreateLearningPath(r.Context(), input); err != nil {
		writeStoreError(w, err)
		return
	}
	s.returnState(w, r, http.StatusCreated)
}

func (s *Server) updateLearningPath(w http.ResponseWriter, r *http.Request) {
	var input model.LearningPathInput
	if err := decode(r, &input); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_input", err.Error())
		return
	}
	if err := s.store.UpdateLearningPath(r.Context(), r.PathValue("id"), input); err != nil {
		writeStoreError(w, err)
		return
	}
	s.returnState(w, r, http.StatusOK)
}

func (s *Server) deleteLearningPath(w http.ResponseWriter, r *http.Request) {
	if err := s.store.DeleteLearningPath(r.Context(), r.PathValue("id")); err != nil {
		writeStoreError(w, err)
		return
	}
	s.returnState(w, r, http.StatusOK)
}

func (s *Server) createLearningResource(w http.ResponseWriter, r *http.Request) {
	var input model.LearningResourceInput
	if err := decode(r, &input); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_input", err.Error())
		return
	}
	if err := s.store.CreateLearningResource(r.Context(), input); err != nil {
		writeStoreError(w, err)
		return
	}
	s.returnState(w, r, http.StatusCreated)
}

func (s *Server) updateLearningResource(w http.ResponseWriter, r *http.Request) {
	var input model.LearningResourceInput
	if err := decode(r, &input); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_input", err.Error())
		return
	}
	if err := s.store.UpdateLearningResource(r.Context(), r.PathValue("id"), input); err != nil {
		writeStoreError(w, err)
		return
	}
	s.returnState(w, r, http.StatusOK)
}

func (s *Server) deleteLearningResource(w http.ResponseWriter, r *http.Request) {
	if err := s.store.DeleteLearningResource(r.Context(), r.PathValue("id")); err != nil {
		writeStoreError(w, err)
		return
	}
	s.returnState(w, r, http.StatusOK)
}

func (s *Server) setLearningResourceStatus(w http.ResponseWriter, r *http.Request) {
	var input struct {
		Status string `json:"status"`
	}
	if err := decode(r, &input); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_input", err.Error())
		return
	}
	if err := s.store.SetLearningResourceStatus(r.Context(), r.PathValue("id"), input.Status); err != nil {
		writeStoreError(w, err)
		return
	}
	s.returnState(w, r, http.StatusOK)
}

func (s *Server) addLearningLessons(w http.ResponseWriter, r *http.Request) {
	var input model.LearningLessonsInput
	if err := decode(r, &input); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_input", err.Error())
		return
	}
	if input.ResourceID == "" {
		input.ResourceID = r.PathValue("id")
	}
	if err := s.store.AddLearningLessons(r.Context(), input); err != nil {
		writeStoreError(w, err)
		return
	}
	s.returnState(w, r, http.StatusCreated)
}

func (s *Server) updateLearningLesson(w http.ResponseWriter, r *http.Request) {
	var input model.LearningLessonUpdateInput
	if err := decode(r, &input); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_input", err.Error())
		return
	}
	if err := s.store.UpdateLearningLesson(r.Context(), r.PathValue("id"), input); err != nil {
		writeStoreError(w, err)
		return
	}
	s.returnState(w, r, http.StatusOK)
}

func (s *Server) setLearningLessonStatus(w http.ResponseWriter, r *http.Request) {
	var input struct {
		Status string `json:"status"`
	}
	if err := decode(r, &input); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_input", err.Error())
		return
	}
	if err := s.store.SetLearningLessonStatus(r.Context(), r.PathValue("id"), input.Status); err != nil {
		writeStoreError(w, err)
		return
	}
	s.returnState(w, r, http.StatusOK)
}

func (s *Server) deleteLearningLesson(w http.ResponseWriter, r *http.Request) {
	if err := s.store.DeleteLearningLesson(r.Context(), r.PathValue("id")); err != nil {
		writeStoreError(w, err)
		return
	}
	s.returnState(w, r, http.StatusOK)
}

func (s *Server) createLearningNoteFolder(w http.ResponseWriter, r *http.Request) {
	var input model.NoteFolderInput
	if err := decode(r, &input); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_input", err.Error())
		return
	}
	if err := s.store.CreateLearningNoteFolder(r.Context(), input.Name); err != nil {
		writeStoreError(w, err)
		return
	}
	s.returnState(w, r, http.StatusCreated)
}

func (s *Server) updateLearningNoteFolder(w http.ResponseWriter, r *http.Request) {
	var input model.NoteFolderInput
	if err := decode(r, &input); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_input", err.Error())
		return
	}
	if err := s.store.UpdateLearningNoteFolder(r.Context(), r.PathValue("id"), input.Name); err != nil {
		writeStoreError(w, err)
		return
	}
	s.returnState(w, r, http.StatusOK)
}

func (s *Server) deleteLearningNoteFolder(w http.ResponseWriter, r *http.Request) {
	if err := s.store.DeleteLearningNoteFolder(r.Context(), r.PathValue("id")); err != nil {
		writeStoreError(w, err)
		return
	}
	s.returnState(w, r, http.StatusOK)
}

func (s *Server) saveLearningNote(w http.ResponseWriter, r *http.Request) {
	var input model.LearningNoteInput
	if err := decode(r, &input); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_input", err.Error())
		return
	}
	if pathID := r.PathValue("id"); pathID != "" {
		input.ID = &pathID
	}
	if err := s.store.SaveLearningNote(r.Context(), input); err != nil {
		writeStoreError(w, err)
		return
	}
	if input.ID != nil && *input.ID != "" {
		s.returnState(w, r, http.StatusOK)
		return
	}
	s.returnState(w, r, http.StatusCreated)
}

func (s *Server) deleteLearningNote(w http.ResponseWriter, r *http.Request) {
	if err := s.store.DeleteLearningNote(r.Context(), r.PathValue("id")); err != nil {
		writeStoreError(w, err)
		return
	}
	s.returnState(w, r, http.StatusOK)
}

func (s *Server) saveWeeklyReview(w http.ResponseWriter, r *http.Request) {
	var input model.WeeklyReviewInput
	if err := decode(r, &input); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_input", err.Error())
		return
	}
	if err := s.store.SaveWeeklyReview(r.Context(), input); err != nil {
		writeStoreError(w, err)
		return
	}
	s.returnState(w, r, http.StatusCreated)
}

func (s *Server) updateWeeklyReview(w http.ResponseWriter, r *http.Request) {
	var input model.WeeklyReviewInput
	if err := decode(r, &input); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_input", err.Error())
		return
	}
	if err := s.store.UpdateWeeklyReview(r.Context(), r.PathValue("id"), input); err != nil {
		writeStoreError(w, err)
		return
	}
	s.returnState(w, r, http.StatusOK)
}

func (s *Server) deleteWeeklyReview(w http.ResponseWriter, r *http.Request) {
	if err := s.store.DeleteWeeklyReview(r.Context(), r.PathValue("id")); err != nil {
		writeStoreError(w, err)
		return
	}
	s.returnState(w, r, http.StatusOK)
}

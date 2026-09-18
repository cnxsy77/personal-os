package ai

import (
	"encoding/json"
	"fmt"
	"time"

	"personal-os/server/internal/model"
)

type PeriodInfo struct {
	Period string `json:"period"`
	Key    string `json:"key"`
	Start  string `json:"start"`
	End    string `json:"end"`
	Label  string `json:"label"`
}

func PeriodRange(period string, now time.Time) (PeriodInfo, error) {
	local := now.Local()
	date := func(value time.Time) string {
		return value.Format("2006-01-02")
	}

	switch period {
	case "daily":
		return PeriodInfo{
			Period: period,
			Key:    local.Format("2006-01-02"),
			Start:  date(local),
			End:    date(local),
			Label:  "每日",
		}, nil
	case "weekly":
		year, week := local.ISOWeek()
		weekday := int(local.Weekday())
		if weekday == 0 {
			weekday = 7
		}
		start := local.AddDate(0, 0, weekday-1)
		end := start.AddDate(0, 0, 6)
		return PeriodInfo{
			Period: period,
			Key:    fmt.Sprintf("%d-W%02d", year, week),
			Start:  date(start),
			End:    date(end),
			Label:  "每周",
		}, nil
	case "monthly":
		start := time.Date(local.Year(), local.Month(), 1, 0, 0, 0, 0, local.Location())
		end := start.AddDate(0, 1, -1)
		return PeriodInfo{
			Period: period,
			Key:    local.Format("2006-01"),
			Start:  date(start),
			End:    date(end),
			Label:  "每月",
		}, nil
	default:
		return PeriodInfo{}, fmt.Errorf("无效的总结周期: %s", period)
	}
}

type financeRecord struct {
	Date         string  `json:"date"`
	Direction    string  `json:"direction"`
	Category     string  `json:"category"`
	Counterparty string  `json:"counterparty,omitempty"`
	Note         string  `json:"note,omitempty"`
	AmountYuan   float64 `json:"amountYuan"`
	Tag          string  `json:"tag,omitempty"`
	Source       string  `json:"source,omitempty"`
}

type workoutRecord struct {
	Date      string   `json:"date"`
	Kinds     []string `json:"kinds"`
	Focus     string   `json:"focus,omitempty"`
	Minutes   int      `json:"minutes"`
	Exercises []string `json:"exercises,omitempty"`
	Notes     string   `json:"notes,omitempty"`
}

type studyRecord struct {
	Date     string `json:"date"`
	Topic    string `json:"topic"`
	Minutes  int    `json:"minutes"`
	CourseID string `json:"courseId,omitempty"`
	LessonID string `json:"lessonId,omitempty"`
	Note     string `json:"note,omitempty"`
}

func BuildContext(state model.State, scope string, period PeriodInfo) (string, error) {
	context := map[string]any{
		"summaryPeriod":       period,
		"scope":               scope,
		"weeklyWorkoutTarget": state.Settings.WeeklyWorkoutTarget,
	}

	if scope == "all" || scope == "finance" {
		transactions := []financeRecord{}
		for _, item := range state.Transactions {
			if item.Date < period.Start || item.Date > period.End {
				continue
			}
			transactions = append(transactions, financeRecord{
				Date:         item.Date,
				Direction:    string(item.Kind),
				Category:     item.Category,
				Counterparty: item.Counterparty,
				Note:         item.Note,
				AmountYuan:   float64(item.AmountCents) / 100,
				Tag:          string(item.Tag),
				Source:       string(item.Source),
			})
		}
		context["monthlyBudgetYuan"] = float64(state.MonthlyBudgetCents) / 100
		context["transactions"] = transactions
		context["recurringTransactions"] = state.RecurringTransactions
		context["paymentOrders"] = state.PaymentOrders
	}

	if scope == "all" || scope == "health" {
		workouts := []workoutRecord{}
		for _, item := range state.Workouts {
			if item.Date < period.Start || item.Date > period.End {
				continue
			}
			kinds := make([]string, 0, len(item.Kinds))
			for _, kind := range item.Kinds {
				kinds = append(kinds, string(kind))
			}
			if len(kinds) == 0 {
				kinds = []string{string(item.Kind)}
			}
			exerciseNames := []string{}
			for _, exercise := range item.Exercises {
				name := exercise.Name
				if exercise.Prescription != "" {
					name += " " + exercise.Prescription
				}
				exerciseNames = append(exerciseNames, name)
			}
			workouts = append(workouts, workoutRecord{
				Date:      item.Date,
				Kinds:     kinds,
				Focus:     item.Focus,
				Minutes:   item.DurationMinutes,
				Exercises: exerciseNames,
				Notes:     item.Notes,
			})
		}
		healthMetrics := []model.HealthMetric{}
		for _, item := range state.HealthMetrics {
			if item.Date >= period.Start && item.Date <= period.End {
				healthMetrics = append(healthMetrics, item)
			}
		}
		context["workouts"] = workouts
		context["healthMetrics"] = healthMetrics
	}

	if scope == "all" || scope == "learning" {
		studyLogs := []studyRecord{}
		for _, item := range state.StudyLogs {
			if item.Date < period.Start || item.Date > period.End {
				continue
			}
			studyLogs = append(studyLogs, studyRecord{
				Date:     item.Date,
				Topic:    item.Topic,
				Minutes:  item.Minutes,
				CourseID: dereference(item.ResourceID),
				LessonID: dereference(item.LessonID),
				Note:     item.Note,
			})
		}
		context["studyLogs"] = studyLogs
		context["learningPaths"] = state.LearningPaths
		context["learningResources"] = state.LearningResources
		context["learningLessons"] = state.LearningLessons
		context["learningNotes"] = briefNotes(state.LearningNotes)
		context["weeklyReviews"] = state.WeeklyReviews
	}

	if scope == "all" || scope == "workbench" {
		context["projects"] = state.Projects
	}

	encoded, err := json.Marshal(context)
	if err != nil {
		return "", err
	}
	return string(encoded), nil
}

func SummaryUserPrompt(scope string, period PeriodInfo, context string) string {
	return fmt.Sprintf(`请基于以下 JSON 数据生成本机个人管理总结，不要编造记录。
时间范围：%s 至 %s
范围：%s
数据：%s

要求：
1. 使用简体中文，重点突出，控制篇幅。
2. 固定输出四个 Markdown 标题：## 当前状态、## 重点变化、## 风险与异常、## 下一步行动。
3. 优先覆盖记账异常、订阅/周期账单、预算风险、订单分期、学习进度、下一步课程、复盘建议、工作台阻塞项目和锻炼频率变化。
4. 每部分最多 4 条，行动建议必须具体可执行。`, period.Start, period.End, scopeLabel(scope), context)
}

func ChatUserPrompt(question string, scope string, period PeriodInfo, context string, summary *model.AISummary) string {
	latest := "无"
	if summary != nil {
		latest = summary.Title + "\n" + summary.Content
	}
	return fmt.Sprintf(`你是用户的本机 Personal OS 助理。请只依据数据和已有总结回答，不编造记录。
时间范围：%s 至 %s
范围：%s
最新总结：%s
数据：%s

用户追问：%s

回答要求：简体中文、简洁、区分事实与建议，并给出具体下一步。`, period.Start, period.End, scopeLabel(scope), latest, context, question)
}

func SummaryTitle(period PeriodInfo, scope string) string {
	return period.Label + scopeLabel(scope) + "总结 " + period.Key
}

func scopeLabel(scope string) string {
	switch scope {
	case "all":
		return "全部"
	case "health":
		return "锻炼"
	case "finance":
		return "记账"
	case "learning":
		return "学习"
	case "workbench":
		return "工作台"
	default:
		return "全部"
	}
}

func briefNotes(notes []model.Note) []map[string]string {
	result := []map[string]string{}
	for _, note := range notes {
		content := note.Content
		if len(content) > 300 {
			content = content[:300] + "..."
		}
		result = append(result, map[string]string{
			"title":   note.Title,
			"content": content,
		})
	}
	return result
}

func dereference(value *string) string {
	if value == nil {
		return ""
	}
	return *value
}

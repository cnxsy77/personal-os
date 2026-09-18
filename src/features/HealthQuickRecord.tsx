import { useEffect, useRef, useState, type FormEvent } from 'react'
import {
  Activity,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Dumbbell,
  GripVertical,
  HeartPulse,
  Pencil,
  Plus,
  Timer,
  Trash2,
  Wind,
  X,
} from 'lucide-react'
import { RecordDialog } from '../components/RecordDialog'
import { ConfirmDialog } from '../components/ConfirmDialog'
import type {
  HealthCondition,
  HealthMetric,
  HealthMetricInput,
  MenstruationFlow,
  MenstruationSymptom,
  SelectableWorkoutKind,
  Workout,
  WorkoutExercise,
  WorkoutInput,
  WorkoutKind,
} from '../data/model'
import {
  getCompletedWorkoutsThisWeek,
  getLatestHealthMetric,
  healthConditionLabels,
  menstruationFlowLabels,
  menstruationSymptomLabels,
  workoutKindLabels,
} from '../utils/health'
import {
  filterWorkoutsByMode,
  filterWorkoutsByMonth,
  getAdjacentMonthKey,
  getCompletedMonthlyWorkouts,
  getMonthKey,
  getMonthLabel,
  getMonthlyWorkoutCalendar,
  getMonthlyWorkoutDays,
  getWorkoutModes,
  workoutModeLabels,
  type WorkoutMode,
  type WorkoutModeFilter,
} from '../utils/healthViews'
import { formatStudyDuration, toDateKey } from '../utils/study'
import { getWorkoutExercises } from '../utils/workoutPlanTags'
import { parseWorkoutPlanText } from '../utils/workoutPlanText'
import './HealthQuickRecord.css'

type Props = {
  workouts: Workout[]
  healthMetrics: HealthMetric[]
  dialogOpen: boolean
  dialogTab?: string
  dialogOnly?: boolean
  onDialogOpen: (tab?: string) => void
  onDialogClose: () => void
  onSaved: (message: string) => void
  onWorkoutSubmit: (input: WorkoutInput) => void
  onWorkoutUpdate: (id: string, input: WorkoutInput) => void
  onMetricSubmit: (input: HealthMetricInput) => void
  onWorkoutDelete: (id: string) => void
  onMetricUpdate: (id: string, input: HealthMetricInput) => void
  onMetricDelete: (id: string) => void
  weeklyWorkoutTarget: number
}

const workoutKinds: Array<[SelectableWorkoutKind, string]> = [
  ['glutes', '臀'],
  ['legs', '腿'],
  ['shoulders', '肩'],
  ['chest', '胸'],
  ['back', '背'],
  ['cardio', '有氧'],
]
const healthConditions = Object.entries(healthConditionLabels) as Array<
  [HealthCondition, string]
>
const menstruationFlows = Object.entries(menstruationFlowLabels) as Array<
  [MenstruationFlow, string]
>
const menstruationSymptomOptions = Object.entries(
  menstruationSymptomLabels,
) as Array<[MenstruationSymptom, string]>
const workoutModes = Object.entries(workoutModeLabels) as Array<
  [WorkoutMode, string]
>
const modeFilterOptions: Array<[WorkoutModeFilter, string]> = [
  ['all', '全部'],
  ...workoutModes,
]

export function HealthQuickRecord({
  workouts,
  healthMetrics,
  dialogOpen,
  dialogTab = 'workout',
  dialogOnly = false,
  onDialogOpen,
  onDialogClose,
  onSaved,
  onWorkoutSubmit,
  onWorkoutUpdate,
  onMetricSubmit,
  onWorkoutDelete,
  onMetricUpdate,
  onMetricDelete,
  weeklyWorkoutTarget,
}: Props) {
  const now = new Date()
  const [workoutDate, setWorkoutDate] = useState(() => toDateKey(now))
  const [selectedWorkoutKinds, setSelectedWorkoutKinds] = useState<
    SelectableWorkoutKind[]
  >([])
  const [duration, setDuration] = useState('')
  const [planText, setPlanText] = useState('')
  const [focus, setFocus] = useState('')
  const [warmupText, setWarmupText] = useState('')
  const [workoutNotes, setWorkoutNotes] = useState('')
  const [exercises, setExercises] = useState<WorkoutExercise[]>([])
  const [exerciseName, setExerciseName] = useState('')
  const [exercisePrescription, setExercisePrescription] = useState('12×4')
  const [exerciseDragIndex, setExerciseDragIndex] = useState<number | null>(
    null,
  )
  const [exerciseDragOverIndex, setExerciseDragOverIndex] = useState<
    number | null
  >(null)
  const [menstruationFlow, setMenstruationFlow] =
    useState<MenstruationFlow>('none')
  const [menstruationSymptoms, setMenstruationSymptoms] = useState<
    MenstruationSymptom[]
  >([])
  const [menstruationNote, setMenstruationNote] = useState('')
  const [workoutError, setWorkoutError] = useState('')
  const [workoutKindOpen, setWorkoutKindOpen] = useState(false)
  const [symptomSelectOpen, setSymptomSelectOpen] = useState(false)
  const [editingWorkout, setEditingWorkout] = useState<Workout | null>(null)
  const [editingMetric, setEditingMetric] = useState<HealthMetric | null>(null)
  const [deletingWorkout, setDeletingWorkout] = useState<Workout | null>(null)
  const [deletingMetric, setDeletingMetric] = useState<HealthMetric | null>(null)
  const workoutKindRef = useRef<HTMLDivElement>(null)
  const symptomSelectRef = useRef<HTMLDivElement>(null)
  const [metricDate, setMetricDate] = useState(() => toDateKey(now))
  const [sleepHours, setSleepHours] = useState('')
  const [weight, setWeight] = useState('')
  const [condition, setCondition] = useState<HealthCondition>('good')
  const [metricError, setMetricError] = useState('')
  const [monthKey, setMonthKey] = useState(() => getMonthKey(now))
  const [workoutModeFilter, setWorkoutModeFilter] =
    useState<WorkoutModeFilter>('all')

  const weeklyWorkouts = getCompletedWorkoutsThisWeek(workouts, now)
  const weeklyMinutes = weeklyWorkouts.reduce(
    (total, workout) => total + workout.durationMinutes,
    0,
  )
  const latestMetric = getLatestHealthMetric(healthMetrics)
  const monthWorkouts = filterWorkoutsByMonth(workouts, monthKey)
  const visibleWorkouts = filterWorkoutsByMode(monthWorkouts, workoutModeFilter)
    .slice()
    .sort((workoutA, workoutB) => workoutB.date.localeCompare(workoutA.date))
  const completedMonthlyWorkouts = getCompletedMonthlyWorkouts(
    workouts,
    monthKey,
  )
  const monthlyStrengthCount = completedMonthlyWorkouts.filter(
    (workout) => getWorkoutModes(workout).includes('strength'),
  ).length
  const monthlyCardioCount = completedMonthlyWorkouts.filter(
    (workout) => getWorkoutModes(workout).includes('cardio'),
  ).length
  const visibleMonthlyMinutes = visibleWorkouts.reduce(
    (total, workout) => total + workout.durationMinutes,
    0,
  )
  const monthlyWorkoutDays = getMonthlyWorkoutDays(workouts, monthKey)
  const monthlyCalendar = getMonthlyWorkoutCalendar(workouts, monthKey)

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      if (
        workoutKindOpen &&
        !workoutKindRef.current?.contains(event.target as Node)
      ) {
        setWorkoutKindOpen(false)
      }

      if (
        symptomSelectOpen &&
        !symptomSelectRef.current?.contains(event.target as Node)
      ) {
        setSymptomSelectOpen(false)
      }
    }

    if (workoutKindOpen || symptomSelectOpen) {
      document.addEventListener('pointerdown', handlePointerDown)
    }

    document.addEventListener('pointerdown', handlePointerDown)
    return () => document.removeEventListener('pointerdown', handlePointerDown)
  }, [symptomSelectOpen, workoutKindOpen])

  function openDialog(tab = dialogTab) {
    setEditingMetric(null)
    setWorkoutError('')
    setMetricError('')
    setWorkoutKindOpen(false)
    setSymptomSelectOpen(false)
    onDialogOpen(tab)
  }

  function startMetricEdit(metric: HealthMetric) {
    setEditingMetric(metric)
    setMetricDate(metric.date)
    setSleepHours(String(metric.sleepHours))
    setWeight(metric.weightKg === null ? '' : String(metric.weightKg))
    setCondition(metric.condition)
    setMenstruationFlow(metric.menstruationFlow ?? 'none')
    setMenstruationSymptoms(metric.menstruationSymptoms ?? [])
    setMenstruationNote(metric.menstruationNote ?? '')
    setMetricError('')
    onDialogOpen('metric')
  }

  function startWorkoutEdit(workout: Workout) {
    const selectedKinds = workout.kinds?.filter(isSelectableWorkoutKind) ?? []
    const planText = (workout.plan ?? []).join('\n')

    setEditingWorkout(workout)
    setWorkoutDate(workout.date)
    setSelectedWorkoutKinds(
      selectedKinds.length > 0
        ? selectedKinds
        : [workout.kind].filter(isSelectableWorkoutKind),
    )
    setDuration(String(workout.durationMinutes || ''))
    setFocus(workout.focus ?? '')
    setPlanText(planText)
    setWarmupText((workout.warmup ?? []).join('\n'))
    setWorkoutNotes(workout.notes ?? '')
    setExercises(getWorkoutExercises(workout))
    setWorkoutError('')
    onDialogOpen('workout')
  }

  function selectMonth(value: string) {
    setMonthKey(/^\d{4}-\d{2}$/.test(value) ? value : getMonthKey(new Date()))
  }

  function toggleWorkoutKind(kind: SelectableWorkoutKind) {
    setSelectedWorkoutKinds((current) =>
      current.includes(kind)
        ? current.filter((item) => item !== kind)
        : [...current, kind],
    )
  }

  function toggleMenstruationSymptom(symptom: MenstruationSymptom) {
    setMenstruationSymptoms((current) =>
      current.includes(symptom)
        ? current.filter((item) => item !== symptom)
        : [...current, symptom],
    )
  }

  function recognizeWorkoutPlan() {
    if (!planText.trim()) {
      return
    }

    const parsedPlan = parseWorkoutPlanText(planText, now)

    if (parsedPlan.date) {
      setWorkoutDate(parsedPlan.date)
    }

    if (parsedPlan.kinds.length > 0) {
      setSelectedWorkoutKinds(parsedPlan.kinds)
    }

    if (parsedPlan.focus) {
      setFocus(parsedPlan.focus)
    }

    setWarmupText(parsedPlan.warmup.join('\n'))
    setWorkoutNotes(parsedPlan.notes.join('\n'))
    setExercises(parsedPlan.exercises)
    setExerciseDragIndex(null)
    setExerciseDragOverIndex(null)
    setWorkoutError('')
  }

  function addWorkoutExercise() {
    const name = exerciseName.trim()
    const prescription = exercisePrescription.trim()

    if (!name) {
      return
    }

    setExercises((current) => [
      ...current,
      {
        name,
        ...(prescription ? { prescription } : {}),
      },
    ])
    setExerciseName('')
    setExercisePrescription('12×4')
    setWorkoutError('')
  }

  function updateWorkoutExercise(index: number, patch: WorkoutExercise) {
    setExercises((current) =>
      current.map((exercise, itemIndex) =>
        itemIndex === index ? patch : exercise,
      ),
    )
  }

  function removeWorkoutExercise(index: number) {
    setExercises((current) =>
      current.filter((_, itemIndex) => itemIndex !== index),
    )
    setExerciseDragIndex(null)
    setExerciseDragOverIndex(null)
  }

  function moveWorkoutExercise(fromIndex: number, toIndex: number) {
    setExercises((current) => {
      if (
        fromIndex === toIndex ||
        fromIndex < 0 ||
        toIndex < 0 ||
        fromIndex >= current.length ||
        toIndex >= current.length
      ) {
        return current
      }

      const next = [...current]
      const [moved] = next.splice(fromIndex, 1)
      next.splice(toIndex, 0, moved)

      return next
    })
  }

  function clearExerciseDrag() {
    setExerciseDragIndex(null)
    setExerciseDragOverIndex(null)
  }

  function buildWorkoutInput(): WorkoutInput {
    return {
      date: workoutDate,
      kind: selectedWorkoutKinds[0],
      kinds: selectedWorkoutKinds,
      status: 'completed',
      durationMinutes: Number(duration),
      notes: workoutNotes,
      plan: splitLines(planText),
      focus: focus || undefined,
      warmup: splitLines(warmupText),
      exercises,
      finisher: editingWorkout?.finisher,
      sorenessAreas: editingWorkout?.sorenessAreas,
      coachNotes: editingWorkout?.coachNotes,
    }
  }

  function closeDialog() {
    setWorkoutError('')
    setMetricError('')
    setWorkoutKindOpen(false)
    setSymptomSelectOpen(false)
    setEditingWorkout(null)
    setEditingMetric(null)
    setDeletingWorkout(null)
    setDeletingMetric(null)
    setExerciseDragIndex(null)
    setExerciseDragOverIndex(null)
    onDialogClose()
  }

  async function submitWorkout(event: FormEvent) {
    event.preventDefault()
    const workoutInput = buildWorkoutInput()
    const normalizedDuration = Number(duration)

    if (selectedWorkoutKinds.length === 0) {
      setWorkoutError('请选择至少一个训练类型')
      return
    }

    if (!workoutDate) {
      setWorkoutError('请选择训练日期')
      return
    }

    if (!Number.isInteger(normalizedDuration) || normalizedDuration < 0) {
      setWorkoutError('请输入 0 以上的训练时长')
      return
    }

    let savedMessage = '训练已保存'

    if (editingWorkout) {
      await onWorkoutUpdate(editingWorkout.id, workoutInput)
      savedMessage = '训练已更新'
    } else {
      await onWorkoutSubmit(workoutInput)
    }

    setPlanText('')
    setDuration('')
    setFocus('')
    setWarmupText('')
    setWorkoutNotes('')
    setExercises([])
    setExerciseDragIndex(null)
    setExerciseDragOverIndex(null)
    setExerciseName('')
    setExercisePrescription('12×4')
    setWorkoutError('')
    setEditingWorkout(null)
    closeDialog()
    onSaved(savedMessage)
  }

  async function submitMetric(event: FormEvent) {
    event.preventDefault()
    const normalizedSleepHours = Number(sleepHours)
    const normalizedWeight = weight === '' ? null : Number(weight)

    if (!metricDate) {
      setMetricError('请选择记录日期')
      return
    }

    if (!Number.isFinite(normalizedSleepHours) || normalizedSleepHours < 0) {
      setMetricError('请输入 0 以上的睡眠时长')
      return
    }

    if (
      normalizedWeight !== null &&
      (!Number.isFinite(normalizedWeight) || normalizedWeight <= 0)
    ) {
      setMetricError('请输入大于 0 的体重')
      return
    }

    const metricInput: HealthMetricInput = {
      date: metricDate,
      sleepHours: normalizedSleepHours,
      weightKg: normalizedWeight,
      condition,
      menstruationFlow,
      menstruationSymptoms,
      menstruationNote,
    }

    if (editingMetric) {
      await onMetricUpdate(editingMetric.id, metricInput)
    } else {
      await onMetricSubmit(metricInput)
    }
    setSleepHours('')
    setWeight('')
    setCondition('good')
    setMenstruationFlow('none')
    setMenstruationSymptoms([])
    setMenstruationNote('')
    setMetricError('')
    setEditingMetric(null)
    closeDialog()
    onSaved(editingMetric ? '身体指标已更新' : '身体指标已保存')
  }

  const healthDialog = (
    <RecordDialog
      activeTab={dialogTab}
      description="记录训练和身体状态。"
      onClose={closeDialog}
      onTabChange={openDialog}
      open={dialogOpen}
      tabs={[
        { id: 'workout', label: '训练' },
        { id: 'metric', label: '身体指标' },
      ]}
      title={
        editingWorkout
          ? '编辑训练记录'
          : editingMetric
            ? '编辑身体指标'
            : '添加锻炼记录'
      }
    >
      {dialogTab === 'workout' ? (
        <form onSubmit={submitWorkout} className="health-form">
          <div className="health-fields">
            <div>
              <label htmlFor="workout-date">训练日期</label>
              <input
                id="workout-date"
                type="date"
                value={workoutDate}
                onChange={(event) => setWorkoutDate(event.target.value)}
              />
            </div>
            <div>
              <label htmlFor="workout-kind">训练类型</label>
              <div
                className={`kind-select${workoutKindOpen ? ' open' : ''}`}
                data-dropdown-open={workoutKindOpen ? 'true' : 'false'}
                onKeyDown={(event) => {
                  if (event.key === 'Escape') {
                    event.stopPropagation()
                    event.preventDefault()
                    setWorkoutKindOpen(false)
                  }
                }}
                ref={workoutKindRef}
              >
                <div
                  className="kind-trigger"
                  aria-expanded={workoutKindOpen}
                  aria-label="训练类型"
                  id="workout-kind"
                  role="button"
                  tabIndex={0}
                  onClick={() => setWorkoutKindOpen((open) => !open)}
                  onKeyDown={(event) => {
                    if (
                      (event.key === 'Enter' || event.key === ' ') &&
                      event.target === event.currentTarget
                    ) {
                      event.preventDefault()
                      setWorkoutKindOpen((open) => !open)
                    }
                  }}
                >
                  <span className="kind-tokens">
                    {selectedWorkoutKinds.length > 0 ? (
                      selectedWorkoutKinds.map((kind) => (
                        <span className="kind-token" key={kind}>
                          {workoutKindLabels[kind]}
                          <button
                            aria-label={`移除${workoutKindLabels[kind]}`}
                            onClick={(event) => {
                              event.stopPropagation()
                              toggleWorkoutKind(kind)
                            }}
                            type="button"
                          >
                            <X size={11} />
                          </button>
                        </span>
                      ))
                    ) : (
                      <span className="kind-placeholder">请选择训练类型</span>
                    )}
                  </span>
                  <ChevronDown className="kind-chevron" size={17} />
                </div>
                {workoutKindOpen ? (
                  <ul aria-label="训练类型选项" role="group">
                    {workoutKinds.map(([value, label]) => (
                      <li
                        aria-selected={selectedWorkoutKinds.includes(value)}
                        key={value}
                      >
                        <label className="kind-option">
                          <span>{label}</span>
                          <input
                            checked={selectedWorkoutKinds.includes(value)}
                            onChange={() => toggleWorkoutKind(value)}
                            type="checkbox"
                          />
                          <i className="kind-check" aria-hidden="true">
                            {selectedWorkoutKinds.includes(value) ? (
                              <Check size={15} />
                            ) : null}
                          </i>
                        </label>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            </div>
            <div>
              <label htmlFor="workout-duration">训练时长</label>
              <input
                id="workout-duration"
                inputMode="numeric"
                min="0"
                step="1"
                type="number"
                value={duration}
                onChange={(event) => setDuration(event.target.value)}
                placeholder="45"
              />
            </div>
            <div>
              <label htmlFor="workout-focus">训练主题</label>
              <input
                id="workout-focus"
                value={focus}
                onChange={(event) => setFocus(event.target.value)}
                placeholder="胸加肩"
              />
            </div>
            <div className="form-field-full">
              <label htmlFor="workout-plan">计划</label>
              <textarea
                id="workout-plan"
                value={planText}
                onChange={(event) => setPlanText(event.target.value)}
                placeholder={'哑铃飞鸟 12×4\n高脚杯深蹲 12×3'}
                rows={8}
              />
              <div className="plan-actions">
                <button
                  className="button-secondary"
                  onClick={recognizeWorkoutPlan}
                  type="button"
                >
                  识别
                </button>
              </div>
            </div>
            <div className="form-field-full exercise-editor">
              <span className="field-label">力量训练</span>
              {exercises.length ? (
                <div aria-label="已添加动作" className="exercise-editor-tags">
                  {exercises.map((exercise, index) => (
                    <span
                      className={[
                        'exercise-tag',
                        exerciseDragIndex === index ? 'dragging' : '',
                        exerciseDragOverIndex === index &&
                        exerciseDragIndex !== index
                          ? 'drop-target'
                          : '',
                      ]
                        .filter(Boolean)
                        .join(' ')}
                      key={`exercise-${index}`}
                      onDragOver={(event) => {
                        if (exerciseDragIndex === null) {
                          return
                        }

                        event.preventDefault()
                        event.dataTransfer.dropEffect = 'move'
                        setExerciseDragOverIndex(index)
                      }}
                      onDragLeave={() => {
                        if (exerciseDragOverIndex === index) {
                          setExerciseDragOverIndex(null)
                        }
                      }}
                      onDrop={(event) => {
                        event.preventDefault()
                        const fallbackSource = Number(
                          event.dataTransfer.getData('text/plain'),
                        )
                        const sourceIndex = exerciseDragIndex ?? fallbackSource

                        if (Number.isInteger(sourceIndex)) {
                          moveWorkoutExercise(sourceIndex, index)
                        }

                        clearExerciseDrag()
                      }}
                    >
                      <button
                        aria-label={`拖拽调整${exercise.name}顺序`}
                        className="exercise-drag-handle"
                        draggable
                        onDragEnd={clearExerciseDrag}
                        onDragStart={(event) => {
                          setExerciseDragIndex(index)
                          setExerciseDragOverIndex(index)
                          event.dataTransfer.setData(
                            'text/plain',
                            String(index),
                          )
                          event.dataTransfer.effectAllowed = 'move'
                        }}
                        type="button"
                      >
                        <GripVertical size={12} />
                      </button>
                      <input
                        aria-label={`动作 ${index + 1} 名称`}
                        className="exercise-tag-name"
                        onChange={(event) =>
                          updateWorkoutExercise(index, {
                            ...exercise,
                            name: event.target.value,
                          })
                        }
                        placeholder="动作名称"
                        value={exercise.name}
                      />
                      <input
                        aria-label={`动作 ${index + 1} 备注`}
                        className="exercise-tag-prescription"
                        onChange={(event) =>
                          updateWorkoutExercise(index, {
                            ...exercise,
                            prescription: event.target.value || undefined,
                          })
                        }
                        placeholder="12×4"
                        value={exercise.prescription ?? ''}
                      />
                      <button
                        aria-label={`移除动作${exercise.name}`}
                        onClick={() => removeWorkoutExercise(index)}
                        type="button"
                      >
                        <X size={11} />
                      </button>
                    </span>
                  ))}
                </div>
              ) : null}
              <div className="exercise-editor-row">
                <div className="exercise-name">
                  <label htmlFor="workout-exercise-name">动作</label>
                  <input
                    id="workout-exercise-name"
                    onChange={(event) => setExerciseName(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault()
                        addWorkoutExercise()
                      }
                    }}
                    placeholder="动作名称"
                    value={exerciseName}
                  />
                </div>
                <div>
                  <label htmlFor="workout-exercise-prescription">备注</label>
                  <input
                    id="workout-exercise-prescription"
                    onChange={(event) =>
                      setExercisePrescription(event.target.value)
                    }
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault()
                        addWorkoutExercise()
                      }
                    }}
                    placeholder="12×4、60秒、递减"
                    value={exercisePrescription}
                  />
                </div>
                <button
                  className="button-secondary"
                  onClick={addWorkoutExercise}
                  type="button"
                >
                  添加
                </button>
              </div>
            </div>
            <div className="form-field-full">
              <label htmlFor="workout-warmup">热身</label>
              <textarea
                id="workout-warmup"
                onChange={(event) => setWarmupText(event.target.value)}
                placeholder="泡沫轴松解、关节激活等"
                rows={3}
                value={warmupText}
              />
            </div>
            <div className="form-field-full">
              <label htmlFor="workout-notes">备注</label>
              <textarea
                id="workout-notes"
                onChange={(event) => setWorkoutNotes(event.target.value)}
                placeholder="身体感受、酸痛部位或其他观察"
                rows={3}
                value={workoutNotes}
              />
            </div>
            <div className="health-actions">
              <button type="submit">
                <Dumbbell size={16} />
                {editingWorkout ? '保存修改' : '保存训练'}
              </button>
            </div>
          </div>
          {workoutError ? <p role="alert">{workoutError}</p> : null}
        </form>
      ) : (
        <form onSubmit={submitMetric} className="metric-form">
          <div className="metric-fields">
            <div>
              <label htmlFor="metric-date">记录日期</label>
              <input
                id="metric-date"
                type="date"
                value={metricDate}
                onChange={(event) => setMetricDate(event.target.value)}
              />
            </div>
            <div>
              <label htmlFor="metric-sleep">睡眠时长</label>
              <input
                id="metric-sleep"
                inputMode="decimal"
                min="0"
                max="24"
                step="0.1"
                type="number"
                value={sleepHours}
                onChange={(event) => setSleepHours(event.target.value)}
                placeholder="7.5"
              />
            </div>
            <div>
              <label htmlFor="metric-weight">体重</label>
              <input
                id="metric-weight"
                inputMode="decimal"
                min="20"
                max="300"
                step="0.1"
                type="number"
                value={weight}
                onChange={(event) => setWeight(event.target.value)}
                placeholder="72.0"
              />
            </div>
            <div>
              <label htmlFor="metric-condition">身体状态</label>
              <select
                id="metric-condition"
                value={condition}
                onChange={(event) =>
                  setCondition(event.target.value as HealthCondition)
                }
              >
                {healthConditions.map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>
            <div className="form-field-full">
              <label htmlFor="menstruation-flow">月经流量</label>
              <select
                id="menstruation-flow"
                value={menstruationFlow}
                onChange={(event) =>
                  setMenstruationFlow(
                    event.target.value as MenstruationFlow,
                  )
                }
              >
                {menstruationFlows.map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="menstruation-symptom">月经症状</label>
              <div
                className={`kind-select${symptomSelectOpen ? ' open' : ''}`}
                data-dropdown-open={symptomSelectOpen ? 'true' : 'false'}
                onKeyDown={(event) => {
                  if (event.key === 'Escape') {
                    event.stopPropagation()
                    event.preventDefault()
                    setSymptomSelectOpen(false)
                  }
                }}
                ref={symptomSelectRef}
              >
                <div
                  aria-expanded={symptomSelectOpen}
                  aria-label="月经症状"
                  className="kind-trigger"
                  id="menstruation-symptom"
                  role="button"
                  tabIndex={0}
                  onClick={() => setSymptomSelectOpen((open) => !open)}
                  onKeyDown={(event) => {
                    if (
                      (event.key === 'Enter' || event.key === ' ') &&
                      event.target === event.currentTarget
                    ) {
                      event.preventDefault()
                      setSymptomSelectOpen((open) => !open)
                    }
                  }}
                >
                  <span className="kind-tokens">
                    {menstruationSymptoms.length === 0 ? (
                      <span className="kind-placeholder">请选择月经症状</span>
                    ) : (
                      menstruationSymptoms.map((symptom) => (
                        <span className="kind-token" key={symptom}>
                          {menstruationSymptomLabels[symptom]}
                          <button
                            aria-label={`移除${menstruationSymptomLabels[symptom]}`}
                            onClick={(event) => {
                              event.stopPropagation()
                              toggleMenstruationSymptom(symptom)
                            }}
                            type="button"
                          >
                            <X size={11} />
                          </button>
                        </span>
                      ))
                    )}
                  </span>
                  <ChevronDown className="kind-chevron" size={17} />
                </div>

                {symptomSelectOpen ? (
                  <ul aria-label="月经症状选项" role="group">
                    {menstruationSymptomOptions.map(([value, label]) => (
                      <li key={value}>
                        <label className="kind-option">
                          <span>{label}</span>
                          <input
                            checked={menstruationSymptoms.includes(value)}
                            name="menstruation-symptom"
                            onChange={() => toggleMenstruationSymptom(value)}
                            type="checkbox"
                            value={value}
                          />
                          <i className="kind-check" aria-hidden="true">
                            {menstruationSymptoms.includes(value) ? (
                              <Check size={15} />
                            ) : null}
                          </i>
                        </label>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            </div>
            <div className="form-field-full">
              <label htmlFor="menstruation-note">月经备注</label>
              <input
                id="menstruation-note"
                value={menstruationNote}
                onChange={(event) => setMenstruationNote(event.target.value)}
                placeholder="周期、不适或其他观察"
              />
            </div>
            <button type="submit">
              <HeartPulse size={16} />
              保存身体指标
            </button>
          </div>
          {metricError ? <p role="alert">{metricError}</p> : null}
        </form>
      )}
    </RecordDialog>
  )

  if (dialogOnly) {
    return healthDialog
  }

  return (
    <div className="health-page">
      <section className="health-panel health-stream" aria-labelledby="health-title">
        <div className="health-toolbar">
          <div className="month-selector">
            <button
              aria-label="上一个月"
              onClick={() => setMonthKey(getAdjacentMonthKey(monthKey, -1))}
              type="button"
            >
              <ChevronLeft size={17} />
            </button>
            <div>
              <label htmlFor="health-month">月份</label>
              <input
                id="health-month"
                onChange={(event) => selectMonth(event.target.value)}
                type="month"
                value={monthKey}
              />
            </div>
            <button
              aria-label="下一个月"
              onClick={() => setMonthKey(getAdjacentMonthKey(monthKey, 1))}
              type="button"
            >
              <ChevronRight size={17} />
            </button>
          </div>
          <div aria-label="训练类别" className="mode-filter" role="group">
            {modeFilterOptions.map(([value, label]) => (
              <button
                aria-pressed={workoutModeFilter === value}
                className={workoutModeFilter === value ? 'selected' : ''}
                key={value}
                onClick={() => setWorkoutModeFilter(value)}
                type="button"
              >
                {label}
              </button>
            ))}
          </div>
          <button className="page-add" onClick={() => openDialog('workout')} type="button">
            <Plus size={16} />
            添加记录
          </button>
        </div>

        <div className="metric-band">
          <div>
            <label>本周完成</label>
            <strong>
              {weeklyWorkouts.length} / {weeklyWorkoutTarget}
            </strong>
            <small>{formatStudyDuration(weeklyMinutes)}</small>
          </div>
          <div>
            <label>{getMonthLabel(monthKey)}</label>
            <strong>{visibleWorkouts.length} 次</strong>
            <small>{monthlyWorkoutDays} 个训练日</small>
          </div>
          <div>
            <label>训练时长</label>
            <strong>{formatStudyDuration(visibleMonthlyMinutes)}</strong>
            <small>当前筛选</small>
          </div>
          <div>
            <label>力量 / 有氧</label>
            <strong>
              {monthlyStrengthCount} / {monthlyCardioCount}
            </strong>
            <small>全月已完成</small>
          </div>
          <div>
            <label>最近睡眠</label>
            <strong>
              {latestMetric ? `${latestMetric.sleepHours} 小时` : '未记录'}
            </strong>
            <small>身体状态</small>
          </div>
          <div>
            <label>最近体重</label>
            <strong>
              {latestMetric?.weightKg == null
                ? '未记录'
                : `${latestMetric.weightKg} kg`}
            </strong>
            <small>身体指标</small>
          </div>
        </div>

        <div className="stream-heading">
          <div>
            <h2 id="health-title">训练流水</h2>
            <p>
              {getMonthLabel(monthKey)} · {visibleWorkouts.length} 条记录
              {workoutModeFilter === 'all'
                ? ''
                : ` · ${workoutModeLabels[workoutModeFilter]}`}
            </p>
          </div>
          <span className="sort-hint">按日期倒序</span>
        </div>

        <ul aria-label="训练记录" className="workout-timeline">
          {visibleWorkouts.map((workout) => {
            const modes = getWorkoutModes(workout)
            const kinds = workout.kinds?.length ? workout.kinds : [workout.kind]
            const exercises = getWorkoutExercises(workout)

            return (
              <li
                className={`timeline-record ${modes[0] ?? ''}`}
                key={workout.id}
              >
                <div className="record-date">
                  <b>{formatDate(workout.date).slice(5)}</b>
                  <span>{formatDate(workout.date).slice(0, 4)}</span>
                </div>
                <div className="record-main">
                  <div className="record-title">
                    <h4>{workout.focus || workoutKindLabels[workout.kind]}</h4>
                    {modes.map((mode) => (
                      <span className={`mode-pill ${mode}`} key={mode}>
                        {mode === 'cardio' ? (
                          <Wind size={13} />
                        ) : (
                          <Dumbbell size={13} />
                        )}
                        {workoutModeLabels[mode]}
                      </span>
                    ))}
                  </div>
                  <p className="record-meta">
                    {kinds.map((kind) => workoutKindLabels[kind]).join(' / ')} ·{' '}
                    {exercises.length
                      ? `${exercises.length} 个动作`
                      : '自由训练'}{' '}
                    · {formatStudyDuration(workout.durationMinutes)}
                  </p>
                  {workout.notes ? (
                    <section className="record-section">
                      <h5>备注</h5>
                      <p>{workout.notes}</p>
                    </section>
                  ) : null}

                  {workout.warmup?.length ? (
                    <section className="record-section">
                      <h5>热身</h5>
                      <p>{workout.warmup.join('\n')}</p>
                    </section>
                  ) : null}

                  {exercises.length ? (
                    <section className="record-section">
                      <h5>力量训练</h5>
                      <p className="exercise-line">
                        {exercises.map((exercise, index) => (
                          <span key={`${exercise.name}-${index}`}>
                            <b>{exercise.name}</b>
                            {exercise.prescription ? (
                              <code>{exercise.prescription}</code>
                            ) : null}
                          </span>
                        ))}
                      </p>
                    </section>
                  ) : null}
                </div>
                <div className="workout-detail">
                  <b>
                    <Timer size={14} />
                    {formatStudyDuration(workout.durationMinutes)}
                  </b>
                  <button
                    aria-label={`编辑${workout.focus || workoutKindLabels[workout.kind]}`}
                    className="record-edit"
                    onClick={() => startWorkoutEdit(workout)}
                    type="button"
                  >
                    <Pencil size={15} />
                    编辑
                  </button>
                  <div className="record-actions">
                    <button
                      aria-label={`删除${workout.focus || workoutKindLabels[workout.kind]}`}
                      className="delete"
                      onClick={() => setDeletingWorkout(workout)}
                      type="button"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
        {visibleWorkouts.length === 0 ? (
          <div className="stream-empty">
            <CalendarDays size={22} />
            <p>{getMonthLabel(monthKey)}没有匹配的训练记录。</p>
          </div>
        ) : null}
      </section>

      <aside className="health-rail">
        <section className="health-panel calendar-panel" aria-labelledby="calendar-title">
          <div className="panel-heading">
            <h2 id="calendar-title">月度训练热力图</h2>
          </div>
          <div className="calendar-legend">
            <span><i className="strength" />力量</span>
            <span><i className="cardio" />有氧</span>
          </div>
          <div className="calendar-weekdays" aria-hidden="true">
            {['一', '二', '三', '四', '五', '六', '日'].map((weekday) => (
              <span key={weekday}>{weekday}</span>
            ))}
          </div>
          <div className="calendar-grid">
            {monthlyCalendar.map((day) => {
              const dayMode =
                day.strengthCount > 0 && day.cardioCount > 0
                  ? 'mixed'
                  : day.cardioCount > 0
                    ? 'cardio'
                    : 'empty'

              return (
                <div
                  aria-label={`${day.date}，${day.totalCount} 次已完成训练`}
                  className={[
                    'calendar-day',
                    `mode-${dayMode}`,
                    `level-${day.level}`,
                    day.inMonth ? '' : 'outside',
                  ].filter(Boolean).join(' ')}
                  key={day.date}
                >
                  <time dateTime={day.date}>{day.day}</time>
                  {day.totalCount > 0 ? <b>{day.totalCount}</b> : null}
                  {day.totalCount > 0 ? (
                    <span className="day-modes">
                      {day.strengthCount > 0 ? <i className="strength" /> : null}
                      {day.cardioCount > 0 ? <i className="cardio" /> : null}
                    </span>
                  ) : null}
                </div>
              )
            })}
          </div>
        </section>

        <section className="health-panel" aria-labelledby="metric-title">
          <div className="panel-heading">
            <h2 id="metric-title">身体指标</h2>
          </div>
          <ul aria-label="身体指标" className="metric-list">
            {[...healthMetrics]
              .sort((metricA, metricB) => metricB.date.localeCompare(metricA.date))
              .slice(0, 6)
              .map((metric) => (
                <li key={metric.id}>
                  <i>
                    <Activity size={17} />
                  </i>
                  <div>
                    <h4>{formatDate(metric.date)}</h4>
                    <p>
                      睡眠 {metric.sleepHours} 小时 · 体重{' '}
                      {metric.weightKg == null ? '未记录' : `${metric.weightKg} kg`}
                    </p>
                    {(metric.menstruationFlow && metric.menstruationFlow !== 'none') ||
                    metric.menstruationSymptoms?.length ||
                    metric.menstruationNote ? (
                      <p>
                        月经
                        {metric.menstruationFlow &&
                        metric.menstruationFlow !== 'none'
                          ? ` ${menstruationFlowLabels[metric.menstruationFlow]}`
                          : ''}
                        {metric.menstruationSymptoms?.length
                          ? ` · ${metric.menstruationSymptoms
                              .map((symptom) => menstruationSymptomLabels[symptom])
                              .join('、')}`
                          : ''}
                      </p>
                    ) : null}
                    {metric.menstruationNote ? (
                      <p>{metric.menstruationNote}</p>
                    ) : null}
                  </div>
                  <div className="metric-side">
                    <b>{healthConditionLabels[metric.condition]}</b>
                    <div className="record-actions">
                      <button
                        aria-label={`编辑${formatDate(metric.date)}身体指标`}
                        onClick={() => startMetricEdit(metric)}
                        type="button"
                      >
                        <Pencil size={15} />
                      </button>
                      <button
                        aria-label={`删除${formatDate(metric.date)}身体指标`}
                        className="delete"
                        onClick={() => setDeletingMetric(metric)}
                        type="button"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                </li>
              ))}
          </ul>
        </section>
      </aside>

      {healthDialog}

      <ConfirmDialog
        description={`删除“${formatDate(deletingWorkout?.date ?? '')} ${
          deletingWorkout?.focus || workoutKindLabels[deletingWorkout?.kind ?? 'glutes']
        }”训练后无法恢复。`}
        onCancel={() => setDeletingWorkout(null)}
        onConfirm={() => {
          if (deletingWorkout) {
            onWorkoutDelete(deletingWorkout.id)
          }
          setDeletingWorkout(null)
          onSaved('训练已删除')
        }}
        open={deletingWorkout !== null}
        title="删除训练"
      />

      <ConfirmDialog
        description={`删除${formatDate(deletingMetric?.date ?? '')}的身体指标后无法恢复。`}
        onCancel={() => setDeletingMetric(null)}
        onConfirm={() => {
          if (deletingMetric) {
            onMetricDelete(deletingMetric.id)
          }
          setDeletingMetric(null)
          onSaved('身体指标已删除')
        }}
        open={deletingMetric !== null}
        title="删除身体指标"
      />
    </div>
  )
}

function formatDate(date: string) {
  return date.replaceAll('-', '.')
}

function splitLines(value: string) {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
}

function isSelectableWorkoutKind(
  value: WorkoutKind,
): value is SelectableWorkoutKind {
  return value !== 'push' && value !== 'pull' && value !== 'rest'
}

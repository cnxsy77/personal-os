import { useState, type FormEvent } from 'react'
import { Activity, Dumbbell, HeartPulse, Plus, Timer } from 'lucide-react'
import { RecordDialog } from '../components/RecordDialog'
import type {
  HealthCondition,
  HealthMetric,
  HealthMetricInput,
  Workout,
  WorkoutInput,
  WorkoutKind,
  WorkoutStatus,
} from '../data/model'
import {
  getCompletedWorkoutsThisWeek,
  getLatestHealthMetric,
  healthConditionLabels,
  weeklyWorkoutTarget,
  workoutKindLabels,
  workoutStatusLabels,
} from '../utils/health'
import { formatStudyDuration, toDateKey } from '../utils/study'
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
  onWorkoutStatusChange: (id: string, status: WorkoutStatus) => void
  onMetricSubmit: (input: HealthMetricInput) => void
}

const workoutKinds = Object.entries(workoutKindLabels) as Array<
  [WorkoutKind, string]
>
const workoutStatuses = Object.entries(workoutStatusLabels) as Array<
  [WorkoutStatus, string]
>
const healthConditions = Object.entries(healthConditionLabels) as Array<
  [HealthCondition, string]
>

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
  onWorkoutStatusChange,
  onMetricSubmit,
}: Props) {
  const now = new Date()
  const [workoutDate, setWorkoutDate] = useState(() => toDateKey(now))
  const [workoutKind, setWorkoutKind] = useState<WorkoutKind>('push')
  const [workoutStatus, setWorkoutStatus] = useState<WorkoutStatus>('planned')
  const [duration, setDuration] = useState('')
  const [notes, setNotes] = useState('')
  const [workoutError, setWorkoutError] = useState('')
  const [metricDate, setMetricDate] = useState(() => toDateKey(now))
  const [sleepHours, setSleepHours] = useState('')
  const [weight, setWeight] = useState('')
  const [condition, setCondition] = useState<HealthCondition>('good')
  const [metricError, setMetricError] = useState('')

  const weeklyWorkouts = getCompletedWorkoutsThisWeek(workouts, now)
  const weeklyMinutes = weeklyWorkouts.reduce(
    (total, workout) => total + workout.durationMinutes,
    0,
  )
  const latestMetric = getLatestHealthMetric(healthMetrics)

  function openDialog(tab = dialogTab) {
    setWorkoutError('')
    setMetricError('')
    onDialogOpen(tab)
  }

  function closeDialog() {
    setWorkoutError('')
    setMetricError('')
    onDialogClose()
  }

  function submitWorkout(event: FormEvent) {
    event.preventDefault()
    const normalizedDuration = Number(duration)

    if (!workoutDate) {
      setWorkoutError('请选择训练日期')
      return
    }

    if (!Number.isInteger(normalizedDuration) || normalizedDuration < 0) {
      setWorkoutError('请输入 0 以上的训练时长')
      return
    }

    onWorkoutSubmit({
      date: workoutDate,
      kind: workoutKind,
      status: workoutStatus,
      durationMinutes: normalizedDuration,
      notes,
    })
    setNotes('')
    setDuration('')
    setWorkoutError('')
    closeDialog()
    onSaved('训练已保存')
  }

  function submitMetric(event: FormEvent) {
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

    onMetricSubmit({
      date: metricDate,
      sleepHours: normalizedSleepHours,
      weightKg: normalizedWeight,
      condition,
    })
    setSleepHours('')
    setWeight('')
    setCondition('good')
    setMetricError('')
    closeDialog()
    onSaved('健康指标已保存')
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
      title="添加健康记录"
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
              <select
                id="workout-kind"
                value={workoutKind}
                onChange={(event) =>
                  setWorkoutKind(event.target.value as WorkoutKind)
                }
              >
                {workoutKinds.map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="workout-status">训练状态</label>
              <select
                id="workout-status"
                value={workoutStatus}
                onChange={(event) =>
                  setWorkoutStatus(event.target.value as WorkoutStatus)
                }
              >
                {workoutStatuses.map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
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
              <label htmlFor="workout-notes">训练备注</label>
              <input
                id="workout-notes"
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="主项卧推"
              />
            </div>
            <button type="submit">
              <Dumbbell size={16} />
              保存训练
            </button>
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
            <button type="submit">
              <HeartPulse size={16} />
              保存健康指标
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
      <section className="health-panel" aria-labelledby="health-title">
        <div className="panel-heading">
          <h2 id="health-title">健康脉搏</h2>
          <button className="page-add" onClick={() => openDialog('workout')} type="button">
            <Plus size={16} />
            添加记录
          </button>
        </div>

        <div className="health-summary">
          <div>
            <label>本周完成</label>
            <strong>
              {weeklyWorkouts.length} / {weeklyWorkoutTarget}
            </strong>
          </div>
          <div>
            <label>训练时长</label>
            <strong>{formatStudyDuration(weeklyMinutes)}</strong>
          </div>
          <div>
            <label>最近睡眠</label>
            <strong>
              {latestMetric ? `${latestMetric.sleepHours} 小时` : '未记录'}
            </strong>
          </div>
          <div>
            <label>最近体重</label>
            <strong>
              {latestMetric?.weightKg == null
                ? '未记录'
                : `${latestMetric.weightKg} kg`}
            </strong>
          </div>
        </div>

        <div className="health-list-heading">
          <h3>训练记录</h3>
        </div>
        <ul aria-label="训练记录">
          {workouts.slice(0, 8).map((workout) => (
            <li key={workout.id}>
              <i>
                <Dumbbell size={17} />
              </i>
              <div>
                <h4>{workoutKindLabels[workout.kind]}</h4>
                <p>
                  {formatDate(workout.date)}
                  {workout.notes ? ` · ${workout.notes}` : ''}
                </p>
              </div>
              <div className="workout-detail">
                <b>
                  <Timer size={14} />
                  {formatStudyDuration(workout.durationMinutes)}
                </b>
                <select
                  aria-label={`${formatDate(workout.date)} ${workoutKindLabels[workout.kind]} 状态`}
                  value={workout.status}
                  onChange={(event) =>
                    onWorkoutStatusChange(
                      workout.id,
                      event.target.value as WorkoutStatus,
                    )
                  }
                >
                  {workoutStatuses.map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="health-panel" aria-labelledby="metric-title">
        <div className="panel-heading">
          <h2 id="metric-title">身体指标</h2>
        </div>
        <div className="health-list-heading">
          <h3>最近指标</h3>
        </div>
        <ul aria-label="健康指标">
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
                </div>
                <b>{healthConditionLabels[metric.condition]}</b>
              </li>
            ))}
        </ul>
      </section>

      {healthDialog}
    </div>
  )
}

function formatDate(date: string) {
  return date.replaceAll('-', '.')
}

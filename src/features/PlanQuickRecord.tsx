import { useState, type FormEvent } from 'react'
import {
  CalendarClock,
  CalendarPlus,
  CalendarRange,
  Check,
  Target,
} from 'lucide-react'
import type { Task, TaskCategory, TaskInput } from '../data/model'
import './PlanQuickRecord.css'

type Props = {
  tasks: Task[]
  onTaskSubmit: (input: TaskInput) => void
  onTaskToggle: (id: string) => void
}

type PlanRange = 'today' | 'week' | 'all'

const taskCategoryLabels: Record<TaskCategory, string> = {
  work: '工作',
  health: '健康',
  learning: '学习',
  life: '生活',
}

const taskCategories = Object.entries(taskCategoryLabels) as Array<
  [TaskCategory, string]
>

const rangeLabels: Record<PlanRange, string> = {
  today: '今天',
  week: '本周',
  all: '全部',
}

export function PlanQuickRecord({
  tasks,
  onTaskSubmit,
  onTaskToggle,
}: Props) {
  const now = new Date()
  const today = toDateKey(now)
  const [date, setDate] = useState(today)
  const [category, setCategory] = useState<TaskCategory>('work')
  const [time, setTime] = useState('')
  const [title, setTitle] = useState('')
  const [error, setError] = useState('')
  const [range, setRange] = useState<PlanRange>('today')

  const weekRange = getWeekRange(now)
  const todayTasks = tasks.filter((task) => task.date === today)
  const weekTasks = tasks.filter(
    (task) =>
      task.date !== undefined &&
      task.date >= weekRange.start &&
      task.date <= weekRange.end,
  )
  const upcomingTasks = tasks
    .filter((task) => task.date !== undefined && task.date > today)
    .sort(compareTasks)
    .slice(0, 6)
  const visibleTasks = tasks
    .filter((task) => {
      if (range === 'today') {
        return task.date === today
      }

      if (range === 'week') {
        return (
          task.date !== undefined &&
          task.date >= weekRange.start &&
          task.date <= weekRange.end
        )
      }

      return true
    })
    .sort(compareTasks)
  const distribution = taskCategories.map(([value, label]) => ({
    label,
    count: tasks.filter((task) => task.category === value).length,
  }))
  const distributionTotal = Math.max(1, tasks.length)

  function submit(event: FormEvent) {
    event.preventDefault()
    const normalizedTitle = title.trim()

    if (!normalizedTitle) {
      setError('请输入计划事项')
      return
    }

    if (!date) {
      setError('请选择计划日期')
      return
    }

    onTaskSubmit({
      title: normalizedTitle,
      date,
      category,
      time: time || undefined,
    })
    setTitle('')
    setTime('')
    setError('')
    setRange(date === today ? 'today' : 'all')
  }

  return (
    <div className="plan-page">
      <section className="plan-panel" aria-labelledby="plan-title">
        <h2 id="plan-title">计划安排</h2>

        <div className="plan-summary">
          <div>
            <label>今日待办</label>
            <strong>
              {todayTasks.filter((task) => !task.done).length} 项
            </strong>
          </div>
          <div>
            <label>今日完成</label>
            <strong>
              {todayTasks.filter((task) => task.done).length} 项
            </strong>
          </div>
          <div>
            <label>本周计划</label>
            <strong>{weekTasks.length} 项</strong>
          </div>
          <div>
            <label>未排期</label>
            <strong>
              {tasks.filter((task) => task.date === undefined).length} 项
            </strong>
          </div>
        </div>

        <form onSubmit={submit} className="plan-form">
          <div className="plan-fields">
            <div className="plan-title-field">
              <label htmlFor="plan-title-input">计划事项</label>
              <input
                id="plan-title-input"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="写下下一步要做的具体动作"
              />
            </div>
            <div>
              <label htmlFor="plan-date">计划日期</label>
              <input
                id="plan-date"
                type="date"
                value={date}
                onChange={(event) => setDate(event.target.value)}
              />
            </div>
            <div>
              <label htmlFor="plan-category">计划分类</label>
              <select
                id="plan-category"
                value={category}
                onChange={(event) =>
                  setCategory(event.target.value as TaskCategory)
                }
              >
                {taskCategories.map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="plan-time">计划时间</label>
              <input
                id="plan-time"
                type="time"
                value={time}
                onChange={(event) => setTime(event.target.value)}
              />
            </div>
            <button type="submit">
              <CalendarPlus size={16} />
              保存计划
            </button>
          </div>
          {error ? <p role="alert">{error}</p> : null}
        </form>

        <div className="plan-filter" role="group" aria-label="计划范围">
          {(Object.keys(rangeLabels) as PlanRange[]).map((item) => (
            <button
              key={item}
              type="button"
              className={range === item ? 'selected' : ''}
              aria-pressed={range === item}
              onClick={() => setRange(item)}
            >
              {rangeLabels[item]}
            </button>
          ))}
        </div>

        <ul className="plan-list" aria-label="计划任务">
          {visibleTasks.length === 0 ? (
            <li className="empty">这个范围还没有计划</li>
          ) : (
            visibleTasks.map((task) => (
              <li key={task.id} className={task.done ? 'done' : ''}>
                <button
                  className="check"
                  onClick={() => onTaskToggle(task.id)}
                  aria-label={`完成 ${task.title}`}
                  aria-pressed={task.done}
                >
                  {task.done ? <Check size={14} /> : null}
                </button>
                <div>
                  <h3>{task.title}</h3>
                  <p>
                    {task.date ? formatDate(task.date) : '未排期'} ·{' '}
                    {task.meta}
                  </p>
                </div>
                <b>{task.time ?? '全天'}</b>
              </li>
            ))
          )}
        </ul>
      </section>

      <aside className="plan-panel plan-side" aria-labelledby="rhythm-title">
        <h2 id="rhythm-title">计划节奏</h2>

        <section aria-labelledby="distribution-title">
          <h3 id="distribution-title">
            <Target size={16} />
            分类分布
          </h3>
          <ul className="distribution-list" aria-label="分类分布">
            {distribution.map((item) => (
              <li key={item.label}>
                <div>
                  <span>{item.label}</span>
                  <b>{item.count} 项</b>
                </div>
                <div
                  className="distribution-track"
                  role="img"
                  aria-label={`${item.label} ${Math.round(
                    (item.count / distributionTotal) * 100,
                  )}%`}
                >
                  <span
                    style={{
                      width: `${Math.round(
                        (item.count / distributionTotal) * 100,
                      )}%`,
                    }}
                  />
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section className="upcoming" aria-labelledby="upcoming-title">
          <h3 id="upcoming-title">
            <CalendarRange size={16} />
            后续计划
          </h3>
          {upcomingTasks.length === 0 ? (
            <p>后面几天还留有空间。</p>
          ) : (
            <ul aria-label="后续计划">
              {upcomingTasks.map((task) => (
                <li key={task.id}>
                  <i>
                    <CalendarClock size={15} />
                  </i>
                  <div>
                    <h4>{task.title}</h4>
                    <p>
                      {task.date ? formatDate(task.date) : '未排期'}
                      {task.time ? ` · ${task.time}` : ''}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </aside>
    </div>
  )
}

function compareTasks(taskA: Task, taskB: Task) {
  const dateA = taskA.date ?? '9999-12-31'
  const dateB = taskB.date ?? '9999-12-31'

  if (dateA !== dateB) {
    return dateA.localeCompare(dateB)
  }

  return (taskA.time ?? '99:99').localeCompare(taskB.time ?? '99:99')
}

function getWeekRange(now: Date) {
  const start = new Date(now)
  start.setDate(now.getDate() - ((now.getDay() + 6) % 7))

  const end = new Date(start)
  end.setDate(start.getDate() + 6)

  return { start: toDateKey(start), end: toDateKey(end) }
}

function formatDate(date: string) {
  return date.replaceAll('-', '.')
}

function toDateKey(value: Date) {
  const month = String(value.getMonth() + 1).padStart(2, '0')
  const day = String(value.getDate()).padStart(2, '0')
  return `${value.getFullYear()}-${month}-${day}`
}

import { useEffect, useMemo, useState, type FormEvent } from 'react'
import {
  AlertTriangle,
  CalendarClock,
  Check,
  Pencil,
  Plus,
  Target,
  Trash2,
} from 'lucide-react'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { RecordDialog } from '../components/RecordDialog'
import type { Task, TaskCategory, TaskInput, TaskUpdateInput } from '../data/model'
import {
  filterTasks,
  groupTasks,
  summarizePlan,
  summarizePlanRhythm,
  type PlanRange,
  type PlanStatusFilter,
} from '../utils/planViews'
import './PlanQuickRecord.css'

type Props = {
  tasks: Task[]
  dialogOpen: boolean
  dialogOnly?: boolean
  onDialogOpen: () => void
  onDialogClose: () => void
  onSaved: (message: string) => void
  onTaskSubmit: (input: TaskInput) => void
  onTaskUpdate: (id: string, input: TaskUpdateInput) => void
  onTaskDelete: (id: string) => void
  onTaskToggle: (id: string) => void
  externalEditingTask?: Task | null
}

const taskCategoryLabels: Record<TaskCategory, string> = {
  work: '工作',
  health: '锻炼',
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

const statusLabels: Record<PlanStatusFilter, string> = {
  active: '进行中',
  all: '全部状态',
  done: '已完成',
}

const distributionLabels = {
  ...taskCategoryLabels,
  none: '未分类',
} as const

export function PlanQuickRecord({
  tasks,
  dialogOpen,
  dialogOnly = false,
  onDialogOpen,
  onDialogClose,
  onSaved,
  onTaskSubmit,
  onTaskUpdate,
  onTaskDelete,
  onTaskToggle,
  externalEditingTask,
}: Props) {
  const [now] = useState(() => new Date())
  const today = toDateKey(now)
  const [date, setDate] = useState(today)
  const [category, setCategory] = useState<TaskCategory>('work')
  const [time, setTime] = useState('')
  const [title, setTitle] = useState('')
  const [error, setError] = useState('')
  const [range, setRange] = useState<PlanRange>('today')
  const [status, setStatus] = useState<PlanStatusFilter>('active')
  const [categoryFilter, setCategoryFilter] = useState<TaskCategory | 'all'>(
    'all',
  )
  const [search, setSearch] = useState('')
  const [editingTaskId, setEditingTaskId] = useState<Task['id'] | null>(null)
  const [deletingTask, setDeletingTask] = useState<Task | null>(null)
  const externalEditingTaskId = externalEditingTask?.id

  useEffect(() => {
    if (!dialogOpen || !externalEditingTask) {
      return
    }

    setTitle(externalEditingTask.title)
    setDate(externalEditingTask.date ?? today)
    setCategory(externalEditingTask.category ?? 'work')
    setTime(externalEditingTask.time ?? '')
    setError('')
    setEditingTaskId(externalEditingTask.id)
  }, [dialogOpen, externalEditingTask, externalEditingTaskId, today])

  const filters = useMemo(() => ({
    range,
    status,
    category: categoryFilter,
    query: search,
  }), [range, status, categoryFilter, search])
  const scopedTasks = useMemo(
    () => filterTasks(tasks, { ...filters, status: 'all' }, now),
    [filters, now, tasks],
  )
  const visibleTasks = useMemo(
    () => filterTasks(tasks, filters, now),
    [filters, now, tasks],
  )
  const groups = useMemo(
    () => groupTasks(visibleTasks, now),
    [now, visibleTasks],
  )
  const summary = summarizePlan(tasks, now)
  const rhythm = summarizePlanRhythm(visibleTasks, scopedTasks, now)
  const distributionTotal = Math.max(1, visibleTasks.length)

  function openDialog() {
    setError('')
    setEditingTaskId(null)
    onDialogOpen()
  }

  function openEditDialog(task: Task) {
    setTitle(task.title)
    setDate(task.date ?? today)
    setCategory(task.category ?? 'work')
    setTime(task.time ?? '')
    setError('')
    setEditingTaskId(task.id)
    onDialogOpen()
  }

  function closeDialog() {
    setError('')
    setEditingTaskId(null)
    onDialogClose()
  }

  async function submit(event: FormEvent) {
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

    const taskInput = {
      title: normalizedTitle,
      date,
      category,
      time: time || undefined,
    }

    if (editingTaskId) {
      await onTaskUpdate(editingTaskId, taskInput)
    } else {
      await onTaskSubmit(taskInput)
    }
    setError('')
    setRange(date === today ? 'today' : 'all')
    onDialogClose()
    onSaved(editingTaskId ? '计划已更新' : '计划已保存')
  }

  const isEditing = editingTaskId !== null

  const taskDialog = (
    <RecordDialog
      activeTab="task"
      description="记录下一步要完成的动作。"
      onClose={closeDialog}
      open={dialogOpen}
      tabs={[{ id: 'task', label: '计划任务' }]}
      title={isEditing ? '编辑计划' : '添加计划'}
    >
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
        <button type="submit">{isEditing ? '更新计划' : '保存计划'}</button>
        </div>
        {error ? <p role="alert">{error}</p> : null}
      </form>
    </RecordDialog>
  )

  if (dialogOnly) {
    return taskDialog
  }

  return (
    <div className="plan-page">
      <section className="plan-panel plan-stream" aria-labelledby="plan-title">
        <div className="panel-heading">
          <div>
            <label>任务流水</label>
            <h2 id="plan-title">计划安排</h2>
          </div>
          <button className="page-add" onClick={openDialog} type="button">
            <Plus size={16} />
            添加计划
          </button>
        </div>

        <div className="plan-summary">
          <div>
            <label>今日任务</label>
            <strong>{summary.todayTotal} 项</strong>
            <small>{summary.todayActive} 项进行中</small>
          </div>
          <div>
            <label>本周任务</label>
            <strong>{summary.weekTotal} 项</strong>
            <small>按周一至周日计算</small>
          </div>
          <div>
            <label>完成率</label>
            <strong>{summary.completionPercent}%</strong>
            <small>本周已完成任务占比</small>
          </div>
        </div>

        <div className="plan-toolbar" aria-label="计划筛选">
          <div className="plan-filter-field search-field">
            <label htmlFor="plan-search">搜索</label>
            <input
              id="plan-search"
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="搜索事项或描述"
            />
          </div>
          <div className="plan-filter-field">
            <label htmlFor="plan-category-filter">分类</label>
            <select
              id="plan-category-filter"
              value={categoryFilter}
              onChange={(event) =>
                setCategoryFilter(event.target.value as TaskCategory | 'all')
              }
            >
              <option value="all">全部分类</option>
              {taskCategories.map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>
          <div className="plan-filter-field">
            <label htmlFor="plan-status-filter">状态</label>
            <select
              id="plan-status-filter"
              value={status}
              onChange={(event) =>
                setStatus(event.target.value as PlanStatusFilter)
              }
            >
              {(Object.keys(statusLabels) as PlanStatusFilter[]).map((item) => (
                <option key={item} value={item}>{statusLabels[item]}</option>
              ))}
            </select>
          </div>
          <div className="plan-range" role="group" aria-label="时间范围">
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
        </div>

        {groups.length === 0 ? (
          <div className="plan-empty">
            <h3>没有匹配的计划</h3>
            <p>调整筛选条件，或添加一项新计划。</p>
          </div>
        ) : (
          groups.map((group) => (
            <section
              className="plan-group"
              key={group.key}
              aria-labelledby={`plan-group-${group.key}`}
            >
              <div className="plan-group-heading">
                <h3 id={`plan-group-${group.key}`}>
                  {group.key === 'overdue' ? (
                    <AlertTriangle size={16} aria-hidden="true" />
                  ) : null}
                  {group.label}
                </h3>
                <span>{group.tasks.length} 项</span>
              </div>
              <ul className="plan-list" aria-label={`${group.label}任务`}>
                {group.tasks.map((task) => {
                  const isOverdue =
                    !task.done &&
                    task.date !== undefined &&
                    task.date < today

                  return (
                    <li
                      key={task.id}
                      className={`${task.done ? 'done' : ''} ${
                        isOverdue ? 'overdue' : ''
                      }`.trim()}
                    >
                      <button
                        className="check"
                        onClick={() => onTaskToggle(task.id)}
                        aria-label={`完成 ${task.title}`}
                        aria-pressed={task.done}
                      >
                        {task.done ? <Check size={16} /> : null}
                      </button>
                      <div>
                        <h4>{task.title}</h4>
                        <div className="task-tags">
                          <span className="task-tag category">
                            {getCategoryLabel(task.category)}
                          </span>
                          <span className="task-tag">
                            {task.date ? formatDate(task.date) : '未排期'}
                          </span>
                          <span className="task-tag">{task.time ?? '全天'}</span>
                          {isOverdue ? (
                            <span className="task-tag alert">逾期</span>
                          ) : null}
                          {task.done ? (
                            <span className="task-tag success">已完成</span>
                          ) : null}
                        </div>
                      </div>
                      <div className="record-actions">
                        <button
                          className="edit"
                          type="button"
                          onClick={() => openEditDialog(task)}
                          aria-label={`编辑 ${task.title}`}
                        >
                          <Pencil size={16} aria-hidden="true" />
                        </button>
                        <button
                          className="delete"
                          type="button"
                          onClick={() => setDeletingTask(task)}
                          aria-label={`删除 ${task.title}`}
                        >
                          <Trash2 size={16} aria-hidden="true" />
                        </button>
                      </div>
                    </li>
                  )
                })}
              </ul>
            </section>
          ))
        )}
      </section>

      <aside className="plan-panel plan-side" aria-labelledby="rhythm-title">
        <div className="panel-heading">
          <div>
            <label>筛选结果</label>
            <h2 id="rhythm-title">计划节奏</h2>
          </div>
        </div>

        <section className="side-metrics" aria-label="逾期与待排期">
          <div className={rhythm.overdueCount ? 'attention' : ''}>
            <label>逾期提醒</label>
            <strong>{rhythm.overdueCount} 项</strong>
            <small>
              {rhythm.overdueCount && rhythm.latestOverdueDate
                ? `最近日期 ${formatDate(rhythm.latestOverdueDate)}`
                : '当前没有逾期任务'}
            </small>
          </div>
          <div>
            <label>待排期</label>
            <strong>{rhythm.unscheduledCount} 项</strong>
            <small>
              {rhythm.unscheduledCount
                ? '这些任务还没有确定日期'
                : '所有进行中任务都有日期'}
            </small>
          </div>
          <div>
            <label>今日完成</label>
            <strong>
              {rhythm.todayCompleted}/{rhythm.todayTotal}
            </strong>
            <small>今天已收尾的任务</small>
          </div>
          <div>
            <label>本周完成</label>
            <strong>
              {rhythm.weekCompleted}/{rhythm.weekTotal}
            </strong>
            <small>周一到周日范围内</small>
          </div>
        </section>

        <section aria-labelledby="distribution-title">
          <h3 id="distribution-title">
            <Target size={16} aria-hidden="true" />
            分类分布
          </h3>
          <ul className="distribution-list" aria-label="分类分布">
            {rhythm.distribution.map((item) => {
              const label =
                distributionLabels[
                  item.category as keyof typeof distributionLabels
                ]
              const percent = Math.round((item.count / distributionTotal) * 100)

              return (
                <li key={item.category}>
                  <div>
                    <span>{label}</span>
                    <b>{item.count} 项</b>
                  </div>
                  <div
                    className="distribution-track"
                    role="img"
                    aria-label={`${label} ${percent}%`}
                  >
                    <span style={{ width: `${percent}%` }} />
                  </div>
                </li>
              )
            })}
          </ul>
        </section>

        <section className="rhythm-note" aria-label="节奏提示">
          <h3>
            <CalendarClock size={16} aria-hidden="true" />
            当前提示
          </h3>
          <p>
            {rhythm.overdueCount
              ? `先处理 ${rhythm.overdueCount} 项逾期任务，再进入今天安排。`
              : rhythm.unscheduledCount
                ? `还有 ${rhythm.unscheduledCount} 项任务待排期。`
                : '当前筛选下没有阻塞项，可以按日期继续推进。'}
          </p>
        </section>
      </aside>

      <ConfirmDialog
        description={`删除“${deletingTask?.title ?? ''}”后无法恢复。`}
        onCancel={() => setDeletingTask(null)}
        onConfirm={() => {
          if (deletingTask) {
            onTaskDelete(deletingTask.id)
          }
          setDeletingTask(null)
          onSaved('计划已删除')
        }}
        open={deletingTask !== null}
        title="删除计划"
      />

      {taskDialog}
    </div>
  )
}

function getCategoryLabel(category?: TaskCategory) {
  return category ? taskCategoryLabels[category] : '未分类'
}

function formatDate(date: string) {
  return date.replaceAll('-', '.')
}

function toDateKey(value: Date) {
  const month = String(value.getMonth() + 1).padStart(2, '0')
  const day = String(value.getDate()).padStart(2, '0')
  return `${value.getFullYear()}-${month}-${day}`
}

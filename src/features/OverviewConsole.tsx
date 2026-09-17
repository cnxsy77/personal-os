import { useState, type ReactNode } from 'react'
import {
  BookOpen,
  Check,
  CircleAlert,
  Dumbbell,
  FolderGit2,
  Pencil,
  Target,
  Trash2,
  Wallet,
} from 'lucide-react'
import { ConfirmDialog } from '../components/ConfirmDialog'
import type { PersonalOSState, Task } from '../data/model'
import {
  getCompletedWorkoutsThisWeek,
  workoutKindLabels,
} from '../utils/health'
import { summarizeFinance } from '../utils/finance'
import {
  formatStudyDuration,
  getRecentStudyMinutes,
  getStudyMinutesOnDate,
  toDateKey,
} from '../utils/study'
import './OverviewConsole.css'

type RecordFilter = 'all' | 'task' | 'workout' | 'finance' | 'learning' | 'project'

type OverviewRecord = {
  id: string
  domain: Exclude<RecordFilter, 'all'>
  title: string
  keyData: string
  timing: string
  status: string
  tone: 'neutral' | 'positive' | 'warning' | 'danger'
  task?: Task
}

type Decision = {
  id: string
  title: string
  detail: string
}

type OverviewConsoleProps = {
  state: PersonalOSState
  onTaskToggle: (id: string) => void
  onTaskEdit?: (task: Task) => void
  onTaskDelete: (id: string) => void
}

const filterLabels: Record<RecordFilter, string> = {
  all: '全部',
  task: '任务',
  workout: '训练',
  finance: '收支',
  learning: '学习',
  project: '项目',
}

const filters = Object.entries(filterLabels) as Array<[RecordFilter, string]>

const domainNames: Record<OverviewRecord['domain'], string> = {
  task: '计划',
  workout: '锻炼',
  finance: '记账',
  learning: '学习',
  project: '工作台',
}

export function OverviewConsole({
  state,
  onTaskToggle,
  onTaskEdit,
  onTaskDelete,
}: OverviewConsoleProps) {
  const [filter, setFilter] = useState<RecordFilter>('all')
  const [deletingTask, setDeletingTask] = useState<Task | null>(null)
  const now = new Date()
  const today = toDateKey(now)
  const todayTasks = state.tasks.filter((task) => task.date === today)
  const doneTodayCount = todayTasks.filter((task) => task.done).length
  const remainingTodayCount = todayTasks.length - doneTodayCount
  const financeSummary = summarizeFinance(
    state.transactions,
    state.monthlyBudgetCents,
    now,
  )
  const monthExpense = financeSummary.monthExpenseCents
  const budgetRemaining = Math.max(0, state.monthlyBudgetCents - monthExpense)
  const completedWorkouts = getCompletedWorkoutsThisWeek(state.workouts, now)
  const weeklyWorkoutTarget = state.settings.weeklyWorkoutTarget
  const weekStudyMinutes = getRecentStudyMinutes(state.studyLogs, now)
  const todayStudyMinutes = getStudyMinutesOnDate(state.studyLogs, today)
  const records = buildRecords(state, now)
  const visibleRecords =
    filter === 'all' ? records : records.filter((record) => record.domain === filter)
  const priorities = [...todayTasks].sort(compareTasks)
  const decisions = buildDecisions(state, monthExpense, now)

  return (
    <div className="overview-console">
      <section className="overview-kpis" aria-label="核心指标">
        <Kpi
          label="今日待办"
          value={`${todayTasks.length}`}
          note={`${remainingTodayCount} 项剩余`}
        />
        <Kpi
          label="本周训练"
          value={`${completedWorkouts.length}/${weeklyWorkoutTarget}`}
          note={`目标 ${weeklyWorkoutTarget} 次`}
        />
        <Kpi
          label="预算剩余"
          value={formatCents(budgetRemaining)}
          note={`已使用 ${formatCents(monthExpense)}`}
        />
        <Kpi
          label="近 7 天学习"
          value={formatStudyDuration(weekStudyMinutes)}
          note={`今日 ${formatStudyDuration(todayStudyMinutes)}`}
        />
      </section>

      <section className="overview-panel domain-progress" aria-labelledby="domain-progress-title">
        <header className="overview-panel-heading">
          <h2 id="domain-progress-title">四个领域进度</h2>
          <span>由当前记录实时计算</span>
        </header>
        <div className="progress-grid">
          <ProgressCard
            label="锻炼进度"
            icon={<Dumbbell size={17} />}
            domain="锻炼"
            primary={`${completedWorkouts.length}/${weeklyWorkoutTarget}`}
            caption="本周完成训练"
            percent={Math.round((completedWorkouts.length / weeklyWorkoutTarget) * 100)}
            tone="health"
          />
          <ProgressCard
            label="记账进度"
            icon={<Wallet size={17} />}
            domain="记账"
            primary={`${Math.round((monthExpense / state.monthlyBudgetCents) * 100)}% 已使用`}
            caption={`剩余 ${formatCents(budgetRemaining)}`}
            percent={Math.round((monthExpense / state.monthlyBudgetCents) * 100)}
            tone="finance"
          />
          <ProgressCard
            label="学习进度"
            icon={<BookOpen size={17} />}
            domain="学习"
            primary={`${getLearningProgress(state)}% 平均进度`}
            caption={`${state.learningPaths.length} 条路径`}
            percent={getLearningProgress(state)}
            tone="learning"
          />
          <ProgressCard
            label="工作台进度"
            icon={<FolderGit2 size={17} />}
            domain="工作台"
            primary={`${state.projects.filter((project) => project.status === 'done').length}/${state.projects.length} 项目已完成`}
            caption={`${state.projects.filter((project) => project.status === 'active').length} 个进行中`}
            percent={Math.round(
              (state.projects.filter((project) => project.status === 'done').length /
                Math.max(1, state.projects.length)) * 100,
            )}
            tone="work"
          />
        </div>
      </section>

      <div className="overview-grid">
        <section className="overview-panel record-panel" aria-labelledby="record-title">
          <header className="overview-panel-heading">
            <h2 id="record-title">记录明细</h2>
            <span>{visibleRecords.length} 条记录</span>
          </header>
          <div className="overview-filters" role="group" aria-label="记录领域筛选">
            {filters.map(([value, label]) => (
              <button
                aria-label={`筛选${label}`}
                aria-pressed={filter === value}
                className={filter === value ? 'selected' : ''}
                key={value}
                onClick={() => setFilter(value)}
                type="button"
              >
                {label}
              </button>
            ))}
          </div>

          {visibleRecords.length === 0 ? (
            <p className="overview-empty">当前筛选下没有记录。</p>
          ) : (
            <div className="record-table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>内容</th>
                    <th>领域</th>
                    <th>关键数据</th>
                    <th>时间</th>
                    <th>状态</th>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleRecords.map((record) => (
                    <tr key={`${record.domain}-${record.id}`}>
                      <td>
                        <span className="record-name">
                          {record.task ? (
                            <button
                              aria-label={`完成 ${record.title}`}
                              aria-pressed={record.task.done}
                              className="record-check"
                              onClick={() => onTaskToggle(record.task?.id ?? '')}
                              type="button"
                            >
                              {record.task.done ? <Check size={13} /> : null}
                            </button>
                          ) : (
                            <RecordIcon domain={record.domain} />
                          )}
                          <b>{record.title}</b>
                        </span>
                      </td>
                      <td>{domainNames[record.domain]}</td>
                      <td>{record.keyData}</td>
                      <td>{record.timing}</td>
                      <td>
                        <span className={`record-status ${record.tone}`}>
                          <i aria-hidden="true" />
                          {record.status}
                        </span>
                      </td>
                      <td>
                        {record.task ? (
                          <div className="record-actions">
                            <button
                              aria-label={`编辑${record.title}`}
                              onClick={() => onTaskEdit?.(record.task as Task)}
                              type="button"
                            >
                              <Pencil size={15} />
                            </button>
                            <button
                              aria-label={`删除${record.title}`}
                              className="delete"
                              onClick={() => setDeletingTask(record.task as Task)}
                              type="button"
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <div className="overview-side">
          <section className="overview-panel" aria-labelledby="priority-title">
            <header className="overview-panel-heading">
              <h2 id="priority-title">今日优先</h2>
              <span>{todayTasks.length} 项</span>
            </header>
            {priorities.length === 0 ? (
              <p className="overview-empty">今天没有排期任务。</p>
            ) : (
              <ul className="priority-list">
                {priorities.map((task) => (
                  <li key={task.id}>
                    <b>{task.title}</b>
                    <p>
                      {task.time ?? '全天'} · {task.meta}
                      {task.done ? ' · 已完成' : ''}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="overview-panel completion-panel" aria-labelledby="completion-title">
            <header className="overview-panel-heading">
              <h2 id="completion-title">今日完成率</h2>
              <span>计划任务</span>
            </header>
            <div
              aria-label={`已完成 ${doneTodayCount} / ${todayTasks.length}`}
              className="completion-ring"
              role="img"
            >
              <b>{doneTodayCount}/{todayTasks.length}</b>
              <span>{Math.round((doneTodayCount / Math.max(1, todayTasks.length)) * 100)}%</span>
            </div>
          </section>

          <section className="overview-panel decision-panel" aria-labelledby="decision-title">
            <header className="overview-panel-heading">
              <h2 id="decision-title">需要决策</h2>
              <span className={decisions.length > 0 ? 'decision-count' : ''}>
                {decisions.length} 项
              </span>
            </header>
            <ul className="decision-list" aria-label="需要决策">
              {decisions.length === 0 ? (
                <li className="overview-empty">当前没有需要决策的事项。</li>
              ) : (
                decisions.map((decision) => (
                  <li key={decision.id}>
                    <b>
                      <CircleAlert size={16} />
                      {decision.title}
                    </b>
                    <p>{decision.detail}</p>
                  </li>
                ))
              )}
            </ul>
          </section>
        </div>

      </div>

      <ConfirmDialog
        description={`删除“${deletingTask?.title ?? ''}”后无法恢复。`}
        onCancel={() => setDeletingTask(null)}
        onConfirm={() => {
          if (deletingTask) {
            onTaskDelete(deletingTask.id)
          }
          setDeletingTask(null)
        }}
        open={deletingTask !== null}
        title="删除任务"
      />
    </div>
  )
}

function Kpi({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <article className="overview-kpi">
      <label>{label}</label>
      <strong>{value}</strong>
      <span>{note}</span>
    </article>
  )
}

function ProgressCard({
  caption,
  domain,
  icon,
  label,
  percent,
  primary,
  tone,
}: {
  caption: string
  domain: string
  icon: ReactNode
  label: string
  percent: number
  primary: string
  tone: 'health' | 'finance' | 'learning' | 'work'
}) {
  return (
    <article aria-label={label} className="domain-progress-card">
      <div className="domain-title">
        <span className={`domain-chip ${tone}`}>
          {icon}
          {domain}
        </span>
        <b>{percent}%</b>
      </div>
      <strong>{primary}</strong>
      <p>{caption}</p>
      <div className="overview-track">
        <span className={tone} style={{ width: `${Math.min(100, Math.max(0, percent))}%` }} />
      </div>
    </article>
  )
}

function RecordIcon({ domain }: { domain: OverviewRecord['domain'] }) {
  if (domain === 'workout') {
    return <Dumbbell size={15} />
  }

  if (domain === 'finance') {
    return <Wallet size={15} />
  }

  if (domain === 'learning') {
    return <BookOpen size={15} />
  }

  if (domain === 'project') {
    return <FolderGit2 size={15} />
  }

  return <Target size={15} />
}

function buildRecords(state: PersonalOSState, now: Date): OverviewRecord[] {
  const taskRecords: OverviewRecord[] = state.tasks.map((task) => ({
    id: task.id,
    domain: 'task' as const,
    title: task.title,
    keyData: task.meta,
    timing: task.date === toDateKey(now) ? task.time ?? '全天' : task.date ?? '未排期',
    status: task.done ? '已完成' : '待完成',
    tone: task.done ? 'positive' : 'warning',
    task,
  }))
  const workoutRecords: OverviewRecord[] = state.workouts.map((workout) => ({
    id: workout.id,
    domain: 'workout' as const,
    title: `${(
      workout.kinds?.length ? workout.kinds : [workout.kind]
    ).map((kind) => workoutKindLabels[kind]).join(' / ')}训练`,
    keyData: `${workout.durationMinutes} 分钟`,
    timing: formatDate(workout.date),
    status: '已记录',
    tone: 'positive',
  }))
  const financeRecords: OverviewRecord[] = state.transactions.map((transaction) => ({
    id: transaction.id,
    domain: 'finance' as const,
    title: transaction.category,
    keyData: transaction.kind === 'expense'
      ? `-${formatCents(transaction.amountCents)}`
      : transaction.kind === 'income'
        ? `+${formatCents(transaction.amountCents)}`
        : formatCents(transaction.amountCents),
    timing: formatDate(transaction.date),
    status: '已记录',
    tone: 'neutral' as const,
  }))
  const learningRecords: OverviewRecord[] = state.studyLogs.map((log) => ({
    id: log.id,
    domain: 'learning' as const,
    title: log.topic,
    keyData: formatStudyDuration(log.minutes),
    timing: formatDate(log.date),
    status: '已记录',
    tone: 'neutral' as const,
  }))
  const projectRecords: OverviewRecord[] = state.projects.map((project) => ({
    id: project.id,
    domain: 'project' as const,
    title: project.name,
    keyData: project.dueDate ? `截止 ${formatDate(project.dueDate)}` : '未设置截止',
    timing: project.dueDate ? formatDate(project.dueDate) : '持续',
    status: getProjectStatusLabel(project.status),
    tone:
      project.status === 'done'
        ? 'positive'
        : project.status === 'blocked'
          ? 'danger'
          : project.status === 'active'
            ? 'warning'
            : 'neutral',
  }))

  return [
    ...taskRecords,
    ...workoutRecords,
    ...financeRecords,
    ...learningRecords,
    ...projectRecords,
  ]
}

function buildDecisions(state: PersonalOSState, monthExpense: number, now: Date): Decision[] {
  const decisions: Decision[] = []

  if (monthExpense > state.monthlyBudgetCents) {
    const overAmount = Math.ceil((monthExpense - state.monthlyBudgetCents) / 100)
    decisions.push({
      id: 'budget-over',
      title: `预算已超支 ¥${overAmount}`,
      detail: '请复核本月支出',
    })
  }

  state.projects
    .filter((project) => project.status === 'blocked')
    .forEach((project) => {
      decisions.push({
        id: `blocked-${project.id}`,
        title: `${project.name} 项目受阻`,
        detail: `下一步：${project.nextAction}`,
      })
    })

  const horizon = toDateKey(addDays(now, 7))
  state.projects
    .filter(
      (project) =>
        project.status !== 'done' &&
        project.dueDate !== undefined &&
        project.dueDate <= horizon,
    )
    .forEach((project) => {
      decisions.push({
        id: `due-${project.id}`,
        title: `${project.name} 七日内到期`,
        detail: project.dueDate
          ? `截止 ${formatDate(project.dueDate)} · ${project.nextAction}`
          : project.nextAction,
      })
    })

  return decisions
}

function getLearningProgress(state: PersonalOSState) {
  if (state.learningPaths.length === 0) {
    return 0
  }

  const total = state.learningPaths.reduce((sum, path) => {
    const learnedMinutes = state.studyLogs
      .filter((log) => log.pathId === path.id)
      .reduce((pathTotal, log) => pathTotal + log.minutes, 0)

    return sum + Math.min(1, learnedMinutes / path.targetMinutes) * 100
  }, 0)

  return Math.round(total / state.learningPaths.length)
}

function getProjectStatusLabel(status: PersonalOSState['projects'][number]['status']) {
  if (status === 'active') {
    return '进行中'
  }

  if (status === 'blocked') {
    return '受阻'
  }

  if (status === 'done') {
    return '已完成'
  }

  return '计划中'
}

function addDays(value: Date, days: number) {
  const next = new Date(value)
  next.setDate(next.getDate() + days)

  return next
}

function compareTasks(taskA: Task, taskB: Task) {
  if (taskA.done !== taskB.done) {
    return taskA.done ? 1 : -1
  }

  return (taskA.time ?? '99:99').localeCompare(taskB.time ?? '99:99')
}

function formatDate(date: string) {
  return date.replaceAll('-', '.')
}

function formatCents(cents: number) {
  return `¥${(cents / 100).toFixed(2).replace(/\.00$/, '')}`
}

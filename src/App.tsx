import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import {
  BookOpen,
  Check,
  ChevronRight,
  Dumbbell,
  FolderGit2,
  HardDrive,
  LayoutDashboard,
  Plus,
  Target,
  Wallet,
} from 'lucide-react'
import { createLocalPersonalOSData } from './data/localPersonalOSData'
import type { PersonalOSData, Transaction } from './data/model'
import { usePersonalOSData } from './data/usePersonalOSData'
import { RecordDialog } from './components/RecordDialog'
import { Toast } from './components/Toast'
import { FinanceQuickRecord } from './features/FinanceQuickRecord'
import { HealthQuickRecord } from './features/HealthQuickRecord'
import { LearningQuickRecord } from './features/LearningQuickRecord'
import { PlanQuickRecord } from './features/PlanQuickRecord'
import { WorkbenchQuickRecord } from './features/WorkbenchQuickRecord'
import {
  getCompletedWorkoutsThisWeek,
  getLatestHealthMetric,
  weeklyWorkoutTarget,
  workoutKindLabels,
} from './utils/health'
import {
  formatStudyDuration,
  getRecentStudyMinutes,
  getStudyMinutesOnDate,
  toDateKey,
} from './utils/study'
import './App.css'
import './globalScale.css'

const menu = [
  [LayoutDashboard, '概览'],
  [Target, '计划'],
  [Dumbbell, '健康'],
  [Wallet, '财务'],
  [BookOpen, '学习'],
  [FolderGit2, '工作台'],
] as const

const domainChoices = [
  [Target, 'plan', '计划', 'task'],
  [Dumbbell, 'health', '健康', 'workout'],
  [Wallet, 'finance', '财务', 'transaction'],
  [BookOpen, 'learning', '学习', 'log'],
  [FolderGit2, 'workbench', '工作台', 'project'],
] as const

const defaultData = createLocalPersonalOSData()

type QuickRecordDomain = 'plan' | 'health' | 'finance' | 'learning' | 'workbench'

type QuickRecordTarget = {
  domain: QuickRecordDomain
  tab?: string
}

type AppProps = {
  data?: PersonalOSData
}

export default function App({ data = defaultData }: AppProps) {
  const [active, setActive] = useState('概览')
  const [mobileOpen, setMobileOpen] = useState(false)
  const [quickRecord, setQuickRecord] = useState<QuickRecordTarget | null>(null)
  const [domainPickerOpen, setDomainPickerOpen] = useState(false)
  const [toastMessage, setToastMessage] = useState('')
  const toastTimerRef = useRef<number | undefined>(undefined)
  const state = usePersonalOSData(data)
  const doneCount = state.tasks.filter((task) => task.done).length
  const todayExpense = sumTodayExpenses(state.transactions)
  const monthExpense = sumMonthExpenses(state.transactions)
  const budgetRemaining = Math.max(0, state.monthlyBudgetCents - monthExpense)
  const now = new Date()
  const todayStudyMinutes = getStudyMinutesOnDate(state.studyLogs, toDateKey(now))
  const weekStudyMinutes = getRecentStudyMinutes(state.studyLogs, now)
  const weeklyCompletedWorkouts = getCompletedWorkoutsThisWeek(state.workouts, now)
  const latestCompletedWorkout = weeklyCompletedWorkouts[0]
  const latestHealthMetric = getLatestHealthMetric(state.healthMetrics)
  const healthTitle = latestCompletedWorkout
    ? `${workoutKindLabels[latestCompletedWorkout.kind]}训练`
    : '暂无训练'
  const healthText = `本周 ${weeklyCompletedWorkouts.length} / ${weeklyWorkoutTarget} 次${
    latestHealthMetric ? ` · 睡眠 ${latestHealthMetric.sleepHours} 小时` : ''
  }`

  const closeQuickRecord = useCallback(() => {
    setQuickRecord(null)
  }, [])

  const closeDomainPicker = useCallback(() => {
    setDomainPickerOpen(false)
  }, [])

  const openQuickRecord = useCallback(
    (domain: QuickRecordDomain, tab?: string) => {
      setQuickRecord({ domain, tab })
      setDomainPickerOpen(false)
    },
    [],
  )

  const showSavedToast = useCallback((message: string) => {
    window.clearTimeout(toastTimerRef.current)
    setToastMessage(message)
    toastTimerRef.current = window.setTimeout(() => {
      setToastMessage('')
    }, 3000)
  }, [])

  function selectPage(name: string) {
    setActive(name)
    setQuickRecord(null)
    setDomainPickerOpen(false)
    setMobileOpen(false)
  }

  useEffect(() => {
    return () => window.clearTimeout(toastTimerRef.current)
  }, [])

  return (
    <main className="app">
      <aside className={mobileOpen ? 'open' : ''}>
        <div className="brand">
          <b>P</b>
          <strong>Personal OS</strong>
        </div>
        <nav aria-label="主菜单">
          {menu.map(([Icon, name]) => (
            <button
              key={name}
              onClick={() => selectPage(name)}
              className={active === name ? 'active' : ''}
              aria-current={active === name ? 'page' : undefined}
            >
              <Icon size={18} />
              <span>{name}</span>
            </button>
          ))}
        </nav>
        <small><i />本地数据已同步</small>
      </aside>

      <section className="content">
        <header>
          <button
            className="hamburger"
            onClick={() => setMobileOpen((open) => !open)}
            aria-expanded={mobileOpen}
            aria-label="打开菜单"
          >
            ☰
          </button>
          <div>
            <label>{formatToday()}</label>
            <h1>{active === '概览' ? '早上好，xqx。' : active}</h1>
          </div>
          <button
            className="add"
            onClick={() => {
              if (active === '概览') {
                setDomainPickerOpen(true)
              } else if (active === '计划') {
                openQuickRecord('plan', 'task')
              } else if (active === '健康') {
                openQuickRecord('health', 'workout')
              } else if (active === '财务') {
                openQuickRecord('finance', 'transaction')
              } else if (active === '学习') {
                openQuickRecord('learning', 'log')
              } else if (active === '工作台') {
                openQuickRecord('workbench', 'project')
              }
            }}
          >
            <Plus size={16} />
            快速记录
          </button>
        </header>

        {active === '计划' ? (
          <PlanQuickRecord
            tasks={state.tasks}
            dialogOpen={quickRecord?.domain === 'plan'}
            onDialogOpen={() => openQuickRecord('plan', 'task')}
            onDialogClose={closeQuickRecord}
            onSaved={showSavedToast}
            onTaskSubmit={data.addTask}
            onTaskToggle={data.toggleTask}
          />
        ) : active === '财务' ? (
          <FinanceQuickRecord
            monthlyBudgetCents={state.monthlyBudgetCents}
            transactions={state.transactions}
            dialogOpen={quickRecord?.domain === 'finance'}
            dialogTab={quickRecord?.tab ?? 'transaction'}
            onDialogOpen={(tab) => openQuickRecord('finance', tab)}
            onDialogClose={closeQuickRecord}
            onSaved={showSavedToast}
            onSubmit={data.recordTransaction}
            onBudgetSubmit={data.updateMonthlyBudget}
          />
        ) : active === '学习' ? (
          <LearningQuickRecord
            studyLogs={state.studyLogs}
            learningPaths={state.learningPaths}
            learningResources={state.learningResources}
            weeklyReviews={state.weeklyReviews}
            dialogOpen={quickRecord?.domain === 'learning'}
            dialogTab={quickRecord?.tab ?? 'log'}
            onDialogOpen={(tab) => openQuickRecord('learning', tab)}
            onDialogClose={closeQuickRecord}
            onSaved={showSavedToast}
            onSubmit={data.recordStudyLog}
            onPathSubmit={data.addLearningPath}
            onResourceSubmit={data.addLearningResource}
            onResourceStatusChange={data.setLearningResourceStatus}
            onReviewSubmit={data.saveWeeklyReview}
          />
        ) : active === '健康' ? (
          <HealthQuickRecord
            workouts={state.workouts}
            healthMetrics={state.healthMetrics}
            dialogOpen={quickRecord?.domain === 'health'}
            dialogTab={quickRecord?.tab ?? 'workout'}
            onDialogOpen={(tab) => openQuickRecord('health', tab)}
            onDialogClose={closeQuickRecord}
            onSaved={showSavedToast}
            onWorkoutSubmit={data.recordWorkout}
            onWorkoutStatusChange={data.setWorkoutStatus}
            onMetricSubmit={data.saveHealthMetric}
          />
        ) : active === '工作台' ? (
          <WorkbenchQuickRecord
            projects={state.projects}
            dialogOpen={quickRecord?.domain === 'workbench'}
            dialogTab={quickRecord?.tab ?? 'project'}
            onDialogOpen={(tab) => openQuickRecord('workbench', tab)}
            onDialogClose={closeQuickRecord}
            onSaved={showSavedToast}
            onProjectSubmit={data.addProject}
            onProjectStatusChange={data.setProjectStatus}
          />
        ) : (
          <>
            <section className="focus">
              <div>
                <label>今日焦点</label>
                <h2>把精力留给真正重要的三件事。</h2>
                <p>
                  今天还有 {state.tasks.length - doneCount} 项重点待完成；先专注当前任务。
                </p>
              </div>
              <div className="score">
                <b>{doneCount}/{state.tasks.length}</b>
                <span>已完成</span>
              </div>
            </section>

            <div className="heading">
              <div>
                <label>TODAY</label>
                <h2>今日行动</h2>
              </div>
              <button>
                查看日程
                <ChevronRight size={16} />
              </button>
            </div>
            <div className="tasks">
              {state.tasks.map((task, index) => (
                <article key={task.id} className={task.done ? 'done' : ''}>
                  <button
                    className="check"
                    onClick={() => data.toggleTask(task.id)}
                    aria-label={`完成 ${task.title}`}
                    aria-pressed={task.done}
                  >
                    {task.done ? <Check size={14} /> : null}
                  </button>
                  <em>{String(index + 1).padStart(2, '0')}</em>
                  <div>
                    <h3>{task.title}</h3>
                    <p>{task.meta}</p>
                  </div>
                  <ChevronRight size={18} />
                </article>
              ))}
            </div>

            <div className="heading pulse">
              <div>
                <label>LIFE PULSE</label>
                <h2>生活脉搏</h2>
              </div>
            </div>
            <div className="cards">
              <Card
                icon={<Dumbbell />}
                name="健康"
                title={healthTitle}
                text={healthText}
              />
              <Card
                icon={<Wallet />}
                name="财务"
                title={formatCents(todayExpense)}
                text={`今日支出 · 预算剩余 ${formatCents(budgetRemaining)}`}
              />
              <Card
                icon={<BookOpen />}
                name="学习"
                title={formatStudyDuration(todayStudyMinutes)}
                text={`今日学习 · 近 7 天 ${formatStudyDuration(weekStudyMinutes)}`}
              />
              <Card icon={<HardDrive />} name="电脑" title="状态良好" text="可用空间 184 GB" />
            </div>
          </>
        )}

        {active === '概览' && quickRecord?.domain === 'plan' ? (
          <PlanQuickRecord
            tasks={state.tasks}
            dialogOpen
            dialogOnly
            onDialogOpen={() => openQuickRecord('plan', 'task')}
            onDialogClose={closeQuickRecord}
            onSaved={showSavedToast}
            onTaskSubmit={data.addTask}
            onTaskToggle={data.toggleTask}
          />
        ) : null}

        {active === '概览' && quickRecord?.domain === 'health' ? (
          <HealthQuickRecord
            workouts={state.workouts}
            healthMetrics={state.healthMetrics}
            dialogOpen
            dialogTab={quickRecord.tab ?? 'workout'}
            dialogOnly
            onDialogOpen={(tab) => openQuickRecord('health', tab)}
            onDialogClose={closeQuickRecord}
            onSaved={showSavedToast}
            onWorkoutSubmit={data.recordWorkout}
            onWorkoutStatusChange={data.setWorkoutStatus}
            onMetricSubmit={data.saveHealthMetric}
          />
        ) : null}

        {active === '概览' && quickRecord?.domain === 'finance' ? (
          <FinanceQuickRecord
            monthlyBudgetCents={state.monthlyBudgetCents}
            transactions={state.transactions}
            dialogOpen
            dialogTab={quickRecord.tab ?? 'transaction'}
            dialogOnly
            onDialogOpen={(tab) => openQuickRecord('finance', tab)}
            onDialogClose={closeQuickRecord}
            onSaved={showSavedToast}
            onSubmit={data.recordTransaction}
            onBudgetSubmit={data.updateMonthlyBudget}
          />
        ) : null}

        {active === '概览' && quickRecord?.domain === 'learning' ? (
          <LearningQuickRecord
            studyLogs={state.studyLogs}
            learningPaths={state.learningPaths}
            learningResources={state.learningResources}
            weeklyReviews={state.weeklyReviews}
            dialogOpen
            dialogTab={quickRecord.tab ?? 'log'}
            dialogOnly
            onDialogOpen={(tab) => openQuickRecord('learning', tab)}
            onDialogClose={closeQuickRecord}
            onSaved={showSavedToast}
            onSubmit={data.recordStudyLog}
            onPathSubmit={data.addLearningPath}
            onResourceSubmit={data.addLearningResource}
            onResourceStatusChange={data.setLearningResourceStatus}
            onReviewSubmit={data.saveWeeklyReview}
          />
        ) : null}

        {active === '概览' && quickRecord?.domain === 'workbench' ? (
          <WorkbenchQuickRecord
            projects={state.projects}
            dialogOpen
            dialogTab={quickRecord.tab ?? 'project'}
            dialogOnly
            onDialogOpen={(tab) => openQuickRecord('workbench', tab)}
            onDialogClose={closeQuickRecord}
            onSaved={showSavedToast}
            onProjectSubmit={data.addProject}
            onProjectStatusChange={data.setProjectStatus}
          />
        ) : null}

        <RecordDialog
          description="选择要记录的内容领域。"
          onClose={closeDomainPicker}
          open={domainPickerOpen}
          title="选择记录领域"
        >
          <div className="domain-choice-list">
            {domainChoices.map(([Icon, domain, label, tab]) => (
              <button
                aria-label={`选择${label}`}
                className="domain-choice"
                key={domain}
                onClick={() => openQuickRecord(domain, tab)}
                type="button"
              >
                <Icon size={20} />
                <span>{label}</span>
              </button>
            ))}
          </div>
        </RecordDialog>

        {toastMessage ? <Toast message={toastMessage} /> : null}
      </section>
    </main>
  )
}

function Card({
  icon,
  name,
  title,
  text,
}: {
  icon: ReactNode
  name: string
  title: string
  text: string
}) {
  return (
    <article className="card">
      <i>{icon}</i>
      <label>{name}</label>
      <h3>{title}</h3>
      <p>{text}</p>
    </article>
  )
}

function sumTodayExpenses(transactions: Transaction[]) {
  const today = toDateKey(new Date())

  return transactions
    .filter((item) => item.date === today && item.kind === 'expense')
    .reduce((total, item) => total + item.amountCents, 0)
}

function sumMonthExpenses(transactions: Transaction[]) {
  const now = new Date()
  const monthPrefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

  return transactions
    .filter((item) => item.date.startsWith(monthPrefix) && item.kind === 'expense')
    .reduce((total, item) => total + item.amountCents, 0)
}

function formatCents(cents: number) {
  return `¥${(cents / 100).toFixed(2).replace(/\.00$/, '')}`
}

function formatToday() {
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'long',
  }).format(new Date())
}

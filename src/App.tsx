import { useCallback, useEffect, useRef, useState } from 'react'
import {
  BookOpen,
  Dumbbell,
  FolderGit2,
  LayoutDashboard,
  Plus,
  Target,
  Wallet,
} from 'lucide-react'
import { createLocalPersonalOSData } from './data/localPersonalOSData'
import type { PersonalOSData } from './data/model'
import { usePersonalOSData } from './data/usePersonalOSData'
import { RecordDialog } from './components/RecordDialog'
import { Toast } from './components/Toast'
import { FinanceQuickRecord } from './features/FinanceQuickRecord'
import { HealthQuickRecord } from './features/HealthQuickRecord'
import { LearningQuickRecord } from './features/LearningQuickRecord'
import { PlanQuickRecord } from './features/PlanQuickRecord'
import { WorkbenchQuickRecord } from './features/WorkbenchQuickRecord'
import { OverviewConsole } from './features/OverviewConsole'
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
            onWorkoutUpdate={data.updateWorkout}
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
          <OverviewConsole state={state} onTaskToggle={data.toggleTask} />
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
            onWorkoutUpdate={data.updateWorkout}
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

function formatToday() {
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'long',
  }).format(new Date())
}

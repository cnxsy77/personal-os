import { useCallback, useEffect, useRef, useState } from 'react'
import {
  BookOpen,
  Dumbbell,
  FolderGit2,
  LayoutDashboard,
  Plus,
  Settings,
  Sparkles,
  Target,
  Wallet,
} from 'lucide-react'
import { createRemotePersonalOSData } from './data/remotePersonalOSData'
import type { PersonalOSData, Task } from './data/model'
import { usePersonalOSData } from './data/usePersonalOSData'
import { RecordDialog } from './components/RecordDialog'
import { SettingsDrawer } from './components/SettingsDrawer'
import { AIDrawer } from './components/AIDrawer'
import { Toast } from './components/Toast'
import { FinanceQuickRecord } from './features/FinanceQuickRecord'
import { HealthQuickRecord } from './features/HealthQuickRecord'
import { LearningQuickRecord } from './features/LearningQuickRecord'
import { PlanQuickRecord } from './features/PlanQuickRecord'
import { WorkbenchQuickRecord } from './features/WorkbenchQuickRecord'
import { OverviewConsole } from './features/OverviewConsole'
import './App.css'
import './globalScale.css'

type PageId =
  | 'overview'
  | 'plan'
  | 'health'
  | 'finance'
  | 'learning'
  | 'workbench'

const menu = [
  [LayoutDashboard, 'overview', '概览'],
  [Target, 'plan', '计划'],
  [Dumbbell, 'health', '锻炼'],
  [Wallet, 'finance', '记账'],
  [BookOpen, 'learning', '学习'],
  [FolderGit2, 'workbench', '工作台'],
] as const

const domainChoices = [
  [Target, 'plan', '计划', 'task'],
  [Dumbbell, 'health', '锻炼', 'workout'],
  [Wallet, 'finance', '记账', 'transaction'],
  [BookOpen, 'learning', '学习', 'log'],
  [FolderGit2, 'workbench', '工作台', 'project'],
] as const

const defaultData = createRemotePersonalOSData()

type QuickRecordDomain = 'plan' | 'health' | 'finance' | 'learning' | 'workbench'

type QuickRecordTarget = {
  domain: QuickRecordDomain
  tab?: string
}

type AppProps = {
  data?: PersonalOSData
}

const pageTitles: Record<PageId, string> = {
  overview: '概览',
  plan: '计划',
  health: '锻炼',
  finance: '记账',
  learning: '学习',
  workbench: '工作台',
}

export default function App({ data = defaultData }: AppProps) {
  const [active, setActive] = useState<PageId>('overview')
  const [mobileOpen, setMobileOpen] = useState(false)
  const [quickRecord, setQuickRecord] = useState<QuickRecordTarget | null>(null)
  const [domainPickerOpen, setDomainPickerOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [aiOpen, setAIOpen] = useState(false)
  const [overviewEditingTask, setOverviewEditingTask] = useState<Task | null>(
    null,
  )
  const [toastMessage, setToastMessage] = useState('')
  const toastTimerRef = useRef<number | undefined>(undefined)
  const state = usePersonalOSData(data)

  const closeQuickRecord = useCallback(() => {
    setQuickRecord(null)
    setOverviewEditingTask(null)
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

  function selectPage(page: PageId) {
    setActive(page)
    setQuickRecord(null)
    setDomainPickerOpen(false)
    setSettingsOpen(false)
    setAIOpen(false)
    setOverviewEditingTask(null)
    setMobileOpen(false)
  }

  useEffect(() => {
    document.documentElement.dataset.fontScale = state.settings.fontScale
    document.documentElement.dataset.reducedMotion = String(
      state.settings.reducedMotion,
    )
  }, [state.settings.fontScale, state.settings.reducedMotion])

  useEffect(() => {
    return () => window.clearTimeout(toastTimerRef.current)
  }, [])

  useEffect(() => {
    function handleDataError(event: Event) {
      const message =
        event instanceof CustomEvent && typeof event.detail === 'string'
          ? event.detail
          : '操作失败'
      showSavedToast(message)
    }

    window.addEventListener('personal-os:data-error', handleDataError)
    return () =>
      window.removeEventListener('personal-os:data-error', handleDataError)
  }, [showSavedToast])

  return (
    <main className="app">
      <aside className={mobileOpen ? 'app-rail open' : 'app-rail'}>
        <div className="brand">
          <b>P</b>
          <strong>Personal OS</strong>
        </div>
        <nav aria-label="主菜单">
          {menu.map(([Icon, page, name]) => (
            <button
              key={name}
              onClick={() => selectPage(page)}
              className={active === page ? 'active' : ''}
              aria-current={active === page ? 'page' : undefined}
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
            <h1>
              {active === 'overview' ? '早上好，xqx。' : pageTitles[active]}
            </h1>
          </div>
          <div className="header-actions">
            <button
              aria-label="AI 助手"
              className="icon-action"
              onClick={() => setAIOpen(true)}
              type="button"
            >
              <Sparkles size={17} />
            </button>
            <button
              aria-label="设置"
              className="icon-action"
              onClick={() => setSettingsOpen(true)}
              type="button"
            >
              <Settings size={17} />
            </button>
            <button
              aria-label="快速记录"
              className="add"
              onClick={() => {
                if (active === 'overview') {
                  setDomainPickerOpen(true)
                } else if (active === 'plan') {
                  openQuickRecord('plan', 'task')
                } else if (active === 'health') {
                  openQuickRecord('health', 'workout')
                } else if (active === 'finance') {
                  openQuickRecord('finance', 'transaction')
                } else if (active === 'learning') {
                  openQuickRecord('learning', 'log')
                } else {
                  openQuickRecord('workbench', 'project')
                }
              }}
            >
              <Plus size={16} />
              快速记录
            </button>
          </div>
        </header>

        {active === 'plan' ? (
          <PlanQuickRecord
            tasks={state.tasks}
            dialogOpen={quickRecord?.domain === 'plan'}
            onDialogOpen={() => openQuickRecord('plan', 'task')}
            onDialogClose={closeQuickRecord}
            onSaved={showSavedToast}
            onTaskSubmit={data.addTask}
            onTaskUpdate={data.updateTask}
            onTaskDelete={data.deleteTask}
            onTaskToggle={data.toggleTask}
          />
        ) : active === 'finance' ? (
          <FinanceQuickRecord
            monthlyBudgetCents={state.monthlyBudgetCents}
            transactions={state.transactions}
            paymentOrders={state.paymentOrders}
            recurringTransactions={state.recurringTransactions}
            billImports={state.billImports}
            dialogOpen={quickRecord?.domain === 'finance'}
            dialogTab={quickRecord?.tab ?? 'transaction'}
            onDialogOpen={(tab) => openQuickRecord('finance', tab)}
            onDialogClose={closeQuickRecord}
            onSaved={showSavedToast}
            onSubmit={data.recordTransaction}
            onBudgetSubmit={data.updateMonthlyBudget}
            onRecurringSubmit={data.saveRecurringTransaction}
            onRecurringStatusChange={data.setRecurringTransactionStatus}
            onRecurringRecord={data.recordRecurringTransaction}
            onTransactionUpdate={data.updateTransaction}
            onTransactionDelete={data.deleteTransaction}
            onRecurringDelete={data.deleteRecurringTransaction}
            onPaymentOrderUpdate={data.updatePaymentOrder}
            onPaymentOrderDelete={data.deletePaymentOrder}
            onImportSubmit={data.importBillTransactions}
            onImportUndo={data.undoBillImport}
            expenseCategories={state.settings.expenseCategories}
            incomeCategories={state.settings.incomeCategories}
          />
        ) : active === 'learning' ? (
          <LearningQuickRecord
            studyLogs={state.studyLogs}
            learningPaths={state.learningPaths}
            learningResources={state.learningResources}
            learningLessons={state.learningLessons}
            learningNoteFolders={state.learningNoteFolders}
            learningNotes={state.learningNotes}
            weeklyReviews={state.weeklyReviews}
            dialogOpen={quickRecord?.domain === 'learning'}
            dialogTab={quickRecord?.tab ?? 'log'}
            onDialogOpen={(tab) => openQuickRecord('learning', tab)}
            onDialogClose={closeQuickRecord}
            onSaved={showSavedToast}
            onSubmit={data.recordStudyLog}
            onStudyUpdate={data.updateStudyLog}
            onStudyDelete={data.deleteStudyLog}
            onPathSubmit={data.addLearningPath}
            onPathUpdate={data.updateLearningPath}
            onPathDelete={data.deleteLearningPath}
            onResourceSubmit={data.addLearningResource}
            onResourceUpdate={data.updateLearningResource}
            onResourceDelete={data.deleteLearningResource}
            onResourceStatusChange={data.setLearningResourceStatus}
            onLessonsSubmit={data.addLearningLessons}
            onLessonStatusChange={data.setLearningLessonStatus}
            onLessonUpdate={data.updateLearningLesson}
            onLessonDelete={data.deleteLearningLesson}
            onNoteFolderSubmit={data.addLearningNoteFolder}
            onNoteFolderUpdate={data.updateLearningNoteFolder}
            onNoteFolderDelete={data.deleteLearningNoteFolder}
            onNoteSubmit={data.saveLearningNote}
            onNoteDelete={data.deleteLearningNote}
            onReviewSubmit={data.saveWeeklyReview}
            onReviewUpdate={data.updateWeeklyReview}
            onReviewDelete={data.deleteWeeklyReview}
          />
        ) : active === 'health' ? (
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
            onWorkoutDelete={data.deleteWorkout}
            onMetricUpdate={data.updateHealthMetric}
            onMetricDelete={data.deleteHealthMetric}
            weeklyWorkoutTarget={state.settings.weeklyWorkoutTarget}
          />
        ) : active === 'workbench' ? (
          <WorkbenchQuickRecord
            projects={state.projects}
            dialogOpen={quickRecord?.domain === 'workbench'}
            dialogTab={quickRecord?.tab ?? 'project'}
            onDialogOpen={(tab) => openQuickRecord('workbench', tab)}
            onDialogClose={closeQuickRecord}
            onSaved={showSavedToast}
            onProjectSubmit={data.addProject}
            onProjectUpdate={data.updateProject}
            onProjectDelete={data.deleteProject}
            onProjectStatusChange={data.setProjectStatus}
          />
        ) : (
          <OverviewConsole
            data={data}
            state={state}
            onTaskToggle={data.toggleTask}
            onTaskEdit={(task) => {
              setOverviewEditingTask(task)
              openQuickRecord('plan', 'task')
            }}
            onTaskDelete={data.deleteTask}
          />
        )}

        {active === 'overview' && quickRecord?.domain === 'plan' ? (
          <PlanQuickRecord
            tasks={state.tasks}
            dialogOpen
            dialogOnly
            onDialogOpen={() => openQuickRecord('plan', 'task')}
            onDialogClose={closeQuickRecord}
            onSaved={showSavedToast}
            onTaskSubmit={data.addTask}
            onTaskUpdate={data.updateTask}
            onTaskDelete={data.deleteTask}
            onTaskToggle={data.toggleTask}
            externalEditingTask={overviewEditingTask}
          />
        ) : null}

        {active === 'overview' && quickRecord?.domain === 'health' ? (
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
            onWorkoutDelete={data.deleteWorkout}
            onMetricUpdate={data.updateHealthMetric}
            onMetricDelete={data.deleteHealthMetric}
            weeklyWorkoutTarget={state.settings.weeklyWorkoutTarget}
          />
        ) : null}

        {active === 'overview' && quickRecord?.domain === 'finance' ? (
          <FinanceQuickRecord
            monthlyBudgetCents={state.monthlyBudgetCents}
            transactions={state.transactions}
            paymentOrders={state.paymentOrders}
            recurringTransactions={state.recurringTransactions}
            billImports={state.billImports}
            dialogOpen
            dialogTab={quickRecord.tab ?? 'transaction'}
            dialogOnly
            onDialogOpen={(tab) => openQuickRecord('finance', tab)}
            onDialogClose={closeQuickRecord}
            onSaved={showSavedToast}
            onSubmit={data.recordTransaction}
            onBudgetSubmit={data.updateMonthlyBudget}
            onRecurringSubmit={data.saveRecurringTransaction}
            onRecurringStatusChange={data.setRecurringTransactionStatus}
            onRecurringRecord={data.recordRecurringTransaction}
            onTransactionUpdate={data.updateTransaction}
            onTransactionDelete={data.deleteTransaction}
            onRecurringDelete={data.deleteRecurringTransaction}
            onPaymentOrderUpdate={data.updatePaymentOrder}
            onPaymentOrderDelete={data.deletePaymentOrder}
            onImportSubmit={data.importBillTransactions}
            onImportUndo={data.undoBillImport}
            expenseCategories={state.settings.expenseCategories}
            incomeCategories={state.settings.incomeCategories}
          />
        ) : null}

        {active === 'overview' && quickRecord?.domain === 'learning' ? (
          <LearningQuickRecord
            studyLogs={state.studyLogs}
            learningPaths={state.learningPaths}
            learningResources={state.learningResources}
            learningLessons={state.learningLessons}
            learningNoteFolders={state.learningNoteFolders}
            learningNotes={state.learningNotes}
            weeklyReviews={state.weeklyReviews}
            dialogOpen
            dialogTab={quickRecord.tab ?? 'log'}
            dialogOnly
            onDialogOpen={(tab) => openQuickRecord('learning', tab)}
            onDialogClose={closeQuickRecord}
            onSaved={showSavedToast}
            onSubmit={data.recordStudyLog}
            onStudyUpdate={data.updateStudyLog}
            onStudyDelete={data.deleteStudyLog}
            onPathSubmit={data.addLearningPath}
            onPathUpdate={data.updateLearningPath}
            onPathDelete={data.deleteLearningPath}
            onResourceSubmit={data.addLearningResource}
            onResourceUpdate={data.updateLearningResource}
            onResourceDelete={data.deleteLearningResource}
            onResourceStatusChange={data.setLearningResourceStatus}
            onLessonsSubmit={data.addLearningLessons}
            onLessonStatusChange={data.setLearningLessonStatus}
            onLessonUpdate={data.updateLearningLesson}
            onLessonDelete={data.deleteLearningLesson}
            onNoteFolderSubmit={data.addLearningNoteFolder}
            onNoteFolderUpdate={data.updateLearningNoteFolder}
            onNoteFolderDelete={data.deleteLearningNoteFolder}
            onNoteSubmit={data.saveLearningNote}
            onNoteDelete={data.deleteLearningNote}
            onReviewSubmit={data.saveWeeklyReview}
            onReviewUpdate={data.updateWeeklyReview}
            onReviewDelete={data.deleteWeeklyReview}
          />
        ) : null}

        {active === 'overview' && quickRecord?.domain === 'workbench' ? (
          <WorkbenchQuickRecord
            projects={state.projects}
            dialogOpen
            dialogTab={quickRecord.tab ?? 'project'}
            dialogOnly
            onDialogOpen={(tab) => openQuickRecord('workbench', tab)}
            onDialogClose={closeQuickRecord}
            onSaved={showSavedToast}
            onProjectSubmit={data.addProject}
            onProjectUpdate={data.updateProject}
            onProjectDelete={data.deleteProject}
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

        {settingsOpen ? (
          <SettingsDrawer
            activePage={active}
            onCategoryRename={data.renameCategory}
            onClose={() => setSettingsOpen(false)}
            onSettingsChange={data.updateSettings}
            open
            settings={state.settings}
          />
        ) : null}

        {aiOpen ? (
          <AIDrawer
            data={data}
            onClose={() => setAIOpen(false)}
            open
            summaries={state.aiSummaries}
          />
        ) : null}

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

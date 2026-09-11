import { useState, type ReactNode } from 'react'
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
import { FinanceQuickRecord } from './features/FinanceQuickRecord'
import { LearningQuickRecord } from './features/LearningQuickRecord'
import {
  formatStudyDuration,
  getRecentStudyMinutes,
  getStudyMinutesOnDate,
  toDateKey,
} from './utils/study'
import './App.css'

const menu = [
  [LayoutDashboard, '概览'],
  [Target, '计划'],
  [Dumbbell, '健康'],
  [Wallet, '财务'],
  [BookOpen, '学习'],
  [FolderGit2, '工作台'],
] as const

const defaultData = createLocalPersonalOSData()

type AppProps = {
  data?: PersonalOSData
}

export default function App({ data = defaultData }: AppProps) {
  const [active, setActive] = useState('概览')
  const [mobileOpen, setMobileOpen] = useState(false)
  const state = usePersonalOSData(data)
  const doneCount = state.tasks.filter((task) => task.done).length
  const todayExpense = sumTodayExpenses(state.transactions)
  const monthExpense = sumMonthExpenses(state.transactions)
  const budgetRemaining = Math.max(0, state.monthlyBudgetCents - monthExpense)
  const now = new Date()
  const todayStudyMinutes = getStudyMinutesOnDate(state.studyLogs, toDateKey(now))
  const weekStudyMinutes = getRecentStudyMinutes(state.studyLogs, now)

  function selectPage(name: string) {
    setActive(name)
    setMobileOpen(false)
  }

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
            onClick={() => data.addQuickTask('新建待办事项')}
          >
            <Plus size={16} />
            快速记录
          </button>
        </header>

        {active === '财务' ? (
          <FinanceQuickRecord
            monthlyBudgetCents={state.monthlyBudgetCents}
            transactions={state.transactions}
            onSubmit={data.recordTransaction}
            onBudgetSubmit={data.updateMonthlyBudget}
          />
        ) : active === '学习' ? (
          <LearningQuickRecord
            studyLogs={state.studyLogs}
            onSubmit={data.recordStudyLog}
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
              <Card icon={<Dumbbell />} name="健康" title="今晚训练：推" text="本周 2 / 4 次" />
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

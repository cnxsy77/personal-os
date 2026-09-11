import { useState, type FormEvent } from 'react'
import {
  CalendarClock,
  CircleAlert,
  CircleCheck,
  ClipboardList,
  FolderGit2,
  Rocket,
  Target,
} from 'lucide-react'
import type { Project, ProjectInput, ProjectStatus } from '../data/model'
import './WorkbenchQuickRecord.css'

type Props = {
  projects: Project[]
  onProjectSubmit: (input: ProjectInput) => void
  onProjectStatusChange: (id: string, status: ProjectStatus) => void
}

type ProjectFilter = 'all' | ProjectStatus

const projectStatusLabels: Record<ProjectStatus, string> = {
  planned: '计划中',
  active: '进行中',
  blocked: '受阻',
  done: '已完成',
}

const projectStatuses = Object.entries(projectStatusLabels) as Array<
  [ProjectStatus, string]
>

const statusIcons: Record<ProjectStatus, typeof FolderGit2> = {
  planned: ClipboardList,
  active: Rocket,
  blocked: CircleAlert,
  done: CircleCheck,
}

const filterLabels: Record<ProjectFilter, string> = {
  all: '全部',
  ...projectStatusLabels,
}

export function WorkbenchQuickRecord({
  projects,
  onProjectSubmit,
  onProjectStatusChange,
}: Props) {
  const today = toDateKey(new Date())
  const horizon = toDateKey(addDays(new Date(), 7))
  const [name, setName] = useState('')
  const [goal, setGoal] = useState('')
  const [status, setStatus] = useState<ProjectStatus>('active')
  const [nextAction, setNextAction] = useState('')
  const [dueDate, setDueDate] = useState(today)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState<ProjectFilter>('all')

  const sortedProjects = [...projects].sort(compareByDueDate)
  const dueProjects = sortedProjects.filter(
    (project) =>
      project.status !== 'done' &&
      project.dueDate !== undefined &&
      project.dueDate <= horizon,
  )
  const focusProject = sortedProjects.find(
    (project) => project.status === 'active' || project.status === 'blocked',
  )
  const visibleProjects = sortedProjects.filter(
    (project) => filter === 'all' || project.status === filter,
  )
  const distribution = projectStatuses.map(([value, label]) => ({
    value,
    label,
    count: projects.filter((project) => project.status === value).length,
  }))
  const distributionTotal = Math.max(1, projects.length)

  function submit(event: FormEvent) {
    event.preventDefault()

    if (!name.trim()) {
      setError('请输入项目名称')
      return
    }

    if (!goal.trim()) {
      setError('请输入项目目标')
      return
    }

    if (!nextAction.trim()) {
      setError('请输入下一步动作')
      return
    }

    onProjectSubmit({
      name,
      goal,
      status,
      nextAction,
      dueDate: dueDate || undefined,
    })
    setName('')
    setGoal('')
    setNextAction('')
    setError('')
  }

  return (
    <div className="workbench-page">
      <section className="workbench-panel" aria-labelledby="workbench-title">
        <h2 id="workbench-title">项目工作台</h2>

        <div className="workbench-summary">
          <div>
            <label>进行中</label>
            <strong>
              {projects.filter((project) => project.status === 'active').length} 项
            </strong>
          </div>
          <div>
            <label>受阻</label>
            <strong>
              {projects.filter((project) => project.status === 'blocked').length} 项
            </strong>
          </div>
          <div>
            <label>已完成</label>
            <strong>
              {projects.filter((project) => project.status === 'done').length} 项
            </strong>
          </div>
          <div>
            <label>七日内到期</label>
            <strong>{dueProjects.length} 项</strong>
          </div>
        </div>

        <form onSubmit={submit} className="workbench-form">
          <div className="workbench-fields">
            <div className="wide">
              <label htmlFor="project-name">项目名称</label>
              <input
                id="project-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="例如：Personal OS"
              />
            </div>
            <div className="wide">
              <label htmlFor="project-goal">项目目标</label>
              <input
                id="project-goal"
                value={goal}
                onChange={(event) => setGoal(event.target.value)}
                placeholder="这个项目完成后会带来什么改变？"
              />
            </div>
            <div>
              <label htmlFor="project-status">项目状态</label>
              <select
                id="project-status"
                value={status}
                onChange={(event) =>
                  setStatus(event.target.value as ProjectStatus)
                }
              >
                {projectStatuses.map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>
            <div className="wide">
              <label htmlFor="project-next-action">下一步动作</label>
              <input
                id="project-next-action"
                value={nextAction}
                onChange={(event) => setNextAction(event.target.value)}
                placeholder="写下推进项目的最小可执行动作"
              />
            </div>
            <div>
              <label htmlFor="project-due-date">截止日期</label>
              <input
                id="project-due-date"
                type="date"
                value={dueDate}
                onChange={(event) => setDueDate(event.target.value)}
              />
            </div>
            <button type="submit">
              <FolderGit2 size={16} />
              保存项目
            </button>
          </div>
          {error ? <p role="alert">{error}</p> : null}
        </form>

        <div
          className="workbench-filter"
          role="group"
          aria-label="项目状态筛选"
        >
          {(Object.keys(filterLabels) as ProjectFilter[]).map((item) => (
            <button
              key={item}
              type="button"
              className={filter === item ? 'selected' : ''}
              aria-pressed={filter === item}
              onClick={() => setFilter(item)}
            >
              {filterLabels[item]}
            </button>
          ))}
        </div>

        <ul className="project-list" aria-label="项目列表">
          {visibleProjects.length === 0 ? (
            <li className="empty">当前筛选下没有项目</li>
          ) : (
            visibleProjects.map((project) => {
              const StatusIcon = statusIcons[project.status]

              return (
                <li key={project.id}>
                  <i>
                    <StatusIcon size={17} />
                  </i>
                  <div>
                    <h3>{project.name}</h3>
                    <p>{project.goal}</p>
                    <small>
                      下一步：{project.nextAction}
                      {project.dueDate ? ` · 截止 ${formatDate(project.dueDate)}` : ''}
                    </small>
                  </div>
                  <select
                    aria-label={`${project.name} 项目状态`}
                    value={project.status}
                    onChange={(event) =>
                      onProjectStatusChange(
                        project.id,
                        event.target.value as ProjectStatus,
                      )
                    }
                  >
                    {projectStatuses.map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                </li>
              )
            })
          )}
        </ul>
      </section>

      <aside className="workbench-panel workbench-side" aria-labelledby="focus-title">
        <h2 id="focus-title">推进焦点</h2>

        <section className="focus-card" aria-labelledby="next-action-title">
          <h3 id="next-action-title">
            <Target size={16} />
            下一步
          </h3>
          {focusProject ? (
            <>
              <strong>{focusProject.name}</strong>
              <p>{focusProject.nextAction}</p>
              <small>
                {projectStatusLabels[focusProject.status]}
                {focusProject.dueDate
                  ? ` · 截止 ${formatDate(focusProject.dueDate)}`
                  : ' · 未设置截止'}
              </small>
            </>
          ) : (
            <p>没有进行中的项目，先添加一个。</p>
          )}
        </section>

        <section aria-labelledby="project-distribution-title">
          <h3 id="project-distribution-title">状态分布</h3>
          <ul className="project-distribution" aria-label="项目状态分布">
            {distribution.map((item) => (
              <li key={item.value}>
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

        <section className="due-list" aria-labelledby="due-title">
          <h3 id="due-title">
            <CalendarClock size={16} />
            到期提醒
          </h3>
          {dueProjects.length === 0 ? (
            <p>七日内没有到期项目。</p>
          ) : (
            <ul aria-label="到期项目">
              {dueProjects.slice(0, 5).map((project) => (
                <li key={project.id}>
                  <div>
                    <h4>{project.name}</h4>
                    <p>{project.nextAction}</p>
                  </div>
                  <b>{project.dueDate ? formatDate(project.dueDate) : ''}</b>
                </li>
              ))}
            </ul>
          )}
        </section>
      </aside>
    </div>
  )
}

function addDays(value: Date, days: number) {
  const next = new Date(value)
  next.setDate(next.getDate() + days)
  return next
}

function compareByDueDate(projectA: Project, projectB: Project) {
  return (projectA.dueDate ?? '9999-12-31').localeCompare(
    projectB.dueDate ?? '9999-12-31',
  )
}

function formatDate(date: string) {
  return date.replaceAll('-', '.')
}

function toDateKey(value: Date) {
  const month = String(value.getMonth() + 1).padStart(2, '0')
  const day = String(value.getDate()).padStart(2, '0')
  return `${value.getFullYear()}-${month}-${day}`
}

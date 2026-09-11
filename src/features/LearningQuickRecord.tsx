import { useState, type FormEvent } from 'react'
import { BookMarked, GraduationCap, NotebookPen, Plus, Timer } from 'lucide-react'
import { RecordDialog } from '../components/RecordDialog'
import type {
  LearningPath,
  LearningPathInput,
  LearningResource,
  LearningResourceInput,
  LearningResourceKind,
  LearningResourceStatus,
  StudyLog,
  StudyLogInput,
  WeeklyReview,
  WeeklyReviewInput,
} from '../data/model'
import {
  formatStudyDuration,
  getRecentStudyMinutes,
  getStudyMinutesOnDate,
  toDateKey,
} from '../utils/study'
import './LearningQuickRecord.css'

type Props = {
  studyLogs: StudyLog[]
  learningPaths: LearningPath[]
  learningResources: LearningResource[]
  weeklyReviews: WeeklyReview[]
  dialogOpen: boolean
  dialogTab?: string
  dialogOnly?: boolean
  onDialogOpen: (tab?: string) => void
  onDialogClose: () => void
  onSaved: (message: string) => void
  onSubmit: (input: StudyLogInput) => void
  onPathSubmit: (input: LearningPathInput) => void
  onResourceSubmit: (input: LearningResourceInput) => void
  onResourceStatusChange: (id: string, status: LearningResourceStatus) => void
  onReviewSubmit: (input: WeeklyReviewInput) => void
}

const resourceKinds: Array<{ value: LearningResourceKind; label: string }> = [
  { value: 'course', label: '课程' },
  { value: 'book', label: '书籍' },
  { value: 'article', label: '文章' },
  { value: 'video', label: '视频' },
  { value: 'docs', label: '文档' },
]

const resourceStatuses: Array<{ value: LearningResourceStatus; label: string }> = [
  { value: 'todo', label: '待开始' },
  { value: 'doing', label: '进行中' },
  { value: 'done', label: '已完成' },
]

export function LearningQuickRecord({
  studyLogs,
  learningPaths,
  learningResources,
  weeklyReviews,
  dialogOpen,
  dialogTab = 'log',
  dialogOnly = false,
  onDialogOpen,
  onDialogClose,
  onSaved,
  onSubmit,
  onPathSubmit,
  onResourceSubmit,
  onResourceStatusChange,
  onReviewSubmit,
}: Props) {
  const [topic, setTopic] = useState('')
  const [minutes, setMinutes] = useState('')
  const [pathId, setPathId] = useState('none')
  const [error, setError] = useState('')
  const [newPathTitle, setNewPathTitle] = useState('')
  const [targetMinutes, setTargetMinutes] = useState('')
  const [pathError, setPathError] = useState('')
  const [resourceTitle, setResourceTitle] = useState('')
  const [resourceKind, setResourceKind] = useState<LearningResourceKind>('course')
  const [resourcePathId, setResourcePathId] = useState('none')
  const [resourceError, setResourceError] = useState('')
  const [reviewWeek, setReviewWeek] = useState(() => toDateKey(getWeekStart(new Date())))
  const [reviewWins, setReviewWins] = useState('')
  const [reviewBlockers, setReviewBlockers] = useState('')
  const [reviewNextFocus, setReviewNextFocus] = useState('')
  const [reviewError, setReviewError] = useState('')
  const now = new Date()
  const today = toDateKey(now)
  const todayMinutes = getStudyMinutesOnDate(studyLogs, today)
  const weekMinutes = getRecentStudyMinutes(studyLogs, now)
  const pathTitles = new Map(learningPaths.map((path) => [path.id, path.title]))
  const doingResources = learningResources.filter(
    (resource) => resource.status === 'doing',
  ).length
  const pathProgress = learningPaths.length
    ? Math.round(
        (learningPaths.reduce((total, path) => {
          const learnedMinutes = studyLogs
            .filter((log) => log.pathId === path.id)
            .reduce((sum, log) => sum + log.minutes, 0)

          return total + Math.min(1, learnedMinutes / path.targetMinutes)
        }, 0) /
          learningPaths.length) *
          100,
      )
    : 0

  function openDialog(tab = dialogTab) {
    setError('')
    setPathError('')
    setResourceError('')
    setReviewError('')
    onDialogOpen(tab)
  }

  function closeDialog() {
    setError('')
    setPathError('')
    setResourceError('')
    setReviewError('')
    onDialogClose()
  }

  function submit(event: FormEvent) {
    event.preventDefault()
    const normalizedTopic = topic.trim()
    const normalizedMinutes = Number(minutes)

    if (!normalizedTopic) {
      setError('请填写学习主题')
      return
    }

    if (!Number.isInteger(normalizedMinutes) || normalizedMinutes <= 0) {
      setError('请输入大于 0 的学习时长')
      return
    }

    onSubmit({
      topic: normalizedTopic,
      minutes: normalizedMinutes,
      date: today,
      pathId: pathId === 'none' ? undefined : pathId,
    })
    setTopic('')
    setMinutes('')
    setError('')
    closeDialog()
    onSaved('学习记录已保存')
  }

  function submitPath(event: FormEvent) {
    event.preventDefault()
    const normalizedTitle = newPathTitle.trim()
    const normalizedTargetMinutes = Number(targetMinutes)

    if (!normalizedTitle) {
      setPathError('请填写路径名称')
      return
    }

    if (!Number.isInteger(normalizedTargetMinutes) || normalizedTargetMinutes <= 0) {
      setPathError('请输入大于 0 的目标时长')
      return
    }

    onPathSubmit({
      title: normalizedTitle,
      targetMinutes: normalizedTargetMinutes,
    })
    setNewPathTitle('')
    setTargetMinutes('')
    setPathError('')
    closeDialog()
    onSaved('学习路径已创建')
  }

  function submitResource(event: FormEvent) {
    event.preventDefault()
    const normalizedTitle = resourceTitle.trim()

    if (!normalizedTitle) {
      setResourceError('请填写资料名称')
      return
    }

    onResourceSubmit({
      pathId: resourcePathId === 'none' ? null : resourcePathId,
      title: normalizedTitle,
      kind: resourceKind,
      status: 'todo',
    })
    setResourceTitle('')
    setResourcePathId('none')
    setResourceError('')
    closeDialog()
    onSaved('学习资料已保存')
  }

  function submitReview(event: FormEvent) {
    event.preventDefault()
    const normalizedWins = reviewWins.trim()
    const normalizedBlockers = reviewBlockers.trim()
    const normalizedNextFocus = reviewNextFocus.trim()

    if (!/^\d{4}-\d{2}-\d{2}$/.test(reviewWeek)) {
      setReviewError('请选择周开始日期')
      return
    }

    if (!normalizedWins || !normalizedBlockers || !normalizedNextFocus) {
      setReviewError('请完整填写本周收获、阻碍和下周重点')
      return
    }

    onReviewSubmit({
      weekStartDate: reviewWeek,
      wins: normalizedWins,
      blockers: normalizedBlockers,
      nextFocus: normalizedNextFocus,
    })
    setReviewWins('')
    setReviewBlockers('')
    setReviewNextFocus('')
    setReviewError('')
    closeDialog()
    onSaved('周复盘已保存')
  }

  const learningDialog = (
    <RecordDialog
      activeTab={dialogTab}
      description="记录学习进展、资料和周复盘。"
      onClose={closeDialog}
      onTabChange={openDialog}
      open={dialogOpen}
      tabs={[
        { id: 'log', label: '学习记录' },
        { id: 'path', label: '学习路径' },
        { id: 'resource', label: '学习资料' },
        { id: 'review', label: '周复盘' },
      ]}
      title="添加学习记录"
    >
      {dialogTab === 'log' ? (
        <form onSubmit={submit} className="learning-form">
          <div className="learning-fields with-path">
            <div>
              <label htmlFor="learning-path">学习路径</label>
              <select
                id="learning-path"
                value={pathId}
                onChange={(event) => setPathId(event.target.value)}
              >
                <option value="none">自由记录</option>
                {learningPaths.map((path) => (
                  <option key={path.id} value={path.id}>{path.title}</option>
                ))}
              </select>
            </div>
            <div className="learning-topic">
              <label htmlFor="learning-topic">学习主题</label>
              <input
                id="learning-topic"
                value={topic}
                onChange={(event) => setTopic(event.target.value)}
                placeholder="React 渲染模型"
              />
            </div>
            <div>
              <label htmlFor="learning-minutes">时长</label>
              <input
                id="learning-minutes"
                value={minutes}
                onChange={(event) => setMinutes(event.target.value)}
                inputMode="numeric"
                type="number"
                min="1"
                step="1"
                placeholder="45"
              />
            </div>
            <button type="submit">
              <GraduationCap size={16} />
              记录
            </button>
          </div>

          {error ? <p role="alert">{error}</p> : null}
        </form>
      ) : dialogTab === 'path' ? (
        <form onSubmit={submitPath} className="compact-form dialog-form">
          <div>
            <label htmlFor="new-learning-path">新路径名称</label>
            <input
              id="new-learning-path"
              value={newPathTitle}
              onChange={(event) => setNewPathTitle(event.target.value)}
              placeholder="TypeScript 工程化"
            />
          </div>
          <div>
            <label htmlFor="learning-target">目标时长</label>
            <input
              id="learning-target"
              value={targetMinutes}
              onChange={(event) => setTargetMinutes(event.target.value)}
              inputMode="numeric"
              type="number"
              min="1"
              step="1"
              placeholder="600"
            />
          </div>
          <button type="submit">创建路径</button>
          {pathError ? <p role="alert">{pathError}</p> : null}
        </form>
      ) : dialogTab === 'resource' ? (
        <form onSubmit={submitResource} className="resource-form dialog-form">
          <div>
            <label htmlFor="learning-resource-title">资料名称</label>
            <input
              id="learning-resource-title"
              value={resourceTitle}
              onChange={(event) => setResourceTitle(event.target.value)}
              placeholder="React 官方课程"
            />
          </div>
          <div>
            <label htmlFor="learning-resource-kind">资料类型</label>
            <select
              id="learning-resource-kind"
              value={resourceKind}
              onChange={(event) => setResourceKind(event.target.value as LearningResourceKind)}
            >
              {resourceKinds.map((kind) => (
                <option key={kind.value} value={kind.value}>{kind.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="learning-resource-path">所属路径</label>
            <select
              id="learning-resource-path"
              value={resourcePathId}
              onChange={(event) => setResourcePathId(event.target.value)}
            >
              <option value="none">独立资料</option>
              {learningPaths.map((path) => (
                <option key={path.id} value={path.id}>{path.title}</option>
              ))}
            </select>
          </div>
          <button type="submit">添加资料</button>
          {resourceError ? <p role="alert">{resourceError}</p> : null}
        </form>
      ) : (
        <form onSubmit={submitReview} className="review-form dialog-form">
          <div>
            <label htmlFor="review-week">周开始日</label>
            <input
              id="review-week"
              type="date"
              value={reviewWeek}
              onChange={(event) => setReviewWeek(event.target.value)}
            />
          </div>
          <div>
            <label htmlFor="review-wins">本周收获</label>
            <input
              id="review-wins"
              value={reviewWins}
              onChange={(event) => setReviewWins(event.target.value)}
              placeholder="完成学习路径设计"
            />
          </div>
          <div>
            <label htmlFor="review-blockers">本周阻碍</label>
            <input
              id="review-blockers"
              value={reviewBlockers}
              onChange={(event) => setReviewBlockers(event.target.value)}
              placeholder="晚上时间不足"
            />
          </div>
          <div>
            <label htmlFor="review-next-focus">下周重点</label>
            <input
              id="review-next-focus"
              value={reviewNextFocus}
              onChange={(event) => setReviewNextFocus(event.target.value)}
              placeholder="补齐项目测试"
            />
          </div>
          <button type="submit">
            <NotebookPen size={15} />
            保存复盘
          </button>
          {reviewError ? <p role="alert">{reviewError}</p> : null}
        </form>
      )}
    </RecordDialog>
  )

  if (dialogOnly) {
    return learningDialog
  }

  return (
    <div className="learning-page">
      <section className="learning-panel" aria-labelledby="learning-title">
        <div className="panel-heading">
          <h2 id="learning-title">学习脉搏</h2>
          <button
            className="page-add"
            onClick={() => openDialog('log')}
            type="button"
          >
            <Plus size={16} />
            添加学习记录
          </button>
        </div>

        <div className="learning-summary">
          <div>
            <label>今日学习</label>
            <strong>{formatStudyDuration(todayMinutes)}</strong>
          </div>
          <div>
            <label>近 7 天</label>
            <strong>{formatStudyDuration(weekMinutes)}</strong>
          </div>
          <div>
            <label>路径进度</label>
            <strong>{pathProgress}%</strong>
          </div>
          <div>
            <label>进行中资料</label>
            <strong>{doingResources} 项</strong>
          </div>
        </div>

        <div className="learning-list-heading">
          <h3>最近学习</h3>
        </div>
        <ul aria-label="学习记录">
          {studyLogs.slice(0, 8).map((log) => (
            <li key={log.id}>
              <i>
                <GraduationCap size={17} />
              </i>
              <div>
                <h4>{log.topic}</h4>
                <p>
                  {formatDate(log.date)}
                  {log.pathId ? ` · ${pathTitles.get(log.pathId) ?? '学习路径'}` : ' · 自由记录'}
                </p>
              </div>
              <b>
                <Timer size={14} />
                {formatStudyDuration(log.minutes)}
              </b>
            </li>
          ))}
        </ul>
      </section>

      <div className="learning-side">
        <section className="learning-panel" aria-labelledby="path-progress-title">
          <h2 id="path-progress-title">路径进度</h2>

        <ul className="path-list" aria-label="学习路径进度">
          {learningPaths.map((path) => {
            const learnedMinutes = studyLogs
              .filter((log) => log.pathId === path.id)
              .reduce((total, log) => total + log.minutes, 0)

            return (
              <li key={path.id}>
                <div>
                  <h3>{path.title}</h3>
                  <p>
                    {learnedMinutes} / {path.targetMinutes} 分钟
                  </p>
                </div>
                <progress
                  aria-label={`${path.title} 学习进度`}
                  max={path.targetMinutes}
                  value={learnedMinutes}
                />
              </li>
            )
          })}
        </ul>
        </section>

      <section className="learning-panel" aria-labelledby="resource-title">
        <h2 id="resource-title">学习资料</h2>

        <ul className="resource-list" aria-label="学习资料">
          {learningResources.map((resource) => (
            <li key={resource.id}>
              <i>
                <BookMarked size={17} />
              </i>
              <div>
                <h3>{resource.title}</h3>
                <p>
                  {resource.pathId ? pathTitles.get(resource.pathId) ?? '学习路径' : '独立资料'}
                  {' · '}
                  {resourceKinds.find((kind) => kind.value === resource.kind)?.label}
                </p>
              </div>
              <select
                aria-label={`${resource.title} 状态`}
                value={resource.status}
                onChange={(event) =>
                  onResourceStatusChange(resource.id, event.target.value as LearningResourceStatus)
                }
              >
                {resourceStatuses.map((status) => (
                  <option key={status.value} value={status.value}>{status.label}</option>
                ))}
              </select>
            </li>
          ))}
        </ul>
        </section>

      <section className="learning-panel" aria-labelledby="review-title">
        <h2 id="review-title">周复盘</h2>

        <ul className="review-list" aria-label="周复盘记录">
          {weeklyReviews.slice(0, 6).map((review) => (
            <li key={review.id}>
              <div>
                <h3>周起始 {formatDate(review.weekStartDate)}</h3>
                <p>{review.wins}</p>
                <small>阻碍：{review.blockers}</small>
                <small>下周：{review.nextFocus}</small>
              </div>
            </li>
          ))}
        </ul>
        </section>
      </div>

      {learningDialog}
    </div>
  )
}

function getWeekStart(value: Date) {
  const start = new Date(value)
  const weekday = start.getDay()
  start.setDate(start.getDate() - (weekday === 0 ? 6 : weekday - 1))

  return start
}

function formatDate(date: string) {
  return date.replaceAll('-', '.')
}

import { useState, type FormEvent } from 'react'
import {
  BookMarked,
  ExternalLink,
  Folder,
  GraduationCap,
  NotebookPen,
  PlayCircle,
  Plus,
  Pencil,
  Timer,
  Trash2,
} from 'lucide-react'
import { RecordDialog } from '../components/RecordDialog'
import { ConfirmDialog } from '../components/ConfirmDialog'
import type {
  LearningLesson,
  LearningLessonDraft,
  LearningLessonStatus,
  LearningPath,
  LearningPlatform,
  LearningNote,
  LearningNoteFolder,
  LearningNoteInput,
  LearningResource,
  LearningResourceInput,
  LearningResourceStatus,
  StudyLog,
  StudyLogInput,
  WeeklyReview,
  WeeklyReviewInput,
  WeeklyReviewUpdateInput,
} from '../data/model'
import { parseLearningSource } from '../utils/learningSource'
import {
  getContinueLearning,
  getCourseLessons,
  getLessonProgress,
  getPlatformCounts,
  learningPlatformLabels,
  parseLearningLessonLines,
} from '../utils/learningViews'
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
  learningLessons: LearningLesson[]
  learningNoteFolders: LearningNoteFolder[]
  learningNotes: LearningNote[]
  weeklyReviews: WeeklyReview[]
  dialogOpen: boolean
  dialogTab?: string
  dialogOnly?: boolean
  onDialogOpen: (tab?: string) => void
  onDialogClose: () => void
  onSaved: (message: string) => void
  onSubmit: (input: StudyLogInput) => void
  onStudyUpdate: (id: string, input: StudyLogInput) => void
  onStudyDelete: (id: string) => void
  onPathSubmit: (input: { title: string; targetMinutes: number }) => void
  onPathUpdate: (
    id: string,
    input: { title: string; targetMinutes: number },
  ) => void
  onPathDelete: (id: string) => void
  onResourceSubmit: (input: LearningResourceInput) => void
  onResourceUpdate: (id: string, input: LearningResourceInput) => void
  onResourceDelete: (id: string) => void
  onResourceStatusChange: (id: string, status: LearningResourceStatus) => void
  onLessonsSubmit: (
    resourceId: string,
    lessons: Array<LearningLessonDraft>,
  ) => void
  onLessonStatusChange: (id: string, status: LearningLessonStatus) => void
  onLessonUpdate: (
    id: string,
    input: {
      title: string
      status: LearningLessonStatus
      expectedMinutes?: number
      sourceUrl?: string
    },
  ) => void
  onLessonDelete: (id: string) => void
  onNoteFolderSubmit: (name: string) => void
  onNoteFolderUpdate: (id: string, name: string) => void
  onNoteFolderDelete: (id: string) => void
  onNoteSubmit: (input: LearningNoteInput) => void
  onNoteDelete: (id: string) => void
  onReviewSubmit: (input: WeeklyReviewInput) => void
  onReviewUpdate: (id: string, input: WeeklyReviewUpdateInput) => void
  onReviewDelete: (id: string) => void
}

const resourceStatuses: Array<{ value: LearningResourceStatus; label: string }> = [
  { value: 'todo', label: '待开始' },
  { value: 'doing', label: '进行中' },
  { value: 'done', label: '已完成' },
]

const lessonStatuses = resourceStatuses

export function LearningQuickRecord({
  studyLogs,
  learningPaths,
  learningResources,
  learningLessons,
  learningNoteFolders,
  learningNotes,
  weeklyReviews,
  dialogOpen,
  dialogTab = 'log',
  dialogOnly = false,
  onDialogOpen,
  onDialogClose,
  onSaved,
  onSubmit,
  onStudyUpdate,
  onStudyDelete,
  onPathSubmit,
  onPathUpdate,
  onPathDelete,
  onResourceSubmit,
  onResourceUpdate,
  onResourceDelete,
  onResourceStatusChange,
  onLessonsSubmit,
  onLessonStatusChange,
  onLessonUpdate,
  onLessonDelete,
  onNoteFolderSubmit,
  onNoteFolderUpdate,
  onNoteFolderDelete,
  onNoteSubmit,
  onNoteDelete,
  onReviewSubmit,
  onReviewUpdate,
  onReviewDelete,
}: Props) {
  const now = new Date()
  const today = toDateKey(now)
  const continueLesson = getContinueLearning(learningLessons, studyLogs)
  const continueCourse = continueLesson
    ? learningResources.find(
        (resource) => resource.id === continueLesson.resourceId,
      )
    : undefined

  const [date, setDate] = useState(today)
  const [topic, setTopic] = useState('')
  const [minutes, setMinutes] = useState('')
  const [pathId, setPathId] = useState('none')
  const [logResourceId, setLogResourceId] = useState(
    () => continueLesson?.resourceId ?? 'none',
  )
  const [logLessonId, setLogLessonId] = useState(
    () => continueLesson?.id ?? 'none',
  )
  const [logNote, setLogNote] = useState('')
  const [error, setError] = useState('')
  const [editingStudyLog, setEditingStudyLog] = useState<StudyLog | null>(null)
  const [resourceTitle, setResourceTitle] = useState('')
  const [resourceSourceUrl, setResourceSourceUrl] = useState('')
  const [resourcePlatform, setResourcePlatform] =
    useState<LearningPlatform>('other')
  const [resourcePathId, setResourcePathId] = useState('none')
  const [resourceStatus, setResourceStatus] =
    useState<LearningResourceStatus>('todo')
  const [resourceTargetMinutes, setResourceTargetMinutes] = useState('')
  const [resourceError, setResourceError] = useState('')
  const [editingResource, setEditingResource] = useState<LearningResource | null>(null)
  const [lessonResourceId, setLessonResourceId] = useState(
    () => learningResources[0]?.id ?? 'none',
  )
  const [lessonBatch, setLessonBatch] = useState('')
  const [lessonError, setLessonError] = useState('')
  const [editingLesson, setEditingLesson] = useState<LearningLesson | null>(null)
  const [lessonTitle, setLessonTitle] = useState('')
  const [lessonStatus, setLessonStatus] = useState<LearningLessonStatus>('todo')
  const [lessonExpectedMinutes, setLessonExpectedMinutes] = useState('')
  const [lessonSourceUrl, setLessonSourceUrl] = useState('')
  const [pathTitle, setPathTitle] = useState('')
  const [pathTargetMinutes, setPathTargetMinutes] = useState('')
  const [pathError, setPathError] = useState('')
  const [editingPath, setEditingPath] = useState<LearningPath | null>(null)
  const [noteFolderId, setNoteFolderId] = useState('none')
  const [newFolderName, setNewFolderName] = useState('')
  const [noteResourceId, setNoteResourceId] = useState('none')
  const [noteLessonId, setNoteLessonId] = useState('none')
  const [noteTitle, setNoteTitle] = useState('')
  const [noteTags, setNoteTags] = useState('')
  const [noteContent, setNoteContent] = useState('')
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null)
  const [noteFolderFilter, setNoteFolderFilter] = useState('all')
  const [noteSearch, setNoteSearch] = useState('')
  const [noteError, setNoteError] = useState('')
  const [reviewWeek, setReviewWeek] = useState(() =>
    toDateKey(getWeekStart(now)),
  )
  const [reviewWins, setReviewWins] = useState('')
  const [reviewBlockers, setReviewBlockers] = useState('')
  const [reviewNextFocus, setReviewNextFocus] = useState('')
  const [reviewError, setReviewError] = useState('')
  const [editingReview, setEditingReview] = useState<WeeklyReview | null>(null)
  const [editingFolder, setEditingFolder] = useState<LearningNoteFolder | null>(null)
  const [deleteRequest, setDeleteRequest] = useState<{
    title: string
    description: string
    action: () => void
  } | null>(null)

  const todayMinutes = getStudyMinutesOnDate(studyLogs, today)
  const weekMinutes = getRecentStudyMinutes(studyLogs, now)
  const pathTitles = new Map(learningPaths.map((path) => [path.id, path.title]))
  const resourceTitles = new Map(
    learningResources.map((resource) => [resource.id, resource.title]),
  )
  const completedLessons = learningLessons.filter(
    (lesson) => lesson.status === 'done',
  ).length
  const pathProgress = learningPaths.length
    ? Math.round(
        (learningPaths.reduce((total, path) => {
          const learnedMinutes = studyLogs
            .filter((log) => log.pathId === path.id)
            .reduce((sum, log) => sum + log.minutes, 0)

          return total + Math.min(1, learnedMinutes / path.targetMinutes)
        }, 0) / learningPaths.length) * 100,
      )
    : 0
  const platformCounts = getPlatformCounts(learningResources)
  const visibleNotes = learningNotes.filter((note) => {
    const folderMatches =
      noteFolderFilter === 'all' || note.folderId === noteFolderFilter
    const query = noteSearch.trim().toLowerCase()
    const queryMatches =
      !query ||
      note.title.toLowerCase().includes(query) ||
      note.content.toLowerCase().includes(query) ||
      note.tags.some((tag) => tag.toLowerCase().includes(query))

    return folderMatches && queryMatches
  })
  const logLessons = getCourseLessons(
    learningLessons,
    logResourceId === 'none' ? '' : logResourceId,
  )
  const noteLessons = getCourseLessons(
    learningLessons,
    noteResourceId === 'none' ? '' : noteResourceId,
  )

  function openDialog(tab = dialogTab) {
    setError('')
    setResourceError('')
    setLessonError('')
    setNoteError('')
    setReviewError('')

    if (tab === 'log' && continueLesson) {
      setLogResourceId(continueLesson.resourceId)
      setLogLessonId(continueLesson.id)
    }

    onDialogOpen(tab)
  }

  function closeDialog() {
    setError('')
    setResourceError('')
    setLessonError('')
    setNoteError('')
    setReviewError('')
    setEditingNoteId(null)
    setEditingStudyLog(null)
    setEditingResource(null)
    setEditingLesson(null)
    setEditingPath(null)
    setEditingReview(null)
    setEditingFolder(null)
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

    const selectedResource = learningResources.find(
      (resource) => resource.id === logResourceId,
    )
    const selectedLesson = learningLessons.find(
      (lesson) => lesson.id === logLessonId,
    )
    const note = logNote.trim()

    const studyInput = {
      topic: normalizedTopic,
      minutes: normalizedMinutes,
      date,
      pathId: pathId === 'none' ? undefined : pathId,
      ...(selectedResource
        ? {
            resourceId: selectedResource.id,
            platform: selectedResource.platform ?? 'other',
          }
        : {}),
      ...(selectedLesson ? { lessonId: selectedLesson.id } : {}),
      ...(note ? { note } : {}),
    }

    if (editingStudyLog) {
      onStudyUpdate(editingStudyLog.id, studyInput)
    } else {
      onSubmit(studyInput)
    }
    setTopic('')
    setMinutes('')
    setLogNote('')
    setError('')
    setEditingStudyLog(null)
    closeDialog()
    onSaved(editingStudyLog ? '学习记录已更新' : '学习记录已保存')
  }

  function handleResourceUrlChange(value: string) {
    setResourceSourceUrl(value)

    if (value.trim()) {
      setResourcePlatform(parseLearningSource(value).platform)
    }
  }

  function submitResource(event: FormEvent) {
    event.preventDefault()
    const normalizedTitle = resourceTitle.trim()
    const targetMinutes = Number(resourceTargetMinutes)

    if (!normalizedTitle) {
      setResourceError('请填写课程名称')
      return
    }

    if (
      resourceTargetMinutes &&
      (!Number.isInteger(targetMinutes) || targetMinutes <= 0)
    ) {
      setResourceError('课程目标必须大于 0 分钟')
      return
    }

    const resourceInput: LearningResourceInput = {
      pathId: resourcePathId === 'none' ? null : resourcePathId,
      title: normalizedTitle,
      kind: 'course',
      status: resourceStatus,
      ...(resourceSourceUrl.trim()
        ? { sourceUrl: resourceSourceUrl.trim() }
        : {}),
      platform: resourcePlatform,
      ...(resourceTargetMinutes ? { targetMinutes } : {}),
    }

    if (editingResource) {
      onResourceUpdate(editingResource.id, resourceInput)
    } else {
      onResourceSubmit(resourceInput)
    }
    setResourceTitle('')
    setResourceSourceUrl('')
    setResourcePlatform('other')
    setResourceTargetMinutes('')
    setResourceError('')
    setEditingResource(null)
    closeDialog()
    onSaved(editingResource ? '课程已更新' : '课程已保存')
  }

  function submitLessons(event: FormEvent) {
    event.preventDefault()

    if (editingLesson) {
      const normalizedTitle = lessonTitle.trim()
      const expectedMinutes = Number(lessonExpectedMinutes)

      if (!normalizedTitle) {
        setLessonError('请填写课时标题')
        return
      }

      onLessonUpdate(editingLesson.id, {
        title: normalizedTitle,
        status: lessonStatus,
        ...(lessonExpectedMinutes ? { expectedMinutes } : {}),
        ...(lessonSourceUrl.trim() ? { sourceUrl: lessonSourceUrl.trim() } : {}),
      })
      setLessonTitle('')
      setLessonExpectedMinutes('')
      setLessonSourceUrl('')
      setLessonStatus('todo')
      setLessonError('')
      setEditingLesson(null)
      closeDialog()
      onSaved('课时已更新')
      return
    }

    if (lessonResourceId === 'none') {
      setLessonError('请选择课程')
      return
    }

    const lessons = parseLearningLessonLines(lessonBatch)

    if (lessons.length === 0) {
      setLessonError('请输入至少一个课时')
      return
    }

    onLessonsSubmit(lessonResourceId, lessons)
    setLessonBatch('')
    setLessonError('')
    closeDialog()
    onSaved('课时目录已保存')
  }

  function submitFolder() {
    const name = newFolderName.trim()

    if (!name) {
      setNoteError('请填写笔记文件夹名称')
      return
    }

    if (editingFolder) {
      onNoteFolderUpdate(editingFolder.id, name)
    } else {
      onNoteFolderSubmit(name)
    }
    setNewFolderName('')
    setEditingFolder(null)
    onSaved(editingFolder ? '笔记文件夹已更新' : '笔记文件夹已创建')
  }

  function submitNote(event: FormEvent) {
    event.preventDefault()
    const title = noteTitle.trim()
    const content = noteContent.trim()

    if (!title) {
      setNoteError('请填写笔记标题')
      return
    }

    if (!content) {
      setNoteError('请填写笔记内容')
      return
    }

    onNoteSubmit({
      ...(editingNoteId ? { id: editingNoteId } : {}),
      folderId: noteFolderId === 'none' ? null : noteFolderId,
      title,
      content,
      tags: noteTags
        .split(/[,，]/)
        .map((tag) => tag.trim())
        .filter(Boolean),
      resourceId: noteResourceId === 'none' ? null : noteResourceId,
      lessonId: noteLessonId === 'none' ? null : noteLessonId,
    })
    setNoteTitle('')
    setNoteContent('')
    setNoteTags('')
    setNoteResourceId('none')
    setNoteLessonId('none')
    setNoteError('')
    closeDialog()
    onSaved(editingNoteId ? '笔记已更新' : '笔记已保存')
  }

  function startPathEdit(path: LearningPath) {
    setEditingPath(path)
    setPathTitle(path.title)
    setPathTargetMinutes(String(path.targetMinutes))
    setPathError('')
    openDialog('path')
  }

  function submitPath(event: FormEvent) {
    event.preventDefault()
    const title = pathTitle.trim()
    const targetMinutes = Number(pathTargetMinutes)

    if (!title) {
      setPathError('请填写学习路径名称')
      return
    }

    if (!Number.isInteger(targetMinutes) || targetMinutes <= 0) {
      setPathError('请输入大于 0 的目标时长')
      return
    }

    if (editingPath) {
      onPathUpdate(editingPath.id, { title, targetMinutes })
    } else {
      onPathSubmit({ title, targetMinutes })
    }

    setPathTitle('')
    setPathTargetMinutes('')
    setPathError('')
    setEditingPath(null)
    closeDialog()
    onSaved(editingPath ? '学习路径已更新' : '学习路径已保存')
  }

  function startLessonEdit(lesson: LearningLesson) {
    setEditingLesson(lesson)
    setLessonResourceId(lesson.resourceId)
    setLessonTitle(lesson.title)
    setLessonStatus(lesson.status)
    setLessonExpectedMinutes(lesson.expectedMinutes ? String(lesson.expectedMinutes) : '')
    setLessonSourceUrl(lesson.sourceUrl ?? '')
    setLessonError('')
    openDialog('lessons')
  }

  function startFolderEdit(folder: LearningNoteFolder) {
    setEditingFolder(folder)
    setNewFolderName(folder.name)
    setNoteError('')
    openDialog('notes')
  }

  function startStudyLogEdit(log: StudyLog) {
    setEditingStudyLog(log)
    setDate(log.date)
    setPathId(log.pathId ?? 'none')
    setLogResourceId(log.resourceId ?? 'none')
    setLogLessonId(log.lessonId ?? 'none')
    setTopic(log.topic)
    setMinutes(String(log.minutes))
    setLogNote(log.note ?? '')
    setError('')
    openDialog('log')
  }

  function startResourceEdit(resource: LearningResource) {
    setEditingResource(resource)
    setResourceTitle(resource.title)
    setResourceSourceUrl(resource.sourceUrl ?? '')
    setResourcePlatform(resource.platform ?? 'other')
    setResourcePathId(resource.pathId ?? 'none')
    setResourceStatus(resource.status)
    setResourceTargetMinutes(resource.targetMinutes ? String(resource.targetMinutes) : '')
    setResourceError('')
    openDialog('course')
  }

  function startReviewEdit(review: WeeklyReview) {
    setEditingReview(review)
    setReviewWeek(review.weekStartDate)
    setReviewWins(review.wins)
    setReviewBlockers(review.blockers)
    setReviewNextFocus(review.nextFocus)
    setReviewError('')
    openDialog('review')
  }

  function requestDelete(input: {
    title: string
    description: string
    action: () => void
  }) {
    setDeleteRequest(input)
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

    const reviewInput = {
      weekStartDate: reviewWeek,
      wins: normalizedWins,
      blockers: normalizedBlockers,
      nextFocus: normalizedNextFocus,
    }

    if (editingReview) {
      onReviewUpdate(editingReview.id, reviewInput)
    } else {
      onReviewSubmit(reviewInput)
    }

    setReviewWins('')
    setReviewBlockers('')
    setReviewNextFocus('')
    setReviewError('')
    setEditingReview(null)
    closeDialog()
    onSaved(editingReview ? '周复盘已更新' : '周复盘已保存')
  }

  function editNote(note: LearningNote) {
    setEditingNoteId(note.id)
    setNoteTitle(note.title)
    setNoteContent(note.content)
    setNoteFolderId(note.folderId ?? 'none')
    setNoteResourceId(note.resourceId ?? 'none')
    setNoteLessonId(note.lessonId ?? 'none')
    setNoteTags(note.tags.join(', '))
    openDialog('notes')
  }

  const learningTitle = editingStudyLog
    ? '编辑学习记录'
    : editingResource
      ? '编辑课程'
      : editingLesson
        ? '编辑课时'
        : editingPath
          ? '编辑学习路径'
          : editingNoteId
            ? '编辑笔记'
            : editingFolder
              ? '编辑笔记文件夹'
            : editingReview
              ? '编辑周复盘'
              : '添加学习内容'

  const learningDialog = (
    <RecordDialog
      activeTab={dialogTab}
      description="记录课程进度、学习流水、笔记和周复盘。"
      onClose={closeDialog}
      onTabChange={openDialog}
      open={dialogOpen}
      tabs={[
        { id: 'log', label: '学习记录' },
        { id: 'path', label: '路径' },
        { id: 'course', label: '课程' },
        { id: 'lessons', label: '课时目录' },
        { id: 'notes', label: '笔记' },
        { id: 'review', label: '周复盘' },
      ]}
      title={learningTitle}
    >
      {dialogTab === 'path' ? (
        <form onSubmit={submitPath} className="learning-dialog-form">
          <div className="form-grid two-columns">
            <div>
              <label htmlFor="learning-path-title">路径名称</label>
              <input
                id="learning-path-title"
                onChange={(event) => setPathTitle(event.target.value)}
                placeholder="前端工程化"
                value={pathTitle}
              />
            </div>
            <div>
              <label htmlFor="learning-path-target">目标时长（分钟）</label>
              <input
                id="learning-path-target"
                min="1"
                onChange={(event) => setPathTargetMinutes(event.target.value)}
                placeholder="600"
                step="1"
                type="number"
                value={pathTargetMinutes}
              />
            </div>
          </div>
          <button type="submit">
            {editingPath ? '保存路径修改' : '保存学习路径'}
          </button>
          {pathError ? <p role="alert">{pathError}</p> : null}
        </form>
      ) : dialogTab === 'course' ? (
        <form onSubmit={submitResource} className="learning-dialog-form">
          <div className="form-grid two-columns">
            <div>
              <label htmlFor="learning-resource-title">课程名称</label>
              <input
                id="learning-resource-title"
                value={resourceTitle}
                onChange={(event) => setResourceTitle(event.target.value)}
                placeholder="前端工程化实战"
              />
            </div>
            <div>
              <label htmlFor="learning-resource-url">课程链接</label>
              <input
                id="learning-resource-url"
                value={resourceSourceUrl}
                onChange={(event) => handleResourceUrlChange(event.target.value)}
                placeholder="粘贴 B站 / 伯索云 / MOOC 课程链接"
                inputMode="url"
              />
            </div>
            <div>
              <label htmlFor="learning-resource-platform">来源平台</label>
              <select
                id="learning-resource-platform"
                value={resourcePlatform}
                onChange={(event) =>
                  setResourcePlatform(event.target.value as LearningPlatform)
                }
              >
                {Object.entries(learningPlatformLabels).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
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
                <option value="none">独立课程</option>
                {learningPaths.map((path) => (
                  <option key={path.id} value={path.id}>{path.title}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="learning-resource-status">课程状态</label>
              <select
                id="learning-resource-status"
                value={resourceStatus}
                onChange={(event) =>
                  setResourceStatus(event.target.value as LearningResourceStatus)
                }
              >
                {resourceStatuses.map((status) => (
                  <option key={status.value} value={status.value}>{status.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="learning-resource-target">目标时长（分钟）</label>
              <input
                id="learning-resource-target"
                value={resourceTargetMinutes}
                onChange={(event) => setResourceTargetMinutes(event.target.value)}
                inputMode="numeric"
                type="number"
                min="1"
                step="1"
                placeholder="300"
              />
            </div>
          </div>
          <button type="submit">
            {editingResource ? '保存课程修改' : '保存课程'}
          </button>
          {resourceError ? <p role="alert">{resourceError}</p> : null}
        </form>
      ) : dialogTab === 'lessons' ? (
        <form onSubmit={submitLessons} className="learning-dialog-form">
          {editingLesson ? (
            <>
              <div className="form-grid two-columns">
                <div>
                  <label htmlFor="editing-lesson-title">课时标题</label>
                  <input
                    id="editing-lesson-title"
                    onChange={(event) => setLessonTitle(event.target.value)}
                    value={lessonTitle}
                  />
                </div>
                <div>
                  <label htmlFor="editing-lesson-status">课时状态</label>
                  <select
                    id="editing-lesson-status"
                    onChange={(event) =>
                      setLessonStatus(event.target.value as LearningLessonStatus)
                    }
                    value={lessonStatus}
                  >
                    {lessonStatuses.map((status) => (
                      <option key={status.value} value={status.value}>
                        {status.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="editing-lesson-minutes">预计分钟</label>
                  <input
                    id="editing-lesson-minutes"
                    min="1"
                    onChange={(event) =>
                      setLessonExpectedMinutes(event.target.value)
                    }
                    step="1"
                    type="number"
                    value={lessonExpectedMinutes}
                  />
                </div>
                <div>
                  <label htmlFor="editing-lesson-url">课时链接</label>
                  <input
                    id="editing-lesson-url"
                    inputMode="url"
                    onChange={(event) => setLessonSourceUrl(event.target.value)}
                    value={lessonSourceUrl}
                  />
                </div>
              </div>
              <button type="submit">保存课时修改</button>
            </>
          ) : (
            <>
              <div>
                <label htmlFor="lesson-resource">课程</label>
                <select
                  id="lesson-resource"
                  value={lessonResourceId}
                  onChange={(event) => setLessonResourceId(event.target.value)}
                >
                  <option value="none">请选择课程</option>
                  {learningResources.map((resource) => (
                    <option key={resource.id} value={resource.id}>
                      {resource.title}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="lesson-batch">课时目录</label>
                <textarea
                  id="lesson-batch"
                  value={lessonBatch}
                  onChange={(event) => setLessonBatch(event.target.value)}
                  placeholder={'第一章 课程导论 | 20\n第二章 环境准备 | 35'}
                  rows={10}
                />
                <small>每行一个课时，可用“|”追加预计分钟和课时链接。</small>
              </div>
              <button type="submit">保存课时目录</button>
            </>
          )}
          {lessonError ? <p role="alert">{lessonError}</p> : null}
        </form>
      ) : dialogTab === 'notes' ? (
        <form onSubmit={submitNote} className="learning-dialog-form">
          <div className="form-grid two-columns">
            <div>
              <label htmlFor="note-title">笔记标题</label>
              <input
                id="note-title"
                value={noteTitle}
                onChange={(event) => setNoteTitle(event.target.value)}
                placeholder="构建工具选型结论"
              />
            </div>
            <div>
              <label htmlFor="note-folder">笔记文件夹</label>
              <select
                id="note-folder"
                value={noteFolderId}
                onChange={(event) => setNoteFolderId(event.target.value)}
              >
                <option value="none">未分类</option>
                {learningNoteFolders.map((folder) => (
                  <option key={folder.id} value={folder.id}>{folder.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="note-resource">关联课程</label>
              <select
                id="note-resource"
                value={noteResourceId}
                onChange={(event) => {
                  setNoteResourceId(event.target.value)
                  setNoteLessonId('none')
                }}
              >
                <option value="none">不关联</option>
                {learningResources.map((resource) => (
                  <option key={resource.id} value={resource.id}>{resource.title}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="note-lesson">关联课时</label>
              <select
                id="note-lesson"
                value={noteLessonId}
                onChange={(event) => setNoteLessonId(event.target.value)}
              >
                <option value="none">不关联</option>
                {noteLessons.map((lesson) => (
                  <option key={lesson.id} value={lesson.id}>{lesson.title}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="note-tags">标签</label>
              <input
                id="note-tags"
                value={noteTags}
                onChange={(event) => setNoteTags(event.target.value)}
                placeholder="前端, 构建工具"
              />
            </div>
            <div className="folder-create">
              <label htmlFor="new-note-folder">
                {editingFolder ? '编辑文件夹名称' : '新文件夹'}
              </label>
              <div>
                <input
                  id="new-note-folder"
                  value={newFolderName}
                  onChange={(event) => setNewFolderName(event.target.value)}
                  placeholder="伯索云课程"
                />
                <button onClick={submitFolder} type="button">
                  {editingFolder ? '保存' : '创建'}
                </button>
              </div>
            </div>
          </div>
          <div>
            <label htmlFor="note-content">笔记内容</label>
            <textarea
              id="note-content"
              value={noteContent}
              onChange={(event) => setNoteContent(event.target.value)}
              placeholder="用 Markdown 记录结论、代码片段和待解决问题。"
              rows={12}
            />
          </div>
          <button type="submit">
            <NotebookPen size={16} />
            {editingNoteId ? '更新笔记' : '保存笔记'}
          </button>
          {noteError ? <p role="alert">{noteError}</p> : null}
        </form>
      ) : dialogTab === 'review' ? (
        <form onSubmit={submitReview} className="learning-dialog-form">
          <div className="form-grid two-columns">
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
              <label htmlFor="review-next-focus">下周重点</label>
              <input
                id="review-next-focus"
                value={reviewNextFocus}
                onChange={(event) => setReviewNextFocus(event.target.value)}
                placeholder="补齐项目测试"
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
          </div>
          <button type="submit">
            {editingReview ? '保存复盘修改' : '保存复盘'}
          </button>
          {reviewError ? <p role="alert">{reviewError}</p> : null}
        </form>
      ) : (
        <form onSubmit={submit} className="learning-dialog-form">
          <div className="form-grid three-columns">
            <div>
              <label htmlFor="learning-date">学习日期</label>
              <input
                id="learning-date"
                type="date"
                value={date}
                onChange={(event) => setDate(event.target.value)}
              />
            </div>
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
            <div>
              <label htmlFor="learning-course">课程</label>
              <select
                id="learning-course"
                value={logResourceId}
                onChange={(event) => {
                  setLogResourceId(event.target.value)
                  setLogLessonId('none')
                }}
              >
                <option value="none">自由记录</option>
                {learningResources.map((resource) => (
                  <option key={resource.id} value={resource.id}>{resource.title}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="learning-lesson">课时</label>
              <select
                id="learning-lesson"
                value={logLessonId}
                onChange={(event) => setLogLessonId(event.target.value)}
              >
                <option value="none">不关联课时</option>
                {logLessons.map((lesson) => (
                  <option key={lesson.id} value={lesson.id}>{lesson.title}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="learning-topic">学习主题</label>
              <input
                id="learning-topic"
                value={topic}
                onChange={(event) => setTopic(event.target.value)}
                placeholder="React 渲染模型"
              />
            </div>
            <div>
              <label htmlFor="learning-minutes">时长（分钟）</label>
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
          </div>
          <div>
            <label htmlFor="learning-note">学习备注</label>
            <textarea
              id="learning-note"
              value={logNote}
              onChange={(event) => setLogNote(event.target.value)}
              placeholder="记录关键结论、疑问或下次继续的位置。"
              rows={4}
            />
          </div>
          <button type="submit">
            <GraduationCap size={16} />
            {editingStudyLog ? '保存学习修改' : '记录学习'}
          </button>
          {error ? <p role="alert">{error}</p> : null}
        </form>
      )}
    </RecordDialog>
  )

  if (dialogOnly) {
    return learningDialog
  }

  const continueUrl = continueLesson?.sourceUrl ?? continueCourse?.sourceUrl

  return (
    <div className="learning-page">
      <section
        className="learning-panel learning-stream"
        aria-labelledby="learning-title"
      >
        <div className="panel-heading">
          <div>
            <label>学习工作台</label>
            <h2 id="learning-title">课程与笔记</h2>
          </div>
          <button
            className="page-add"
            onClick={() => openDialog('log')}
            type="button"
          >
            <Plus size={16} />
            添加学习内容
          </button>
        </div>

        {continueLesson ? (
          <section className="continue-card" aria-label="继续学习">
            <i aria-hidden="true">
              <PlayCircle size={22} />
            </i>
            <div>
              <label>继续学习</label>
              <h3>{continueLesson.title}</h3>
              <p>
                {continueCourse?.title ?? '自由课程'}
                {continueCourse?.platform
                  ? ` · ${learningPlatformLabels[continueCourse.platform]}`
                  : ''}
                {continueLesson.expectedMinutes
                  ? ` · 预计 ${continueLesson.expectedMinutes} 分钟`
                  : ''}
              </p>
            </div>
            {continueUrl ? (
              <a href={continueUrl} rel="noreferrer" target="_blank">
                <ExternalLink size={16} />
                打开课程
              </a>
            ) : null}
          </section>
        ) : null}

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
            <label>课时进度</label>
            <strong>
              {completedLessons}/{learningLessons.length}
            </strong>
            <small>{learningLessons.length ? '已勾选完成' : '还没有课时'}</small>
          </div>
          <div>
            <label>路径进度</label>
            <strong>{pathProgress}%</strong>
            <small>按学习时长统计</small>
          </div>
        </div>

        <div className="learning-list-heading">
          <h3>学习流水</h3>
        </div>
        <ul aria-label="学习记录">
          {studyLogs.map((log) => {
            const lesson = learningLessons.find((item) => item.id === log.lessonId)

            return (
              <li key={log.id}>
                <i>
                  <GraduationCap size={17} />
                </i>
                <div>
                  <h4>{log.topic}</h4>
                  <p>
                    {formatDate(log.date)}
                    {' · '}
                    {log.resourceId
                      ? resourceTitles.get(log.resourceId) ?? '课程'
                      : '自由记录'}
                    {lesson ? ` · ${lesson.title}` : ''}
                    {log.platform
                      ? ` · ${learningPlatformLabels[log.platform]}`
                      : ''}
                  </p>
                  {log.note ? <small>{log.note}</small> : null}
                </div>
                <div className="learning-record-side">
                  <b>
                    <Timer size={14} />
                    {formatStudyDuration(log.minutes)}
                  </b>
                  <div className="record-actions">
                    <button
                      aria-label={`编辑学习记录 ${log.topic}`}
                      onClick={() => startStudyLogEdit(log)}
                      type="button"
                    >
                      <Pencil size={15} />
                    </button>
                    <button
                      aria-label={`删除学习记录 ${log.topic}`}
                      className="delete"
                      onClick={() =>
                        requestDelete({
                          title: '删除学习记录',
                          description: `删除“${log.topic}”后无法恢复。`,
                          action: () => onStudyDelete(log.id),
                        })
                      }
                      type="button"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      </section>

      <div className="learning-side">
        <section className="learning-panel" aria-labelledby="course-title">
          <div className="panel-heading">
            <h2 id="course-title">课程库</h2>
            <button onClick={() => openDialog('course')} type="button">添加</button>
          </div>
          <ul className="course-list" aria-label="课程库">
            {learningResources.map((resource) => {
              const lessons = getCourseLessons(learningLessons, resource.id)
              const progress = getLessonProgress(learningLessons, resource.id)

              return (
                <li key={resource.id}>
                  <div className="course-heading">
                    <i>
                      <BookMarked size={16} />
                    </i>
                    <div>
                      <h3>{resource.title}</h3>
                      <p>
                        {resource.pathId
                          ? pathTitles.get(resource.pathId) ?? '学习路径'
                          : '独立课程'}
                        {' · '}
                        {learningPlatformLabels[resource.platform ?? 'other']}
                      </p>
                    </div>
                  </div>
                  <div className="course-meta">
                    <span>
                      {resourceStatuses.find((status) => status.value === resource.status)?.label}
                    </span>
                    {resource.sourceUrl ? (
                      <a href={resource.sourceUrl} rel="noreferrer" target="_blank">
                        <ExternalLink size={14} />
                        打开
                      </a>
                    ) : null}
                    <div className="record-actions">
                      <button
                        aria-label={`编辑课程 ${resource.title}`}
                        onClick={() => startResourceEdit(resource)}
                        type="button"
                      >
                        <Pencil size={15} />
                      </button>
                      <button
                        aria-label={`删除课程 ${resource.title}`}
                        className="delete"
                        onClick={() =>
                          requestDelete({
                            title: '删除课程',
                            description: `删除“${resource.title}”会删除其课时；学习流水和笔记会保留并清空课程关联。`,
                            action: () => onResourceDelete(resource.id),
                          })
                        }
                        type="button"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                  {lessons.length > 0 ? (
                    <div className="lesson-progress">
                      <progress
                        aria-label={`${resource.title} 课时进度`}
                        max={progress.total}
                        value={progress.completed}
                      />
                      <span>{progress.completed}/{progress.total} 课时</span>
                    </div>
                  ) : null}
                  <select
                    aria-label={`${resource.title} 状态`}
                    value={resource.status}
                    onChange={(event) =>
                      onResourceStatusChange(
                        resource.id,
                        event.target.value as LearningResourceStatus,
                      )
                    }
                  >
                    {resourceStatuses.map((status) => (
                      <option key={status.value} value={status.value}>{status.label}</option>
                    ))}
                  </select>
                  {lessons.length > 0 ? (
                    <ul
                      className="lesson-list"
                      aria-label={`${resource.title} 课时目录`}
                    >
                      {lessons.map((lesson) => (
                        <li key={lesson.id}>
                          <div>
                            <strong>{lesson.title}</strong>
                            <small>
                              {lesson.expectedMinutes
                                ? `${lesson.expectedMinutes} 分钟`
                                : '未设置时长'}
                            </small>
                          </div>
                          <select
                            aria-label={`${resource.title} ${lesson.title} 状态`}
                            value={lesson.status}
                            onChange={(event) =>
                              onLessonStatusChange(
                                lesson.id,
                                event.target.value as LearningLessonStatus,
                              )
                            }
                          >
                            {lessonStatuses.map((status) => (
                              <option key={status.value} value={status.value}>{status.label}</option>
                            ))}
                          </select>
                          <div className="record-actions">
                            <button
                              aria-label={`编辑课时 ${lesson.title}`}
                              onClick={() => startLessonEdit(lesson)}
                              type="button"
                            >
                              <Pencil size={15} />
                            </button>
                            <button
                              aria-label={`删除课时 ${lesson.title}`}
                              className="delete"
                              onClick={() =>
                                requestDelete({
                                  title: '删除课时',
                                  description: `删除“${lesson.title}”后无法恢复；学习流水和笔记会保留并清空课时关联。`,
                                  action: () => onLessonDelete(lesson.id),
                                })
                              }
                              type="button"
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <button
                      className="ghost-add"
                      onClick={() => openDialog('lessons')}
                      type="button"
                    >
                      添加课时
                    </button>
                  )}
                </li>
              )
            })}
          </ul>
        </section>

        <section className="learning-panel" aria-labelledby="path-progress-title">
          <div className="panel-heading">
            <h2 id="path-progress-title">路径进度</h2>
            <button onClick={() => openDialog('path')} type="button">添加</button>
          </div>
          <ul className="path-list" aria-label="学习路径进度">
            {learningPaths.map((path) => {
              const learnedMinutes = studyLogs
                .filter((log) => log.pathId === path.id)
                .reduce((total, log) => total + log.minutes, 0)

              return (
                <li key={path.id}>
                  <div>
                    <h3>{path.title}</h3>
                    <p>{learnedMinutes} / {path.targetMinutes} 分钟</p>
                  </div>
                  <progress
                    aria-label={`${path.title} 学习进度`}
                    max={path.targetMinutes}
                    value={learnedMinutes}
                  />
                  <div className="record-actions">
                    <button
                      aria-label={`编辑学习路径 ${path.title}`}
                      onClick={() => startPathEdit(path)}
                      type="button"
                    >
                      <Pencil size={15} />
                    </button>
                    <button
                      aria-label={`删除学习路径 ${path.title}`}
                      className="delete"
                      onClick={() =>
                        requestDelete({
                          title: '删除学习路径',
                          description: `删除“${path.title}”后课程和学习记录会保留，但会清空路径关联。`,
                          action: () => onPathDelete(path.id),
                        })
                      }
                      type="button"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </li>
              )
            })}
          </ul>
        </section>

        <section className="learning-panel" aria-labelledby="platform-title">
          <h2 id="platform-title">平台分布</h2>
          <ul className="platform-list" aria-label="平台分布">
            {platformCounts.map((item) => (
              <li key={item.platform}>
                <span>{learningPlatformLabels[item.platform]}</span>
                <b>{item.count} 门</b>
              </li>
            ))}
          </ul>
        </section>

        <section className="learning-panel" aria-labelledby="review-title">
          <h2 id="review-title">周复盘</h2>
          {weeklyReviews.length === 0 ? (
            <p className="section-empty">还没有周复盘，可在添加弹窗中记录。</p>
          ) : (
            <ul className="review-list" aria-label="周复盘记录">
              {weeklyReviews.slice(0, 6).map((review) => (
                <li key={review.id}>
                  <div>
                    <h3>周起始 {formatDate(review.weekStartDate)}</h3>
                    <p>{review.wins}</p>
                    <small>阻碍：{review.blockers}</small>
                    <small>下周：{review.nextFocus}</small>
                  </div>
                  <div className="record-actions">
                    <button
                      aria-label={`编辑周复盘 ${formatDate(review.weekStartDate)}`}
                      onClick={() => startReviewEdit(review)}
                      type="button"
                    >
                      <Pencil size={15} />
                    </button>
                    <button
                      aria-label={`删除周复盘 ${formatDate(review.weekStartDate)}`}
                      className="delete"
                      onClick={() =>
                        requestDelete({
                          title: '删除周复盘',
                          description: `删除周起始 ${formatDate(review.weekStartDate)} 的复盘后无法恢复。`,
                          action: () => onReviewDelete(review.id),
                        })
                      }
                      type="button"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section
        className="learning-panel notes-workspace"
        aria-labelledby="notes-title"
      >
        <div className="panel-heading">
          <div>
            <label>知识沉淀</label>
            <h2 id="notes-title">学习笔记库</h2>
          </div>
          <button
            className="page-add"
            onClick={() => openDialog('notes')}
            type="button"
          >
            <Plus size={16} />
            添加笔记
          </button>
        </div>

        <div className="notes-toolbar">
          <div className="folder-list" role="group" aria-label="笔记文件夹">
            <button
              aria-pressed={noteFolderFilter === 'all'}
              className={noteFolderFilter === 'all' ? 'selected' : ''}
              onClick={() => setNoteFolderFilter('all')}
              type="button"
            >
              全部
            </button>
            {learningNoteFolders.map((folder) => (
              <span className="folder-filter-item" key={folder.id}>
                <button
                  aria-pressed={noteFolderFilter === folder.id}
                  className={noteFolderFilter === folder.id ? 'selected' : ''}
                  onClick={() => setNoteFolderFilter(folder.id)}
                  type="button"
                >
                  <Folder size={14} />
                  {folder.name}
                </button>
                <button
                  aria-label={`编辑笔记文件夹 ${folder.name}`}
                  onClick={() => startFolderEdit(folder)}
                  type="button"
                >
                  <Pencil size={13} />
                </button>
                <button
                  aria-label={`删除笔记文件夹 ${folder.name}`}
                  className="delete"
                  onClick={() =>
                    requestDelete({
                      title: '删除笔记文件夹',
                      description: `删除“${folder.name}”后，其中笔记会移动到“未分类”。`,
                      action: () => onNoteFolderDelete(folder.id),
                    })
                  }
                  type="button"
                >
                  <Trash2 size={13} />
                </button>
              </span>
            ))}
          </div>
          <input
            aria-label="搜索笔记"
            onChange={(event) => setNoteSearch(event.target.value)}
            placeholder="搜索标题、内容或标签"
            type="search"
            value={noteSearch}
          />
        </div>

        {visibleNotes.length === 0 ? (
          <div className="notes-empty">
            <h3>还没有匹配的笔记</h3>
            <p>把课程结论、代码片段和待解决问题沉淀到这里。</p>
          </div>
        ) : (
          <ul className="note-grid" aria-label="学习笔记">
            {visibleNotes.map((note) => (
              <li key={note.id}>
                <div className="note-heading">
                  <h3>{note.title}</h3>
                  <div className="record-actions">
                    <button
                      aria-label={`编辑笔记 ${note.title}`}
                      onClick={() => editNote(note)}
                      type="button"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      aria-label={`删除笔记 ${note.title}`}
                      className="delete"
                      onClick={() =>
                        requestDelete({
                          title: '删除笔记',
                          description: `删除“${note.title}”后无法恢复。`,
                          action: () => onNoteDelete(note.id),
                        })
                      }
                      type="button"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
                <p className="note-meta">
                  {learningNoteFolders.find((folder) => folder.id === note.folderId)?.name ?? '未分类'}
                  {' · '}
                  {note.resourceId
                    ? resourceTitles.get(note.resourceId) ?? '课程'
                    : '未关联课程'}
                </p>
                <pre>{note.content}</pre>
                {note.tags.length > 0 ? (
                  <div className="note-tags">
                    {note.tags.map((tag) => (
                      <span key={tag}>#{tag}</span>
                    ))}
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      {learningDialog}

      <ConfirmDialog
        description={deleteRequest?.description ?? ''}
        onCancel={() => setDeleteRequest(null)}
        onConfirm={() => {
          if (deleteRequest) {
            deleteRequest.action()
          }
          setDeleteRequest(null)
          onSaved('记录已删除')
        }}
        open={deleteRequest !== null}
        title={deleteRequest?.title ?? ''}
      />
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

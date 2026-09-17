import type {
  LearningLesson,
  LearningLessonDraft,
  LearningPlatform,
  LearningResource,
  StudyLog,
} from '../data/model'

export const learningPlatformLabels: Record<LearningPlatform, string> = {
  bilibili: 'B站',
  mooc: 'MOOC',
  plaso: '伯索云',
  xiaoe: '小鹅通',
  baiduPan: '百度网盘',
  other: '其他',
}

export function getCourseLessons(
  lessons: LearningLesson[],
  resourceId: string,
) {
  return lessons
    .filter((lesson) => lesson.resourceId === resourceId)
    .sort((a, b) => a.sortOrder - b.sortOrder)
}

export function getLessonProgress(
  lessons: LearningLesson[],
  resourceId: string,
) {
  const courseLessons = getCourseLessons(lessons, resourceId)
  const completed = courseLessons.filter(
    (lesson) => lesson.status === 'done',
  ).length

  return {
    completed,
    total: courseLessons.length,
    percent: courseLessons.length
      ? Math.round((completed / courseLessons.length) * 100)
      : 0,
  }
}

export function getContinueLearning(
  lessons: LearningLesson[],
  studyLogs: StudyLog[],
) {
  const lessonMap = new Map(lessons.map((lesson) => [lesson.id, lesson]))
  const recentlyStudied = studyLogs
    .map((log) => log.lessonId)
    .filter((lessonId): lessonId is string => Boolean(lessonId))
    .map((lessonId) => lessonMap.get(lessonId))
    .find(
      (lesson): lesson is LearningLesson =>
        Boolean(lesson) && lesson?.status !== 'done',
    )

  if (recentlyStudied) {
    return recentlyStudied
  }

  return [...lessons]
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .find((lesson) => lesson.status === 'doing')
}

export function parseLearningLessonLines(
  value: string,
): Array<LearningLessonDraft> {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim().replace(/^[-*]\s*/, ''))
    .filter(Boolean)
    .map((line) => {
      const parts = line.split(/[|｜]/).map((part) => part.trim())
      const title = parts[0]?.trim() ?? ''
      const expectedMinutes = Number(parts[1])
      const sourceUrl = parts[2]?.trim()

      return {
        title,
        ...(Number.isInteger(expectedMinutes) && expectedMinutes > 0
          ? { expectedMinutes }
          : {}),
        ...(sourceUrl ? { sourceUrl } : {}),
      }
    })
    .filter((lesson) => lesson.title.length > 0)
}

export function getPlatformCounts(resources: LearningResource[]) {
  const counts = new Map<LearningPlatform, number>()

  for (const resource of resources) {
    const platform = resource.platform ?? 'other'
    counts.set(platform, (counts.get(platform) ?? 0) + 1)
  }

  return [...counts.entries()]
    .map(([platform, count]) => ({ platform, count }))
    .sort((a, b) => b.count - a.count)
}

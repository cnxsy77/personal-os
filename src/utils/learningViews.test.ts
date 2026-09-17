import { describe, expect, it } from 'vitest'
import type { LearningLesson, StudyLog } from '../data/model'
import {
  getContinueLearning,
  getLessonProgress,
  parseLearningLessonLines,
} from './learningViews'

describe('learning views', () => {
  it('parses batched lesson lines with optional duration and link', () => {
    const lessons = parseLearningLessonLines(`
- 工程化总览 | 20
构建工具对比｜35 | https://example.com/lesson-2
测试策略
`)

    expect(lessons).toEqual([
      { title: '工程化总览', expectedMinutes: 20 },
      {
        title: '构建工具对比',
        expectedMinutes: 35,
        sourceUrl: 'https://example.com/lesson-2',
      },
      { title: '测试策略' },
    ])
  })

  it('recommends the unfinished lesson from the latest study log', () => {
    const lessons: LearningLesson[] = [
      {
        id: 'lesson-1',
        resourceId: 'course-1',
        title: '第一课',
        sortOrder: 1,
        status: 'done',
      },
      {
        id: 'lesson-2',
        resourceId: 'course-1',
        title: '第二课',
        sortOrder: 2,
        status: 'doing',
      },
    ]
    const logs: StudyLog[] = [
      {
        id: 'log-1',
        topic: '第一课',
        minutes: 20,
        date: '2026-09-17',
        lessonId: 'lesson-2',
      },
    ]

    expect(getContinueLearning(lessons, logs)?.id).toBe('lesson-2')
  })

  it('summarizes completed lessons for a course', () => {
    const lessons: LearningLesson[] = [
      {
        id: 'lesson-1',
        resourceId: 'course-1',
        title: '第一课',
        sortOrder: 1,
        status: 'done',
      },
      {
        id: 'lesson-2',
        resourceId: 'course-2',
        title: '其他课程',
        sortOrder: 2,
        status: 'done',
      },
    ]

    expect(getLessonProgress(lessons, 'course-1')).toEqual({
      completed: 1,
      total: 1,
      percent: 100,
    })
  })
})

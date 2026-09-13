import { describe, expect, it } from 'vitest'
import type { Task } from '../data/model'
import {
  filterTasks,
  getWeekRange,
  groupTasks,
  summarizePlan,
  summarizePlanRhythm,
} from './planViews'

describe('plan views', () => {
  const now = new Date('2026-09-14T10:00:00')
  const tasks: Task[] = [
    {
      id: 'overdue',
      title: '归档上月账单',
      meta: '生活 · 全天',
      done: false,
      date: '2026-09-07',
      category: 'life',
    },
    {
      id: 'today',
      title: '完成计划页',
      meta: '工作 · 10:30',
      done: false,
      date: '2026-09-14',
      time: '10:30',
      category: 'work',
    },
    {
      id: 'done-today',
      title: '准备晨会',
      meta: '工作 · 09:00',
      done: true,
      date: '2026-09-14',
      time: '09:00',
      category: 'work',
    },
    {
      id: 'tomorrow',
      title: '安排锻炼计划',
      meta: '锻炼 · 08:00',
      done: false,
      date: '2026-09-15',
      time: '08:00',
      category: 'health',
    },
    {
      id: 'week-after',
      title: '更新周报',
      meta: '工作 · 全天',
      done: false,
      date: '2026-09-16',
      category: 'work',
    },
    {
      id: 'future',
      title: '年度复盘',
      meta: '生活 · 全天',
      done: false,
      date: '2026-09-27',
      category: 'life',
    },
    {
      id: 'unscheduled',
      title: '整理想法',
      meta: '工作 · 今天',
      done: false,
    },
  ]

  it('calculates a Monday-to-Sunday week', () => {
    expect(getWeekRange(now)).toEqual({
      start: '2026-09-14',
      end: '2026-09-20',
    })
  })

  it('groups tasks by due date and completion state', () => {
    const activeTasks = filterTasks(
      tasks,
      { range: 'all', status: 'active', category: 'all', query: '' },
      now,
    )

    expect(groupTasks(activeTasks, now).map((group) => group.key)).toEqual([
      'overdue',
      'today',
      'tomorrow',
      'weekAfter',
      'future',
      'unscheduled',
    ])
  })

  it('filters by category, status, time range, and query', () => {
    const healthTasks = filterTasks(
      tasks,
      { range: 'week', status: 'active', category: 'health', query: '锻炼' },
      now,
    )

    expect(healthTasks.map((task) => task.id)).toEqual(['tomorrow'])
  })

  it('summarizes task totals and filtered rhythm', () => {
    const summary = summarizePlan(tasks, now)

    expect(summary).toEqual({
      todayTotal: 2,
      todayActive: 1,
      weekTotal: 4,
      completionPercent: 25,
    })

    const activeTasks = filterTasks(
      tasks,
      { range: 'all', status: 'active', category: 'all', query: '' },
      now,
    )
    const rhythm = summarizePlanRhythm(activeTasks, tasks, now)

    expect(rhythm.overdueCount).toBe(1)
    expect(rhythm.latestOverdueDate).toBe('2026-09-07')
    expect(rhythm.unscheduledCount).toBe(1)
    expect(rhythm.weekCompleted).toBe(1)
    expect(rhythm.weekTotal).toBe(4)
    expect(rhythm.distribution).toEqual([
      { category: 'work', count: 2 },
      { category: 'health', count: 1 },
      { category: 'learning', count: 0 },
      { category: 'life', count: 2 },
      { category: 'none', count: 1 },
    ])
  })
})

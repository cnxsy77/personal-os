import { describe, expect, it } from 'vitest'
import { parseWorkoutPlanText } from './workoutPlanText'

const today = new Date(2026, 8, 12)

describe('workout plan text parser', () => {
  it('resolves dates, focus, kinds, warmup, exercises, and notes', () => {
    const plan = parseWorkoutPlanText(
      `9月9日 胸加肩
热身泡沫轴松解背部
肩关节灵活度热身
哑铃飞鸟12×2×4递减
史密斯上斜推胸12×4
肌肉延迟性酸痛
胸大肌，肩前束`,
      today,
    )

    expect(plan.date).toBe('2026-09-09')
    expect(plan.focus).toBe('胸加肩')
    expect(plan.kinds).toEqual(['shoulders', 'chest'])
    expect(plan.warmup).toEqual([
      '热身泡沫轴松解背部',
      '肩关节灵活度热身',
    ])
    expect(plan.exercises).toEqual([
      { name: '哑铃飞鸟', prescription: '12×2×4', target: '递减' },
      { name: '史密斯上斜推胸', prescription: '12×4' },
    ])
    expect(plan.notes).toEqual(['肌肉延迟性酸痛', '胸大肌，肩前束'])
  })

  it('supports separated date and focus lines plus implicit nearest years', () => {
    const currentYearPlan = parseWorkoutPlanText(
      `9月6日
下肢臀腿
坐姿髋外展中立位12×4`,
      today,
    )

    expect(currentYearPlan.date).toBe('2026-09-06')
    expect(currentYearPlan.focus).toBe('下肢臀腿')
    expect(currentYearPlan.kinds).toEqual(['glutes', 'legs'])

    const previousYearPlan = parseWorkoutPlanText(
      `1月2日
背部训练
高位下拉12×4`,
      today,
    )
    expect(previousYearPlan.date).toBe('2026-01-02')
    expect(previousYearPlan.kinds).toEqual(['back'])
  })
})

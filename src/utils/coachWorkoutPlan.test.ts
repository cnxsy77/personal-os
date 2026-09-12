import { describe, expect, it } from 'vitest'
import { parseCoachWorkoutPlans } from './coachWorkoutPlan'

const coachPlan = `
9月6日
恢复训练力量还没上来
下肢臀腿
热身泡沫轴松解臀大肌，股四头肌，腘绳肌
坐姿髋外展中立位12×4
坐姿髋外展后仰位12×4
坐姿腰带臀推12×4
哑铃硬拉12×4
高脚杯深蹲12×2
9月9日
胸加肩
哑铃飞鸟12×2×4
史密斯上斜推胸12×4
固定器械上斜推胸12×4
宽位划船肩后束12×3
蝴蝶结夹胸12×3
肌肉延迟性酸痛
胸大肌，肩前束，肱三头肌
9月5日，
背部训练
热身激活
泡沫轴松解背部
肩关节灵活度热身
高位下拉12*4
坐姿划船12*4
固定器械反手下拉12*4
宽位划船12*4中下斜方菱形肌
最近一段时间有可能身体耐力下降了，力量会相对来讲有点偏小，恢复2个循环力量慢慢就会上来了
7月12日
肩部训练
上肢肩关节灵活度热身
ytA字伸展
核心激活平板支撑*2，
下卷腹各三组，每组20个
哑铃飞鸟12×3*4递减
蝴蝶机反向12×4肩后束
固定器械坐姿推肩12×4
哑铃前平举12*4
整体强度还不错[嘿哈]
肩前束整体还是有点偏无力，慢慢加强
7月10日，背部训练
热身激活，泡沫轴松解背部
泡沫轴活动胸椎
肩关节灵活度热身
核心激活
平板支撑两组，每组60秒左右，第二组增加抗旋能力对抗
固定器械下卷腹3组每组20次
高位下拉12*6大小圆背阔，递减组
固定器械坐姿划船12*4背阔中下斜方菱形
对握高位下拉12×4
坐姿划船12×4
4月18日，背部训练
热身激活，泡沫轴松解背部
肩关节灵活度热身
高位下拉12*4
坐姿划船12*4
固定器械斜向反手下拉12×4
固定器械下拉12×4
核心收尾
平板支撑2组43S   22S
死虫子静力抗阻，1组
`

describe('coach workout plan parser', () => {
  it('splits multi-day coach plans and infers this year for past dates', () => {
    const plans = parseCoachWorkoutPlans(
      coachPlan,
      new Date('2026-09-12T12:00:00'),
    )

    expect(plans.map((plan) => plan.date)).toEqual([
      '2026-09-06',
      '2026-09-09',
      '2026-09-05',
      '2026-07-12',
      '2026-07-10',
      '2026-04-18',
    ])
    expect(plans.map((plan) => plan.focus)).toEqual([
      '下肢臀腿',
      '胸加肩',
      '背部训练',
      '肩部训练',
      '背部训练',
      '背部训练',
    ])
    expect(plans.map((plan) => plan.kind)).toEqual([
      'glutes',
      'shoulders',
      'back',
      'shoulders',
      'back',
      'back',
    ])
    expect(plans.map((plan) => plan.kinds)).toEqual([
      ['glutes', 'legs'],
      ['shoulders', 'chest', 'back'],
      ['back'],
      ['shoulders', 'chest'],
      ['back'],
      ['back'],
    ])
    expect(plans.every((plan) => plan.status === 'completed')).toBe(true)
    expect(plans.every((plan) => plan.durationMinutes === 0)).toBe(true)
  })

  it('keeps warm-ups, exercises, soreness areas, and coach notes apart', () => {
    const plans = parseCoachWorkoutPlans(
      coachPlan,
      new Date('2026-09-12T12:00:00'),
    )

    expect(plans[0].warmup).toEqual([
      '热身泡沫轴松解臀大肌，股四头肌，腘绳肌',
    ])
    expect(plans[0].exercises).toHaveLength(5)
    expect(plans[0].coachNotes).toEqual(['恢复训练力量还没上来'])

    expect(plans[1].exercises).toEqual([
      { name: '哑铃飞鸟', prescription: '12×2×4' },
      { name: '史密斯上斜推胸', prescription: '12×4' },
      { name: '固定器械上斜推胸', prescription: '12×4' },
      { name: '宽位划船肩后束', prescription: '12×3' },
      { name: '蝴蝶结夹胸', prescription: '12×3' },
    ])
    expect(plans[1].sorenessAreas).toEqual([
      '胸大肌',
      '肩前束',
      '肱三头肌',
    ])

    expect(plans[2].warmup).toEqual([
      '热身激活',
      '泡沫轴松解背部',
      '肩关节灵活度热身',
    ])
    expect(plans[2]?.exercises?.at(-1)).toEqual({
      name: '宽位划船',
      prescription: '12*4',
      target: '中下斜方菱形肌',
    })
    expect((plans[2]?.coachNotes ?? []).join('\n')).toContain(
      '身体耐力下降了',
    )

    expect(plans[3].coachNotes).toEqual([
      '整体强度还不错[嘿哈]',
      '肩前束整体还是有点偏无力，慢慢加强',
    ])

    expect(plans[4].warmup).toContain('核心激活')
    expect(
      (plans[4]?.exercises ?? []).some((item) => item.name === '平板支撑'),
    ).toBe(true)
    expect(
      (plans[4]?.exercises ?? []).some(
        (item) => item.name === '固定器械下卷腹',
      ),
    ).toBe(true)

    expect(plans[5].finisher).toEqual(['核心收尾'])
    expect(plans[5]?.exercises?.at(-1)).toMatchObject({
      name: '死虫子静力抗阻',
      prescription: '1组',
    })
  })

  it('ignores text without a usable date', () => {
    expect(
      parseCoachWorkoutPlans('胸加肩\n哑铃飞鸟12×4', new Date()),
    ).toEqual([])
  })
})

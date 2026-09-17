import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import App from './App'
import { createLocalPersonalOSData } from './data/localPersonalOSData'
import { createMemoryStorage } from './test/memoryStorage'

function toDateKey(value: Date) {
  const month = String(value.getMonth() + 1).padStart(2, '0')
  const day = String(value.getDate()).padStart(2, '0')
  return `${value.getFullYear()}-${month}-${day}`
}

describe('health quick capture', () => {
  it('records a workout and updates its status', async () => {
    const user = userEvent.setup()
    const data = createLocalPersonalOSData({ storage: createMemoryStorage() })
    render(<App data={data} />)

    await user.click(screen.getByRole('button', { name: '锻炼' }))
    await user.click(screen.getByRole('button', { name: '添加记录' }))
    await user.click(screen.getByRole('button', { name: '训练类型' }))
    await user.click(screen.getByLabelText('胸'))
    await user.click(screen.getByLabelText('肩'))
    expect(screen.getByLabelText('胸')).toBeChecked()
    expect(screen.getByLabelText('肩')).toBeChecked()
    expect(screen.getByRole('button', { name: '训练类型' })).toHaveTextContent(
      '胸',
    )
    expect(screen.getByRole('button', { name: '训练类型' })).toHaveTextContent(
      '肩',
    )
    expect(screen.getByRole('button', { name: '移除胸' })).toBeInTheDocument()
    await user.keyboard('{Escape}')
    expect(screen.queryByLabelText('臀')).not.toBeInTheDocument()
    expect(screen.getByRole('dialog', { name: '添加锻炼记录' })).toBeInTheDocument()
    await user.type(screen.getByLabelText('训练时长'), '45')
    fireEvent.change(screen.getByLabelText('计划'), {
      target: { value: '哑铃飞鸟 12×4\n史密斯上斜推胸 12×4' },
    })
    await user.click(screen.getByRole('button', { name: '保存训练' }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByText('训练已保存')).toBeInTheDocument()

    const workoutList = screen.getByRole('list', { name: '训练记录' })
    expect(workoutList).toHaveTextContent('哑铃飞鸟')
    expect(workoutList).toHaveTextContent('12×4')
    expect(workoutList).toHaveTextContent('史密斯上斜推胸')

    expect(data.getSnapshot().workouts[0]).toMatchObject({
      kind: 'chest',
      kinds: ['chest', 'shoulders'],
      status: 'completed',
      durationMinutes: 45,
      plan: ['哑铃飞鸟 12×4', '史密斯上斜推胸 12×4'],
    })
    expect(screen.queryByLabelText('热身与准备')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('收尾')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('酸痛肌群')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('训练备注')).not.toBeInTheDocument()
    expect(screen.getByText('本周完成').nextElementSibling).toHaveTextContent(
      '1 / 4',
    )
  })

  it('edits an existing workout and preserves its record id', async () => {
    const user = userEvent.setup()
    const data = createLocalPersonalOSData({ storage: createMemoryStorage() })
    render(<App data={data} />)

    await user.click(screen.getByRole('button', { name: '锻炼' }))
    await user.click(screen.getByRole('button', { name: '添加记录' }))
    fireEvent.change(screen.getByLabelText('训练日期'), {
      target: { value: '2026-09-09' },
    })
    await user.click(screen.getByRole('button', { name: '训练类型' }))
    await user.click(screen.getByLabelText('胸'))
    await user.keyboard('{Escape}')
    await user.type(screen.getByLabelText('训练时长'), '45')
    await user.type(screen.getByLabelText('训练主题'), '胸加肩')
    fireEvent.change(screen.getByLabelText('计划'), {
      target: { value: '哑铃飞鸟 12×4' },
    })
    await user.click(screen.getByRole('button', { name: '保存训练' }))

    expect(screen.getByText('训练已保存')).toBeInTheDocument()

    const originalId = data.getSnapshot().workouts[0]?.id as string
    await user.click(screen.getByRole('button', { name: '编辑胸加肩' }))

    expect(
      screen.getByRole('dialog', { name: '编辑训练记录' }),
    ).toBeInTheDocument()
    expect(screen.getByLabelText('训练日期')).toHaveValue('2026-09-09')
    expect(screen.getByLabelText('训练时长')).toHaveValue(45)
    expect(screen.getByLabelText('训练主题')).toHaveValue('胸加肩')
    expect(screen.getByLabelText('计划')).toHaveValue('哑铃飞鸟 12×4')
    expect(screen.getByRole('button', { name: '保存修改' })).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('训练日期'), {
      target: { value: '2026-09-10' },
    })
    await user.clear(screen.getByLabelText('训练时长'))
    await user.type(screen.getByLabelText('训练时长'), '55')
    await user.clear(screen.getByLabelText('计划'))
    await user.type(screen.getByLabelText('计划'), '高脚杯深蹲 12×3')
    await user.click(screen.getByRole('button', { name: '识别' }))
    await user.click(screen.getByRole('button', { name: '保存修改' }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByText('训练已更新')).toBeInTheDocument()
    expect(data.getSnapshot().workouts).toHaveLength(1)
    expect(data.getSnapshot().workouts[0]).toMatchObject({
      id: originalId,
      date: '2026-09-10',
      durationMinutes: 55,
      plan: ['高脚杯深蹲 12×3'],
    })
    const workoutList = screen.getByRole('list', { name: '训练记录' })
    expect(workoutList).toHaveTextContent('高脚杯深蹲')
    expect(workoutList).toHaveTextContent('12×3')
  })

  it('records a health metric and updates it on the same date', async () => {
    const user = userEvent.setup()
    const data = createLocalPersonalOSData({ storage: createMemoryStorage() })
    render(<App data={data} />)

    await user.click(screen.getByRole('button', { name: '锻炼' }))
    await user.click(screen.getByRole('button', { name: '添加记录' }))
    await user.click(screen.getByRole('tab', { name: '身体指标' }))
    fireEvent.change(screen.getByLabelText('记录日期'), {
      target: { value: '2026-09-11' },
    })
    await user.type(screen.getByLabelText('睡眠时长'), '7.5')
    await user.type(screen.getByLabelText('体重'), '72.4')
    await user.selectOptions(screen.getByLabelText('身体状态'), 'good')
    await user.click(screen.getByRole('button', { name: '保存身体指标' }))

    expect(screen.getByRole('list', { name: '身体指标' })).toHaveTextContent(
      '2026.09.11',
    )

    await user.click(screen.getByRole('button', { name: '添加记录' }))
    await user.click(screen.getByRole('tab', { name: '身体指标' }))

    expect(screen.getByRole('list', { name: '身体指标' })).toHaveTextContent(
      '2026.09.11',
    )

    await user.clear(screen.getByLabelText('睡眠时长'))
    await user.type(screen.getByLabelText('睡眠时长'), '8')
    await user.clear(screen.getByLabelText('体重'))
    await user.type(screen.getByLabelText('体重'), '72.2')
    await user.selectOptions(screen.getByLabelText('身体状态'), 'great')
    await user.selectOptions(screen.getByLabelText('月经流量'), 'medium')
    await user.click(screen.getByRole('button', { name: '月经症状' }))
    await user.click(screen.getByLabelText('痛经'))
    await user.click(screen.getByLabelText('疲劳'))
    expect(screen.getByRole('button', { name: '月经症状' })).toHaveTextContent(
      '痛经',
    )
    expect(screen.getByRole('button', { name: '月经症状' })).toHaveTextContent(
      '疲劳',
    )
    await user.type(screen.getByLabelText('月经备注'), '周期第 2 天')
    await user.click(screen.getByRole('button', { name: '保存身体指标' }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByText('身体指标已保存')).toBeInTheDocument()
    expect(data.getSnapshot().healthMetrics).toHaveLength(1)
    expect(data.getSnapshot().healthMetrics[0]).toMatchObject({
      date: '2026-09-11',
      sleepHours: 8,
      weightKg: 72.2,
      condition: 'great',
      menstruationFlow: 'medium',
      menstruationSymptoms: ['cramps', 'fatigue'],
      menstruationNote: '周期第 2 天',
    })
    expect(screen.getByRole('list', { name: '身体指标' })).toHaveTextContent(
      '月经 中等 · 痛经、疲劳',
    )
  })

  it('edits and deletes a health metric after confirmation', async () => {
    const user = userEvent.setup()
    const data = createLocalPersonalOSData({ storage: createMemoryStorage() })
    const today = toDateKey(new Date())
    const todayLabel = today.replaceAll('-', '.')
    render(<App data={data} />)

    await user.click(screen.getByRole('button', { name: '锻炼' }))
    await user.click(screen.getByRole('button', { name: '添加记录' }))
    await user.click(screen.getByRole('tab', { name: '身体指标' }))
    await user.type(screen.getByLabelText('睡眠时长'), '7.2')
    await user.click(screen.getByRole('button', { name: '保存身体指标' }))

    const originalId = data.getSnapshot().healthMetrics[0]?.id as string
    await user.click(screen.getByRole('button', { name: `编辑${todayLabel}身体指标` }))

    expect(screen.getByRole('dialog', { name: '编辑身体指标' })).toBeInTheDocument()
    expect(screen.getByLabelText('记录日期')).toHaveValue(today)
    expect(screen.getByLabelText('睡眠时长')).toHaveValue(7.2)

    await user.clear(screen.getByLabelText('睡眠时长'))
    await user.type(screen.getByLabelText('睡眠时长'), '8.4')
    await user.click(screen.getByRole('button', { name: '保存身体指标' }))

    expect(screen.getByText('身体指标已更新')).toBeInTheDocument()
    expect(data.getSnapshot().healthMetrics).toHaveLength(1)
    expect(data.getSnapshot().healthMetrics[0]).toMatchObject({
      id: originalId,
      sleepHours: 8.4,
    })

    await user.click(screen.getByRole('button', { name: `删除${todayLabel}身体指标` }))
    expect(screen.getByRole('alertdialog', { name: '删除身体指标' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '取消' }))
    expect(data.getSnapshot().healthMetrics).toHaveLength(1)

    await user.click(screen.getByRole('button', { name: `删除${todayLabel}身体指标` }))
    await user.click(screen.getByRole('button', { name: '确认删除' }))

    expect(screen.getByText('身体指标已删除')).toBeInTheDocument()
    expect(data.getSnapshot().healthMetrics).toHaveLength(0)
    expect(screen.getByRole('list', { name: '身体指标' })).toBeEmptyDOMElement()
  })

  it('keeps the workout dialog open when duration is invalid', async () => {
    const user = userEvent.setup()
    const data = createLocalPersonalOSData({ storage: createMemoryStorage() })
    render(<App data={data} />)

    await user.click(screen.getByRole('button', { name: '锻炼' }))
    await user.click(screen.getByRole('button', { name: '添加记录' }))
    await user.click(screen.getByRole('button', { name: '训练类型' }))
    await user.click(screen.getByLabelText('胸'))
    await user.type(screen.getByLabelText('训练时长'), '-1')
    fireEvent.submit(
      screen.getByLabelText('训练时长').closest('form') as HTMLFormElement,
    )

    expect(screen.getByRole('dialog', { name: '添加锻炼记录' })).toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent('请输入 0 以上的训练时长')
    expect(data.getSnapshot().workouts).toHaveLength(0)
  })

  it('shows structured workout details and preserves them when editing', async () => {
    const user = userEvent.setup()
    const data = createLocalPersonalOSData({ storage: createMemoryStorage() })
    data.recordWorkout({
      date: '2026-09-09',
      kind: 'chest',
      kinds: ['chest', 'shoulders'],
      status: 'completed',
      durationMinutes: 60,
      notes: '',
      focus: '胸加肩',
      warmup: ['热身泡沫轴松解'],
      exercises: [
        { name: '哑铃飞鸟', prescription: '12×2×4' },
        { name: '史密斯上斜推胸', prescription: '12×4' },
      ],
      finisher: ['核心收尾'],
      sorenessAreas: ['胸大肌', '肩前束', '肱三头肌'],
      coachNotes: ['整体强度还不错'],
    })
    render(<App data={data} />)

    await user.click(screen.getByRole('button', { name: '锻炼' }))

    expect(screen.getByRole('list', { name: '训练记录' })).toHaveTextContent(
      '2 个动作',
    )
    expect(screen.getByText('哑铃飞鸟')).toBeInTheDocument()
    expect(screen.getByText('12×2×4')).toBeInTheDocument()
    expect(screen.queryByText('训练详情')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '编辑胸加肩' }))
    expect(screen.getByLabelText('计划')).toHaveValue('')
    await user.clear(screen.getByLabelText('训练时长'))
    await user.type(screen.getByLabelText('训练时长'), '70')
    await user.click(screen.getByRole('button', { name: '保存修改' }))

    expect(screen.getByText('训练已更新')).toBeInTheDocument()
    expect(data.getSnapshot().workouts[0]).toMatchObject({
      durationMinutes: 70,
      exercises: [
        { name: '哑铃飞鸟', prescription: '12×2×4' },
        { name: '史密斯上斜推胸', prescription: '12×4' },
      ],
      coachNotes: ['整体强度还不错'],
    })
  })

  it('shows every plan line as an exercise tag', async () => {
    const data = createLocalPersonalOSData({ storage: createMemoryStorage() })
    data.recordWorkout({
      date: '2026-09-09',
      kind: 'glutes',
      kinds: ['glutes', 'legs'],
      status: 'completed',
      durationMinutes: 55,
      notes: '',
      focus: '下肢臀腿',
      plan: [
        '坐姿髋外展中立位12×4',
        '坐姿髋外展后仰位12×4',
        '坐姿腰带臀推12×4',
        '哑铃硬拉12×4',
        '高脚杯深蹲12×2',
      ],
    })
    render(<App data={data} />)

    await userEvent.setup().click(screen.getByRole('button', { name: '锻炼' }))

    expect(screen.getByRole('list', { name: '训练记录' })).toHaveTextContent(
      '5 个动作',
    )
    expect(screen.getByText('坐姿髋外展中立位')).toBeInTheDocument()
    expect(screen.getByText('坐姿髋外展后仰位')).toBeInTheDocument()
    expect(screen.getByText('坐姿腰带臀推')).toBeInTheDocument()
    expect(screen.getByText('哑铃硬拉')).toBeInTheDocument()
    expect(screen.getByText('高脚杯深蹲')).toBeInTheDocument()
    expect(screen.queryByText('+2')).not.toBeInTheDocument()
  })

  it('parses a multi-day style plan into fields and record sections', async () => {
    const user = userEvent.setup()
    const data = createLocalPersonalOSData({ storage: createMemoryStorage() })
    render(<App data={data} />)

    await user.click(screen.getByRole('button', { name: '锻炼' }))
    await user.click(screen.getByRole('button', { name: '添加记录' }))
    await user.type(screen.getByLabelText('训练时长'), '60')
    fireEvent.change(
      screen.getByLabelText('计划'),
      {
        target: {
          value: `9月9日 胸加肩
热身泡沫轴松解胸部
肩关节灵活度热身
哑铃飞鸟12×2×4递减
史密斯上斜推胸12×4
肌肉延迟性酸痛
胸大肌，肩前束`,
        },
    },
    )

    await user.click(screen.getByRole('button', { name: '识别' }))

    expect(screen.getByLabelText('训练日期')).toHaveValue('2026-09-09')
    expect(screen.getByLabelText('训练主题')).toHaveValue('胸加肩')
    expect(screen.getByRole('button', { name: '训练类型' })).toHaveTextContent(
      '肩',
    )
    expect(screen.getByRole('button', { name: '训练类型' })).toHaveTextContent(
      '胸',
    )
    expect(screen.getByLabelText('动作 1 名称')).toHaveValue('哑铃飞鸟')
    expect(screen.getByLabelText('动作 1 备注')).toHaveValue('12×2×4')
    expect(screen.getByLabelText('动作 2 名称')).toHaveValue('史密斯上斜推胸')
    expect(screen.getByLabelText('热身')).toHaveValue(
      '热身泡沫轴松解胸部\n肩关节灵活度热身',
    )
    expect(
      screen.getByLabelText('备注', { selector: '#workout-notes' }),
    ).toHaveValue('肌肉延迟性酸痛\n胸大肌，肩前束')
    await user.clear(screen.getByLabelText('动作 1 名称'))
    await user.type(screen.getByLabelText('动作 1 名称'), '哑铃飞鸟变式')
    await user.clear(screen.getByLabelText('动作 1 备注'))
    await user.type(screen.getByLabelText('动作 1 备注'), '15×5')
    await user.type(screen.getByLabelText('动作'), '高脚杯深蹲')
    await user.keyboard('{Enter}')
    expect(screen.getByLabelText('动作 3 名称')).toHaveValue('高脚杯深蹲')
    expect(screen.getByLabelText('动作 3 备注')).toHaveValue('12×4')
    const dragData = {
      getData: () => '2',
      setData: () => undefined,
      effectAllowed: 'move' as const,
      dropEffect: 'move' as const,
    }
    fireEvent.dragStart(
      screen.getByLabelText('拖拽调整高脚杯深蹲顺序'),
      { dataTransfer: dragData },
    )
    fireEvent.dragOver(
      screen.getByLabelText('拖拽调整哑铃飞鸟变式顺序'),
      { dataTransfer: dragData },
    )
    fireEvent.drop(
      screen.getByLabelText('拖拽调整哑铃飞鸟变式顺序'),
      { dataTransfer: dragData },
    )
    expect(screen.getByLabelText('动作 1 名称')).toHaveValue('高脚杯深蹲')
    expect(screen.getByLabelText('动作 2 名称')).toHaveValue('哑铃飞鸟变式')
    await user.click(screen.getByRole('button', { name: '保存训练' }))

    const workoutList = screen.getByRole('list', { name: '训练记录' })
    expect(within(workoutList).getByText('备注')).toBeInTheDocument()
    expect(within(workoutList).getByText('热身')).toBeInTheDocument()
    expect(within(workoutList).getByText('力量训练')).toBeInTheDocument()
    expect(workoutList).toHaveTextContent('肌肉延迟性酸痛')
    expect(
      within(workoutList).getByText('哑铃飞鸟变式'),
    ).toBeInTheDocument()
    expect(within(workoutList).getByText('史密斯上斜推胸')).toBeInTheDocument()
    expect(data.getSnapshot().workouts[0]).toMatchObject({
      date: '2026-09-09',
      kinds: ['shoulders', 'chest'],
      focus: '胸加肩',
      warmup: ['热身泡沫轴松解胸部', '肩关节灵活度热身'],
      notes: '肌肉延迟性酸痛\n胸大肌，肩前束',
      exercises: [
        { name: '高脚杯深蹲', prescription: '12×4' },
        { name: '哑铃飞鸟变式', prescription: '15×5', target: '递减' },
        { name: '史密斯上斜推胸', prescription: '12×4' },
      ],
    })
  })

  it('deletes a workout only after confirmation', async () => {
    const user = userEvent.setup()
    const data = createLocalPersonalOSData({ storage: createMemoryStorage() })
    data.recordWorkout({
      date: '2026-09-17',
      kind: 'chest',
      kinds: ['chest'],
      status: 'completed',
      durationMinutes: 45,
      notes: '',
      focus: '胸加肩',
    })
    render(<App data={data} />)

    await user.click(screen.getByRole('button', { name: '锻炼' }))
    await user.click(screen.getByRole('button', { name: '删除胸加肩' }))

    expect(screen.getByRole('alertdialog', { name: '删除训练' })).toBeInTheDocument()
    expect(data.getSnapshot().workouts).toHaveLength(1)

    await user.click(screen.getByRole('button', { name: '取消' }))
    expect(data.getSnapshot().workouts).toHaveLength(1)

    await user.click(screen.getByRole('button', { name: '删除胸加肩' }))
    await user.click(screen.getByRole('button', { name: '确认删除' }))

    expect(screen.getByText('训练已删除')).toBeInTheDocument()
    expect(data.getSnapshot().workouts).toHaveLength(0)
  })
})

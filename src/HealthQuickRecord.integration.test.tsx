import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import App from './App'
import { createLocalPersonalOSData } from './data/localPersonalOSData'
import { createMemoryStorage } from './test/memoryStorage'

describe('health quick capture', () => {
  it('records a workout and updates its status', async () => {
    const user = userEvent.setup()
    const data = createLocalPersonalOSData({ storage: createMemoryStorage() })
    render(<App data={data} />)

    await user.click(screen.getByRole('button', { name: '健康' }))
    await user.click(screen.getByRole('button', { name: '添加记录' }))
    fireEvent.change(screen.getByLabelText('训练日期'), {
      target: { value: '2026-09-11' },
    })
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
    expect(screen.getByRole('dialog', { name: '添加健康记录' })).toBeInTheDocument()
    await user.type(screen.getByLabelText('训练时长'), '45')
    await user.type(screen.getByLabelText('训练备注'), '主项卧推')
    await user.click(screen.getByRole('button', { name: '保存训练' }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByText('训练已保存')).toBeInTheDocument()

    expect(screen.getByRole('list', { name: '训练记录' })).toHaveTextContent(
      '主项卧推',
    )

    expect(data.getSnapshot().workouts[0]).toMatchObject({
      kind: 'chest',
      kinds: ['chest', 'shoulders'],
      status: 'completed',
      durationMinutes: 45,
      notes: '主项卧推',
    })
    expect(screen.getByText('1 / 4')).toBeInTheDocument()
  })

  it('edits an existing workout and preserves its record id', async () => {
    const user = userEvent.setup()
    const data = createLocalPersonalOSData({ storage: createMemoryStorage() })
    render(<App data={data} />)

    await user.click(screen.getByRole('button', { name: '健康' }))
    await user.click(screen.getByRole('button', { name: '添加记录' }))
    fireEvent.change(screen.getByLabelText('训练日期'), {
      target: { value: '2026-09-09' },
    })
    await user.click(screen.getByRole('button', { name: '训练类型' }))
    await user.click(screen.getByLabelText('胸'))
    await user.keyboard('{Escape}')
    await user.type(screen.getByLabelText('训练时长'), '45')
    await user.type(screen.getByLabelText('训练主题'), '胸加肩')
    await user.type(screen.getByLabelText('训练备注'), '原始备注')
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
    expect(screen.getByLabelText('训练备注')).toHaveValue('原始备注')
    expect(screen.getByRole('button', { name: '保存修改' })).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('训练日期'), {
      target: { value: '2026-09-10' },
    })
    await user.clear(screen.getByLabelText('训练时长'))
    await user.type(screen.getByLabelText('训练时长'), '55')
    await user.clear(screen.getByLabelText('训练备注'))
    await user.type(screen.getByLabelText('训练备注'), '更新后的备注')
    await user.click(screen.getByRole('button', { name: '保存修改' }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByText('训练已更新')).toBeInTheDocument()
    expect(data.getSnapshot().workouts).toHaveLength(1)
    expect(data.getSnapshot().workouts[0]).toMatchObject({
      id: originalId,
      date: '2026-09-10',
      durationMinutes: 55,
      notes: '更新后的备注',
    })
    expect(screen.getByRole('list', { name: '训练记录' })).toHaveTextContent(
      '更新后的备注',
    )
  })

  it('records a health metric and updates it on the same date', async () => {
    const user = userEvent.setup()
    const data = createLocalPersonalOSData({ storage: createMemoryStorage() })
    render(<App data={data} />)

    await user.click(screen.getByRole('button', { name: '健康' }))
    await user.click(screen.getByRole('button', { name: '添加记录' }))
    await user.click(screen.getByRole('tab', { name: '身体指标' }))
    fireEvent.change(screen.getByLabelText('记录日期'), {
      target: { value: '2026-09-11' },
    })
    await user.type(screen.getByLabelText('睡眠时长'), '7.5')
    await user.type(screen.getByLabelText('体重'), '72.4')
    await user.selectOptions(screen.getByLabelText('身体状态'), 'good')
    await user.click(screen.getByRole('button', { name: '保存健康指标' }))

    expect(screen.getByRole('list', { name: '健康指标' })).toHaveTextContent(
      '2026.09.11',
    )

    await user.click(screen.getByRole('button', { name: '添加记录' }))
    await user.click(screen.getByRole('tab', { name: '身体指标' }))

    expect(screen.getByRole('list', { name: '健康指标' })).toHaveTextContent(
      '2026.09.11',
    )

    await user.clear(screen.getByLabelText('睡眠时长'))
    await user.type(screen.getByLabelText('睡眠时长'), '8')
    await user.clear(screen.getByLabelText('体重'))
    await user.type(screen.getByLabelText('体重'), '72.2')
    await user.selectOptions(screen.getByLabelText('身体状态'), 'great')
    await user.selectOptions(screen.getByLabelText('月经流量'), 'medium')
    await user.click(screen.getByLabelText('痛经'))
    await user.click(screen.getByLabelText('疲劳'))
    await user.type(screen.getByLabelText('月经备注'), '周期第 2 天')
    await user.click(screen.getByRole('button', { name: '保存健康指标' }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByText('健康指标已保存')).toBeInTheDocument()
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
    expect(screen.getByRole('list', { name: '健康指标' })).toHaveTextContent(
      '月经 中等 · 痛经、疲劳',
    )
  })

  it('keeps the workout dialog open when duration is invalid', async () => {
    const user = userEvent.setup()
    const data = createLocalPersonalOSData({ storage: createMemoryStorage() })
    render(<App data={data} />)

    await user.click(screen.getByRole('button', { name: '健康' }))
    await user.click(screen.getByRole('button', { name: '添加记录' }))
    await user.click(screen.getByRole('button', { name: '训练类型' }))
    await user.click(screen.getByLabelText('胸'))
    await user.type(screen.getByLabelText('训练时长'), '-1')
    fireEvent.submit(
      screen.getByLabelText('训练时长').closest('form') as HTMLFormElement,
    )

    expect(screen.getByRole('dialog', { name: '添加健康记录' })).toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent('请输入 0 以上的训练时长')
    expect(data.getSnapshot().workouts).toHaveLength(0)
  })

  it('imports multi-day coach plans and shows structured workout details', async () => {
    const user = userEvent.setup()
    const data = createLocalPersonalOSData({ storage: createMemoryStorage() })
    render(<App data={data} />)

    await user.click(screen.getByRole('button', { name: '健康' }))
    await user.click(screen.getByRole('button', { name: '添加记录' }))
    fireEvent.change(screen.getByLabelText('教练计划'), {
      target: {
        value: [
          '9月9日',
          '胸加肩',
          '哑铃飞鸟12×2×4',
          '肌肉延迟性酸痛',
          '胸大肌，肩前束，肱三头肌',
          '9月6日',
          '下肢臀腿',
          '热身泡沫轴松解臀大肌',
          '高脚杯深蹲12×2',
        ].join('\n'),
      },
    })
    await user.click(screen.getByRole('button', { name: '解析教练计划' }))

    expect(screen.getByLabelText('训练日期')).toHaveValue('2026-09-09')
    expect(screen.getByLabelText('训练主题')).toHaveValue('胸加肩')
    expect(screen.getByText('已识别 2 次训练，保存时将全部导入。')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '保存训练' }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByText('已保存 2 次训练')).toBeInTheDocument()
    expect(data.getSnapshot().workouts).toHaveLength(2)
    expect(data.getSnapshot().workouts[0]).toMatchObject({
      date: '2026-09-09',
      focus: '胸加肩',
      exercises: [{ name: '哑铃飞鸟', prescription: '12×2×4' }],
      sorenessAreas: ['胸大肌', '肩前束', '肱三头肌'],
    })

    await user.click(screen.getAllByText('训练详情')[0])

    expect(screen.getAllByText('哑铃飞鸟').length).toBeGreaterThan(0)
    expect(screen.getAllByText('12×2×4').length).toBeGreaterThan(0)
    expect(screen.getByText('胸大肌')).toBeInTheDocument()
  })
})

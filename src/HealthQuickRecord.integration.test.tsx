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
    fireEvent.change(screen.getByLabelText('训练日期'), {
      target: { value: '2026-09-11' },
    })
    await user.selectOptions(screen.getByLabelText('训练类型'), 'push')
    await user.selectOptions(screen.getByLabelText('训练状态'), 'planned')
    await user.type(screen.getByLabelText('训练时长'), '45')
    await user.type(screen.getByLabelText('训练备注'), '主项卧推')
    await user.click(screen.getByRole('button', { name: '保存训练' }))

    expect(screen.getByRole('list', { name: '训练记录' })).toHaveTextContent(
      '主项卧推',
    )

    const statusSelect = screen.getByLabelText('2026.09.11 推 状态')
    await user.selectOptions(statusSelect, 'completed')

    expect(data.getSnapshot().workouts[0]).toMatchObject({
      kind: 'push',
      status: 'completed',
      durationMinutes: 45,
      notes: '主项卧推',
    })
    expect(screen.getByText('1 / 4')).toBeInTheDocument()
  })

  it('records a health metric and updates it on the same date', async () => {
    const user = userEvent.setup()
    const data = createLocalPersonalOSData({ storage: createMemoryStorage() })
    render(<App data={data} />)

    await user.click(screen.getByRole('button', { name: '健康' }))
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

    await user.clear(screen.getByLabelText('睡眠时长'))
    await user.type(screen.getByLabelText('睡眠时长'), '8')
    await user.clear(screen.getByLabelText('体重'))
    await user.type(screen.getByLabelText('体重'), '72.2')
    await user.selectOptions(screen.getByLabelText('身体状态'), 'great')
    await user.click(screen.getByRole('button', { name: '保存健康指标' }))

    expect(data.getSnapshot().healthMetrics).toHaveLength(1)
    expect(data.getSnapshot().healthMetrics[0]).toMatchObject({
      date: '2026-09-11',
      sleepHours: 8,
      weightKg: 72.2,
      condition: 'great',
    })
  })
})

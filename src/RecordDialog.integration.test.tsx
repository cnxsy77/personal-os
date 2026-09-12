import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { RecordDialog } from './components/RecordDialog'
import { Toast } from './components/Toast'

describe('record dialog', () => {
  it('supports tabs, tab changes, Escape and backdrop closing', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    const onTabChange = vi.fn()

    const { container } = render(
      <RecordDialog
        activeTab="workout"
        onClose={onClose}
        onTabChange={onTabChange}
        open
        tabs={[
          { id: 'workout', label: '训练' },
          { id: 'metric', label: '身体指标' },
        ]}
        title="添加锻炼记录"
      >
        <button type="button">保存训练</button>
      </RecordDialog>,
    )

    expect(screen.getByRole('dialog', { name: '添加锻炼记录' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: '训练' })).toHaveAttribute(
      'aria-selected',
      'true',
    )

    await user.click(screen.getByRole('tab', { name: '身体指标' }))
    expect(onTabChange).toHaveBeenCalledWith('metric')

    await user.keyboard('{Escape}')
    expect(onClose).toHaveBeenCalledTimes(1)

    fireEventMouseDown(container.querySelector('.record-dialog-backdrop'))
    expect(onClose).toHaveBeenCalledTimes(2)
  })

  it('keeps keyboard focus inside the dialog', async () => {
    const user = userEvent.setup()
    render(
      <RecordDialog onClose={() => {}} open title="添加计划">
        <button type="button">第一个控件</button>
        <button type="button">最后一个控件</button>
      </RecordDialog>,
    )

    const closeButton = screen.getByRole('button', { name: '关闭记录弹窗' })
    const firstControl = screen.getByRole('button', { name: '第一个控件' })
    const lastControl = screen.getByRole('button', { name: '最后一个控件' })

    closeButton.focus()
    await user.tab()
    expect(firstControl).toHaveFocus()

    lastControl.focus()
    await user.tab()
    expect(closeButton).toHaveFocus()
  })

  it('renders a polite success message', () => {
    render(<Toast message="计划已保存" />)

    expect(screen.getByRole('status')).toHaveTextContent('计划已保存')
  })
})

function fireEventMouseDown(element: Element | null) {
  element?.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
}

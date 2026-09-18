import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react'
import { FileDown, Pencil, Send, Sparkles, Trash2, X } from 'lucide-react'
import { ConfirmDialog } from './ConfirmDialog'
import type {
  AIChatResult,
  AIPublicConfig,
  AISummary,
  AISummaryPeriod,
  AISummaryScope,
  PersonalOSData,
} from '../data/model'
import { getISOWeekKey } from '../utils/isoWeek'
import './AIDrawer.css'

type ChatMessage = {
  role: 'user' | 'assistant'
  content: string
  totalTokens?: number
}

type AIDrawerProps = {
  data: PersonalOSData
  onClose: () => void
  open: boolean
  summaries: AISummary[]
}

const periodLabels: Record<AISummaryPeriod, string> = {
  daily: '每日',
  weekly: '每周',
  monthly: '每月',
}

const scopeLabels: Record<AISummaryScope, string> = {
  all: '全部',
  health: '锻炼',
  finance: '记账',
  learning: '学习',
  workbench: '工作台',
}

const periods = Object.entries(periodLabels) as Array<[AISummaryPeriod, string]>
const scopes = Object.entries(scopeLabels) as Array<[AISummaryScope, string]>

export function AIDrawer({
  data,
  onClose,
  open,
  summaries,
}: AIDrawerProps) {
  const [period, setPeriod] = useState<AISummaryPeriod>('daily')
  const [scope, setScope] = useState<AISummaryScope>('all')
  const [config, setConfig] = useState<AIPublicConfig | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [titleDraft, setTitleDraft] = useState('')
  const [contentDraft, setContentDraft] = useState('')
  const [question, setQuestion] = useState('')
  const [chat, setChat] = useState<ChatMessage[]>([])
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const drawerRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<Element | null>(null)
  const onCloseRef = useRef(onClose)
  const titleId = useId()
  const descriptionId = useId()

  const currentPeriod = summaries.find(
    (item) =>
      item.period === period &&
      item.scope === scope &&
      isCurrentPeriodKey(item.period, item.periodKey),
  )
  const history = summaries.filter((item) => item.period === period)

  useEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])

  useEffect(() => {
    if (!open) {
      return
    }

    triggerRef.current = document.activeElement
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    drawerRef.current?.focus({ preventScroll: true })
    data
      .getAIConfig()
      .then(setConfig)
      .catch((cause: unknown) => {
        setConfig(null)
        setError(cause instanceof Error ? cause.message : '无法读取 AI 配置')
      })

    function handleKeyDown(event: globalThis.KeyboardEvent) {
      if (event.defaultPrevented) {
        return
      }
      if (event.key === 'Escape') {
        event.preventDefault()
        onCloseRef.current()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = previousOverflow
      const trigger = triggerRef.current
      if (trigger instanceof HTMLElement) {
        trigger.focus({ preventScroll: true })
      }
    }
  }, [data, open])

  function handleTabKey(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== 'Tab' || !drawerRef.current) {
      return
    }

    const focusableElements = Array.from(
      drawerRef.current.querySelectorAll<HTMLElement>(
        [
          'a[href]',
          'button:not([disabled])',
          'input:not([disabled])',
          'select:not([disabled])',
          'textarea:not([disabled])',
          '[tabindex]:not([tabindex="-1"])',
        ].join(','),
      ),
    )
    if (focusableElements.length === 0) {
      return
    }

    const firstElement = focusableElements[0]
    const lastElement = focusableElements.at(-1) as HTMLElement
    if (event.shiftKey && document.activeElement === firstElement) {
      event.preventDefault()
      lastElement.focus()
      return
    }
    if (event.shiftKey || document.activeElement !== lastElement) {
      return
    }
    event.preventDefault()
    firstElement.focus()
  }

  async function runAction(action: () => Promise<unknown>, fallback: string) {
    setBusy(true)
    setError('')
    try {
      await action()
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : fallback)
    } finally {
      setBusy(false)
    }
  }

  function generate() {
    return runAction(() => data.generateAISummary({ period, scope }), 'AI 总结生成失败')
  }

  function startEdit(summary: AISummary) {
    setEditingId(summary.id)
    setTitleDraft(summary.title)
    setContentDraft(summary.content)
  }

  function saveEdit() {
    if (!editingId) {
      return
    }
    const id = editingId
    return runAction(
      () => data.updateAISummary(id, { title: titleDraft, content: contentDraft }),
      'AI 总结保存失败',
    ).then(() => {
      setEditingId(null)
    })
  }

  function removeSummary() {
    if (!deletingId) {
      return
    }
    const id = deletingId
    return runAction(() => data.deleteAISummary(id), 'AI 总结删除失败').then(() => {
      setDeletingId(null)
    })
  }

  async function sendQuestion() {
    const value = question.trim()
    if (!value || busy) {
      return
    }

    setBusy(true)
    setError('')
    setQuestion('')
    setChat((messages) => [...messages, { role: 'user', content: value }])
    try {
      const result: AIChatResult = await data.sendAIChat({
        question: value,
        scope,
        summaryId: currentPeriod?.id,
      })
      setChat((messages) => [
        ...messages,
        { role: 'assistant', content: result.answer, totalTokens: result.totalTokens },
      ])
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : 'AI 追问失败')
    } finally {
      setBusy(false)
    }
  }

  if (!open) {
    return null
  }

  return (
    <div className="ai-backdrop">
      <div
        aria-describedby={descriptionId}
        aria-labelledby={titleId}
        aria-modal="true"
        className="ai-drawer"
        onKeyDown={handleTabKey}
        ref={drawerRef}
        role="dialog"
        tabIndex={-1}
      >
        <header className="settings-header">
          <div>
            <h2 id={titleId}>AI 助手</h2>
            <p id={descriptionId}>主动分析本机记录，生成总结并支持追问。</p>
          </div>
          <button aria-label="关闭 AI 助手" onClick={onClose} type="button">
            <X size={18} />
          </button>
        </header>

        <div className="settings-body ai-body">
          <section className="settings-card">
            <h3>服务状态</h3>
            <p>
              {config?.configured
                ? `已连接 · ${config.model} · 单次上限 ${config.maxOutputTokens} tokens`
                : '未配置 API Key，请在本机环境变量或 server/.env 中配置。'}
            </p>
          </section>

          <section className="settings-card">
            <h3>生成总结</h3>
            <div className="ai-selector-row">
              <div className="settings-segmented ai-grow" role="group" aria-label="总结周期">
                {periods.map(([value, label]) => (
                  <button
                    aria-label={`选择${label}总结`}
                    aria-pressed={period === value}
                    className={period === value ? 'selected' : ''}
                    disabled={busy}
                    key={value}
                    onClick={() => setPeriod(value)}
                    type="button"
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div className="ai-selector-row">
              <select
                aria-label="总结范围"
                disabled={busy}
                onChange={(event) => setScope(event.target.value as AISummaryScope)}
                value={scope}
              >
                {scopes.map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
              <button
                className="ai-primary"
                disabled={busy || !config?.configured}
                onClick={generate}
                type="button"
              >
                <Sparkles size={16} />
                {busy ? '生成中' : '刷新总结'}
              </button>
            </div>

            {currentPeriod ? (
              <article className="ai-summary-current">
                <header>
                  <b>{currentPeriod.title}</b>
                  <span>{formatTokens(currentPeriod.totalTokens)}</span>
                </header>
                {editingId === currentPeriod.id ? (
                  <div className="ai-edit-form">
                    <input
                      onChange={(event) => setTitleDraft(event.target.value)}
                      value={titleDraft}
                      aria-label="总结标题"
                    />
                    <textarea
                      aria-label="总结内容"
                      onChange={(event) => setContentDraft(event.target.value)}
                      rows={9}
                      value={contentDraft}
                    />
                  </div>
                ) : (
                  <AIContent content={currentPeriod.content} />
                )}
                <div className="ai-summary-actions">
                  {editingId === currentPeriod.id ? (
                    <>
                      <button disabled={busy} onClick={() => setEditingId(null)} type="button">取消</button>
                      <button className="ai-primary" disabled={busy} onClick={saveEdit} type="button">保存</button>
                    </>
                  ) : (
                    <>
                      <button disabled={busy} onClick={() => startEdit(currentPeriod)} type="button">
                        <Pencil size={15} /> 编辑
                      </button>
                      <button disabled={busy} onClick={() => runAction(() => data.exportAISummary(currentPeriod.id), 'AI 总结导出失败')} type="button">
                        <FileDown size={15} /> {currentPeriod.filePath ? '更新文档' : '保存文档'}
                      </button>
                      <button className="danger" disabled={busy} onClick={() => setDeletingId(currentPeriod.id)} type="button">
                        <Trash2 size={15} /> 删除
                      </button>
                    </>
                  )}
                </div>
                {currentPeriod.filePath ? (
                  <p className="ai-file-path">{currentPeriod.filePath}</p>
                ) : null}
              </article>
            ) : (
              <p className="ai-empty">当前周期还没有总结。</p>
            )}
          </section>

          <section className="settings-card">
            <h3>历史总结</h3>
            {history.length === 0 ? (
              <p className="ai-empty">还没有历史总结。</p>
            ) : (
              <ul className="ai-history-list">
                {history.slice(0, 20).map((item) => (
                  <li key={item.id}>
                    <div>
                      <b>{item.title}</b>
                      <span>{formatDateTime(item.generatedAt)} · {formatTokens(item.totalTokens)}</span>
                    </div>
                    <button
                      onClick={() => {
                        setPeriod(item.period)
                        setScope(item.scope)
                      }}
                      type="button"
                    >
                      查看
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="settings-card">
            <h3>追问</h3>
            <div className="ai-chat">
              {chat.length === 0 ? (
                <p className="ai-empty">可以围绕当前范围的数据继续提问。</p>
              ) : (
                chat.map((message, index) => (
                  <div className={`ai-message ${message.role}`} key={`${message.role}-${index}`}>
                    <b>{message.role === 'user' ? '我' : 'AI'}</b>
                    <div>{message.content}</div>
                    {message.totalTokens ? <span>{formatTokens(message.totalTokens)}</span> : null}
                  </div>
                ))
              )}
            </div>
            <div className="ai-question-row">
              <input
                aria-label="追问内容"
                disabled={busy || !config?.configured}
                onChange={(event) => setQuestion(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault()
                    void sendQuestion()
                  }
                }}
                placeholder="例如：这个月有哪些消费风险？"
                value={question}
              />
              <button
                aria-label="发送追问"
                disabled={busy || !config?.configured}
                onClick={() => void sendQuestion()}
                type="button"
              >
                <Send size={16} />
              </button>
            </div>
          </section>

          {error ? <p className="ai-error" role="alert">{error}</p> : null}
        </div>
      </div>

      <ConfirmDialog
        description="删除后无法恢复，已导出的 Markdown 文档也会一并删除。"
        onCancel={() => setDeletingId(null)}
        onConfirm={() => void removeSummary()}
        open={deletingId !== null}
        title="删除 AI 总结"
      />
    </div>
  )
}

function AIContent({ content }: { content: string }) {
  const blocks = content.split(/^##\s*/m).filter(Boolean)
  return (
    <div className="ai-content">
      {blocks.map((block, index) => {
        const [heading, ...rest] = block.split('\n')
        return (
          <section key={`${heading}-${index}`}>
            <h4>{heading}</h4>
            {rest.map((line, lineIndex) => line.trim() ? <p key={lineIndex}>{line}</p> : null)}
          </section>
        )
      })}
    </div>
  )
}

function isCurrentPeriodKey(period: AISummaryPeriod, key: string) {
  const now = new Date()
  if (period === 'daily') {
    return key === toDateKey(now)
  }
  if (period === 'monthly') {
    return key === `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  }

  return key === getISOWeekKey(now)
}

function toDateKey(value: Date) {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`
}

function formatTokens(value: number) {
  return `${value} tokens`
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

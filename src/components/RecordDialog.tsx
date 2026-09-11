import { useEffect, useId, useRef, type KeyboardEvent, type ReactNode } from 'react'
import { X } from 'lucide-react'
import './RecordDialog.css'

export type RecordDialogTab = {
  id: string
  label: string
}

type RecordDialogProps = {
  open: boolean
  title: string
  description?: string
  tabs?: RecordDialogTab[]
  activeTab?: string
  onTabChange?: (tabId: string) => void
  onClose: () => void
  children: ReactNode
}

export function RecordDialog({
  open,
  title,
  description,
  tabs,
  activeTab,
  onTabChange,
  onClose,
  children,
}: RecordDialogProps) {
  const titleId = useId()
  const descriptionId = useId()
  const panelRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<Element | null>(null)

  useEffect(() => {
    if (!open) {
      return
    }

    triggerRef.current = document.activeElement
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    panelRef.current?.focus({ preventScroll: true })

    function handleKeyDown(event: globalThis.KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
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
  }, [open, onClose])

  function handleTabKey(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== 'Tab' || !panelRef.current) {
      return
    }

    const focusableElements = Array.from(
      panelRef.current.querySelectorAll<HTMLElement>(
        [
          'a[href]',
          'button:not([disabled])',
          'input:not([disabled])',
          'select:not([disabled])',
          'textarea:not([disabled])',
          '[tabindex]:not([tabindex="-1"])',
        ].join(','),
      ),
    ).filter((element) => element.getAttribute('aria-hidden') !== 'true')

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

    if (!event.shiftKey && document.activeElement === lastElement) {
      event.preventDefault()
      firstElement.focus()
    }
  }

  function handleTabSelect(tabId: string) {
    onTabChange?.(tabId)
  }

  if (!open) {
    return null
  }

  return (
    <div
      className="record-dialog-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose()
        }
      }}
    >
      <div
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        className="record-dialog"
        onKeyDown={handleTabKey}
        ref={panelRef}
        role="dialog"
        tabIndex={-1}
      >
        <header className="record-dialog-header">
          <div>
            <h2 id={titleId}>{title}</h2>
            {description ? <p id={descriptionId}>{description}</p> : null}
          </div>
          <button aria-label="关闭记录弹窗" onClick={onClose} type="button">
            <X size={18} />
          </button>
        </header>

        {tabs && tabs.length > 0 ? (
          <div
            aria-label="记录类型"
            className="record-dialog-tabs"
            role="tablist"
          >
            {tabs.map((tab) => (
              <button
                aria-selected={activeTab === tab.id}
                key={tab.id}
                onClick={() => handleTabSelect(tab.id)}
                role="tab"
                tabIndex={activeTab === tab.id ? 0 : -1}
                type="button"
              >
                {tab.label}
              </button>
            ))}
          </div>
        ) : null}

        <div className="record-dialog-body">{children}</div>
      </div>
    </div>
  )
}

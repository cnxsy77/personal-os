import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react'
import { X } from 'lucide-react'
import type {
  PersonalOSSettings,
  PersonalOSSettingsInput,
} from '../data/model'
import { fontScaleLabels } from '../utils/settings'
import './SettingsDrawer.css'

type PageId =
  | 'overview'
  | 'plan'
  | 'health'
  | 'finance'
  | 'learning'
  | 'workbench'

type SettingsDrawerProps = {
  activePage: PageId
  onClose: () => void
  onSettingsChange: (input: PersonalOSSettingsInput) => void
  open: boolean
  settings: PersonalOSSettings
}

const pageNames: Record<PageId, string> = {
  overview: '概览',
  plan: '计划',
  health: '锻炼',
  finance: '记账',
  learning: '学习',
  workbench: '工作台',
}

export function SettingsDrawer({
  activePage,
  onClose,
  onSettingsChange,
  open,
  settings,
}: SettingsDrawerProps) {
  const [categoryKind, setCategoryKind] = useState<'expense' | 'income'>(
    'expense',
  )
  const [categoryDraft, setCategoryDraft] = useState('')
  const [categoryError, setCategoryError] = useState('')
  const [targetDraft, setTargetDraft] = useState(
    String(settings.weeklyWorkoutTarget),
  )
  const [targetError, setTargetError] = useState('')
  const drawerRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<Element | null>(null)
  const onCloseRef = useRef(onClose)
  const titleId = useId()
  const descriptionId = useId()

  useEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])

  useEffect(() => {
    if (!open) {
      return
    }

    setCategoryDraft('')
    setCategoryError('')
    setTargetDraft(String(settings.weeklyWorkoutTarget))
    setTargetError('')
    triggerRef.current = document.activeElement
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    drawerRef.current?.focus({ preventScroll: true })

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
  }, [open, settings.weeklyWorkoutTarget])

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

  function addCategory() {
    const name = categoryDraft.trim()

    if (!name) {
      setCategoryError('分类名称不能为空')
      return
    }

    const categories =
      categoryKind === 'expense'
        ? settings.expenseCategories
        : settings.incomeCategories

    if (categories.includes(name)) {
      setCategoryError('分类已存在')
      return
    }

    onSettingsChange(
      categoryKind === 'expense'
        ? { expenseCategories: [...categories, name] }
        : { incomeCategories: [...categories, name] },
    )
    setCategoryDraft('')
    setCategoryError('')
  }

  function removeCategory(name: string) {
    const categories =
      categoryKind === 'expense'
        ? settings.expenseCategories
        : settings.incomeCategories

    if (categories.length === 1) {
      setCategoryError('至少保留一个分类')
      return
    }

    onSettingsChange(
      categoryKind === 'expense'
        ? { expenseCategories: categories.filter((item) => item !== name) }
        : { incomeCategories: categories.filter((item) => item !== name) },
    )
    setCategoryError('')
  }

  function saveTarget() {
    const target = Number(targetDraft)

    if (!Number.isInteger(target) || target < 1 || target > 14) {
      setTargetError('请输入 1 到 14 之间的整数')
      return
    }

    onSettingsChange({ weeklyWorkoutTarget: target })
    setTargetError('')
  }

  if (!open) {
    return null
  }

  const activeCategories =
    categoryKind === 'expense'
      ? settings.expenseCategories
      : settings.incomeCategories

  return (
    <div
      className="settings-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose()
        }
      }}
    >
      <aside
        aria-describedby={descriptionId}
        aria-labelledby={titleId}
        aria-modal="true"
        className="settings-drawer"
        onKeyDown={handleTabKey}
        ref={drawerRef}
        role="dialog"
        tabIndex={-1}
      >
        <header className="settings-header">
          <div>
            <h2 id={titleId}>设置</h2>
            <p id={descriptionId}>当前页面：{pageNames[activePage]}</p>
          </div>
          <button aria-label="关闭设置" onClick={onClose} type="button">
            <X size={18} />
          </button>
        </header>

        <div className="settings-body">
          <section aria-labelledby="page-settings-title">
            <h3 id="page-settings-title">本页设置</h3>

            {activePage === 'finance' ? (
              <div className="settings-card">
                <div aria-label="分类类型" className="settings-segmented" role="group">
                  <button
                    aria-pressed={categoryKind === 'expense'}
                    className={categoryKind === 'expense' ? 'selected' : ''}
                    onClick={() => {
                      setCategoryKind('expense')
                      setCategoryError('')
                    }}
                    type="button"
                  >
                    支出
                  </button>
                  <button
                    aria-pressed={categoryKind === 'income'}
                    className={categoryKind === 'income' ? 'selected' : ''}
                    onClick={() => {
                      setCategoryKind('income')
                      setCategoryError('')
                    }}
                    type="button"
                  >
                    收入
                  </button>
                </div>

                <div className="settings-add">
                  <label htmlFor="settings-category">新增分类</label>
                  <input
                    id="settings-category"
                    onChange={(event) => setCategoryDraft(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault()
                        addCategory()
                      }
                    }}
                    placeholder="输入分类名称"
                    value={categoryDraft}
                  />
                  <button onClick={addCategory} type="button">
                    添加
                  </button>
                </div>

                <ul aria-label={`${categoryKind === 'expense' ? '支出' : '收入'}分类列表`}>
                  {activeCategories.map((category) => (
                    <li key={category}>
                      <span>{category}</span>
                      <button
                        aria-label={`删除${category}`}
                        onClick={() => removeCategory(category)}
                        type="button"
                      >
                        删除
                      </button>
                    </li>
                  ))}
                </ul>

                {categoryError ? <p role="alert">{categoryError}</p> : null}
                <p className="settings-hint">删除分类不影响已有交易记录。</p>
              </div>
            ) : activePage === 'health' ? (
              <div className="settings-card">
                <label htmlFor="settings-weekly-target">每周锻炼目标</label>
                <div className="settings-add">
                  <input
                    id="settings-weekly-target"
                    max="14"
                    min="1"
                    onChange={(event) => setTargetDraft(event.target.value)}
                    step="1"
                    type="number"
                    value={targetDraft}
                  />
                  <button onClick={saveTarget} type="button">
                    保存
                  </button>
                </div>
                {targetError ? <p role="alert">{targetError}</p> : null}
              </div>
            ) : (
              <div className="settings-card">
                <p>{pageNames[activePage]}暂无可调整项。</p>
              </div>
            )}
          </section>

          <section aria-labelledby="global-settings-title">
            <h3 id="global-settings-title">全局设置</h3>
            <div className="settings-card">
              <fieldset>
                <legend>界面字号</legend>
                <div className="settings-segmented" role="group">
                  {Object.entries(fontScaleLabels).map(([value, label]) => (
                    <button
                      aria-pressed={settings.fontScale === value}
                      className={settings.fontScale === value ? 'selected' : ''}
                      key={value}
                      onClick={() =>
                        onSettingsChange({
                          fontScale: value as PersonalOSSettings['fontScale'],
                        })
                      }
                      type="button"
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </fieldset>

              <label className="settings-switch">
                <input
                  checked={settings.reducedMotion}
                  onChange={(event) =>
                    onSettingsChange({
                      reducedMotion: event.target.checked,
                    })
                  }
                  type="checkbox"
                />
                <span>减少动态效果</span>
              </label>
            </div>
          </section>
        </div>
      </aside>
    </div>
  )
}

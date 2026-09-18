import { useRef, useState, type ChangeEvent } from 'react'
import { FileSpreadsheet, Upload } from 'lucide-react'
import type {
  BillImportInput,
  BillImportResult,
  Transaction,
  TransactionKind,
} from '../data/model'
import {
  parseBillFile,
  type BillImportPreview,
  type BillPreviewRow,
} from '../utils/billImport'

type Props = {
  transactions: Transaction[]
  onSubmit: (input: BillImportInput) => BillImportResult | Promise<BillImportResult>
}

const sourceLabels = {
  alipay: '支付宝',
  wechat: '微信',
}

export function FinanceImportForm({ transactions, onSubmit }: Props) {
  const [preview, setPreview] = useState<BillImportPreview | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  async function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    setPreview(null)
    setError('')
    if (!file) {
      return
    }

    setLoading(true)
    try {
      setPreview(await parseBillFile(file, transactions))
    } catch (parseError) {
      setError(parseError instanceof Error ? parseError.message : '账单解析失败')
    } finally {
      setLoading(false)
    }
  }

  function updateRow(id: string, changes: Partial<BillPreviewRow>) {
    setPreview((current) =>
      current
        ? {
            ...current,
            rows: current.rows.map((row) =>
              row.id === id ? { ...row, ...changes } : row,
            ),
          }
        : current,
    )
  }

  async function importSelected() {
    if (!preview) {
      return
    }

    const selectedRows = preview.rows.filter((row) => canImport(row))
    if (selectedRows.length === 0) {
      setError('请至少选择一笔可导入的账单')
      return
    }

    try {
      const result = await onSubmit({
        source: preview.source,
        fileName: preview.fileName,
        transactions: selectedRows.map((row) => ({
          kind: row.kind,
          amountCents: row.amountCents,
          category: row.category.trim() || '其他',
          date: row.date,
          note: row.note,
          tag: row.tag,
          counterparty: row.counterparty,
          sourceTradeNo: row.sourceTradeNo,
          occurredAt: row.occurredAt,
        })),
      })
      if (result.importedCount === 0) {
        setError(`没有新增账单，已跳过 ${result.duplicateCount} 笔重复记录`)
        return
      }
    } catch (importError) {
      setError(importError instanceof Error ? importError.message : '账单导入失败')
    }
  }

  function canImport(row: BillPreviewRow) {
    return row.selected && !row.duplicate && !row.warning && row.amountCents > 0
  }

  const selectedCount = preview?.rows.filter(canImport).length ?? 0
  const duplicateCount = preview?.rows.filter((row) => row.duplicate).length ?? 0

  return (
    <div className="finance-import">
      <div className="bill-import-picker">
        <FileSpreadsheet size={20} />
        <div>
          <strong>支付宝 / 微信账单</strong>
          <p>支持官方导出的 CSV、XLS、XLSX，仅在本机解析。</p>
        </div>
        <button onClick={() => fileInputRef.current?.click()} type="button">
          <Upload size={15} />
          选择文件
        </button>
        <input
          accept=".csv,.xls,.xlsx"
          aria-label="选择账单文件"
          onChange={handleFile}
          ref={fileInputRef}
          type="file"
        />
      </div>

      {loading ? <p className="bill-loading">正在解析账单...</p> : null}

      {preview ? (
        <section aria-label="账单导入预览" className="bill-preview">
          <header>
            <h4>
              {sourceLabels[preview.source]} · {preview.rows.length} 行
            </h4>
            <span>
              可导入 {selectedCount} 笔，重复 {duplicateCount} 笔
            </span>
          </header>
          <div className="bill-preview-scroll">
            <table>
              <thead>
                <tr>
                  <th scope="col">导入</th>
                  <th scope="col">日期</th>
                  <th scope="col">对方/商品</th>
                  <th scope="col">类型</th>
                  <th scope="col">分类</th>
                  <th scope="col">金额</th>
                  <th scope="col">备注</th>
                  <th scope="col">状态</th>
                </tr>
              </thead>
              <tbody>
                {preview.rows.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <input
                        aria-label={`选择 ${row.date} ${row.counterparty || row.category}`}
                        checked={row.selected}
                        disabled={Boolean(row.warning)}
                        onChange={(event) =>
                          updateRow(row.id, { selected: event.target.checked })
                        }
                        type="checkbox"
                      />
                    </td>
                    <td>{row.date || '未知'}</td>
                    <td>{row.counterparty || '—'}</td>
                    <td>
                      <select
                        aria-label="导入类型"
                        disabled={Boolean(row.warning)}
                        onChange={(event) =>
                          updateRow(row.id, {
                            kind: event.target.value as TransactionKind,
                          })
                        }
                        value={row.kind}
                      >
                        <option value="expense">支出</option>
                        <option value="income">收入</option>
                        <option value="transfer">转账</option>
                      </select>
                    </td>
                    <td>
                      <input
                        aria-label="导入分类"
                        onChange={(event) =>
                          updateRow(row.id, { category: event.target.value })
                        }
                        value={row.category}
                      />
                    </td>
                    <td>
                      {(row.amountCents / 100).toFixed(2)}
                    </td>
                    <td>
                      <input
                        aria-label="导入备注"
                        onChange={(event) =>
                          updateRow(row.id, { note: event.target.value })
                        }
                        value={row.note ?? ''}
                      />
                    </td>
                    <td>
                      <span className={row.duplicate ? 'duplicate' : ''}>
                        {row.duplicate
                          ? '重复'
                          : row.warning || row.status || '可导入'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button onClick={importSelected} type="button">
            确认导入 {selectedCount} 笔
          </button>
        </section>
      ) : null}

      {error ? <p role="alert">{error}</p> : null}
    </div>
  )
}

import * as XLSX from 'xlsx'
import type { Transaction, TransactionKind, TransactionTag } from '../data/model'

export type BillFileSource = 'alipay' | 'wechat'

export type BillFileRow = {
  id: string
  kind: TransactionKind
  amountCents: number
  category: string
  date: string
  note?: string
  tag?: TransactionTag
  counterparty?: string
  sourceTradeNo?: string
  occurredAt?: string
  status: string
  warning?: string
}

export type BillPreviewRow = BillFileRow & {
  selected: boolean
  duplicate: boolean
  warning?: string
}

export type BillImportPreview = {
  source: BillFileSource
  fileName: string
  rows: BillPreviewRow[]
}

const transferPattern = /转账|红包|提现|充值|代扣|理财|基金/
const refundPattern = /退款/

export async function parseBillFile(
  file: File,
  existingTransactions: Transaction[] = [],
): Promise<BillImportPreview> {
  const fileName = file.name
  if (/\.(csv|xls|xlsx)$/i.test(fileName) === false) {
    throw new Error('请选择 CSV、XLS 或 XLSX 格式的账单文件')
  }

  const rawRows = /\.csv$/i.test(fileName)
    ? await readCsvRows(file)
    : await readSpreadsheetRows(file)
  const source = detectBillSource(rawRows)
  if (!source) {
    throw new Error('无法识别支付宝或微信账单表头')
  }

  const rows = parseBillRows(rawRows)

  const existingKeys = new Set(
    existingTransactions.map(getBillDuplicateKey).filter(Boolean),
  )
  const seen = new Set<string>()
  const previewRows = rows.map((row, index) => {
    const id = `bill-row-${index}`
    const duplicateKey = getRowDuplicateKey(source, row)
    const duplicate = Boolean(duplicateKey && seen.has(duplicateKey)) ||
      Boolean(duplicateKey && existingKeys.has(duplicateKey))
    if (duplicateKey) {
      seen.add(duplicateKey)
    }

    const importable =
      row.amountCents > 0 &&
      /^\d{4}-\d{2}-\d{2}$/.test(row.date) &&
      !row.warning
    const selected = importable && !duplicate

    return {
      ...row,
      id,
      duplicate,
      selected,
      warning: row.warning,
    }
  })

  return { source, fileName, rows: previewRows }
}

export function getBillDuplicateKey(transaction: Transaction) {
  if (!transaction.source || transaction.source === 'manual') {
    return ''
  }

  return transaction.sourceTradeNo
    ? `${transaction.source}:${transaction.sourceTradeNo}`
    : [
        transaction.source,
        transaction.date,
        transaction.counterparty ?? '',
        transaction.amountCents,
        transaction.kind,
      ].join(':')
}

export function getRowDuplicateKey(
  source: BillFileSource,
  row: Pick<
    BillFileRow,
    'date' | 'kind' | 'amountCents' | 'counterparty' | 'sourceTradeNo'
  >,
) {
  return row.sourceTradeNo
    ? `${source}:${row.sourceTradeNo}`
    : [
        source,
        row.date,
        row.counterparty ?? '',
        row.amountCents,
        row.kind,
      ].join(':')
}

export function parseBillAmount(value: unknown) {
  const amount = Number(String(value ?? '').replace(/[¥￥,\s]/g, ''))
  if (!Number.isFinite(amount)) {
    return 0
  }

  return Math.round(amount * 100)
}

export function parseBillDateTime(value: unknown) {
  const text = String(value ?? '').trim()
  const match = text.match(
    /(\d{4})[-/年](\d{1,2})[-/月](\d{1,2})日?(?:\s+(\d{1,2}):(\d{2}))?/,
  )
  if (!match) {
    return { date: '', occurredAt: '' }
  }

  const year = match[1]
  const month = match[2].padStart(2, '0')
  const day = match[3].padStart(2, '0')
  const date = `${year}-${month}-${day}`
  const hour = match[4]?.padStart(2, '0')
  const minute = match[5]
  const occurredAt = hour && minute ? `${date} ${hour}:${minute}` : date
  return { date, occurredAt }
}

async function readCsvRows(file: File) {
  const buffer = await file.arrayBuffer()
  const text = decodeCsvBuffer(buffer)
  return parseCsv(text)
}

function decodeCsvBuffer(buffer: ArrayBuffer) {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buffer)
  } catch {
    try {
      return new TextDecoder('gbk').decode(buffer)
    } catch {
      throw new Error('账单文件编码无法识别，请导出 UTF-8 或 GBK 编码的 CSV')
    }
  }
}

function parseCsv(text: string) {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let quoted = false

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index]
    if (quoted) {
      if (char === '"') {
        if (text[index + 1] === '"') {
          field += '"'
          index += 1
        } else {
          quoted = false
        }
      } else {
        field += char
      }
      continue
    }

    if (char === '"') {
      quoted = true
    } else if (char === ',') {
      row.push(field)
      field = ''
    } else if (char === '\n') {
      row.push(field.replace(/\r$/, ''))
      rows.push(row)
      row = []
      field = ''
    } else {
      field += char
    }
  }

  if (field || row.length > 0) {
    row.push(field)
    rows.push(row)
  }

  return rows
    .map((item) => item.map((cell) => cell.trim()))
    .filter((item) => item.some(Boolean))
}

async function readSpreadsheetRows(file: File) {
  const buffer = await file.arrayBuffer()
  const workbook = XLSX.read(buffer, { type: 'array' })
  const sheet = workbook.Sheets[workbook.SheetNames[0]]
  if (!sheet) {
    return []
  }

  const values = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    defval: '',
    header: 1,
    raw: false,
  })
  return values.map((row) => row.map(String))
}

function detectBillSource(rows: string[][]) {
  const headerIndex = rows.findIndex((row) => getHeaderScore(row) > 0)
  if (headerIndex < 0) {
    return undefined
  }

  const headers = normalizeHeaders(rows[headerIndex])
  if (headers.some((header) => header.includes('交易订单号'))) {
    return 'alipay' as const
  }

  if (headers.some((header) => header.includes('交易单号'))) {
    return 'wechat' as const
  }

  return undefined
}

function parseBillRows(rawRows: string[][]) {
  const headerIndex = rawRows.findIndex((row) => getHeaderScore(row) > 0)
  if (headerIndex < 0) {
    return []
  }

  const headers = normalizeHeaders(rawRows[headerIndex])
  return rawRows.slice(headerIndex + 1).map((row) => {
    const record: Record<string, string> = {}
    headers.forEach((header, index) => {
      record[header] = row[index]?.trim() ?? ''
    })

    return mapBillRecord(record)
  })
}

function getHeaderScore(row: string[]) {
  const headers = normalizeHeaders(row)
  let score = 0
  if (headers.includes('交易时间')) {
    score += 1
  }
  if (headers.some((header) => header === '收/支')) {
    score += 1
  }
  if (
    headers.some(
      (header) => header.includes('金额') || header.includes('金额(元)'),
    )
  ) {
    score += 1
  }
  return score >= 3 ? score : 0
}

function normalizeHeaders(row: string[]) {
  return row.map((item) => item.replace(/\s+/g, '').trim())
}

function mapBillRecord(record: Record<string, string>): BillFileRow {
  const status = record['交易状态'] || record['当前状态'] || ''
  const counterparty = record['交易对方'] || record['商品说明'] || record['商品'] || ''
  const remark = record['备注'] || ''
  const { date, occurredAt } = parseBillDateTime(record['交易时间'])
  const amountCents = parseBillAmount(record['金额'] || record['金额(元)'])
  const direction = record['收/支'] || ''
  const transactionType = record['交易分类'] || record['交易类型'] || ''
  const refund = refundPattern.test(`${status} ${remark} ${transactionType}`)
  const sourceTradeNo =
    record['交易订单号'] || record['交易单号'] || record['商户单号'] || ''

  let kind: TransactionKind
  let category: string
  let tag: TransactionTag | undefined

  if (direction === '支出') {
    kind = 'expense'
    category = transactionType || '其他'
  } else if (direction === '收入') {
    kind = 'income'
    category = transactionType || '其他'
    if (refund) {
      tag = 'refund'
    }
  } else if (direction === '不计收支' || transferPattern.test(transactionType)) {
    kind = 'transfer'
    category = '转账'
  } else {
    kind = 'expense'
    category = transactionType || '其他'
  }

  const success = /成功|已收钱|已存入零钱/.test(status)
  const failed = /关闭|撤销|失败|已取消/.test(status)
  const warning = !success
    ? failed
      ? `交易状态为“${status || '未知'}”，已跳过`
      : `无法确认交易状态“${status || '未知'}”，默认跳过`
    : direction
      ? undefined
      : '无法识别收/支方向，默认跳过'

  return {
    id: '',
    kind,
    amountCents,
    category,
    date,
    tag,
    ...(counterparty ? { counterparty } : {}),
    ...(remark ? { note: remark } : {}),
    ...(sourceTradeNo ? { sourceTradeNo } : {}),
    ...(occurredAt ? { occurredAt } : {}),
    status,
    warning,
  }
}

import * as XLSX from 'xlsx'
import { describe, expect, it } from 'vitest'
import type { Transaction } from '../data/model'
import { parseBillAmount, parseBillDateTime, parseBillFile } from './billImport'

describe('bill import parsing', () => {
  it('parses bill amounts and local date times', () => {
    expect(parseBillAmount('¥1,234.56')).toBe(123456)
    expect(parseBillDateTime('2026/9/10 9:05')).toEqual({
      date: '2026-09-10',
      occurredAt: '2026-09-10 09:05',
    })
  })

  it('parses Alipay CSV rows and skips failed or duplicate rows', async () => {
    const csv = [
      '交易时间,交易分类,交易对方,商品说明,收/支,金额,交易状态,交易订单号,备注',
      '2026-09-10 12:30:00,餐饮美食,咖啡店,拿铁,支出,¥18.50,交易成功,ALI-1,上午咖啡',
      '2026-09-11 15:20:00,餐饮美食,咖啡店,拿铁退款,收入,¥5.00,退款成功,ALI-2,已退款',
      '2026-09-12 10:00:00,理财,零钱通,转入,不计收支,¥100.00,转账成功,ALI-3,',
      '2026-09-13 10:00:00,交通,地铁,乘车,支出,¥4.00,交易关闭,ALI-4,',
    ].join('\n')
    const existing: Transaction[] = [
      {
        id: 'old',
        kind: 'expense',
        amountCents: 1850,
        category: '餐饮美食',
        date: '2026-09-10',
        source: 'alipay',
        sourceTradeNo: 'ALI-1',
      },
    ]

    const preview = await parseBillFile(new File([csv], 'alipay.csv'), existing)

    expect(preview.source).toBe('alipay')
    expect(preview.rows).toHaveLength(4)
    expect(preview.rows[0]).toMatchObject({
      duplicate: true,
      selected: false,
      amountCents: 1850,
    })
    expect(preview.rows[1]).toMatchObject({
      kind: 'income',
      tag: 'refund',
      selected: true,
      amountCents: 500,
    })
    expect(preview.rows[2]).toMatchObject({
      kind: 'transfer',
      category: '转账',
      selected: true,
    })
    expect(preview.rows[3]).toMatchObject({
      selected: false,
      warning: '交易状态为“交易关闭”，已跳过',
    })
  })

  it('parses WeChat XLSX rows', async () => {
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.aoa_to_sheet([
        ['微信支付账单明细'],
        ['交易时间', '交易类型', '交易对方', '商品', '收/支', '金额(元)', '支付方式', '当前状态', '交易单号', '备注'],
        ['2026-09-10 18:20:00', '商户消费', '书店', '技术书', '支出', '¥89.00', '零钱', '支付成功', 'WX-1', ''],
      ]),
      '微信支付账单明细',
    )
    const data = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' })
    const file = new File([data], 'wechat.xlsx')

    const preview = await parseBillFile(file, [])

    expect(preview.source).toBe('wechat')
    expect(preview.rows[0]).toMatchObject({
      kind: 'expense',
      category: '商户消费',
      counterparty: '书店',
      amountCents: 8900,
      selected: true,
      sourceTradeNo: 'WX-1',
    })
  })
})

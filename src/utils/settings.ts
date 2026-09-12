import type { PersonalOSSettings } from '../data/model'

export const defaultPersonalOSSettings: PersonalOSSettings = {
  weeklyWorkoutTarget: 4,
  expenseCategories: ['餐饮', '交通', '购物', '住房', '订阅', '其他'],
  incomeCategories: ['工资', '奖金', '理财', '其他'],
  fontScale: 'default',
  reducedMotion: false,
}

export const fontScaleLabels: Record<PersonalOSSettings['fontScale'], string> =
  {
    default: '标准',
    large: '大',
    xlarge: '特大',
  }

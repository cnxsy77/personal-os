import { describe, expect, it } from 'vitest'
import { parseLearningSource } from './learningSource'

describe('learning source parser', () => {
  it('identifies bilibili videos and extracts the BV id', () => {
    expect(
      parseLearningSource(
        'https://www.bilibili.com/video/BV1q5YL69E44/?vd_source=abc',
      ),
    ).toEqual({ platform: 'bilibili', externalId: 'BV1q5YL69E44' })
  })

  it('identifies plaso courses and extracts the course path id', () => {
    expect(
      parseLearningSource(
        'https://www.plaso.com.cn/static/market/?appId=20130&subId=20131&oemName=maze#/root/home/studyCenter/course/5-27425-112648-1',
      ),
    ).toEqual({
      platform: 'plaso',
      externalId: '5-27425-112648-1',
    })
  })

  it('identifies MOOC, Xiaoe and Baidu Pan sources', () => {
    expect(parseLearningSource('https://www.icourse163.org/course/1'))
      .toEqual({ platform: 'mooc' })
    expect(parseLearningSource('https://app.xiaoe-tech.com/?resource_id=42'))
      .toEqual({ platform: 'xiaoe', externalId: '42' })
    expect(parseLearningSource('https://pan.baidu.com/s/abc_123'))
      .toEqual({ platform: 'baiduPan', externalId: 'abc_123' })
  })

  it('keeps blank and unknown links readable as other sources', () => {
    expect(parseLearningSource('')).toEqual({ platform: 'other' })
    expect(parseLearningSource('https://example.com/course')).toEqual({
      platform: 'other',
    })
  })
})

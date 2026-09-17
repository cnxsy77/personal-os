import type { LearningPlatform } from '../data/model'

export type ParsedLearningSource = {
  platform: LearningPlatform
  externalId?: string
}

const learningPlatforms: LearningPlatform[] = [
  'bilibili',
  'mooc',
  'plaso',
  'xiaoe',
  'baiduPan',
  'other',
]

export function isLearningPlatform(
  value: unknown,
): value is LearningPlatform {
  return learningPlatforms.includes(value as LearningPlatform)
}

export function normalizeLearningPlatform(
  value: string,
): LearningPlatform {
  return isLearningPlatform(value) ? value : 'other'
}

export function parseLearningSource(
  rawUrl: string,
): ParsedLearningSource {
  const url = rawUrl.trim()

  if (!url) {
    return { platform: 'other' }
  }

  if (url.includes('bilibili.com') || url.includes('b23.tv')) {
    const videoId = url.match(/BV[1-9A-HJ-NP-Za-km-z]{8,10}/)?.[0]
    return {
      platform: 'bilibili',
      ...(videoId ? { externalId: videoId } : {}),
    }
  }

  if (url.includes('plaso.com.cn')) {
    const coursePath = url.match(/course\/([^/?#]+)/)?.[1]
    return {
      platform: 'plaso',
      ...(coursePath ? { externalId: decodeURIComponent(coursePath) } : {}),
    }
  }

  if (url.includes('pan.baidu.com')) {
    const shareId = url.match(/\/s\/([^/?#]+)/)?.[1]
    return {
      platform: 'baiduPan',
      ...(shareId ? { externalId: decodeURIComponent(shareId) } : {}),
    }
  }

  if (
    url.includes('icourse163.org') ||
    url.includes('xuetangx.com') ||
    url.includes('mooc')
  ) {
    const courseId = url.match(/[?&]courseId=([^&#]+)/)?.[1]
    return {
      platform: 'mooc',
      ...(courseId ? { externalId: decodeURIComponent(courseId) } : {}),
    }
  }

  if (url.includes('xiaoe-tech.com') || url.includes('xiaoe')) {
    const resourceId = url.match(/[?&](?:resource_id|id)=([^&#]+)/)?.[1]
    return {
      platform: 'xiaoe',
      ...(resourceId ? { externalId: decodeURIComponent(resourceId) } : {}),
    }
  }

  return { platform: 'other' }
}

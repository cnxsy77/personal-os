import { useSyncExternalStore } from 'react'
import type { PersonalOSData } from './model'

export function usePersonalOSData(data: PersonalOSData) {
  return useSyncExternalStore(data.subscribe, data.getSnapshot, data.getSnapshot)
}

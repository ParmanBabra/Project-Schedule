import { useQuery } from '@tanstack/react-query'
import { api } from '@/shared/api/client'
import type { BufferSettings, Rules, Schedule } from '@/features/projects/types'

export interface BufferMethodInfo {
  id: 'ccpm' | 'percent' | 'pert'
  title: string
  recommended: boolean
  what: string
  fit: string
  reference: string
  options: Record<string, unknown>
}

export interface RuleOption {
  value: string | number
  label: string
  help?: string
  disabled?: boolean
}

export interface RuleInfo {
  id: string
  title: string
  reference: string
  options: RuleOption[] | { min: number; max: number; step: number; default: number; unit: string }
}

export interface SettingsDefaults {
  rules: Rules
  buffer: BufferSettings
  bufferMethods: BufferMethodInfo[]
  ruleDescriptions: RuleInfo[]
  managementReserve: { help: string; default: number; unit: string }
}

export function useSettingsDefaults() {
  return useQuery({ queryKey: ['settings', 'defaults'], queryFn: () => api<SettingsDefaults>('/settings/defaults'), staleTime: Infinity })
}

export interface PreviewDraft {
  buffer?: BufferSettings
  rules?: Rules
  holidays?: string[]
  workingDays?: number[]
  startDate?: string
}

/** What-if schedule for a draft of settings (nothing is saved). */
export function useSchedulePreview(projectId: string, draft: PreviewDraft, enabled = true) {
  return useQuery({
    queryKey: ['preview', projectId, draft],
    queryFn: () => api<Schedule>(`/projects/${projectId}/schedule/preview`, { method: 'POST', body: JSON.stringify(draft) }),
    enabled,
    staleTime: 30_000,
  })
}

import { api } from '@/shared/api/client'
import { useProjectMutation } from '@/features/projects/api'
import type { EpicBulkCreate, EpicCreate, EpicUpdate, ProjectOut } from '@/features/projects/types'

export function useCreateEpic(id: string) {
  return useProjectMutation((body: EpicCreate) => api<ProjectOut>(`/projects/${id}/epics`, { method: 'POST', body: JSON.stringify(body) }), id)
}

export function useCreateEpics(id: string) {
  return useProjectMutation((body: EpicBulkCreate) => api<ProjectOut>(`/projects/${id}/epics/bulk`, { method: 'POST', body: JSON.stringify(body) }), id)
}

export function useUpdateEpic(id: string) {
  return useProjectMutation(({ taskId, ...body }: EpicUpdate & { taskId: string }) => api<ProjectOut>(`/projects/${id}/epics/${taskId}`, { method: 'PATCH', body: JSON.stringify(body) }), id)
}

export function useConvertToEpic(id: string) {
  return useProjectMutation((taskId: string) => api<ProjectOut>(`/projects/${id}/epics/${taskId}/convert`, { method: 'POST' }), id)
}

export function useAddEpicMembers(id: string) {
  return useProjectMutation(({ taskId, taskIds }: { taskId: string; taskIds: string[] }) => api<ProjectOut>(`/projects/${id}/epics/${taskId}/members`, { method: 'POST', body: JSON.stringify({ taskIds }) }), id)
}

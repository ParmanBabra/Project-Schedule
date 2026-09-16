import { api } from '@/shared/api/client'
import { useProjectMutation } from '@/features/projects/api'
import type { ProjectOut, ReleaseCreate, ReleaseUpdate } from '@/features/projects/types'

export function useCreateRelease(id: string) {
  return useProjectMutation((body: ReleaseCreate) => api<ProjectOut>(`/projects/${id}/releases`, { method: 'POST', body: JSON.stringify(body) }), id)
}

export function useUpdateRelease(id: string) {
  return useProjectMutation(({ releaseId, ...body }: ReleaseUpdate & { releaseId: string }) => api<ProjectOut>(`/projects/${id}/releases/${releaseId}`, { method: 'PATCH', body: JSON.stringify(body) }), id)
}

export function useDeleteRelease(id: string) {
  return useProjectMutation((releaseId: string) => api<ProjectOut>(`/projects/${id}/releases/${releaseId}`, { method: 'DELETE' }), id)
}

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { projectKeys } from '@/features/projects/api'
import type { ProjectOut, Resource, ResourceCreate, ResourceOut, ResourceUpdate, WorkloadResponse } from '@/features/projects/types'
import { api } from '@/shared/api/client'
import { useHistory } from '@/features/history/store'

export const resourceKeys = {
  all: ['resources'] as const,
  workload: (from: string, to: string, projectId?: string, resourceIds?: string[]) =>
    ['workload', from, to, projectId ?? '', (resourceIds ?? []).slice().sort().join(',')] as const,
}

export function useResources() {
  return useQuery({ queryKey: resourceKeys.all, queryFn: () => api<ResourceOut[]>('/resources') })
}

/** Per-day load across all projects; `projectId` picks the overallocation threshold rule. */
export function useWorkload(from: string, to: string, projectId?: string, enabled = true, resourceIds?: string[]) {
  const ids = (resourceIds ?? []).slice().sort()
  const qs = [`from=${from}`, `to=${to}`, projectId ? `projectId=${projectId}` : '', ...ids.map((id) => `resourceId=${encodeURIComponent(id)}`)].filter(Boolean).join('&')
  return useQuery({
    queryKey: resourceKeys.workload(from, to, projectId, ids),
    queryFn: () => api<WorkloadResponse>(`/resources/workload?${qs}`),
    enabled,
    staleTime: 5_000,
  })
}

function invalidateWorkload(qc: ReturnType<typeof useQueryClient>) {
  void qc.invalidateQueries({ queryKey: ['workload'] })
  void qc.invalidateQueries({ queryKey: resourceKeys.all })
}

export function useCreateResource() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: ResourceCreate) => api<Resource>('/resources', { method: 'POST', body: JSON.stringify(body) }),
    onSuccess: () => invalidateWorkload(qc),
  })
}

export function useUpdateResource() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...body }: ResourceUpdate & { id: string }) => api<Resource>(`/resources/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
    onSuccess: () => invalidateWorkload(qc),
  })
}

export function useDeleteResource() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, force }: { id: string; force?: boolean }) => api<void>(`/resources/${id}${force ? '?force=true' : ''}`, { method: 'DELETE' }),
    onSuccess: () => {
      invalidateWorkload(qc)
      void qc.invalidateQueries({ queryKey: ['project'] })
    },
  })
}

// ------------------------------------------------------------- assignments

function useAssignmentMutation<TVars>(projectId: string, fn: (vars: TVars) => Promise<ProjectOut>) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onMutate: () => {
      const current = qc.getQueryData<ProjectOut>(projectKeys.detail(projectId))
      if (current) useHistory.getState().push(current)
    },
    onSuccess: (project) => {
      qc.setQueryData(projectKeys.detail(project.id), project)
      invalidateWorkload(qc)
    },
  })
}

export function useAddAssignment(projectId: string) {
  return useAssignmentMutation(projectId, (body: { taskId: string; resourceId: string; units?: number }) =>
    api<ProjectOut>(`/projects/${projectId}/assignments`, { method: 'POST', body: JSON.stringify(body) }),
  )
}

export function useUpdateAssignment(projectId: string) {
  return useAssignmentMutation(projectId, ({ id, units }: { id: string; units: number }) =>
    api<ProjectOut>(`/projects/${projectId}/assignments/${id}`, { method: 'PATCH', body: JSON.stringify({ units }) }),
  )
}

export function useDeleteAssignment(projectId: string) {
  return useAssignmentMutation(projectId, (id: string) => api<ProjectOut>(`/projects/${projectId}/assignments/${id}`, { method: 'DELETE' }))
}

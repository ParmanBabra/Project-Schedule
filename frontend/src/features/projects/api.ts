import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/shared/api/client'
import type {
  BufferSettings,
  DependencyCreate,
  DependencyType,
  ProjectCreate,
  ProjectListItem,
  ProjectOut,
  ProjectUpdate,
  Rules,
  TaskCreate,
  TaskUpdate,
} from './types'

export const projectKeys = {
  all: ['projects'] as const,
  detail: (id: string) => ['project', id] as const,
}

// ------------------------------------------------------------------ queries

export function useProjects() {
  return useQuery({ queryKey: projectKeys.all, queryFn: () => api<ProjectListItem[]>('/projects') })
}

export function useProject(id: string | undefined) {
  return useQuery({
    queryKey: projectKeys.detail(id ?? ''),
    queryFn: () => api<ProjectOut>(`/projects/${id}`),
    enabled: Boolean(id),
  })
}

// ---------------------------------------------------------------- mutations

/** Every mutation returns the full ProjectOut; we put it straight into the cache. */
function useProjectMutation<TVars>(fn: (vars: TVars) => Promise<ProjectOut>) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSuccess: (project) => {
      qc.setQueryData(projectKeys.detail(project.id), project)
      void qc.invalidateQueries({ queryKey: projectKeys.all })
    },
  })
}

export function useCreateProject() {
  return useProjectMutation((body: ProjectCreate) =>
    api<ProjectOut>('/projects', { method: 'POST', body: JSON.stringify(body) }),
  )
}

export function useUpdateProject(id: string) {
  return useProjectMutation((body: ProjectUpdate) =>
    api<ProjectOut>(`/projects/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  )
}

export function useDuplicateProject() {
  return useProjectMutation(({ id, name }: { id: string; name?: string }) =>
    api<ProjectOut>(`/projects/${id}/duplicate`, { method: 'POST', body: JSON.stringify({ name }) }),
  )
}

export function useDeleteProject() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api<void>(`/projects/${id}`, { method: 'DELETE' }),
    onSuccess: (_, id) => {
      qc.removeQueries({ queryKey: projectKeys.detail(id) })
      void qc.invalidateQueries({ queryKey: projectKeys.all })
    },
  })
}

export function useUpdateRules(id: string) {
  return useProjectMutation((rules: Rules) =>
    api<ProjectOut>(`/projects/${id}/rules`, { method: 'PATCH', body: JSON.stringify(rules) }),
  )
}

export function useUpdateBuffer(id: string) {
  return useProjectMutation((buffer: BufferSettings) =>
    api<ProjectOut>(`/projects/${id}/buffer`, { method: 'PATCH', body: JSON.stringify(buffer) }),
  )
}

export function useAddTask(id: string) {
  return useProjectMutation((body: TaskCreate) =>
    api<ProjectOut>(`/projects/${id}/tasks`, { method: 'POST', body: JSON.stringify(body) }),
  )
}

export function useUpdateTask(id: string) {
  return useProjectMutation(({ taskId, ...body }: TaskUpdate & { taskId: string }) =>
    api<ProjectOut>(`/projects/${id}/tasks/${taskId}`, { method: 'PATCH', body: JSON.stringify(body) }),
  )
}

export function useDeleteTask(id: string) {
  return useProjectMutation(({ taskId, mode = 'lift' }: { taskId: string; mode?: 'lift' | 'cascade' }) =>
    api<ProjectOut>(`/projects/${id}/tasks/${taskId}?mode=${mode}`, { method: 'DELETE' }),
  )
}

export function useReorderTasks(id: string) {
  return useProjectMutation((body: { parentId: string | null; ids: string[] }) =>
    api<ProjectOut>(`/projects/${id}/tasks/reorder`, { method: 'PATCH', body: JSON.stringify(body) }),
  )
}

export function useGroupTasks(id: string) {
  return useProjectMutation((body: { name: string; taskIds: string[] }) =>
    api<ProjectOut>(`/projects/${id}/tasks/group`, { method: 'POST', body: JSON.stringify(body) }),
  )
}

export function useMoveTask(id: string) {
  return useProjectMutation(({ taskId, ...body }: { taskId: string; parentId: string | null; order?: number }) =>
    api<ProjectOut>(`/projects/${id}/tasks/${taskId}/move`, { method: 'PATCH', body: JSON.stringify(body) }),
  )
}

export function useAddDependency(id: string) {
  return useProjectMutation((body: DependencyCreate) =>
    api<ProjectOut>(`/projects/${id}/dependencies`, { method: 'POST', body: JSON.stringify(body) }),
  )
}

export function useUpdateDependency(id: string) {
  return useProjectMutation(({ depId, ...body }: { depId: string; type?: DependencyType; lag?: number }) =>
    api<ProjectOut>(`/projects/${id}/dependencies/${depId}`, { method: 'PATCH', body: JSON.stringify(body) }),
  )
}

export function useDeleteDependency(id: string) {
  return useProjectMutation((depId: string) =>
    api<ProjectOut>(`/projects/${id}/dependencies/${depId}`, { method: 'DELETE' }),
  )
}

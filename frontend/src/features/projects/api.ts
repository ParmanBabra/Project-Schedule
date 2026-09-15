import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/shared/api/client'
import { toState, useHistory } from '@/features/history/store'
import type {
  BufferSettings,
  ChainBody,
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

/**
 * Every mutation returns the full ProjectOut; we put it straight into the cache.
 * When `projectId` is given the pre-mutation state is pushed to the undo history.
 */
export function useProjectMutation<TVars>(fn: (vars: TVars) => Promise<ProjectOut>, projectId?: string, track = true) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onMutate: () => {
      if (projectId && track) {
        const current = qc.getQueryData<ProjectOut>(projectKeys.detail(projectId))
        if (current) useHistory.getState().push(current)
      }
    },
    onSuccess: (project) => {
      qc.setQueryData(projectKeys.detail(project.id), project)
      void qc.invalidateQueries({ queryKey: projectKeys.all })
    },
  })
}

/** Undo/redo: replace the whole editable state without touching the history stack. */
export function useReplaceState(id: string) {
  return useProjectMutation(
    (snapshot: ProjectOut) => api<ProjectOut>(`/projects/${id}`, { method: 'PUT', body: JSON.stringify(toState(snapshot)) }),
    id,
    false,
  )
}

export function useCreateProject() {
  return useProjectMutation((body: ProjectCreate) =>
    api<ProjectOut>('/projects', { method: 'POST', body: JSON.stringify(body) }),
  )
}

export function useUpdateProject(id: string) {
  return useProjectMutation((body: ProjectUpdate) =>
    api<ProjectOut>(`/projects/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
    id,
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
    id,
  )
}

export function useUpdateBuffer(id: string) {
  return useProjectMutation((buffer: BufferSettings) =>
    api<ProjectOut>(`/projects/${id}/buffer`, { method: 'PATCH', body: JSON.stringify(buffer) }),
    id,
  )
}

export function useAddTask(id: string) {
  return useProjectMutation((body: TaskCreate) =>
    api<ProjectOut>(`/projects/${id}/tasks`, { method: 'POST', body: JSON.stringify(body) }),
    id,
  )
}

export function useUpdateTask(id: string) {
  return useProjectMutation(({ taskId, ...body }: TaskUpdate & { taskId: string }) =>
    api<ProjectOut>(`/projects/${id}/tasks/${taskId}`, { method: 'PATCH', body: JSON.stringify(body) }),
    id,
  )
}

export function useDeleteTask(id: string) {
  return useProjectMutation(({ taskId, mode = 'lift' }: { taskId: string; mode?: 'lift' | 'cascade' }) =>
    api<ProjectOut>(`/projects/${id}/tasks/${taskId}?mode=${mode}`, { method: 'DELETE' }),
    id,
  )
}

export function useReorderTasks(id: string) {
  return useProjectMutation((body: { parentId: string | null; ids: string[] }) =>
    api<ProjectOut>(`/projects/${id}/tasks/reorder`, { method: 'PATCH', body: JSON.stringify(body) }),
    id,
  )
}

export function useGroupTasks(id: string) {
  return useProjectMutation((body: { name: string; taskIds: string[] }) =>
    api<ProjectOut>(`/projects/${id}/tasks/group`, { method: 'POST', body: JSON.stringify(body) }),
    id,
  )
}

export function useMoveTask(id: string) {
  return useProjectMutation(({ taskId, ...body }: { taskId: string; parentId: string | null; order?: number }) =>
    api<ProjectOut>(`/projects/${id}/tasks/${taskId}/move`, { method: 'PATCH', body: JSON.stringify(body) }),
    id,
  )
}

export function useAddDependency(id: string) {
  return useProjectMutation((body: DependencyCreate) =>
    api<ProjectOut>(`/projects/${id}/dependencies`, { method: 'POST', body: JSON.stringify(body) }),
    id,
  )
}

export function useUpdateDependency(id: string) {
  return useProjectMutation(({ depId, ...body }: { depId: string; type?: DependencyType; lag?: number }) =>
    api<ProjectOut>(`/projects/${id}/dependencies/${depId}`, { method: 'PATCH', body: JSON.stringify(body) }),
    id,
  )
}

export function useDeleteDependency(id: string) {
  return useProjectMutation((depId: string) =>
    api<ProjectOut>(`/projects/${id}/dependencies/${depId}`, { method: 'DELETE' }),
    id,
  )
}

export function useSaveBaseline(id: string) {
  return useProjectMutation(() => api<ProjectOut>(`/projects/${id}/baseline`, { method: 'POST' }), id, false)
}

export function useClearBaseline(id: string) {
  return useProjectMutation(() => api<ProjectOut>(`/projects/${id}/baseline`, { method: 'DELETE' }), id, false)
}

/** TSK-9: create a chain of tasks after `taskId`. */
export function useCreateChain(id: string) {
  return useProjectMutation(({ taskId, ...body }: ChainBody & { taskId: string }) =>
    api<ProjectOut>(`/projects/${id}/tasks/${taskId}/chain`, { method: 'POST', body: JSON.stringify(body) }),
    id,
  )
}

/** Same call with dryRun: the would-be project (schedule included) without saving. */
export function useChainPreview(id: string, taskId: string, body: ChainBody, enabled = true) {
  return useQuery({
    queryKey: ['chain-preview', id, taskId, body],
    queryFn: () => api<ProjectOut>(`/projects/${id}/tasks/${taskId}/chain?dryRun=true`, { method: 'POST', body: JSON.stringify(body) }),
    enabled,
    staleTime: 30_000,
    placeholderData: (prev) => prev,
  })
}

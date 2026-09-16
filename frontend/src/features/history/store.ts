import { create } from 'zustand'
import type { ProjectOut } from '@/features/projects/types'

/**
 * Undo/redo history per project (docs/features.md HIS-1). Every mutation pushes the
 * project state it started from; undo sends that snapshot back with PUT /projects/{id}.
 * Kept in memory only – 50 steps, reset when the page reloads.
 */
export const HISTORY_LIMIT = 50

interface Stack {
  past: ProjectOut[]
  future: ProjectOut[]
}

interface HistoryState {
  stacks: Record<string, Stack>
  push: (snapshot: ProjectOut) => void
  /** Pop the last snapshot, remembering `current` for redo. */
  undo: (projectId: string, current: ProjectOut) => ProjectOut | undefined
  redo: (projectId: string, current: ProjectOut) => ProjectOut | undefined
  clear: (projectId: string) => void
}

const empty: Stack = { past: [], future: [] }

export const useHistory = create<HistoryState>((set, get) => ({
  stacks: {},
  push: (snapshot) =>
    set((s) => {
      const stack = s.stacks[snapshot.id] ?? empty
      const last = stack.past[stack.past.length - 1]
      if (last && last.updatedAt === snapshot.updatedAt) return s // same state, nothing new
      const past = [...stack.past, snapshot].slice(-HISTORY_LIMIT)
      return { stacks: { ...s.stacks, [snapshot.id]: { past, future: [] } } }
    }),
  undo: (projectId, current) => {
    const stack = get().stacks[projectId] ?? empty
    const previous = stack.past[stack.past.length - 1]
    if (!previous) return undefined
    set((s) => ({
      stacks: { ...s.stacks, [projectId]: { past: stack.past.slice(0, -1), future: [current, ...stack.future].slice(0, HISTORY_LIMIT) } },
    }))
    return previous
  },
  redo: (projectId, current) => {
    const stack = get().stacks[projectId] ?? empty
    const next = stack.future[0]
    if (!next) return undefined
    set((s) => ({
      stacks: { ...s.stacks, [projectId]: { past: [...stack.past, current].slice(-HISTORY_LIMIT), future: stack.future.slice(1) } },
    }))
    return next
  },
  clear: (projectId) => set((s) => ({ stacks: { ...s.stacks, [projectId]: empty } })),
}))

export function useCanUndoRedo(projectId: string) {
  // two primitive selectors: returning a fresh object from one selector would re-render forever
  const canUndo = useHistory((s) => (s.stacks[projectId]?.past.length ?? 0) > 0)
  const canRedo = useHistory((s) => (s.stacks[projectId]?.future.length ?? 0) > 0)
  return { canUndo, canRedo }
}

/** Fields the PUT endpoint accepts. */
export function toState(p: ProjectOut) {
  return {
    name: p.name,
    startDate: p.startDate,
    holidays: p.holidays,
    workingDays: p.workingDays,
    tasks: p.tasks,
    dependencies: p.dependencies,
    assignments: p.assignments,
    buffer: p.buffer,
    rules: p.rules,
    releases: p.releases,
  }
}

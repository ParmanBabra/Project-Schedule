import { create } from 'zustand'

/** Tiny cross-page UI signals (e.g. the mobile "+" button asking the Gantt to open Add task). */
interface UiState {
  addTaskRequest: number
  requestAddTask: () => void
}

export const useUiStore = create<UiState>((set) => ({
  addTaskRequest: 0,
  requestAddTask: () => set((s) => ({ addTaskRequest: s.addTaskRequest + 1 })),
}))

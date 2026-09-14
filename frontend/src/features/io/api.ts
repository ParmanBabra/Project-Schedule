import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/shared/api/client'
import { projectKeys } from '@/features/projects/api'
import type { ProjectOut } from '@/features/projects/types'

export interface ImportResult {
  projectId: string
  createdResources: string[]
  matchedResources: string[]
}

export interface ImportOut {
  project: ProjectOut
  result: ImportResult
}

export const EXPORT_FORMAT = 'phaengan-project'

/** Server URLs for file exports (the browser downloads them directly; IO-1, IO-3). */
export const exportUrls = {
  json: (projectId: string) => `/api/projects/${projectId}/export`,
  csv: (projectId: string) => `/api/projects/${projectId}/export.csv`,
}

/** POST a parsed export document; the server matches resources by name (IO-2). */
export function useImportProject() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (doc: unknown) => api<ImportOut>('/projects/import', { method: 'POST', body: JSON.stringify(doc) }),
    onSuccess: ({ project }) => {
      qc.setQueryData(projectKeys.detail(project.id), project)
      void qc.invalidateQueries({ queryKey: projectKeys.all })
      void qc.invalidateQueries({ queryKey: ['resources'] })
    },
  })
}

/** Trigger a browser download of `href` (a server URL or a data/blob URL). */
export function downloadHref(href: string, filename?: string): void {
  const a = document.createElement('a')
  a.href = href
  if (filename) a.download = filename
  a.rel = 'noopener'
  document.body.appendChild(a)
  a.click()
  a.remove()
}

/** File name that is safe on every OS; keeps Thai letters. */
export function safeFilename(name: string, ext: string): string {
  const safe = name.replace(/[\\/:*?"<>|]+/g, '_').trim() || 'project'
  return `${safe}.${ext}`
}

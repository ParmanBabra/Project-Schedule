import { Navigate, Route, Routes } from 'react-router-dom'
import { AppShell } from '@/app/layout/AppShell'
import { ProjectsPage } from '@/features/projects/ProjectsPage'
import { GanttPage } from '@/features/gantt/GanttPage'
import { CalendarPage } from '@/features/calendar/CalendarPage'
import { ResourcesPage } from '@/features/resources/ResourcesPage'
import { SettingsPage } from '@/features/settings/SettingsPage'
import { UiPage } from '@/dev/UiPage'

/** Route table (docs/ui-design.md §1). */
export function AppRoutes() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route path="/" element={<ProjectsPage />} />
        <Route path="/resources" element={<ResourcesPage />} />
        <Route path="/p/:projectId" element={<Navigate to="gantt" replace />} />
        <Route path="/p/:projectId/gantt" element={<GanttPage />} />
        <Route path="/p/:projectId/calendar" element={<CalendarPage />} />
        <Route path="/p/:projectId/settings" element={<SettingsPage />} />
      </Route>
      <Route path="/dev/ui" element={<UiPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

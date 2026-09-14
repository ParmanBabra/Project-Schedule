import { Route, Routes } from 'react-router-dom'
import { HomePage } from '@/features/projects/HomePage'

/**
 * Route table (see docs/ui-design.md §1).
 * Feature pages are added phase by phase.
 */
export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
    </Routes>
  )
}

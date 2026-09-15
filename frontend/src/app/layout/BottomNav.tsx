import { Calendar, GanttChartSquare, Layers, Plus, Users } from 'lucide-react'
import { NavLink, useLocation, useNavigate, useParams } from 'react-router-dom'
import styles from './BottomNav.module.css'
import { useUiStore } from './uiStore'

/**
 * Mobile-only bottom navigation (docs/ui-design.md §5.1): three tabs plus a raised "+"
 * that opens Add task on the Gantt (navigating there first when needed).
 */
export function BottomNav() {
  const { projectId } = useParams<{ projectId: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const requestAddTask = useUiStore((s) => s.requestAddTask)

  const onAdd = () => {
    if (!projectId) return
    const ganttPath = `/p/${projectId}/gantt`
    if (!location.pathname.endsWith('/gantt')) navigate(ganttPath)
    // the Gantt page reads the counter; a tick later so it is mounted after navigation
    window.setTimeout(requestAddTask, 0)
  }

  return (
    <nav className={styles.nav} aria-label="เมนูมือถือ" data-testid="bottom-nav">
      {projectId ? (
        <>
          <Tab to={`/p/${projectId}/gantt`} icon={<GanttChartSquare size={22} />} label="Gantt" />
          <Tab to={`/p/${projectId}/calendar`} icon={<Calendar size={22} />} label="ปฏิทิน" />
          <button type="button" className={styles.fab} aria-label="เพิ่มงาน" onClick={onAdd}>
            <Plus size={26} />
          </button>
          <Tab to={`/p/${projectId}/epics`} icon={<Layers size={22} />} label="Epics" />
          <Tab to="/resources" icon={<Users size={22} />} label="ทรัพยากร" />
        </>
      ) : (
        <>
          <Tab to="/" end icon={<Layers size={22} />} label="โปรเจกต์" />
          <Tab to="/resources" icon={<Users size={22} />} label="ทรัพยากร" />
        </>
      )}
    </nav>
  )
}

function Tab({ to, icon, label, end }: { to: string; icon: React.ReactNode; label: string; end?: boolean }) {
  return (
    <NavLink to={to} end={end} className={({ isActive }) => [styles.tab, isActive && styles.tabOn].filter(Boolean).join(' ')}>
      {icon}
      <span>{label}</span>
    </NavLink>
  )
}

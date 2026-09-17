import { Calendar, ChevronDown, FolderKanban, GanttChartSquare, Layers, LogOut, MoreHorizontal, Settings, Users } from 'lucide-react'
import { NavLink, Outlet, useLocation, useNavigate, useParams } from 'react-router-dom'
import { useLogout, useMe } from '@/features/auth/api'
import { useProject, useProjects } from '@/features/projects/api'
import { IconButton, Menu } from '@/shared/ui'
import { BottomNav } from './BottomNav'
import styles from './AppShell.module.css'

/**
 * Layout 2 shell (docs/ui-design.md §1): purple header bar with brand, project switcher
 * and tabs. Pages render below with a 16px gutter. Without a project only the
 * global tabs (โปรเจกต์ / ทรัพยากร) are shown.
 */
/** Pages that are a scrolling canvas (Gantt, calendar) fill the viewport and scroll inside; document-like pages scroll the window. */
export function isFillRoute(pathname: string): boolean {
  return /\/(gantt|calendar)\/?$/.test(pathname)
}

export function AppShell() {
  const { projectId } = useParams<{ projectId: string }>()
  const navigate = useNavigate()
  const fill = isFillRoute(useLocation().pathname)
  const me = useMe()
  const logout = useLogout()
  const canLogout = Boolean(me.data && !me.data.authDisabled)
  const doLogout = () => logout.mutate(undefined, { onSettled: () => navigate('/login', { replace: true }) })
  const logoutItem = canLogout ? [{ label: 'ออกจากระบบ', icon: <LogOut size={16} />, onSelect: doLogout }] : []
  return (
    <div className={[styles.shell, fill && styles.shellFill].filter(Boolean).join(' ')} data-fill={fill ? 'true' : undefined}>
      <header className={styles.hbar}>
        <NavLink to="/" className={styles.brand} aria-label="แผนงาน หน้าแรก">
          <span className={styles.mark} aria-hidden="true" />
          <span className={styles.brandName}>แผนงาน</span>
        </NavLink>
        {projectId ? <ProjectSwitcher projectId={projectId} /> : null}
        <div className={styles.mobileMenu}>
          <Menu
            items={
              projectId
                ? [
                    { label: 'Gantt', icon: <GanttChartSquare size={16} />, onSelect: () => navigate(`/p/${projectId}/gantt`) },
                    { label: 'ปฏิทิน', icon: <Calendar size={16} />, onSelect: () => navigate(`/p/${projectId}/calendar`) },
                    { label: 'Epics', icon: <Layers size={16} />, onSelect: () => navigate(`/p/${projectId}/epics`) },
                    { label: 'ทรัพยากร', icon: <Users size={16} />, onSelect: () => navigate('/resources') },
                    { label: 'ตั้งค่า', icon: <Settings size={16} />, onSelect: () => navigate(`/p/${projectId}/settings`) },
                    { label: 'โปรเจกต์ทั้งหมด', icon: <FolderKanban size={16} />, onSelect: () => navigate('/') },
                    ...logoutItem,
                  ]
                : [
                    { label: 'โปรเจกต์', icon: <FolderKanban size={16} />, onSelect: () => navigate('/') },
                    { label: 'ทรัพยากร', icon: <Users size={16} />, onSelect: () => navigate('/resources') },
                    ...logoutItem,
                  ]
            }
            trigger={(props) => (
              <IconButton label="เมนู" onDark size="lg" {...props}>
                <MoreHorizontal size={20} />
              </IconButton>
            )}
          />
        </div>
        <nav className={styles.tabs} aria-label="เมนูหลัก">
          {projectId ? (
            <>
              <Tab to={`/p/${projectId}/gantt`} icon={<GanttChartSquare size={18} />} label="Gantt" />
              <Tab to={`/p/${projectId}/calendar`} icon={<Calendar size={18} />} label="ปฏิทิน" />
              <Tab to={`/p/${projectId}/epics`} icon={<Layers size={18} />} label="Epics" />
              <Tab to="/resources" icon={<Users size={18} />} label="ทรัพยากร" />
              <Tab to={`/p/${projectId}/settings`} icon={<Settings size={18} />} label="ตั้งค่า" />
            </>
          ) : (
            <>
              <Tab to="/" end icon={<FolderKanban size={18} />} label="โปรเจกต์" />
              <Tab to="/resources" icon={<Users size={18} />} label="ทรัพยากร" />
            </>
          )}
        </nav>
        {canLogout && (
          <IconButton label={`ออกจากระบบ (${me.data?.username})`} onDark className={styles.logout} onClick={doLogout} data-testid="logout">
            <LogOut size={18} />
          </IconButton>
        )}
      </header>
      <main className={styles.main}>
        <Outlet />
      </main>
      <BottomNav />
    </div>
  )
}

function Tab({ to, icon, label, end }: { to: string; icon: React.ReactNode; label: string; end?: boolean }) {
  return (
    <NavLink to={to} end={end} className={({ isActive }) => [styles.tab, isActive && styles.tabOn].filter(Boolean).join(' ')}>
      {icon}
      <span className={styles.tabLabel}>{label}</span>
    </NavLink>
  )
}

function ProjectSwitcher({ projectId }: { projectId: string }) {
  const project = useProject(projectId)
  const projects = useProjects()
  const navigate = useNavigate()
  const name = project.data?.name ?? (project.isError ? 'ไม่พบโปรเจกต์' : '…')
  const items = [
    ...(projects.data ?? [])
      .filter((p) => p.id !== projectId)
      .slice(0, 8)
      .map((p) => ({ label: p.name, onSelect: () => navigate(`/p/${p.id}/gantt`) })),
    { label: 'ดูโปรเจกต์ทั้งหมด', onSelect: () => navigate('/') },
  ]
  return (
    <Menu
      align="left"
      items={items}
      trigger={(props) => (
        <button type="button" className={styles.switcher} aria-label="สลับโปรเจกต์" title="สลับโปรเจกต์" data-testid="project-switcher" {...props}>
          <span className={styles.switcherName}>{name}</span>
          <ChevronDown size={16} />
        </button>
      )}
    />
  )
}

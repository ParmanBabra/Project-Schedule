import { useHealth } from '@/shared/api/health'

/** Placeholder home page for Phase 0. Replaced by the project list in Phase 2. */
export function HomePage() {
  const health = useHealth()
  const status = health.isPending ? 'กำลังเชื่อมต่อ…' : health.isError ? 'เชื่อมต่อไม่ได้' : 'พร้อม'

  return (
    <main style={{ padding: 'var(--sp-6)', display: 'grid', gap: 'var(--sp-3)' }}>
      <h1 style={{ margin: 0, fontSize: 'var(--fs-h1)', fontWeight: 600 }}>แผนงาน</h1>
      <p style={{ margin: 0, color: 'var(--text-2)' }}>
        Backend: <span data-testid="backend-status">{status}</span>
      </p>
    </main>
  )
}

import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Route, Routes, useLocation } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { mockFetch, sampleProject } from '@/test/fixtures'
import { renderWithProviders } from '@/test/render'
import { ExportMenu } from './ExportMenu'
import { ImportButton } from './ImportButton'
import { safeFilename } from './api'

vi.mock('html-to-image', () => ({ toPng: vi.fn(async () => 'data:image/png;base64,AAAA') }))

function Loc() {
  const loc = useLocation()
  return <div data-testid="loc">{loc.pathname}</div>
}

describe('io', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('safeFilename strips characters that are illegal on Windows', () => {
    expect(safeFilename('แผน: ระบบ/จอง?', 'csv')).toBe('แผน_ ระบบ_จอง_.csv')
    expect(safeFilename('   ', 'png')).toBe('project.png')
  })

  it('export menu downloads JSON / CSV from the API and PNG through html-to-image', async () => {
    const clicks: string[] = []
    const origClick = HTMLAnchorElement.prototype.click
    HTMLAnchorElement.prototype.click = function () {
      clicks.push(`${this.getAttribute('download') ?? ''}|${this.getAttribute('href')}`)
    }
    const target = document.createElement('div')
    document.body.appendChild(target)
    try {
      renderWithProviders(<ExportMenu projectId="prj_a" projectName="ตัวอย่าง" pngTarget={() => target} />)
      await userEvent.click(screen.getByRole('button', { name: 'ส่งออก' }))
      await userEvent.click(screen.getByRole('menuitem', { name: 'ไฟล์โปรเจกต์ (.json)' }))
      await userEvent.click(screen.getByRole('button', { name: 'ส่งออก' }))
      await userEvent.click(screen.getByRole('menuitem', { name: 'ตารางงาน (.csv)' }))
      await userEvent.click(screen.getByRole('button', { name: 'ส่งออก' }))
      await userEvent.click(screen.getByRole('menuitem', { name: 'ภาพ Gantt (.png)' }))
      await screen.findByText('บันทึกภาพ Gantt แล้ว')
      expect(clicks).toEqual(['|/api/projects/prj_a/export', '|/api/projects/prj_a/export.csv', 'ตัวอย่าง.png|data:image/png;base64,AAAA'])
    } finally {
      HTMLAnchorElement.prototype.click = origClick
      target.remove()
    }
  })

  it('import button posts the file and navigates to the new project', async () => {
    const posted: unknown[] = []
    vi.stubGlobal(
      'fetch',
      vi.fn(
        mockFetch({
          'POST /projects/import': (init) => {
            posted.push(JSON.parse(String(init?.body)))
            return { project: { ...sampleProject(), id: 'prj_new', name: 'นำเข้า' }, result: { projectId: 'prj_new', createdResources: ['สมชาย'], matchedResources: [] } }
          },
        }),
      ),
    )
    renderWithProviders(
      <Routes>
        <Route path="/" element={<><ImportButton /><Loc /></>} />
        <Route path="/p/:id/gantt" element={<Loc />} />
      </Routes>,
      { route: '/' },
    )
    const file = new File([JSON.stringify({ format: 'phaengan-project', version: 1, project: { name: 'นำเข้า' }, resources: [] })], 'x.phaengan.json', { type: 'application/json' })
    await userEvent.upload(screen.getByTestId('import-file'), file)
    await screen.findByText(/นำเข้า "นำเข้า" แล้ว · สร้างใหม่ 1 คน/)
    expect(posted).toHaveLength(1)
    expect(screen.getByTestId('loc')).toHaveTextContent('/p/prj_new/gantt')
  })

  it('import button rejects files from other apps without calling the API', async () => {
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)
    renderWithProviders(<ImportButton />)
    const file = new File([JSON.stringify({ format: 'ms-project' })], 'x.json', { type: 'application/json' })
    await userEvent.upload(screen.getByTestId('import-file'), file)
    await screen.findByText('ไฟล์นี้ไม่ใช่ไฟล์โปรเจกต์ของแผนงาน')
    expect(fetchSpy).not.toHaveBeenCalled()
  })
})

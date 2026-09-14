import { Download, FileImage, FileJson, FileSpreadsheet } from 'lucide-react'
import { useState } from 'react'
import { Button, Menu, useToast } from '@/shared/ui'
import { downloadHref, exportUrls, safeFilename } from './api'

interface Props {
  projectId: string
  projectName: string
  /** Element to rasterise for the PNG export (IO-4); omit to hide that option. */
  pngTarget?: () => HTMLElement | null
  compact?: boolean
}

/**
 * "ส่งออก" dropdown on the Gantt toolbar: JSON (full project + resources), CSV (task table
 * with computed dates and float) and PNG of the Gantt as currently shown.
 */
export function ExportMenu({ projectId, projectName, pngTarget, compact }: Props) {
  const toast = useToast()
  const [busy, setBusy] = useState(false)

  const exportPng = async () => {
    const el = pngTarget?.()
    if (!el) return
    setBusy(true)
    try {
      const { toPng } = await import('html-to-image')
      const dataUrl = await toPng(el, {
        pixelRatio: 2,
        backgroundColor: '#ffffff',
        skipFonts: true, // Google Fonts CSS is cross-origin; Kanit is already loaded in the page
        // the today line is positioned on the scroll container; keep it, drop hover-only bits
        filter: (node) => !(node instanceof HTMLElement && node.dataset.exportSkip === 'true'),
      })
      downloadHref(dataUrl, safeFilename(projectName, 'png'))
      toast.success('บันทึกภาพ Gantt แล้ว')
    } catch {
      toast.error('สร้างภาพไม่สำเร็จ')
    } finally {
      setBusy(false)
    }
  }

  const items = [
    { label: 'ไฟล์โปรเจกต์ (.json)', icon: <FileJson size={16} />, onSelect: () => downloadHref(exportUrls.json(projectId)) },
    { label: 'ตารางงาน (.csv)', icon: <FileSpreadsheet size={16} />, onSelect: () => downloadHref(exportUrls.csv(projectId)) },
    ...(pngTarget ? [{ label: 'ภาพ Gantt (.png)', icon: <FileImage size={16} />, onSelect: () => void exportPng(), disabled: busy }] : []),
  ]

  return (
    <Menu
      items={items}
      trigger={(props) => (
        <Button size="sm" icon={<Download size={16} />} aria-label="ส่งออก" title="ส่งออก JSON / CSV / PNG" {...props}>
          {compact ? null : <span>ส่งออก</span>}
        </Button>
      )}
    />
  )
}

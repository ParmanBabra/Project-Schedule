import { Upload } from 'lucide-react'
import { useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { ApiError } from '@/shared/api/client'
import { Button, useToast } from '@/shared/ui'
import { EXPORT_FORMAT, useImportProject } from './api'

/** "นำเข้า" on the projects page: pick a .json exported by แผนงาน, create a new project (IO-2). */
export function ImportButton() {
  const input = useRef<HTMLInputElement>(null)
  const importProject = useImportProject()
  const toast = useToast()
  const navigate = useNavigate()

  const onFile = async (file: File | undefined) => {
    if (!file) return
    let doc: { format?: string; project?: { name?: string } }
    try {
      doc = JSON.parse(await file.text())
    } catch {
      toast.error('อ่านไฟล์ไม่ได้ ต้องเป็นไฟล์ .json ที่ส่งออกจากแผนงาน')
      return
    }
    if (doc?.format !== EXPORT_FORMAT) {
      toast.error('ไฟล์นี้ไม่ใช่ไฟล์โปรเจกต์ของแผนงาน')
      return
    }
    try {
      const { project, result } = await importProject.mutateAsync(doc)
      const parts = [`นำเข้า "${project.name}" แล้ว`]
      if (result.matchedResources.length) parts.push(`จับคู่ทรัพยากรเดิม ${result.matchedResources.length} คน`)
      if (result.createdResources.length) parts.push(`สร้างใหม่ ${result.createdResources.length} คน`)
      toast.success(parts.join(' · '))
      navigate(`/p/${project.id}/gantt`)
    } catch (e) {
      const msg = e instanceof ApiError && e.body && typeof e.body === 'object' && 'error' in e.body ? String((e.body as { error: { message: string } }).error.message) : 'นำเข้าไม่สำเร็จ'
      toast.error(msg)
    }
  }

  return (
    <>
      <input
        ref={input}
        type="file"
        accept="application/json,.json"
        hidden
        data-testid="import-file"
        onChange={(e) => {
          void onFile(e.target.files?.[0])
          e.target.value = ''
        }}
      />
      <Button icon={<Upload size={16} />} onClick={() => input.current?.click()} disabled={importProject.isPending} aria-label="นำเข้าโปรเจกต์" title="นำเข้าไฟล์ .json ที่ส่งออกจากแผนงาน">
        นำเข้า
      </Button>
    </>
  )
}

import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ApiError } from '@/shared/api/client'
import { todayISO } from '@/shared/lib/date'
import { Button, DatePicker, Dialog, Field, Input, WeekdayPicker, useToast } from '@/shared/ui'
import { useCreateProject } from './api'

export function CreateProjectDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate()
  const toast = useToast()
  const create = useCreateProject()
  const [name, setName] = useState('')
  const [startDate, setStartDate] = useState(todayISO())
  const [workingDays, setWorkingDays] = useState([1, 2, 3, 4, 5])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setName('')
      setStartDate(todayISO())
      setWorkingDays([1, 2, 3, 4, 5])
      setError(null)
    }
  }, [open])

  const submit = async () => {
    const trimmed = name.trim()
    if (!trimmed) return setError('กรุณาตั้งชื่อโปรเจกต์')
    if (!startDate) return setError('กรุณาเลือกวันเริ่ม')
    if (workingDays.length === 0) return setError('ต้องมีวันทำงานอย่างน้อย 1 วัน')
    setError(null)
    try {
      const project = await create.mutateAsync({ name: trimmed, startDate, workingDays })
      toast.success(`สร้าง "${project.name}" แล้ว`)
      onClose()
      navigate(`/p/${project.id}/gantt`)
    } catch (e) {
      setError(e instanceof ApiError ? `สร้างไม่สำเร็จ (${e.status})` : 'สร้างไม่สำเร็จ ลองใหม่อีกครั้ง')
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="โปรเจกต์ใหม่"
      description="ตั้งชื่อ เลือกวันเริ่ม และวันทำงาน ปรับทีหลังได้ในหน้าตั้งค่า"
      actions={
        <>
          <Button onClick={onClose}>ยกเลิก</Button>
          <Button variant="primary" onClick={() => void submit()} disabled={create.isPending}>
            สร้างโปรเจกต์
          </Button>
        </>
      }
    >
      <form
        onSubmit={(e) => {
          e.preventDefault()
          void submit()
        }}
        style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)' }}
      >
        <Field label="ชื่อโปรเจกต์" htmlFor="new-project-name" error={error}>
          <Input id="new-project-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="เช่น ระบบจองห้องประชุม" maxLength={200} />
        </Field>
        <Field label="วันเริ่ม" htmlFor="new-project-start">
          <DatePicker id="new-project-start" aria-label="วันเริ่ม" value={startDate} onChange={setStartDate} />
        </Field>
        <Field label="วันทำงาน" hint="วันที่ระบบนับเป็นวันทำงาน วันอื่นจะถูกข้าม">
          <WeekdayPicker value={workingDays} onChange={setWorkingDays} />
        </Field>
        <button type="submit" hidden aria-hidden="true" />
      </form>
    </Dialog>
  )
}

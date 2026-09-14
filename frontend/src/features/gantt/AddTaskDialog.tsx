import { useEffect, useMemo, useState } from 'react'
import { useAddTask } from '@/features/projects/api'
import type { ProjectOut } from '@/features/projects/types'
import { ApiError } from '@/shared/api/client'
import { Button, Dialog, Field, Input, NumberInput, Select, Toggle, useToast } from '@/shared/ui'

export interface AddTaskDialogProps {
  project: ProjectOut
  open: boolean
  onClose: () => void
  onCreated: (taskId: string) => void
  defaultParentId?: string | null
}

export function AddTaskDialog({ project, open, onClose, onCreated, defaultParentId = null }: AddTaskDialogProps) {
  const toast = useToast()
  const add = useAddTask(project.id)
  const [name, setName] = useState('')
  const [duration, setDuration] = useState<number | ''>(1)
  const [milestone, setMilestone] = useState(false)
  const [parentId, setParentId] = useState<string>(defaultParentId ?? '')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setName('')
      setDuration(1)
      setMilestone(false)
      setParentId(defaultParentId ?? '')
      setError(null)
    }
  }, [open, defaultParentId])

  const groups = useMemo(
    () => project.tasks.filter((t) => project.schedule.tasks[t.id]?.isSummary),
    [project.tasks, project.schedule.tasks],
  )
  const ccpm = project.buffer.method === 'ccpm'

  const submit = async () => {
    const trimmed = name.trim()
    if (!trimmed) return setError('กรุณาตั้งชื่องาน')
    if (!milestone && (duration === '' || duration < 0)) return setError('กรุณาระบุระยะเวลา')
    setError(null)
    try {
      const before = new Set(project.tasks.map((t) => t.id))
      const result = await add.mutateAsync({
        name: trimmed,
        duration: milestone ? 0 : Number(duration),
        isMilestone: milestone,
        parentId: parentId || null,
      })
      const created = result.tasks.find((t) => !before.has(t.id))
      toast.success(`เพิ่ม "${trimmed}" แล้ว`)
      onClose()
      if (created) onCreated(created.id)
    } catch (e) {
      const msg = e instanceof ApiError && typeof e.body === 'object' && e.body && 'error' in e.body ? (e.body as { error: { message: string } }).error.message : 'เพิ่มงานไม่สำเร็จ'
      setError(msg)
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="เพิ่มงาน"
      actions={
        <>
          <Button onClick={onClose}>ยกเลิก</Button>
          <Button variant="primary" onClick={() => void submit()} disabled={add.isPending}>
            เพิ่มงาน
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
        <Field label="ชื่องาน" htmlFor="task-name" error={error}>
          <Input id="task-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="เช่น ออกแบบระบบ" maxLength={200} />
        </Field>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 'var(--sp-3)' }}>
          <Field label="ระยะเวลา" htmlFor="task-duration" hint={ccpm ? 'ไม่ต้องเผื่อ ระบบเผื่อรวมไว้ท้ายโครงการแล้ว' : 'นับเฉพาะวันทำงาน'}>
            <NumberInput
              id="task-duration"
              value={milestone ? 0 : duration}
              onChange={setDuration}
              min={0}
              max={3650}
              suffix="วัน"
              disabled={milestone}
              placeholder={ccpm ? 'ถ้าราบรื่น กี่วัน' : 'กี่วัน'}
            />
          </Field>
          <Field label="อยู่ในกลุ่ม" htmlFor="task-parent">
            <Select
              id="task-parent"
              value={parentId}
              onChange={setParentId}
              options={[{ value: '', label: 'ไม่มี (ระดับบนสุด)' }, ...groups.map((g) => ({ value: g.id, label: g.name }))]}
            />
          </Field>
        </div>
        <Toggle checked={milestone} onChange={setMilestone} label="เป็น milestone (ไม่มีระยะเวลา)" />
        <button type="submit" hidden aria-hidden="true" />
      </form>
    </Dialog>
  )
}

import { Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import {
  Avatar,
  Button,
  Card,
  Chip,
  DateInput,
  Dialog,
  EmptyState,
  Field,
  IconButton,
  Input,
  NumberInput,
  Pill,
  ProgressBar,
  Segment,
  Select,
  StatusDot,
  Toggle,
  Tooltip,
  WeekdayPicker,
  useToast,
} from '@/shared/ui'

/** Living style guide at /dev/ui – every shared component in every state. Not linked from the app. */
export function UiPage() {
  const toast = useToast()
  const [seg, setSeg] = useState('week')
  const [on, setOn] = useState(true)
  const [days, setDays] = useState([1, 2, 3, 4, 5])
  const [num, setNum] = useState<number | ''>(5)
  const [sel, setSel] = useState('FS')
  const [dialog, setDialog] = useState(false)

  const row: React.CSSProperties = { display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }
  const section: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 12 }

  return (
    <div style={{ padding: 24, display: 'grid', gap: 16, maxWidth: 960, margin: '0 auto' }}>
      <h1 style={{ margin: 0 }}>UI kit</h1>
      <Card padding="md" style={section}>
        <h3 style={{ margin: 0 }}>Buttons</h3>
        <div style={row}>
          <Button variant="primary" icon={<Plus size={16} />}>เพิ่มงาน</Button>
          <Button>รอง</Button>
          <Button variant="ghost">ghost</Button>
          <Button variant="danger" icon={<Trash2 size={16} />}>ลบ</Button>
          <Button disabled>ปิดใช้งาน</Button>
          <Button size="sm">เล็ก</Button>
          <IconButton label="เพิ่ม"><Plus size={16} /></IconButton>
          <Tooltip text="คำอธิบายสั้น"><Button size="sm">hover ดู tooltip</Button></Tooltip>
        </div>
      </Card>
      <Card padding="md" style={section}>
        <h3 style={{ margin: 0 }}>Chips, pills, avatars, dots</h3>
        <div style={row}>
          <Chip tone="critical">Critical 4 งาน</Chip>
          <Chip tone="soft">เสร็จตามแผน 6 ต.ค.</Chip>
          <Chip tone="primary">แนะนำ</Chip>
          <Chip tone="warn">เกินกำลัง 1</Chip>
          <Chip tone="green">เผื่อยังปลอดภัย</Chip>
          <Chip tone="neutral">งาน 7</Chip>
        </div>
        <div style={row}>
          <Pill>FS</Pill>
          <Pill tone="soft">+0 วัน</Pill>
          <Pill tone="critical">Float 0</Pill>
          <Avatar name="สมชาย" />
          <Avatar name="สุดา" color="var(--critical)" size="lg" />
          <StatusDot kind="task" /> <StatusDot kind="critical" /> <StatusDot kind="near" /> <StatusDot kind="milestone" /> <StatusDot kind="summary" />
        </div>
      </Card>
      <Card padding="md" style={section}>
        <h3 style={{ margin: 0 }}>Inputs</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12 }}>
          <Field label="ชื่องาน" htmlFor="ui-name"><Input id="ui-name" placeholder="ถ้าราบรื่น กี่วัน" /></Field>
          <Field label="ระยะเวลา" htmlFor="ui-dur" hint="ไม่ต้องเผื่อ"><NumberInput id="ui-dur" value={num} onChange={setNum} min={0} suffix="วัน" /></Field>
          <Field label="วันเริ่ม" htmlFor="ui-date"><DateInput id="ui-date" defaultValue="2026-09-14" /></Field>
          <Field label="ประเภท" htmlFor="ui-sel">
            <Select id="ui-sel" value={sel} onChange={setSel} options={[{ value: 'FS', label: 'FS เสร็จแล้วค่อยเริ่ม' }, { value: 'SS', label: 'SS เริ่มพร้อมกัน' }]} />
          </Field>
          <Field label="มีข้อผิดพลาด" htmlFor="ui-err" error="ต้องไม่ว่าง"><Input id="ui-err" invalid /></Field>
          <Field label="อ่านอย่างเดียว" htmlFor="ui-ro"><Input id="ui-ro" readOnly value="17 ก.ย. 2569" /></Field>
        </div>
        <div style={row}>
          <Segment value={seg} onChange={setSeg} options={[{ value: 'day', label: 'วัน' }, { value: 'week', label: 'สัปดาห์' }, { value: 'month', label: 'เดือน' }]} />
          <Segment variant="white" value={seg} onChange={setSeg} options={[{ value: 'day', label: 'วัน' }, { value: 'week', label: 'สัปดาห์' }, { value: 'month', label: 'เดือน' }]} />
          <Toggle checked={on} onChange={setOn} label="แสดง Critical Path" />
        </div>
        <WeekdayPicker value={days} onChange={setDays} />
      </Card>
      <Card padding="md" style={section}>
        <h3 style={{ margin: 0 }}>Feedback</h3>
        <ProgressBar value={32} />
        <ProgressBar value={80} tone="task" size="lg" />
        <div style={row}>
          <Button onClick={() => toast.success('บันทึกแล้ว')}>toast success</Button>
          <Button onClick={() => toast.error('เกิดข้อผิดพลาด')}>toast error</Button>
          <Button onClick={() => toast.show('ปรับกติกาแล้ว', { action: { label: 'เลิกทำ', onClick: () => {} } })}>toast + action</Button>
          <Button onClick={() => setDialog(true)}>dialog</Button>
        </div>
        <EmptyState title="ยังไม่มีงาน" description="เริ่มด้วยการเพิ่มงานแรก" action={<Button variant="primary">เพิ่มงาน</Button>} />
      </Card>
      <Dialog open={dialog} onClose={() => setDialog(false)} title="ตัวอย่าง dialog" description="คำอธิบายสั้น" actions={<><Button onClick={() => setDialog(false)}>ยกเลิก</Button><Button variant="primary" onClick={() => setDialog(false)}>ตกลง</Button></>}>
        <p style={{ margin: 0 }}>เนื้อหา</p>
      </Dialog>
    </div>
  )
}

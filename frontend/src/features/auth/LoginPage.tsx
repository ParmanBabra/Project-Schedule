import { LogIn } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { ApiError } from '@/shared/api/client'
import { Button, Field, Input } from '@/shared/ui'
import { useLogin, useMe } from './api'
import styles from './login.module.css'

function messageFor(e: unknown): string {
  if (e instanceof ApiError) {
    if (e.status === 429) return 'ลองผิดหลายครั้งเกินไป รอ 1 นาทีแล้วลองใหม่'
    if (e.status === 401) return 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง'
    return `เข้าสู่ระบบไม่สำเร็จ (${e.status})`
  }
  return 'ติดต่อเซิร์ฟเวอร์ไม่ได้ ลองใหม่อีกครั้ง'
}

/** Single-user login (docs/features.md AUTH-1). Credentials live in the server config. */
export function LoginPage() {
  const me = useMe()
  const login = useLogin()
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as { from?: string } | null)?.from ?? '/'
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)

  if (me.data) return <Navigate to={from} replace />

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!username.trim() || !password) {
      setError('กรอกชื่อผู้ใช้และรหัสผ่าน')
      return
    }
    setError(null)
    try {
      await login.mutateAsync({ username: username.trim(), password })
      navigate(from, { replace: true })
    } catch (err) {
      setError(messageFor(err))
    }
  }

  return (
    <main className={styles.page}>
      <form className={styles.card} onSubmit={(e) => void submit(e)} aria-labelledby="login-title" data-testid="login-form">
        <div className={styles.brand}>
          <span className={styles.mark} aria-hidden="true" />
          <div>
            <h1 id="login-title" className={styles.title}>แผนงาน</h1>
            <p className={styles.sub}>เข้าสู่ระบบเพื่อดูและแก้ไขแผนโปรเจกต์</p>
          </div>
        </div>
        <Field label="ชื่อผู้ใช้" htmlFor="login-username">
          <Input id="login-username" autoComplete="username" autoFocus value={username} onChange={(e) => setUsername(e.target.value)} maxLength={120} />
        </Field>
        <Field label="รหัสผ่าน" htmlFor="login-password" error={error}>
          <Input id="login-password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} maxLength={200} />
        </Field>
        <Button type="submit" variant="primary" block icon={<LogIn size={16} />} disabled={login.isPending}>
          เข้าสู่ระบบ
        </Button>
        <p className={styles.hint}>ชื่อผู้ใช้และรหัสผ่านตั้งไว้ในไฟล์ config ของเซิร์ฟเวอร์ (backend/config.json)</p>
      </form>
    </main>
  )
}

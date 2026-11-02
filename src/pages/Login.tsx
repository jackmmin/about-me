import { useState, type FormEvent } from 'react'
import { AuthCard, ErrorText, inputClass, primaryButtonClass } from '../components/AuthCard.tsx'
import { supabase } from '../lib/supabase.ts'

export function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setPending(true)
    setError(null)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    setPending(false)
    // 성공하면 AuthProvider가 상태를 바꿔 OTP 화면으로 넘어간다.
    if (error) {
      setError(error.message === 'Invalid login credentials' ? '이메일 또는 비밀번호가 올바르지 않습니다.' : error.message)
    }
  }

  return (
    <AuthCard title="로그인">
      <form className="flex flex-col gap-3" onSubmit={handleSubmit}>
        <input
          className={inputClass}
          type="email"
          autoComplete="username"
          placeholder="이메일"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <input
          className={inputClass}
          type="password"
          autoComplete="current-password"
          placeholder="비밀번호"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <ErrorText message={error} />
        <button className={primaryButtonClass} disabled={pending}>
          {pending ? '확인 중…' : '로그인'}
        </button>
      </form>
    </AuthCard>
  )
}

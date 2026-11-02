import { useState } from 'react'
import { inputClass } from './AuthCard.tsx'

// 6자리 OTP 입력. 모바일 숫자 키패드를 띄우고, 6자리가 채워지면 자동으로 제출한다.
export function OtpInput({ disabled, onComplete }: { disabled?: boolean; onComplete: (code: string) => void }) {
  const [code, setCode] = useState('')

  return (
    <input
      className={`${inputClass} text-center font-mono text-2xl tracking-[0.5em]`}
      inputMode="numeric"
      autoComplete="one-time-code"
      autoFocus
      maxLength={6}
      placeholder="000000"
      aria-label="OTP 6자리 코드"
      disabled={disabled}
      value={code}
      onChange={(e) => {
        const next = e.target.value.replace(/\D/g, '').slice(0, 6)
        setCode(next)
        if (next.length === 6) {
          onComplete(next)
          setCode('')
        }
      }}
    />
  )
}

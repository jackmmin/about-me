import { useState } from 'react'
import { signOut } from '../auth/useAuth.ts'
import { AuthCard, ErrorText, linkButtonClass } from '../components/AuthCard.tsx'
import { OtpInput } from '../components/OtpInput.tsx'
import { supabase } from '../lib/supabase.ts'

// 로그인할 때마다 등록된 OTP 앱의 코드를 확인한다.
export function MfaVerify() {
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function verify(code: string) {
    setPending(true)
    setError(null)
    const { data: factors, error: listError } = await supabase.auth.mfa.listFactors()
    const factor = factors?.totp[0]
    if (listError || !factor) {
      setPending(false)
      return setError('등록된 OTP를 찾을 수 없습니다. 다시 로그인하세요.')
    }
    const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: factor.id, code })
    setPending(false)
    if (error) setError('코드가 올바르지 않습니다. 앱에 표시된 최신 코드를 입력하세요.')
  }

  return (
    <AuthCard title="OTP 인증" description="인증 앱에 표시된 6자리 코드를 입력하세요.">
      <OtpInput disabled={pending} onComplete={verify} />
      <div className="mt-4 flex flex-col items-center gap-3">
        <ErrorText message={error} />
        <button className={linkButtonClass} onClick={() => void signOut()}>
          다른 계정으로 로그인
        </button>
      </div>
    </AuthCard>
  )
}

import { useEffect, useRef, useState } from 'react'
import { signOut } from '../auth/useAuth.ts'
import { AuthCard, ErrorText, linkButtonClass } from '../components/AuthCard.tsx'
import { OtpInput } from '../components/OtpInput.tsx'
import { supabase } from '../lib/supabase.ts'

interface Enrollment {
  factorId: string
  qrCode: string // SVG data URL
  secret: string
}

// 처음 로그인했을 때 OTP 앱(Google Authenticator 등)을 등록한다.
export function MfaEnroll() {
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const started = useRef(false) // StrictMode 이중 실행으로 등록이 두 번 생기는 것을 막는다

  useEffect(() => {
    if (started.current) return
    started.current = true
    void (async () => {
      // 이전에 등록을 끝내지 못하고 남은(unverified) TOTP는 지우고 새로 시작한다.
      const { data: factors } = await supabase.auth.mfa.listFactors()
      for (const f of factors?.all ?? []) {
        if (f.factor_type === 'totp' && f.status === 'unverified') {
          await supabase.auth.mfa.unenroll({ factorId: f.id })
        }
      }
      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: 'totp',
        friendlyName: `Authenticator ${new Date().toISOString().slice(0, 10)}`,
      })
      if (error) return setError(error.message)
      setEnrollment({ factorId: data.id, qrCode: data.totp.qr_code, secret: data.totp.secret })
    })()
  }, [])

  async function verify(code: string) {
    if (!enrollment) return
    setPending(true)
    setError(null)
    const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: enrollment.factorId, code })
    setPending(false)
    // 성공하면 세션이 aal2로 올라가고 AuthProvider가 본문 화면으로 넘긴다.
    if (error) setError('코드가 올바르지 않습니다. 앱에 표시된 최신 코드를 입력하세요.')
  }

  return (
    <AuthCard title="OTP 앱 등록" description="인증 앱으로 QR 코드를 스캔한 뒤, 앱에 표시된 6자리 코드를 입력하세요.">
      {enrollment ? (
        <div className="flex flex-col gap-4">
          <img src={enrollment.qrCode} alt="OTP 등록 QR 코드" className="mx-auto size-48 rounded-lg bg-white p-2" />
          <details className="text-sm text-neutral-500">
            <summary className="cursor-pointer">QR을 스캔할 수 없나요? (같은 폰에서 여는 경우)</summary>
            <p className="mt-2">인증 앱에서 "설정 키 입력"을 선택하고 아래 키를 입력하세요.</p>
            <code className="mt-2 block break-all rounded bg-neutral-100 p-2 font-mono text-xs select-all dark:bg-neutral-900">
              {enrollment.secret}
            </code>
          </details>
          <OtpInput disabled={pending} onComplete={verify} />
        </div>
      ) : (
        !error && <p className="text-sm text-neutral-500">QR 코드를 만드는 중…</p>
      )}
      <div className="mt-4 flex flex-col items-center gap-3">
        <ErrorText message={error} />
        <button className={linkButtonClass} onClick={() => void signOut()}>
          로그아웃
        </button>
      </div>
    </AuthCard>
  )
}

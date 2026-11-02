import { Outlet } from 'react-router'
import { supabaseConfigError } from '../lib/supabase.ts'
import { Login } from '../pages/Login.tsx'
import { MfaEnroll } from '../pages/MfaEnroll.tsx'
import { MfaVerify } from '../pages/MfaVerify.tsx'
import { useAuth } from './useAuth.ts'

// 인증 단계에 맞는 화면만 보여준다. OTP까지 통과해야 하위 라우트(Outlet)가 열린다.
export function AuthGate() {
  const { status } = useAuth()

  if (supabaseConfigError) return <CenterMessage text={supabaseConfigError} />

  switch (status) {
    case 'loading':
      return <CenterMessage text="불러오는 중…" />
    case 'signedOut':
      return <Login />
    case 'needsEnroll':
      return <MfaEnroll />
    case 'needsVerify':
      return <MfaVerify />
    case 'ready':
      return <Outlet />
  }
}

function CenterMessage({ text }: { text: string }) {
  return <div className="grid min-h-dvh place-items-center p-6 text-sm text-neutral-500">{text}</div>
}

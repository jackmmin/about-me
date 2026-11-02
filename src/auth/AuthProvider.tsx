import type { Session } from '@supabase/supabase-js'
import { useEffect, useState, type ReactNode } from 'react'
import { supabase } from '../lib/supabase.ts'
import { AuthContext, type AuthState, type AuthStatus } from './useAuth.ts'

async function resolveStatus(session: Session | null): Promise<AuthStatus> {
  if (!session) return 'signedOut'
  const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
  if (error || !data) return 'signedOut'
  if (data.currentLevel === 'aal2') return 'ready'
  return data.nextLevel === 'aal2' ? 'needsVerify' : 'needsEnroll'
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ status: 'loading', session: null })

  useEffect(() => {
    let active = true
    const update = async (session: Session | null) => {
      const status = await resolveStatus(session)
      if (active) setState({ status, session })
    }

    // onAuthStateChange 콜백 안에서 다른 supabase 호출을 바로 await하면 교착될 수 있어 다음 틱으로 미룬다.
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setTimeout(() => void update(session), 0)
    })
    return () => {
      active = false
      data.subscription.unsubscribe()
    }
  }, [])

  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>
}

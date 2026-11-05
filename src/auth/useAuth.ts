import type { Session } from '@supabase/supabase-js'
import { createContext, useContext } from 'react'
import { clearUrlCache } from '../lib/images.ts'
import { supabase } from '../lib/supabase.ts'
import { clearUsageCache } from '../lib/usage.ts'
import { clearLoadCache } from '../lib/useLoad.ts'

// signedOut: 로그인 전
// needsEnroll: 비밀번호는 통과했지만 등록된 OTP가 없음
// needsVerify: OTP가 등록돼 있고 이번 세션에서 아직 입력하지 않음
// ready: OTP까지 통과한 세션(aal2). 이 상태에서만 RLS가 데이터를 내준다.
export type AuthStatus = 'loading' | 'signedOut' | 'needsEnroll' | 'needsVerify' | 'ready'

export interface AuthState {
  status: AuthStatus
  session: Session | null
}

export const AuthContext = createContext<AuthState>({ status: 'loading', session: null })

export function useAuth() {
  return useContext(AuthContext)
}

// 다른 계정으로 다시 로그인했을 때 이전 계정의 데이터가 보이지 않도록 캐시를 모두 비운다.
export function signOut() {
  clearLoadCache()
  clearUrlCache()
  clearUsageCache()
  return supabase.auth.signOut()
}

import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY

// 키가 없으면 앱 대신 설정 안내 화면을 띄운다 (AuthGate 참고)
export const supabaseConfigError =
  !url || !key ? 'VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY 환경변수가 설정되지 않았습니다.' : null

export const supabase = createClient(url || 'http://localhost', key || 'missing-key')

/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/react" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string
  readonly VITE_SUPABASE_ANON_KEY?: string
  readonly VITE_IMAGE_API_URL?: string // 사진 Worker 주소 (없으면 새 사진도 Supabase Storage에 저장)
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

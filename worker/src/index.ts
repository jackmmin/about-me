// 사진 파일 저장소 (R2). 기록 데이터는 Supabase에 그대로 두고 사진 파일만 여기 둔다.
//
// 접근 원칙은 Supabase Storage 정책과 같다:
//   Supabase 로그인 토큰이 유효하고, OTP 인증까지 마친 세션(aal2)이며, 경로의 첫 폴더가 본인 user_id일 때만 허용.
//
// POST /sign    { keys }  → { urls }   사진을 볼 임시 주소(1시간) 발급
// GET  /img/<key>?exp&sig               임시 주소로 사진 받기 (<img src>는 헤더를 못 보내므로 서명으로 확인)
// PUT  /object/<key>                    사진 올리기 (본문 = 파일, Content-Type = image/webp | image/jpeg)
// POST /delete  { keys }                사진 지우기
import { createRemoteJWKSet, decodeProtectedHeader, jwtVerify, type JWTVerifyGetKey } from 'jose'

interface Env {
  IMAGES: R2Bucket
  ALLOWED_ORIGINS: string
  SUPABASE_URL: string
  URL_SIGNING_SECRET: string
  SUPABASE_JWT_SECRET?: string
}

const URL_TTL = 60 * 60 // 임시 주소 유효 시간(초)
const MAX_BYTES = 10 * 1024 * 1024
const CONTENT_TYPES = ['image/webp', 'image/jpeg']
const MAX_KEYS = 500

class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message)
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const cors = corsHeaders(request, env)
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors })
    try {
      const res = await route(request, env)
      for (const [k, v] of Object.entries(cors)) res.headers.set(k, v)
      return res
    } catch (e) {
      const status = e instanceof HttpError ? e.status : 500
      const message = e instanceof Error ? e.message : String(e)
      return Response.json({ error: message }, { status, headers: cors })
    }
  },
} satisfies ExportedHandler<Env>

async function route(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url)
  const { pathname } = url

  if (request.method === 'GET' && pathname.startsWith('/img/')) {
    return serveImage(env, decodeURIComponent(pathname.slice('/img/'.length)), url.searchParams)
  }
  if (request.method === 'POST' && pathname === '/sign') {
    const userId = await authenticate(request, env)
    const keys = checkKeys(await readKeys(request), userId)
    const exp = Math.floor(Date.now() / 1000) + URL_TTL
    const urls: Record<string, string> = {}
    for (const key of keys) {
      const sig = await sign(env, key, exp)
      urls[key] = `${url.origin}/img/${encodeURI(key)}?exp=${exp}&sig=${sig}`
    }
    return Response.json({ urls, expiresIn: URL_TTL })
  }
  if (request.method === 'PUT' && pathname.startsWith('/object/')) {
    const userId = await authenticate(request, env)
    const [key] = checkKeys([decodeURIComponent(pathname.slice('/object/'.length))], userId)
    const contentType = request.headers.get('Content-Type') ?? ''
    if (!CONTENT_TYPES.includes(contentType)) throw new HttpError(415, `지원하지 않는 형식: ${contentType}`)
    const body = await request.arrayBuffer()
    if (body.byteLength === 0 || body.byteLength > MAX_BYTES) throw new HttpError(413, '파일 크기가 허용 범위를 벗어났습니다.')
    await env.IMAGES.put(key, body, { httpMetadata: { contentType } })
    return Response.json({ key, size: body.byteLength })
  }
  if (request.method === 'POST' && pathname === '/delete') {
    const userId = await authenticate(request, env)
    const keys = checkKeys(await readKeys(request), userId)
    if (keys.length > 0) await env.IMAGES.delete(keys)
    return Response.json({ deleted: keys.length })
  }
  throw new HttpError(404, 'not found')
}

async function serveImage(env: Env, key: string, params: URLSearchParams) {
  const exp = Number(params.get('exp'))
  const sig = params.get('sig') ?? ''
  if (!exp || exp < Date.now() / 1000 || !(await verify(env, key, exp, sig))) throw new HttpError(403, '만료되었거나 잘못된 주소입니다.')
  const object = await env.IMAGES.get(key)
  if (!object) throw new HttpError(404, '사진이 없습니다.')
  const headers = new Headers()
  object.writeHttpMetadata(headers)
  headers.set('ETag', object.httpEtag)
  // 같은 임시 주소는 만료 전까지 브라우저 캐시를 쓴다 (경로마다 내용이 바뀌지 않음)
  headers.set('Cache-Control', `private, max-age=${Math.max(0, Math.floor(exp - Date.now() / 1000))}, immutable`)
  return new Response(object.body, { headers })
}

// ---------------------------------------------------------------
// Supabase 로그인 토큰 검증 → user_id
// 새 프로젝트는 비대칭 키(JWKS), 예전 프로젝트는 HS256 공유 비밀키로 서명한다. 둘 다 지원.
// ---------------------------------------------------------------
let jwks: JWTVerifyGetKey | undefined

async function authenticate(request: Request, env: Env) {
  const token = request.headers.get('Authorization')?.match(/^Bearer (.+)$/)?.[1]
  if (!token) throw new HttpError(401, '로그인이 필요합니다.')
  const base = env.SUPABASE_URL.replace(/\/$/, '')
  const options = { issuer: `${base}/auth/v1`, audience: 'authenticated' }
  let payload
  try {
    if (decodeProtectedHeader(token).alg === 'HS256') {
      if (!env.SUPABASE_JWT_SECRET) throw new Error('HS256 secret not configured')
      ;({ payload } = await jwtVerify(token, new TextEncoder().encode(env.SUPABASE_JWT_SECRET), options))
    } else {
      jwks ??= createRemoteJWKSet(new URL(`${base}/auth/v1/.well-known/jwks.json`))
      ;({ payload } = await jwtVerify(token, jwks, options))
    }
  } catch {
    throw new HttpError(401, '로그인 정보가 유효하지 않습니다. 다시 로그인하세요.')
  }
  if (payload.aal !== 'aal2' || typeof payload.sub !== 'string') throw new HttpError(403, 'OTP 인증이 필요합니다.')
  return payload.sub
}

// 본인 폴더 안의 정상적인 경로만 허용 ('{user_id}/{entry_id}/{파일}')
function checkKeys(keys: unknown, userId: string): string[] {
  if (!Array.isArray(keys) || keys.length > MAX_KEYS) throw new HttpError(400, '잘못된 요청입니다.')
  for (const key of keys) {
    if (typeof key !== 'string' || !key.startsWith(`${userId}/`) || !/^[\w-]+(\/[\w-]+)*\.(webp|jpg)$/.test(key)) {
      throw new HttpError(403, '접근할 수 없는 사진입니다.')
    }
  }
  return keys as string[]
}

async function readKeys(request: Request) {
  try {
    return ((await request.json()) as { keys?: unknown }).keys
  } catch {
    throw new HttpError(400, '잘못된 요청입니다.')
  }
}

// ---------------------------------------------------------------
// 임시 주소 서명 (HMAC-SHA256)
// ---------------------------------------------------------------
let hmacKey: Promise<CryptoKey> | undefined

function signingKey(env: Env) {
  hmacKey ??= crypto.subtle.importKey('raw', new TextEncoder().encode(env.URL_SIGNING_SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, [
    'sign',
    'verify',
  ])
  return hmacKey
}

const message = (key: string, exp: number) => new TextEncoder().encode(`${key}\n${exp}`)

async function sign(env: Env, key: string, exp: number) {
  const sig = await crypto.subtle.sign('HMAC', await signingKey(env), message(key, exp))
  return btoa(String.fromCharCode(...new Uint8Array(sig))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

async function verify(env: Env, key: string, exp: number, sig: string) {
  let bytes: Uint8Array
  try {
    bytes = Uint8Array.from(atob(sig.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0))
  } catch {
    return false
  }
  // crypto.subtle.verify는 일정 시간 비교라 서명 추측 공격에 안전하다
  return crypto.subtle.verify('HMAC', await signingKey(env), bytes, message(key, exp))
}

// ---------------------------------------------------------------
// CORS: 허용한 사이트에서만 API를 부를 수 있다
// ---------------------------------------------------------------
function corsHeaders(request: Request, env: Env): Record<string, string> {
  const origin = request.headers.get('Origin')
  const allowed = env.ALLOWED_ORIGINS.split(',').map((o) => o.trim())
  if (!origin || !allowed.includes(origin)) return {}
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  }
}

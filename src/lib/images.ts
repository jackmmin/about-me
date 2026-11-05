import { supabase } from './supabase.ts'
import { entryCover, type Entry } from './types.ts'

// 사진 파일 위치는 storage_path 접두사로 구분한다 (기록 데이터는 모두 Supabase DB).
//   'r2:{user}/{entry}/{id}.webp'  → Cloudflare R2 (worker/ 의 Worker를 거쳐 접근)
//   '{user}/{entry}/{id}.jpg'      → 예전 사진, Supabase Storage 'images' 버킷
// 새 사진은 VITE_IMAGE_API_URL이 설정돼 있으면 R2에, 없으면 Supabase Storage에 올린다.
const BUCKET = 'images'
const R2_PREFIX = 'r2:'
const IMAGE_API = import.meta.env.VITE_IMAGE_API_URL?.replace(/\/$/, '')
const FULL_SIZE = 2000
const THUMB_SIZE = 400
const SIGNED_URL_TTL = 60 * 60 // 1시간 (Worker의 URL_TTL과 같게)

const isR2 = (path: string) => path.startsWith(R2_PREFIX)
const r2Key = (path: string) => path.slice(R2_PREFIX.length)

// 새로 올릴 사진의 저장 경로
export function imagePath(userId: string, entryId: string, imageId: string, ext: 'webp' | 'jpg') {
  return `${IMAGE_API ? R2_PREFIX : ''}${userId}/${entryId}/${imageId}.${ext}`
}

// 사진 Worker 호출 (Supabase 로그인 토큰으로 본인 확인)
async function imageApi<T>(path: string, init: RequestInit): Promise<T> {
  if (!IMAGE_API) throw new Error('사진 서버 주소(VITE_IMAGE_API_URL)가 설정되지 않았습니다.')
  const { data } = await supabase.auth.getSession()
  const res = await fetch(`${IMAGE_API}${path}`, {
    ...init,
    headers: { ...init.headers, Authorization: `Bearer ${data.session?.access_token ?? ''}` },
  })
  const body = (await res.json().catch(() => ({}))) as T & { error?: string }
  if (!res.ok) throw new Error(body.error ?? `사진 서버 오류 (${res.status})`)
  return body
}

// Worker는 한 번에 500개까지 받는다
async function postKeys<T>(path: string, keys: string[]) {
  const results: T[] = []
  for (let i = 0; i < keys.length; i += 500) {
    const body = JSON.stringify({ keys: keys.slice(i, i + 500) })
    results.push(await imageApi<T>(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body }))
  }
  return results
}

// 예전 사진은 .jpg, 이후 사진은 .webp (WebP를 못 만드는 브라우저에서 올린 사진은 .jpg)
// '{user}/{entry}/{id}.webp' → '{user}/{entry}/{id}_thumb.webp'
export function thumbPath(path: string) {
  return path.replace(/\.(jpg|webp)$/, '_thumb.$1')
}

export function imageExt(path: string) {
  return path.endsWith('.webp') ? 'webp' : 'jpg'
}

const extOf = (blob: Blob) => (blob.type === 'image/webp' ? 'webp' : 'jpg')

// 긴 변을 maxSize 이하로 줄여 WebP로 다시 인코딩한다. 사진 방향(EXIF)은 반영된다.
// WebP는 같은 화질에서 JPEG보다 30~40% 작다. 지원하지 않는 브라우저(iOS Safari 등)는 PNG를 돌려주므로 JPEG로 다시 만든다.
async function resize(bitmap: ImageBitmap, maxSize: number, quality: number) {
  const scale = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  const encode = (type: string) =>
    new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('이미지 변환 실패'))), type, quality),
    )
  const webp = await encode('image/webp')
  return webp.type === 'image/webp' ? webp : encode('image/jpeg')
}

async function compress(file: File) {
  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
  } catch {
    throw new Error(`${file.name}: 이 브라우저에서 열 수 없는 이미지 형식입니다.`)
  }
  try {
    return { full: await resize(bitmap, FULL_SIZE, 0.85), thumb: await resize(bitmap, THUMB_SIZE, 0.8) }
  } finally {
    bitmap.close()
  }
}

// 원본·썸네일 두 파일을 올리고, 저장한 총 크기를 돌려준다 (entry_images.size_bytes)
async function putPair(path: string, full: Blob, thumb: Blob) {
  for (const [p, blob] of [
    [path, full],
    [thumbPath(path), thumb],
  ] as const) {
    if (isR2(p)) {
      await imageApi(`/object/${encodeURI(r2Key(p))}`, { method: 'PUT', headers: { 'Content-Type': blob.type }, body: blob })
    } else {
      const { error } = await supabase.storage.from(BUCKET).upload(p, blob, { contentType: blob.type, upsert: true })
      if (error) throw error
    }
  }
  return full.size + thumb.size
}

// 압축 후 원본·썸네일을 업로드하고 원본 경로와 크기를 돌려준다.
export async function uploadImage(userId: string, entryId: string, imageId: string, file: File) {
  const { full, thumb } = await compress(file)
  const path = imagePath(userId, entryId, imageId, extOf(full))
  return { path, size: await putPair(path, full, thumb) }
}

// 백업용: 원본 사진 파일 받기
export async function downloadImage(path: string) {
  if (isR2(path)) {
    const url = (await signedUrls([path]))[path]
    const res = await fetch(url)
    if (!res.ok) throw new Error(`사진을 받지 못했습니다 (${res.status})`)
    return new Uint8Array(await res.arrayBuffer())
  }
  const { data, error } = await supabase.storage.from(BUCKET).download(path)
  if (error) throw error
  return new Uint8Array(await data.arrayBuffer())
}

// 복원용: 백업의 원본(이미 압축된 파일)을 그대로 올리고 썸네일만 다시 만든다. 저장한 총 크기를 돌려준다.
// 썸네일은 파일 확장자와 실제 형식이 다를 수 있지만 contentType을 실제 형식으로 올리므로 그대로 표시된다.
export async function uploadBackupImage(path: string, bytes: Uint8Array) {
  const full = new Blob([bytes as Uint8Array<ArrayBuffer>], { type: imageExt(path) === 'webp' ? 'image/webp' : 'image/jpeg' })
  const bitmap = await createImageBitmap(full)
  let thumb: Blob
  try {
    thumb = await resize(bitmap, THUMB_SIZE, 0.8)
  } finally {
    bitmap.close()
  }
  return putPair(path, full, thumb)
}

export async function removeImages(paths: string[]) {
  if (paths.length === 0) return
  const all = paths.flatMap((p) => [p, thumbPath(p)])
  const r2 = all.filter(isR2)
  const legacy = all.filter((p) => !isR2(p))
  if (r2.length > 0) await postKeys('/delete', r2.map(r2Key))
  if (legacy.length > 0) {
    const { error } = await supabase.storage.from(BUCKET).remove(legacy)
    if (error) throw error
  }
  for (const p of all) urlCache.delete(p)
  saveUrlCache()
}

// 서명 URL은 만료 전까지 재사용한다 (같은 사진을 매번 새 URL로 받으면 브라우저 캐시가 안 먹는다).
// 앱을 다시 켜도 이어 쓰도록 localStorage에 보관한다 (최대 1시간짜리 본인 사진 주소뿐).
type CachedUrl = { url: string; expiresAt: number }
const URL_CACHE_KEY = 'signed-url-cache'
const urlCache = loadUrlCache()

function loadUrlCache() {
  const now = Date.now()
  try {
    const saved = JSON.parse(localStorage.getItem(URL_CACHE_KEY) ?? '[]') as [string, CachedUrl][]
    return new Map(saved.filter(([, v]) => v.expiresAt > now))
  } catch {
    return new Map<string, CachedUrl>()
  }
}

function saveUrlCache() {
  const now = Date.now()
  try {
    localStorage.setItem(URL_CACHE_KEY, JSON.stringify([...urlCache].filter(([, v]) => v.expiresAt > now)))
  } catch {
    // 저장 공간이 부족해도 메모리 캐시는 그대로 쓴다
  }
}

export function clearUrlCache() {
  urlCache.clear()
  localStorage.removeItem(URL_CACHE_KEY)
}

export async function signedUrls(paths: string[]): Promise<Record<string, string>> {
  const now = Date.now()
  const result: Record<string, string> = {}
  const missing: string[] = []
  for (const p of new Set(paths)) {
    const cached = urlCache.get(p)
    if (cached && cached.expiresAt > now) result[p] = cached.url
    else missing.push(p)
  }
  // 만료 5분 전까지만 캐시를 쓴다
  const expiresAt = now + (SIGNED_URL_TTL - 300) * 1000
  const keep = (path: string, url: string) => {
    urlCache.set(path, { url, expiresAt })
    result[path] = url
  }
  if (missing.length === 0) return result
  // R2와 예전 Storage 주소는 동시에 발급받는다
  const r2 = missing.filter(isR2)
  const legacy = missing.filter((p) => !isR2(p))
  await Promise.all([
    r2.length > 0 &&
      postKeys<{ urls: Record<string, string> }>('/sign', r2.map(r2Key)).then((res) => {
        const urls: Record<string, string> = Object.assign({}, ...res.map((r) => r.urls))
        for (const p of r2) if (urls[r2Key(p)]) keep(p, urls[r2Key(p)])
      }),
    legacy.length > 0 &&
      supabase.storage
        .from(BUCKET)
        .createSignedUrls(legacy, SIGNED_URL_TTL)
        .then(({ data, error }) => {
          if (error) throw error
          for (const item of data) if (item.path && item.signedUrl) keep(item.path, item.signedUrl)
        }),
  ])
  saveUrlCache()
  return result
}

// 목록 카드에 쓸 대표 사진의 썸네일 경로 (사진이 없으면 undefined)
export function coverThumbPath(entry: Entry) {
  const cover = entryCover(entry)
  return cover ? thumbPath(cover.storage_path) : undefined
}

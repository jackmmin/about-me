import { supabase } from './supabase.ts'

const BUCKET = 'images'
const FULL_SIZE = 2000
const THUMB_SIZE = 400
const SIGNED_URL_TTL = 60 * 60 // 1시간

// '{user}/{entry}/{id}.jpg' → '{user}/{entry}/{id}_thumb.jpg'
export function thumbPath(path: string) {
  return path.replace(/\.jpg$/, '_thumb.jpg')
}

// 긴 변을 maxSize 이하로 줄여 JPEG로 다시 인코딩한다. 사진 방향(EXIF)은 반영된다.
async function resize(bitmap: ImageBitmap, maxSize: number, quality: number) {
  const scale = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  return new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('이미지 변환 실패'))), 'image/jpeg', quality),
  )
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

// 압축 후 원본·썸네일을 업로드하고 원본 경로를 돌려준다.
export async function uploadImage(userId: string, entryId: string, file: File) {
  const { full, thumb } = await compress(file)
  const path = `${userId}/${entryId}/${crypto.randomUUID()}.jpg`
  const bucket = supabase.storage.from(BUCKET)
  const upload = async (p: string, blob: Blob) => {
    const { error } = await bucket.upload(p, blob, { contentType: 'image/jpeg' })
    if (error) throw error
  }
  await upload(path, full)
  await upload(thumbPath(path), thumb)
  return path
}

// 백업용: 원본 사진 파일 받기
export async function downloadImage(path: string) {
  const { data, error } = await supabase.storage.from(BUCKET).download(path)
  if (error) throw error
  return new Uint8Array(await data.arrayBuffer())
}

// 복원용: 백업의 원본(이미 압축된 JPEG)을 그대로 올리고 썸네일만 다시 만든다.
export async function uploadBackupImage(path: string, bytes: Uint8Array) {
  const full = new Blob([bytes as Uint8Array<ArrayBuffer>], { type: 'image/jpeg' })
  const bitmap = await createImageBitmap(full)
  let thumb: Blob
  try {
    thumb = await resize(bitmap, THUMB_SIZE, 0.8)
  } finally {
    bitmap.close()
  }
  const bucket = supabase.storage.from(BUCKET)
  for (const [p, blob] of [
    [path, full],
    [thumbPath(path), thumb],
  ] as const) {
    const { error } = await bucket.upload(p, blob, { contentType: 'image/jpeg', upsert: true })
    if (error) throw error
  }
}

export async function removeImages(paths: string[]) {
  if (paths.length === 0) return
  const all = paths.flatMap((p) => [p, thumbPath(p)])
  const { error } = await supabase.storage.from(BUCKET).remove(all)
  if (error) throw error
  for (const p of all) urlCache.delete(p)
}

// 서명 URL은 만료 전까지 재사용한다 (같은 사진을 매번 새 URL로 받으면 브라우저 캐시가 안 먹는다).
const urlCache = new Map<string, { url: string; expiresAt: number }>()

export async function signedUrls(paths: string[]): Promise<Record<string, string>> {
  const now = Date.now()
  const result: Record<string, string> = {}
  const missing: string[] = []
  for (const p of new Set(paths)) {
    const cached = urlCache.get(p)
    if (cached && cached.expiresAt > now) result[p] = cached.url
    else missing.push(p)
  }
  if (missing.length > 0) {
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrls(missing, SIGNED_URL_TTL)
    if (error) throw error
    // 만료 5분 전까지만 캐시를 쓴다
    const expiresAt = now + (SIGNED_URL_TTL - 300) * 1000
    for (const item of data) {
      if (!item.path || !item.signedUrl) continue
      urlCache.set(item.path, { url: item.signedUrl, expiresAt })
      result[item.path] = item.signedUrl
    }
  }
  return result
}

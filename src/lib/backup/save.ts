import { Capacitor, registerPlugin } from '@capacitor/core'

// 백업 파일을 조금씩 써 내려가는 대상. 사진이 많아도 전체를 메모리에 올리지 않도록 스트리밍으로 쓴다.
export interface ByteSink {
  write(chunk: Uint8Array): Promise<void>
  close(): Promise<void>
  abort(): Promise<void>
}

// Android 앱: 시스템 파일 저장 화면(SAF)으로 위치를 고른다. (android/.../BackupFilePlugin.java)
interface BackupFilePlugin {
  create(options: { fileName: string; mimeType: string }): Promise<{ cancelled: boolean; id?: string }>
  write(options: { id: string; data: string }): Promise<void>
  close(options: { id: string }): Promise<void>
  abort(options: { id: string }): Promise<void>
}
const BackupFile = registerPlugin<BackupFilePlugin>('BackupFile')

// Chrome·Edge의 저장 대화상자 (표준 타입 정의에 아직 없음)
interface SaveFilePickerWindow {
  showSaveFilePicker(options: {
    suggestedName: string
    types: { description: string; accept: Record<string, string[]> }[]
  }): Promise<{ createWritable(): Promise<{ write(data: BufferSource): Promise<void>; close(): Promise<void>; abort(): Promise<void> }> }>
}

const NATIVE_CHUNK = 1024 * 1024 // 네이티브 브리지로 한 번에 넘기는 크기

/**
 * 저장 위치를 고르게 하고 쓰기 대상을 돌려준다. 사용자가 취소하면 null.
 * 브라우저 저장 대화상자는 클릭 직후에만 열 수 있으므로, 다른 비동기 작업보다 먼저 불러야 한다.
 */
export async function openSink(fileName: string): Promise<ByteSink | null> {
  if (Capacitor.isNativePlatform()) return openNativeSink(fileName)
  if ('showSaveFilePicker' in window) return openPickerSink(fileName)
  return openDownloadSink(fileName)
}

async function openNativeSink(fileName: string): Promise<ByteSink | null> {
  if (!Capacitor.isPluginAvailable('BackupFile')) {
    throw new Error('백업 저장 기능이 없는 이전 버전 앱입니다. 앱을 최신 버전으로 다시 설치하세요.')
  }
  const { cancelled, id } = await BackupFile.create({ fileName, mimeType: 'application/zip' })
  if (cancelled || !id) return null

  let buffer: Uint8Array[] = []
  let buffered = 0
  const flush = async () => {
    if (buffered === 0) return
    const data = await toBase64(buffer)
    buffer = []
    buffered = 0
    await BackupFile.write({ id, data })
  }
  return {
    async write(chunk) {
      buffer.push(chunk)
      buffered += chunk.length
      if (buffered >= NATIVE_CHUNK) await flush()
    },
    async close() {
      await flush()
      await BackupFile.close({ id })
    },
    abort: () => BackupFile.abort({ id }),
  }
}

async function openPickerSink(fileName: string): Promise<ByteSink | null> {
  let handle
  try {
    handle = await (window as unknown as SaveFilePickerWindow).showSaveFilePicker({
      suggestedName: fileName,
      types: [{ description: 'About Me 백업', accept: { 'application/zip': ['.zip'] } }],
    })
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') return null
    throw e
  }
  const writable = await handle.createWritable()
  return {
    write: (chunk) => writable.write(chunk as Uint8Array<ArrayBuffer>),
    close: () => writable.close(),
    abort: () => writable.abort(),
  }
}

// 저장 대화상자가 없는 브라우저: 모아서 일반 다운로드
function openDownloadSink(fileName: string): ByteSink {
  let chunks: Uint8Array[] = []
  return {
    async write(chunk) {
      chunks.push(chunk)
    },
    async close() {
      const url = URL.createObjectURL(new Blob(chunks as Uint8Array<ArrayBuffer>[], { type: 'application/zip' }))
      chunks = []
      const a = document.createElement('a')
      a.href = url
      a.download = fileName
      a.click()
      setTimeout(() => URL.revokeObjectURL(url), 60_000)
    },
    async abort() {
      chunks = []
    },
  }
}

function toBase64(chunks: Uint8Array[]) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve((reader.result as string).slice((reader.result as string).indexOf(',') + 1))
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(new Blob(chunks as Uint8Array<ArrayBuffer>[]))
  })
}

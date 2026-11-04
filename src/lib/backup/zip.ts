import { inflateSync, strFromU8, strToU8, Zip, ZipDeflate, ZipPassThrough } from 'fflate'
import type { ByteSink } from './save.ts'

// 파일을 하나씩 추가하면서 바로 sink로 흘려보낸다. 파일마다 쓰기가 끝날 때까지 기다려 메모리가 쌓이지 않게 한다.
export class ZipWriter {
  private zip: Zip
  private pending: Promise<void> = Promise.resolve()
  private error: unknown = null

  constructor(sink: ByteSink) {
    this.zip = new Zip((err, chunk) => {
      if (err) this.error = err
      else this.pending = this.pending.then(() => sink.write(chunk))
    })
  }

  async addJson(path: string, value: unknown) {
    const file = new ZipDeflate(path, { level: 6 })
    this.zip.add(file)
    file.push(strToU8(JSON.stringify(value, null, 2)), true)
    await this.drain()
  }

  // 사진(JPEG)은 이미 압축돼 있어 그대로 담는다.
  async addFile(path: string, bytes: Uint8Array) {
    const file = new ZipPassThrough(path)
    this.zip.add(file)
    file.push(bytes, true)
    await this.drain()
  }

  async finish() {
    this.zip.end()
    await this.drain()
  }

  private async drain() {
    if (this.error) throw this.error
    await this.pending
  }
}

interface ZipEntry {
  method: number
  compressedSize: number
  offset: number
}

// 끝부분의 중앙 디렉터리만 읽어 목록을 만들고, 필요한 파일만 잘라 읽는다. (백업 파일 전체를 메모리에 올리지 않음)
export class ZipReader {
  private file: Blob
  private entries: Map<string, ZipEntry>

  private constructor(file: Blob, entries: Map<string, ZipEntry>) {
    this.file = file
    this.entries = entries
  }

  static async open(file: Blob) {
    const invalid = () => new Error('ZIP 파일이 아니거나 손상된 파일입니다.')
    const tailStart = Math.max(0, file.size - 65557)
    const tail = await view(file, tailStart, file.size)
    let eocd = -1
    for (let i = tail.byteLength - 22; i >= 0; i--) {
      if (tail.getUint32(i, true) === 0x06054b50) {
        eocd = i
        break
      }
    }
    if (eocd < 0) throw invalid()
    const cdSize = tail.getUint32(eocd + 12, true)
    const cdOffset = tail.getUint32(eocd + 16, true)
    if (cdOffset === 0xffffffff || cdSize === 0xffffffff) throw new Error('4GB가 넘는 백업 파일은 지원하지 않습니다.')

    const cd = await view(file, cdOffset, cdOffset + cdSize)
    const decoder = new TextDecoder()
    const entries = new Map<string, ZipEntry>()
    for (let p = 0; p + 46 <= cd.byteLength; ) {
      if (cd.getUint32(p, true) !== 0x02014b50) throw invalid()
      const nameLength = cd.getUint16(p + 28, true)
      const extraLength = cd.getUint16(p + 30, true)
      const commentLength = cd.getUint16(p + 32, true)
      const name = decoder.decode(new Uint8Array(cd.buffer, cd.byteOffset + p + 46, nameLength))
      entries.set(name, {
        method: cd.getUint16(p + 10, true),
        compressedSize: cd.getUint32(p + 20, true),
        offset: cd.getUint32(p + 42, true),
      })
      p += 46 + nameLength + extraLength + commentLength
    }
    return new ZipReader(file, entries)
  }

  has(path: string) {
    return this.entries.has(path)
  }

  async read(path: string) {
    const entry = this.entries.get(path)
    if (!entry) throw new Error(`백업 파일에 ${path}가 없습니다.`)
    const header = await view(this.file, entry.offset, entry.offset + 30)
    const start = entry.offset + 30 + header.getUint16(26, true) + header.getUint16(28, true)
    const data = new Uint8Array(await this.file.slice(start, start + entry.compressedSize).arrayBuffer())
    if (entry.method === 0) return data
    if (entry.method === 8) return inflateSync(data)
    throw new Error(`${path}: 지원하지 않는 압축 방식입니다.`)
  }

  async readJson<T>(path: string): Promise<T> {
    return JSON.parse(strFromU8(await this.read(path))) as T
  }
}

async function view(file: Blob, start: number, end: number) {
  return new DataView(await file.slice(start, end).arrayBuffer())
}

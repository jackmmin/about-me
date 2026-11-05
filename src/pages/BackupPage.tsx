import { useEffect, useState, type ReactNode } from 'react'
import { useAuth } from '../auth/useAuth.ts'
import { primaryClass, secondaryClass } from '../components/styles.ts'
import { PageHeader } from '../components/ui.tsx'
import { countRecords, createBackup, type BackupResult } from '../lib/backup/export.ts'
import { backupFileName, CATEGORIES, CATEGORY_LABEL, type BackupCategory } from '../lib/backup/format.ts'
import { readBackup, restoreBackup, type LoadedBackup, type RestoreResult } from '../lib/backup/import.ts'
import { openSink } from '../lib/backup/save.ts'
import { formatDate } from '../lib/format.ts'
import { DB_LIMIT, fetchUsage, formatBytes, R2_LIMIT, STORAGE_LIMIT, WARN_RATIO } from '../lib/usage.ts'
import { useLoad } from '../lib/useLoad.ts'

const errorText = (e: unknown) => (e instanceof Error ? e.message : String(e))

export function BackupPage() {
  const [busy, setBusy] = useState<string | null>(null) // 진행 중인 작업 메시지

  // 백업·복원 도중 페이지를 닫으려 하면 경고
  useEffect(() => {
    if (!busy) return
    const warn = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [busy])

  return (
    <section>
      <PageHeader title="백업" description="기록을 파일로 저장하고 다시 불러오기" />
      {busy && (
        <p role="status" className="sticky top-2 z-10 mb-4 rounded-lg bg-neutral-900 px-3 py-2 text-sm text-white dark:bg-white dark:text-neutral-900">
          {busy} · 끝날 때까지 화면을 닫지 마세요
        </p>
      )}
      <div className="flex flex-col gap-8">
        <UsageSection />
        <BackupSection busy={busy} setBusy={setBusy} />
        <RestoreSection busy={busy} setBusy={setBusy} />
      </div>
    </section>
  )
}

function UsageSection() {
  const usage = useLoad(fetchUsage, [])
  const u = usage.data
  return (
    <Card title="저장 공간" description={`무료 플랜 한도. 모든 사용자가 함께 쓰며 ${WARN_RATIO * 100}%를 넘으면 모든 화면에 경고가 뜹니다.`}>
      {usage.loading && <p className="text-sm text-neutral-500">불러오는 중…</p>}
      {usage.error && <p className="text-sm text-red-600 dark:text-red-400">사용량 확인 실패: {usage.error}</p>}
      {u && (
        <>
          <UsageBar label="사진 · R2" limit={R2_LIMIT} parts={split(u.r2.total, u.r2.mine)} />
          {u.storage.total > 0 && (
            <UsageBar label="예전 사진 · Supabase" limit={STORAGE_LIMIT} parts={split(u.storage.total, u.storage.mine)} />
          )}
          <UsageBar
            label="데이터베이스 (기록)"
            limit={DB_LIMIT}
            parts={[...split(u.db.rows, u.db.mine), { kind: 'common', bytes: Math.max(0, u.db.total - u.db.rows) }]}
          />
          <p className="text-xs text-neutral-400">데이터베이스의 공통 공간은 시스템·인덱스처럼 사용자별로 나눌 수 없는 부분입니다.</p>
        </>
      )}
    </Card>
  )
}

type UsagePart = { kind: 'mine' | 'others' | 'common'; bytes: number }

const split = (total: number, mine: number): UsagePart[] => [
  { kind: 'mine', bytes: mine },
  { kind: 'others', bytes: Math.max(0, total - mine) },
]

const PART_LABEL: Record<UsagePart['kind'], string> = { mine: '나', others: '다른 사용자', common: '공통' }

// 한도에 가까우면 붉은 계열로 바꾼다
function partColor(kind: UsagePart['kind'], warn: boolean) {
  if (kind === 'mine') return warn ? 'bg-red-600' : 'bg-neutral-900 dark:bg-white'
  if (kind === 'others') return warn ? 'bg-red-400' : 'bg-neutral-500 dark:bg-neutral-400'
  return warn ? 'bg-red-200 dark:bg-red-900' : 'bg-neutral-300 dark:bg-neutral-600'
}

// 막대 전체 길이 = 무료 한도, 그 안에 나 / 다른 사용자 (/ 공통)을 이어서 칠한다
function UsageBar({ label, limit, parts }: { label: string; limit: number; parts: UsagePart[] }) {
  const used = parts.reduce((n, p) => n + p.bytes, 0)
  const ratio = Math.min(1, used / limit)
  const warn = ratio >= WARN_RATIO
  return (
    <div className="text-sm">
      <div className="flex justify-between">
        <span className="font-semibold">{label}</span>
        <span className={warn ? 'font-semibold text-red-600 dark:text-red-400' : 'text-neutral-500'}>
          {formatBytes(used)} / {formatBytes(limit)} ({Math.round(ratio * 100)}%)
        </span>
      </div>
      <div className="mt-1 flex h-2 overflow-hidden rounded-full bg-neutral-100 dark:bg-neutral-800">
        {parts.map((p) => (
          <div key={p.kind} className={`h-full ${partColor(p.kind, warn)}`} style={{ width: `${Math.min(1, p.bytes / limit) * 100}%` }} />
        ))}
      </div>
      <ul className="mt-1 flex flex-wrap gap-x-3 text-xs text-neutral-500">
        {parts.map((p) => (
          <li key={p.kind} className="flex items-center gap-1">
            <span className={`inline-block size-2 rounded-full ${partColor(p.kind, warn)}`} />
            {PART_LABEL[p.kind]} {formatBytes(p.bytes)}
          </li>
        ))}
      </ul>
    </div>
  )
}

interface BusyProps {
  busy: string | null
  setBusy: (message: string | null) => void
}

function BackupSection({ busy, setBusy }: BusyProps) {
  const counts = useLoad(countRecords, [])
  const [selected, setSelected] = useState<BackupCategory[]>(CATEGORIES.map((c) => c.key))
  const [result, setResult] = useState<BackupResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleBackup() {
    setError(null)
    setResult(null)
    try {
      // 저장 위치를 먼저 고른다 (브라우저 저장 대화상자는 클릭 직후에만 열 수 있음)
      const sink = await openSink(backupFileName())
      if (!sink) return
      setBusy('백업 준비 중…')
      const categories = CATEGORIES.map((c) => c.key).filter((k) => selected.includes(k))
      setResult(await createBackup(sink, categories, setBusy))
    } catch (e) {
      setError(errorText(e))
    } finally {
      setBusy(null)
    }
  }

  return (
    <Card title="백업" description="고른 항목을 ZIP 파일 하나로 저장합니다. 저장할 위치를 고를 수 있습니다.">
      <CategoryChecks
        selected={selected}
        onChange={setSelected}
        disabled={!!busy}
        detail={(k) => (counts.data ? `${counts.data[k]}건` : counts.loading ? '…' : '')}
      />
      {counts.error && <p className="text-sm text-red-600 dark:text-red-400">기록 수 확인 실패: {counts.error}</p>}
      <button className={primaryClass} disabled={!!busy || selected.length === 0} onClick={() => void handleBackup()}>
        백업 파일 저장
      </button>
      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
      {result && (
        <div className="rounded-lg bg-neutral-50 p-3 text-sm dark:bg-neutral-900">
          <p className="font-semibold">백업을 저장했습니다.</p>
          <ul className="mt-1 text-neutral-600 dark:text-neutral-400">
            {result.manifest.categories.map((k) => {
              const c = result.manifest.counts[k]
              return (
                <li key={k}>
                  {CATEGORY_LABEL[k]} {c?.records ?? 0}건{c?.images ? ` · 사진 ${c.images}장` : ''}
                </li>
              )
            })}
          </ul>
          <Warnings items={result.warnings} />
        </div>
      )}
    </Card>
  )
}

function RestoreSection({ busy, setBusy }: BusyProps) {
  const { session } = useAuth()
  const [backup, setBackup] = useState<LoadedBackup | null>(null)
  const [selected, setSelected] = useState<BackupCategory[]>([])
  const [results, setResults] = useState<RestoreResult[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleFile(file: File | undefined) {
    if (!file) return
    setError(null)
    setBackup(null)
    setResults(null)
    setBusy('백업 파일 확인 중…')
    try {
      const loaded = await readBackup(file)
      setBackup(loaded)
      setSelected(loaded.previews.filter((p) => p.added > 0).map((p) => p.category))
    } catch (e) {
      setError(errorText(e))
    } finally {
      setBusy(null)
    }
  }

  async function handleRestore() {
    if (!backup || !session) return
    const count = backup.previews.filter((p) => selected.includes(p.category)).reduce((n, p) => n + p.added, 0)
    if (!confirm(`${count}건을 복원할까요? 이미 있는 기록은 건너뛰고 바꾸지 않습니다.`)) return
    setError(null)
    setBusy('복원 준비 중…')
    try {
      setResults(await restoreBackup(session.user.id, backup, selected, setBusy))
      setBackup(null)
    } catch (e) {
      setError(errorText(e))
    } finally {
      setBusy(null)
    }
  }

  const available = backup?.previews.map((p) => p.category) ?? []

  return (
    <Card title="복원" description="백업 파일의 기록을 원래 날짜·사진·태그 그대로 되살립니다. 같은 기록(같은 id)이 이미 있으면 건너뜁니다.">
      <label className={`${secondaryClass} cursor-pointer ${busy ? 'pointer-events-none opacity-50' : ''}`}>
        백업 파일 선택
        <input
          type="file"
          accept=".zip,application/zip"
          className="sr-only"
          disabled={!!busy}
          onChange={(e) => {
            void handleFile(e.target.files?.[0])
            e.target.value = '' // 같은 파일을 다시 골라도 onChange가 오도록
          }}
        />
      </label>
      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

      {backup && (
        <>
          <p className="text-sm text-neutral-500">{new Date(backup.manifest.exported_at).toLocaleString('ko-KR')}에 만든 백업</p>
          <CategoryChecks
            selected={selected}
            onChange={setSelected}
            disabled={!!busy}
            only={available}
            detail={(k) => {
              const p = backup.previews.find((x) => x.category === k)!
              const skip = p.existing + p.conflicts
              return `새로 추가 ${p.added}건${skip ? ` · 건너뜀 ${skip}건` : ''}`
            }}
            extra={(k) => {
              const p = backup.previews.find((x) => x.category === k)!
              return (
                <>
                  백업 {p.total}건{p.images ? ` · 사진 ${p.images}장` : ''}
                  {p.from && p.to && ` · ${formatDate(p.from)} ~ ${formatDate(p.to)}`}
                  {p.existing > 0 && ` · 이미 있음 ${p.existing}`}
                  {p.conflicts > 0 && ` · 같은 날 같은 끼니 있음 ${p.conflicts}`}
                </>
              )
            }}
          />
          <button
            className={primaryClass}
            disabled={!!busy || backup.previews.filter((p) => selected.includes(p.category)).every((p) => p.added === 0)}
            onClick={() => void handleRestore()}
          >
            복원 시작
          </button>
        </>
      )}

      {results && (
        <div className="rounded-lg bg-neutral-50 p-3 text-sm dark:bg-neutral-900">
          <p className="font-semibold">복원을 마쳤습니다.</p>
          <ul className="mt-1 text-neutral-600 dark:text-neutral-400">
            {results.map((r) => (
              <li key={r.category}>
                {CATEGORY_LABEL[r.category]}: 추가 {r.added}건 · 건너뜀 {r.skipped}건
                {r.failed.length > 0 && <span className="text-red-600 dark:text-red-400"> · 실패 {r.failed.length}건</span>}
              </li>
            ))}
          </ul>
          <Warnings items={results.flatMap((r) => r.failed)} title="실패한 기록 (같은 파일로 다시 복원하면 이것만 다시 시도합니다)" />
        </div>
      )}
    </Card>
  )
}

function Card({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return (
    <div className="rounded-xl border border-neutral-200 p-4 dark:border-neutral-800">
      <h2 className="text-lg font-bold">{title}</h2>
      <p className="mt-1 mb-4 text-sm text-neutral-500">{description}</p>
      <div className="flex flex-col gap-3">{children}</div>
    </div>
  )
}

function CategoryChecks({
  selected,
  onChange,
  disabled,
  only,
  detail,
  extra,
}: {
  selected: BackupCategory[]
  onChange: (v: BackupCategory[]) => void
  disabled: boolean
  only?: BackupCategory[] // 이 항목들만 보여준다
  detail: (k: BackupCategory) => string
  extra?: (k: BackupCategory) => ReactNode
}) {
  return (
    <div className="flex flex-col gap-1.5">
      {CATEGORIES.filter((c) => !only || only.includes(c.key)).map((c) => (
        <label key={c.key} className="flex cursor-pointer items-start gap-2.5 rounded-lg px-1 py-1 text-sm">
          <input
            type="checkbox"
            className="mt-0.5 size-4 accent-neutral-900 dark:accent-white"
            disabled={disabled}
            checked={selected.includes(c.key)}
            onChange={(e) => onChange(e.target.checked ? [...selected, c.key] : selected.filter((k) => k !== c.key))}
          />
          <span className="min-w-0">
            <span className="font-semibold">{c.label}</span>
            <span className="ml-2 text-neutral-500">{detail(c.key)}</span>
            {extra && <span className="block text-xs text-neutral-400">{extra(c.key)}</span>}
          </span>
        </label>
      ))}
    </div>
  )
}

function Warnings({ items, title = '확인할 내용' }: { items: string[]; title?: string }) {
  if (items.length === 0) return null
  return (
    <details className="mt-2">
      <summary className="cursor-pointer text-red-600 dark:text-red-400">
        {title} ({items.length})
      </summary>
      <ul className="mt-1 list-disc pl-5 text-xs text-neutral-500">
        {items.map((w, i) => (
          <li key={i}>{w}</li>
        ))}
      </ul>
    </details>
  )
}

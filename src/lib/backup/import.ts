import { syncTags } from '../entries.ts'
import { imageExt, imagePath, removeImages, uploadBackupImage } from '../images.ts'
import { supabase } from '../supabase.ts'
import { clearLoadCache } from '../useLoad.ts'
import { existingIds, fetchAll } from './db.ts'
import {
  BACKUP_FORMAT,
  BACKUP_VERSION,
  CATEGORY_FOLDER,
  CATEGORY_LABEL,
  entriesPath,
  EXERCISES_PATH,
  MANIFEST_PATH,
  MEALS_PATH,
  moodsPath,
  type BackupCategory,
  type BackupEntry,
  type BackupExercise,
  type BackupManifest,
  type BackupMeal,
  type BackupMood,
} from './format.ts'
import { ZipReader } from './zip.ts'

export interface CategoryPreview {
  category: BackupCategory
  total: number // 백업에 든 기록 수
  images: number
  added: number // 새로 추가될 기록 수
  existing: number // 같은 id가 이미 있어 건너뛸 기록 수
  conflicts: number // 같은 날짜·끼니(아침·점심·저녁)나 같은 날짜의 컨디션이 이미 있어 건너뛸 기록 수
  from: string | null // 기록 날짜 범위
  to: string | null
}

export interface LoadedBackup {
  manifest: BackupManifest
  previews: CategoryPreview[]
  reader: ZipReader
  entries: Partial<Record<BackupCategory, BackupEntry[]>> // 새로 추가할 것만
  meals: BackupMeal[]
  exercises: BackupExercise[]
  moods: Partial<Record<BackupCategory, BackupMood[]>> // 새로 추가할 것만
}

function dateRange(dates: string[]) {
  if (dates.length === 0) return { from: null, to: null }
  const sorted = [...dates].sort()
  return { from: sorted[0], to: sorted[sorted.length - 1] }
}

// 백업 파일을 읽고, DB와 비교해 항목별로 무엇이 추가되고 무엇을 건너뛸지 계산한다. (DB는 바꾸지 않음)
export async function readBackup(file: Blob): Promise<LoadedBackup> {
  const reader = await ZipReader.open(file)
  if (!reader.has(MANIFEST_PATH)) throw new Error('생활기록 백업 파일이 아닙니다. (manifest.json 없음)')
  const manifest = await reader.readJson<BackupManifest>(MANIFEST_PATH)
  if (manifest.format !== BACKUP_FORMAT) throw new Error('생활기록 백업 파일이 아닙니다.')
  if (manifest.version > BACKUP_VERSION) throw new Error('더 새로운 버전의 앱에서 만든 백업입니다. 앱을 업데이트하세요.')

  const loaded: LoadedBackup = { manifest, previews: [], reader, entries: {}, meals: [], exercises: [], moods: {} }
  for (const category of manifest.categories) {
    if (category === 'health') {
      const meals = await reader.readJson<BackupMeal[]>(MEALS_PATH)
      const exercises = await reader.readJson<BackupExercise[]>(EXERCISES_PATH)
      const existingMeals = await existingIds('meal_logs', meals.map((m) => m.id))
      const existingExercises = await existingIds('exercise_logs', exercises.map((e) => e.id))
      const newMeals = meals.filter((m) => !existingMeals.has(m.id))

      // 아침·점심·저녁은 하루 한 건이라, 다른 id로 같은 날짜·끼니가 이미 있으면 넣을 수 없다.
      const mains = newMeals.filter((m) => m.meal !== 'snack')
      const taken = new Set<string>()
      if (mains.length > 0) {
        const { from, to } = dateRange(mains.map((m) => m.log_date))
        const rows = await fetchAll<{ log_date: string; meal: string }>((a, b) =>
          supabase
            .from('meal_logs')
            .select('log_date, meal')
            .neq('meal', 'snack')
            .gte('log_date', from!)
            .lte('log_date', to!)
            .order('id')
            .range(a, b),
        )
        for (const r of rows) taken.add(`${r.log_date}|${r.meal}`)
      }
      loaded.meals = newMeals.filter((m) => m.meal === 'snack' || !taken.has(`${m.log_date}|${m.meal}`))
      loaded.exercises = exercises.filter((e) => !existingExercises.has(e.id))

      const total = meals.length + exercises.length
      loaded.previews.push({
        category,
        total,
        images: 0,
        added: loaded.meals.length + loaded.exercises.length,
        existing: existingMeals.size + existingExercises.size,
        conflicts: newMeals.length - loaded.meals.length,
        ...dateRange([...meals.map((m) => m.log_date), ...exercises.map((e) => e.log_date)]),
      })
      continue
    }

    const entries = (await reader.readJson<BackupEntry[]>(entriesPath(category))).filter((e) => e.type === category)
    const existing = await existingIds('entries', entries.map((e) => e.id))
    loaded.entries[category] = entries.filter((e) => !existing.has(e.id))

    // 일기·묵상에는 날짜별 마음 기록이 함께 들어 있다. 종류별 하루 한 건이라 다른 id로 같은 날짜가 이미 있으면 건너뛴다.
    const kind = category === 'photo' ? null : category
    const moods =
      kind && reader.has(moodsPath(kind))
        ? (await reader.readJson<BackupMood[]>(moodsPath(kind))).map((m) => ({ ...m, kind: m.kind ?? 'diary' })).filter((m) => m.kind === kind)
        : []
    const existingMoods = await existingIds('daily_moods', moods.map((m) => m.id))
    const newMoods = moods.filter((m) => !existingMoods.has(m.id))
    const takenDates = new Set<string>()
    if (newMoods.length > 0) {
      const { from, to } = dateRange(newMoods.map((m) => m.mood_date))
      const rows = await fetchAll<{ mood_date: string }>((a, b) =>
        supabase.from('daily_moods').select('mood_date').eq('kind', kind!).gte('mood_date', from!).lte('mood_date', to!).order('id').range(a, b),
      )
      for (const r of rows) takenDates.add(r.mood_date)
    }
    loaded.moods[category] = newMoods.filter((m) => !takenDates.has(m.mood_date))

    loaded.previews.push({
      category,
      total: entries.length + moods.length,
      images: entries.reduce((n, e) => n + e.images.length, 0),
      added: loaded.entries[category].length + loaded.moods[category]!.length,
      existing: existing.size + existingMoods.size,
      conflicts: newMoods.length - loaded.moods[category]!.length,
      ...dateRange([...entries.map((e) => e.record_date), ...moods.map((m) => m.mood_date)]),
    })
  }
  return loaded
}

export interface RestoreResult {
  category: BackupCategory
  added: number
  skipped: number // 이미 있음 + 같은 끼니 있음
  failed: string[] // 실패한 기록 설명
}

// 미리보기에서 "새로 추가"로 계산된 기록만 원래 id 그대로 넣는다. 기존 데이터는 바꾸지 않는다.
export async function restoreBackup(
  userId: string,
  backup: LoadedBackup,
  categories: BackupCategory[],
  onProgress: (message: string) => void,
) {
  const results: RestoreResult[] = []
  for (const category of categories) {
    const preview = backup.previews.find((p) => p.category === category)
    if (!preview) continue
    const result: RestoreResult = { category, added: 0, skipped: preview.existing + preview.conflicts, failed: [] }
    results.push(result)
    const label = CATEGORY_LABEL[category]

    if (category === 'health') {
      onProgress(`${label} 복원 중…`)
      await insertRows('meal_logs', backup.meals, (m) => `식단 ${m.log_date} ${m.meal}`, result)
      await insertRows('exercise_logs', backup.exercises, (e) => `운동 ${e.log_date} ${e.kind}`, result)
      continue
    }

    const entries = backup.entries[category] ?? []
    for (const [i, entry] of entries.entries()) {
      onProgress(`${label} 복원 중 (${i + 1}/${entries.length})`)
      try {
        await restoreEntry(userId, backup.reader, CATEGORY_FOLDER[category], entry)
        result.added++
      } catch (e) {
        result.failed.push(`${entry.record_date} "${entry.title || '제목 없음'}": ${e instanceof Error ? e.message : e}`)
      }
    }
    await insertRows('daily_moods', backup.moods[category] ?? [], (m) => `마음 기록 ${m.mood_date}`, result)
  }
  clearLoadCache()
  return results
}

// 기록 → 태그 → 사진 순서로 넣는다. 중간에 실패하면 넣은 것을 지워 반쯤 복원된 기록이 남지 않게 한다.
async function restoreEntry(userId: string, reader: ZipReader, folder: string, entry: BackupEntry) {
  const { tags, images, ...fields } = entry
  const { error } = await supabase.from('entries').insert(fields)
  if (error) throw error

  const uploaded: string[] = []
  try {
    await syncTags(entry.id, tags)
    for (const img of images) {
      const path = imagePath(userId, entry.id, img.id, imageExt(img.file))
      uploaded.push(path) // 원본만 올라가고 썸네일에서 실패해도 지울 수 있게 먼저 넣는다
      const size = await uploadBackupImage(path, await reader.read(`${folder}/${img.file}`))
      const { error } = await supabase.from('entry_images').insert({
        id: img.id,
        entry_id: entry.id,
        storage_path: path,
        size_bytes: size,
        caption: img.caption,
        sort_order: img.sort_order,
        created_at: img.created_at,
      })
      if (error) throw error
    }
  } catch (e) {
    await supabase.from('entries').delete().eq('id', entry.id) // 사진·태그 연결은 cascade로 함께 삭제
    await removeImages(uploaded).catch(() => {})
    throw e
  }
}

// 100건씩 넣고, 묶음이 실패하면 한 건씩 다시 넣어 실패한 기록만 골라낸다.
async function insertRows<T extends { id: string }>(
  table: 'meal_logs' | 'exercise_logs' | 'daily_moods',
  rows: T[],
  describe: (row: T) => string,
  result: RestoreResult,
) {
  for (let i = 0; i < rows.length; i += 100) {
    const chunk = rows.slice(i, i + 100)
    const { error } = await supabase.from(table).insert(chunk)
    if (!error) {
      result.added += chunk.length
      continue
    }
    for (const row of chunk) {
      const { error } = await supabase.from(table).insert(row)
      if (error) result.failed.push(`${describe(row)}: ${error.message}`)
      else result.added++
    }
  }
}

import { downloadImage, imageExt } from '../images.ts'
import { supabase } from '../supabase.ts'
import { fetchAll } from './db.ts'
import {
  BACKUP_FORMAT,
  BACKUP_VERSION,
  CATEGORY_FOLDER,
  CATEGORY_LABEL,
  entriesPath,
  EXERCISES_PATH,
  MANIFEST_PATH,
  MEALS_PATH,
  MOODS_PATH,
  type BackupCategory,
  type BackupEntry,
  type BackupExercise,
  type BackupManifest,
  type BackupMeal,
  type BackupMood,
} from './format.ts'
import type { ByteSink } from './save.ts'
import { ZipWriter } from './zip.ts'

interface EntryRow extends Omit<BackupEntry, 'tags' | 'images'> {
  entry_images: { id: string; storage_path: string; caption: string; sort_order: number; created_at: string }[]
  entry_tags: { tags: { name: string } | null }[]
}

const ENTRY_SELECT =
  'id, type, title, content, record_date, meta, created_at, updated_at, entry_images(id, storage_path, caption, sort_order, created_at), entry_tags(tags(name))'

// 백업 화면에 보여줄 항목별 기록 수
export async function countRecords(): Promise<Record<BackupCategory, number>> {
  const count = async (query: PromiseLike<{ count: number | null; error: unknown }>) => {
    const { count, error } = await query
    if (error) throw error
    return count ?? 0
  }
  const entries = (type: string) => supabase.from('entries').select('id', { count: 'exact', head: true }).eq('type', type)
  const [diary, photo, meditation, meals, exercises, moods] = await Promise.all([
    count(entries('diary')),
    count(entries('photo')),
    count(entries('meditation')),
    count(supabase.from('meal_logs').select('id', { count: 'exact', head: true })),
    count(supabase.from('exercise_logs').select('id', { count: 'exact', head: true })),
    count(supabase.from('daily_moods').select('id', { count: 'exact', head: true })),
  ])
  return { diary: diary + moods, photo, meditation, health: meals + exercises }
}

export interface BackupResult {
  manifest: BackupManifest
  warnings: string[] // 저장소에서 찾지 못해 빠진 사진 등
}

// 고른 항목을 ZIP으로 sink에 쓴다. 실패하면 sink를 abort하고 오류를 그대로 던진다.
export async function createBackup(sink: ByteSink, categories: BackupCategory[], onProgress: (message: string) => void) {
  const zip = new ZipWriter(sink)
  const manifest: BackupManifest = {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exported_at: new Date().toISOString(),
    categories,
    counts: {},
  }
  const warnings: string[] = []

  try {
    for (const category of categories) {
      const label = CATEGORY_LABEL[category]
      onProgress(`${label} 불러오는 중…`)
      if (category === 'health') {
        const meals = await fetchAll<BackupMeal>((from, to) =>
          supabase
            .from('meal_logs')
            .select('id, log_date, meal, foods, symptoms, severity, note, created_at, updated_at')
            .order('id')
            .range(from, to),
        )
        const exercises = await fetchAll<BackupExercise>((from, to) =>
          supabase.from('exercise_logs').select('id, log_date, kind, minutes, intensity, memo, created_at').order('id').range(from, to),
        )
        await zip.addJson(MEALS_PATH, meals)
        await zip.addJson(EXERCISES_PATH, exercises)
        manifest.counts.health = { records: meals.length + exercises.length, images: 0 }
        continue
      }

      const rows = await fetchAll<EntryRow>((from, to) =>
        supabase.from('entries').select(ENTRY_SELECT).eq('type', category).order('id').range(from, to),
      )
      const total = rows.reduce((n, r) => n + r.entry_images.length, 0)
      let done = 0
      const entries: BackupEntry[] = []
      for (const { entry_images, entry_tags, ...row } of rows) {
        const images: BackupEntry['images'] = []
        for (const img of [...entry_images].sort((a, b) => a.sort_order - b.sort_order)) {
          onProgress(`${label} 사진 받는 중 (${++done}/${total})`)
          const file = `images/${row.id}/${img.id}.${imageExt(img.storage_path)}`
          try {
            await zip.addFile(`${CATEGORY_FOLDER[category]}/${file}`, await downloadImage(img.storage_path))
          } catch (e) {
            warnings.push(`${label} ${row.record_date} "${row.title || '제목 없음'}": 사진 1장을 받지 못해 제외 (${e instanceof Error ? e.message : e})`)
            continue
          }
          images.push({ id: img.id, file, caption: img.caption, sort_order: img.sort_order, created_at: img.created_at })
        }
        entries.push({ ...row, meta: row.meta ?? {}, tags: entry_tags.flatMap((t) => (t.tags ? [t.tags.name] : [])).sort(), images })
      }
      await zip.addJson(entriesPath(category), entries)
      let moodCount = 0
      if (category === 'diary') {
        const moods = await fetchAll<BackupMood>((from, to) =>
          supabase.from('daily_moods').select('id, mood_date, score, emotions, created_at, updated_at').order('id').range(from, to),
        )
        await zip.addJson(MOODS_PATH, moods)
        moodCount = moods.length
      }
      manifest.counts[category] = { records: entries.length + moodCount, images: entries.reduce((n, e) => n + e.images.length, 0) }
    }

    onProgress('파일 마무리 중…')
    await zip.addJson(MANIFEST_PATH, manifest)
    await zip.finish()
    await sink.close()
  } catch (e) {
    await sink.abort().catch(() => {})
    throw e
  }
  return { manifest, warnings } satisfies BackupResult
}

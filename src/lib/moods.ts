import { supabase } from './supabase.ts'
import { clearLoadCache } from './useLoad.ts'

// 날짜별 마음 기록: 점수(1~5) 하나와 감정 여러 개 (012·013 마이그레이션)
// 일기와 묵상은 따로 기록한다. 점수 척도는 같고 감정 목록만 다르다.
export type MoodKind = 'diary' | 'meditation'

export const MOOD_KIND_LABEL: Record<MoodKind, string> = { diary: '컨디션', meditation: '마음 상태' }

// 높은 점수부터
export const MOOD_SCORES: { score: number; emoji: string; label: string }[] = [
  { score: 5, emoji: '😄', label: '최고' },
  { score: 4, emoji: '🙂', label: '좋음' },
  { score: 3, emoji: '😐', label: '보통' },
  { score: 2, emoji: '😔', label: '별로' },
  { score: 1, emoji: '😫', label: '최악' },
]

export interface Emotion {
  key: string
  emoji: string
  label: string
}

// DB 제약(013 마이그레이션)과 같게 맞춘다
export const EMOTION_SETS: Record<MoodKind, Emotion[]> = {
  diary: [
    { key: 'happy', emoji: '😊', label: '행복' },
    { key: 'calm', emoji: '😌', label: '평온' },
    { key: 'excited', emoji: '🤩', label: '설렘' },
    { key: 'grateful', emoji: '🙏', label: '감사' },
    { key: 'proud', emoji: '😎', label: '뿌듯' },
    { key: 'tired', emoji: '😪', label: '피곤' },
    { key: 'stressed', emoji: '😤', label: '스트레스' },
    { key: 'anxious', emoji: '😰', label: '불안' },
    { key: 'sad', emoji: '😢', label: '슬픔' },
    { key: 'angry', emoji: '😠', label: '화남' },
    { key: 'lonely', emoji: '🥺', label: '외로움' },
    { key: 'sick', emoji: '🤒', label: '아픔' },
  ],
  meditation: [
    { key: 'grace', emoji: '🙌', label: '은혜' },
    { key: 'thanks', emoji: '🙏', label: '감사' },
    { key: 'peace', emoji: '🕊️', label: '평안' },
    { key: 'joy', emoji: '😊', label: '기쁨' },
    { key: 'hope', emoji: '🌅', label: '소망' },
    { key: 'comfort', emoji: '🤗', label: '위로' },
    { key: 'resolve', emoji: '💪', label: '결단' },
    { key: 'repent', emoji: '😔', label: '회개' },
    { key: 'thirst', emoji: '🥺', label: '갈급함' },
    { key: 'dry', emoji: '🏜️', label: '메마름' },
    { key: 'fear', emoji: '😨', label: '두려움' },
    { key: 'struggle', emoji: '😣', label: '어려움' },
  ],
}

export const SCORE_INFO = Object.fromEntries(MOOD_SCORES.map((m) => [m.score, m])) as Record<number, (typeof MOOD_SCORES)[number]>
export const EMOTION_INFO: Record<string, Emotion> = Object.fromEntries(
  Object.values(EMOTION_SETS).flatMap((set) => set.map((e) => [e.key, e])),
)

export interface DailyMood {
  mood_date: string // YYYY-MM-DD
  score: number | null
  emotions: string[]
}

const COLUMNS = 'mood_date, score, emotions'

export async function listMoods(kind: MoodKind, from: string, to: string) {
  const { data, error } = await supabase
    .from('daily_moods')
    .select(COLUMNS)
    .eq('kind', kind)
    .gte('mood_date', from)
    .lte('mood_date', to)
    .order('mood_date')
  if (error) throw error
  return data as DailyMood[]
}

// 그날의 기록을 저장한다. 점수와 감정이 모두 비면 행을 지운다.
export async function saveMood(kind: MoodKind, mood: DailyMood) {
  clearLoadCache()
  if (mood.score === null && mood.emotions.length === 0) {
    const { error } = await supabase.from('daily_moods').delete().eq('kind', kind).eq('mood_date', mood.mood_date)
    if (error) throw error
    return
  }
  const { error } = await supabase.from('daily_moods').upsert({ kind, ...mood }, { onConflict: 'user_id,kind,mood_date' })
  if (error) throw error
}

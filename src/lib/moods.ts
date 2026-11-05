import { supabase } from './supabase.ts'
import { clearLoadCache } from './useLoad.ts'

// 날짜별 컨디션: 점수(1~5) 하나와 감정 여러 개 (012 마이그레이션)
export type EmotionKey =
  | 'happy'
  | 'calm'
  | 'excited'
  | 'grateful'
  | 'proud'
  | 'tired'
  | 'stressed'
  | 'anxious'
  | 'sad'
  | 'angry'
  | 'lonely'
  | 'sick'

// 높은 점수부터
export const MOOD_SCORES: { score: number; emoji: string; label: string }[] = [
  { score: 5, emoji: '😄', label: '최고' },
  { score: 4, emoji: '🙂', label: '좋음' },
  { score: 3, emoji: '😐', label: '보통' },
  { score: 2, emoji: '😔', label: '별로' },
  { score: 1, emoji: '😫', label: '최악' },
]

// DB 제약(012 마이그레이션)과 같게 맞춘다
export const EMOTIONS: { key: EmotionKey; emoji: string; label: string }[] = [
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
]

export const SCORE_INFO = Object.fromEntries(MOOD_SCORES.map((m) => [m.score, m])) as Record<number, (typeof MOOD_SCORES)[number]>
export const EMOTION_INFO = Object.fromEntries(EMOTIONS.map((e) => [e.key, e])) as Record<EmotionKey, (typeof EMOTIONS)[number]>

export interface DailyMood {
  mood_date: string // YYYY-MM-DD
  score: number | null
  emotions: EmotionKey[]
}

const COLUMNS = 'mood_date, score, emotions'

export async function listMoods(from: string, to: string) {
  const { data, error } = await supabase.from('daily_moods').select(COLUMNS).gte('mood_date', from).lte('mood_date', to).order('mood_date')
  if (error) throw error
  return data as DailyMood[]
}

// 그날의 컨디션을 저장한다. 점수와 감정이 모두 비면 행을 지운다.
export async function saveMood(mood: DailyMood) {
  clearLoadCache()
  if (mood.score === null && mood.emotions.length === 0) {
    const { error } = await supabase.from('daily_moods').delete().eq('mood_date', mood.mood_date)
    if (error) throw error
    return
  }
  const { error } = await supabase.from('daily_moods').upsert(mood, { onConflict: 'user_id,mood_date' })
  if (error) throw error
}

-- =============================================================
-- 013: 묵상 탭에도 날짜별 마음 상태를 따로 기록한다.
-- daily_moods에 kind('diary' | 'meditation')를 두고, 종류마다 하루 한 행.
-- 점수(1~5)는 같은 척도를 쓰고, 감정은 종류별 목록(src/lib/moods.ts EMOTION_SETS)과 같은 값만 허용한다.
-- 기존 행은 모두 일기(diary)로 남는다.
--
-- 012를 먼저 실행한 뒤 Supabase 대시보드 > SQL Editor에 붙여넣고 실행한다. 여러 번 실행해도 안전하다.
-- =============================================================

alter table public.daily_moods
  add column if not exists kind text not null default 'diary';

alter table public.daily_moods drop constraint if exists daily_moods_kind_check;
alter table public.daily_moods
  add constraint daily_moods_kind_check check (kind in ('diary', 'meditation'));

-- 하루 한 행 → 종류별 하루 한 행
alter table public.daily_moods drop constraint if exists daily_moods_user_id_mood_date_key;
alter table public.daily_moods drop constraint if exists daily_moods_user_kind_date_key;
alter table public.daily_moods
  add constraint daily_moods_user_kind_date_key unique (user_id, kind, mood_date);

alter table public.daily_moods drop constraint if exists daily_moods_emotions_check;
alter table public.daily_moods
  add constraint daily_moods_emotions_check
  check (
    (kind = 'diary' and emotions <@ array[
      'happy', 'calm', 'excited', 'grateful', 'proud', 'tired',
      'stressed', 'anxious', 'sad', 'angry', 'lonely', 'sick'
    ]::text[])
    or
    (kind = 'meditation' and emotions <@ array[
      'grace', 'thanks', 'peace', 'joy', 'hope', 'comfort',
      'resolve', 'repent', 'thirst', 'dry', 'fear', 'struggle'
    ]::text[])
  );

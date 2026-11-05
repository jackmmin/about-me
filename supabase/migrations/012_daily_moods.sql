-- =============================================================
-- 012: 날짜별 컨디션(기분) 기록. 하루에 한 행, 일기가 없는 날도 지정할 수 있다.
-- score: 1 최악 ~ 5 최고 (비워둘 수 있음)
-- emotions: 그날 느낀 감정 여러 개. 앱의 목록(src/lib/moods.ts EMOTIONS)과 같은 값만 허용한다.
--
-- Supabase 대시보드 > SQL Editor에 붙여넣고 실행한다. 여러 번 실행해도 안전하다.
-- =============================================================

create table if not exists public.daily_moods (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  mood_date  date not null,
  score      smallint check (score between 1 and 5),
  emotions   text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, mood_date)
);

alter table public.daily_moods drop constraint if exists daily_moods_emotions_check;
alter table public.daily_moods
  add constraint daily_moods_emotions_check
  check (emotions <@ array[
    'happy', 'calm', 'excited', 'grateful', 'proud', 'tired',
    'stressed', 'anxious', 'sad', 'angry', 'lonely', 'sick'
  ]::text[]);

drop trigger if exists daily_moods_updated_at on public.daily_moods;
create trigger daily_moods_updated_at
  before update on public.daily_moods
  for each row execute function public.set_updated_at();

revoke all on public.daily_moods from anon;
grant select, insert, update, delete on public.daily_moods to authenticated;

-- 본인 + aal2(OTP 인증 완료) 세션만
alter table public.daily_moods enable row level security;
drop policy if exists "owner with mfa" on public.daily_moods;
create policy "owner with mfa" on public.daily_moods
  for all to authenticated
  using ((select auth.uid()) = user_id and (select auth.jwt() ->> 'aal') = 'aal2')
  with check ((select auth.uid()) = user_id and (select auth.jwt() ->> 'aal') = 'aal2');

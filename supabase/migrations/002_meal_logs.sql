-- =============================================================
-- 002: 끼니별 식단·식후 증상 기록 (과민성대장증후군 음식-증상 추적)
-- Supabase 대시보드 > SQL Editor에 붙여넣고 실행한다. 여러 번 실행해도 안전하다.
-- =============================================================

create table if not exists public.meal_logs (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  log_date   date not null default current_date,
  meal       text not null check (meal in ('breakfast', 'lunch', 'dinner', 'snack')),
  foods      text[] not null default '{}',     -- 먹은 음식 (하나씩 분리해 저장해야 음식별 분석이 가능)
  symptoms   text[] not null default '{}'
             check (symptoms <@ array['diarrhea', 'bloating', 'pain', 'gas', 'constipation', 'nausea']::text[]),
  severity   smallint check (severity between 1 and 3),  -- 1 약, 2 중, 3 강
  note       text not null default '',          -- 증상이 나타난 시간 등 메모
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, log_date, meal)              -- 하루 끼니당 한 행
);

create index if not exists meal_logs_user_date_idx on public.meal_logs (user_id, log_date desc);

drop trigger if exists meal_logs_updated_at on public.meal_logs;
create trigger meal_logs_updated_at
  before update on public.meal_logs
  for each row execute function public.set_updated_at();

revoke all on public.meal_logs from anon;
grant select, insert, update, delete on public.meal_logs to authenticated;

-- 본인 + aal2(OTP 인증 완료) 세션만
alter table public.meal_logs enable row level security;
drop policy if exists "owner with mfa" on public.meal_logs;
create policy "owner with mfa" on public.meal_logs
  for all to authenticated
  using ((select auth.uid()) = user_id and (select auth.jwt() ->> 'aal') = 'aal2')
  with check ((select auth.uid()) = user_id and (select auth.jwt() ->> 'aal') = 'aal2');

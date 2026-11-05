-- =============================================================
-- 생활기록 스키마
-- 이후 변경분은 supabase/migrations/ 의 파일을 번호 순서대로 실행한다.
-- Supabase 대시보드 > SQL Editor에 전체를 붙여넣고 한 번에 실행한다.
-- 여러 번 실행해도 안전하도록 작성했다.
--
-- 접근 원칙: 모든 데이터는 "본인 계정 + OTP 인증까지 마친 세션(aal2)"만
-- 읽기/쓰기 가능하다. 비밀번호만 통과한 세션(aal1)이나 비로그인(anon)은 거절된다.
-- =============================================================

-- -------------------------------------------------------------
-- 공통: updated_at 자동 갱신
-- -------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- -------------------------------------------------------------
-- 기록 (일기, 사진)
-- 유형은 추후 확장 시 check 제약에 값을 추가한다.
-- -------------------------------------------------------------
create table if not exists public.entries (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  type        text not null check (type in ('diary', 'photo')),
  title       text not null default '',
  content     text not null default '',            -- 마크다운 본문
  record_date date not null default current_date,  -- 기록 대상 날짜 (작성일과 다를 수 있음)
  meta        jsonb not null default '{}'::jsonb,  -- 유형별 추가 정보 (기분, 날씨, 장소 등)
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists entries_user_date_idx on public.entries (user_id, record_date desc);
create index if not exists entries_user_type_date_idx on public.entries (user_id, type, record_date desc);

drop trigger if exists entries_updated_at on public.entries;
create trigger entries_updated_at
  before update on public.entries
  for each row execute function public.set_updated_at();

-- -------------------------------------------------------------
-- 기록에 붙은 사진 (파일은 Storage 'images' 버킷, 여기는 경로만)
-- -------------------------------------------------------------
create table if not exists public.entry_images (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  entry_id     uuid not null references public.entries (id) on delete cascade,
  storage_path text not null,                -- '{user_id}/{파일명}' 형식
  caption      text not null default '',
  sort_order   int  not null default 0,
  created_at   timestamptz not null default now()
);

create index if not exists entry_images_entry_idx on public.entry_images (entry_id, sort_order);

-- -------------------------------------------------------------
-- 태그
-- -------------------------------------------------------------
create table if not exists public.tags (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name       text not null,
  created_at timestamptz not null default now(),
  unique (user_id, name)
);

create table if not exists public.entry_tags (
  entry_id uuid not null references public.entries (id) on delete cascade,
  tag_id   uuid not null references public.tags (id) on delete cascade,
  user_id  uuid not null default auth.uid() references auth.users (id) on delete cascade,
  primary key (entry_id, tag_id)
);

create index if not exists entry_tags_tag_idx on public.entry_tags (tag_id);

-- -------------------------------------------------------------
-- 건강: 하루 한 행 (수면, 체중·체성분, 걸음 수, 컨디션·식단·병원)
-- -------------------------------------------------------------
create table if not exists public.health_logs (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null default auth.uid() references auth.users (id) on delete cascade,
  log_date        date not null default current_date,

  -- 수면 (전날 밤 취침 ~ 해당 날짜 기상)
  bed_at          timestamptz,
  wake_at         timestamptz,
  sleep_minutes   int check (sleep_minutes between 0 and 1440),
  sleep_quality   smallint check (sleep_quality between 1 and 5),

  -- 체중·체성분
  weight_kg       numeric(5, 2) check (weight_kg > 0),
  body_fat_pct    numeric(4, 1) check (body_fat_pct between 0 and 100),
  muscle_kg       numeric(5, 2) check (muscle_kg > 0),

  -- 활동
  steps           int check (steps >= 0),

  -- 컨디션·식단·병원
  condition_score smallint check (condition_score between 1 and 5),
  meals           text not null default '',
  medications     text not null default '',
  hospital_visit  text not null default '',
  memo            text not null default '',

  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (user_id, log_date)
);

drop trigger if exists health_logs_updated_at on public.health_logs;
create trigger health_logs_updated_at
  before update on public.health_logs
  for each row execute function public.set_updated_at();

-- -------------------------------------------------------------
-- 건강: 운동 (하루 여러 건 가능)
-- -------------------------------------------------------------
create table if not exists public.exercise_logs (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  log_date   date not null default current_date,
  kind       text not null,                 -- 예: 러닝, 웨이트, 수영
  minutes    int  not null check (minutes > 0),
  intensity  smallint check (intensity between 1 and 5),
  memo       text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists exercise_logs_user_date_idx on public.exercise_logs (user_id, log_date desc);

-- -------------------------------------------------------------
-- 권한: anon은 테이블 접근 불가, authenticated만 허용 후 RLS로 다시 제한
-- -------------------------------------------------------------
revoke all on public.entries, public.entry_images, public.tags, public.entry_tags,
              public.health_logs, public.exercise_logs from anon;
grant select, insert, update, delete
   on public.entries, public.entry_images, public.tags, public.entry_tags,
      public.health_logs, public.exercise_logs to authenticated;

-- -------------------------------------------------------------
-- RLS: 본인 + aal2(OTP 인증 완료) 세션만
-- -------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array['entries', 'entry_images', 'tags', 'entry_tags', 'health_logs', 'exercise_logs']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "owner with mfa" on public.%I', t);
    execute format(
      'create policy "owner with mfa" on public.%I
         for all to authenticated
         using ((select auth.uid()) = user_id and (select auth.jwt() ->> ''aal'') = ''aal2'')
         with check ((select auth.uid()) = user_id and (select auth.jwt() ->> ''aal'') = ''aal2'')',
      t
    );
  end loop;
end;
$$;

-- -------------------------------------------------------------
-- Storage: 비공개 'images' 버킷 (10MB, 이미지 형식만)
-- 파일 경로의 첫 폴더가 본인 user_id여야 접근 가능
-- -------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'images', 'images', false, 10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif']
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "images owner with mfa" on storage.objects;
create policy "images owner with mfa" on storage.objects
  for all to authenticated
  using (
    bucket_id = 'images'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and (select auth.jwt() ->> 'aal') = 'aal2'
  )
  with check (
    bucket_id = 'images'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and (select auth.jwt() ->> 'aal') = 'aal2'
  );

-- -------------------------------------------------------------
-- ping: 7일 비활성 일시정지 방지용 (GitHub Actions가 5일 주기로 호출)
-- 데이터는 읽지 않고 현재 시각만 돌려준다.
-- -------------------------------------------------------------
create or replace function public.ping()
returns timestamptz
language sql
stable
set search_path = ''
as $$
  select now();
$$;

revoke all on function public.ping() from public;
grant execute on function public.ping() to anon, authenticated;

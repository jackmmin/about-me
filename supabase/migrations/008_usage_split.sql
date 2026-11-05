-- =============================================================
-- 008: 저장 공간 사용량을 '나 / 다른 사용자'로 나눠 돌려준다
--
-- 사진: 파일이 사용자 폴더별로 있어서 사용자별 합계가 전체와 정확히 맞는다.
-- 데이터베이스: 모든 사용자 행이 같은 테이블에 섞여 있고, 전체 크기에는 시스템 공간·인덱스·
--   수정/삭제 후 남은 빈 공간이 포함된다. 그래서 각 행의 실제 데이터 크기만 사용자별로 합산하고
--   (db_rows_bytes, db_my_bytes), 나머지(db_bytes - db_rows_bytes)는 화면에서 '공통'으로 표시한다.
--
-- ⚠️ 새 버전 앱을 배포하기 전에 실행할 것 (반환 칸 이름이 바뀐다).
-- Supabase 대시보드 > SQL Editor에 붙여넣고 실행한다. 여러 번 실행해도 안전하다.
-- =============================================================

drop function if exists public.storage_usage();

create function public.storage_usage()
returns table (
  storage_bytes    bigint,  -- Supabase Storage (예전 사진), 모든 사용자
  storage_my_bytes bigint,
  r2_bytes         bigint,  -- R2 (새 사진), 모든 사용자
  r2_my_bytes      bigint,
  db_bytes         bigint,  -- 데이터베이스 전체 크기
  db_rows_bytes    bigint,  -- 그중 기록 행 데이터 (모든 사용자)
  db_my_bytes      bigint   -- 그중 내 기록 행 데이터
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
begin
  -- 다른 테이블과 같이 OTP 인증까지 마친 세션만
  if (select auth.jwt() ->> 'aal') is distinct from 'aal2' then
    raise exception 'mfa required' using errcode = '42501';
  end if;

  return query
  with s as (
    select
      coalesce(sum((o.metadata ->> 'size')::bigint), 0)::bigint as total,
      coalesce(sum((o.metadata ->> 'size')::bigint)
        filter (where o.bucket_id = 'images' and (storage.foldername(o.name))[1] = uid::text), 0)::bigint as mine
    from storage.objects o
  ), r as (
    select
      coalesce(sum(i.size_bytes), 0)::bigint as total,
      coalesce(sum(i.size_bytes) filter (where i.user_id = uid), 0)::bigint as mine
    from public.entry_images i
    where i.storage_path like 'r2:%'
  ), rows as (
    select t.user_id, pg_column_size(t.*)::bigint as size from public.entries t
    union all select t.user_id, pg_column_size(t.*) from public.entry_images t
    union all select t.user_id, pg_column_size(t.*) from public.tags t
    union all select t.user_id, pg_column_size(t.*) from public.entry_tags t
    union all select t.user_id, pg_column_size(t.*) from public.meal_logs t
    union all select t.user_id, pg_column_size(t.*) from public.exercise_logs t
  ), d as (
    select
      coalesce(sum(rows.size), 0)::bigint as total,
      coalesce(sum(rows.size) filter (where rows.user_id = uid), 0)::bigint as mine
    from rows
  )
  select s.total, s.mine, r.total, r.mine, pg_database_size(current_database()), d.total, d.mine
  from s, r, d;
end;
$$;

revoke all on function public.storage_usage() from public, anon;
grant execute on function public.storage_usage() to authenticated;

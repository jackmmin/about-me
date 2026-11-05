-- =============================================================
-- 007: 사진 파일을 Cloudflare R2로 저장 (기록 데이터는 그대로 Supabase)
--
-- entry_images.storage_path 접두사로 파일 위치를 구분한다.
--   'r2:{user_id}/{entry_id}/{id}.webp'  → R2 (worker/ 의 Cloudflare Worker가 관리)
--   '{user_id}/{entry_id}/{id}.jpg'      → 예전 사진, Supabase Storage 'images' 버킷
-- R2는 용량을 직접 합산할 수 없어서, 올릴 때 원본+썸네일 크기를 size_bytes에 함께 저장한다.
--
-- ⚠️ 새 버전 앱을 배포하기 전에 실행할 것 (새 앱이 size_bytes 칸에 값을 넣는다).
-- Supabase 대시보드 > SQL Editor에 붙여넣고 실행한다. 여러 번 실행해도 안전하다.
-- =============================================================

alter table public.entry_images
  add column if not exists size_bytes bigint check (size_bytes >= 0);

-- 반환 칸이 바뀌므로 006의 함수를 지우고 다시 만든다
drop function if exists public.storage_usage();

create function public.storage_usage()
returns table (my_bytes bigint, storage_bytes bigint, r2_bytes bigint, db_bytes bigint)
language plpgsql
stable
security definer
set search_path = ''
as $$
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
        filter (where o.bucket_id = 'images' and (storage.foldername(o.name))[1] = (select auth.uid())::text), 0)::bigint as mine
    from storage.objects o
  ), r as (
    select
      coalesce(sum(i.size_bytes), 0)::bigint as total,
      coalesce(sum(i.size_bytes) filter (where i.user_id = (select auth.uid())), 0)::bigint as mine
    from public.entry_images i
    where i.storage_path like 'r2:%'
  )
  select s.mine + r.mine, s.total, r.total, pg_database_size(current_database())
  from s, r;
end;
$$;

revoke all on function public.storage_usage() from public, anon;
grant execute on function public.storage_usage() to authenticated;

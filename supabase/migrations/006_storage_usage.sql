-- =============================================================
-- 006: 저장 공간 사용량 조회 (무료 플랜 한도 경고용)
-- 사용자 여러 명이 같은 프로젝트를 쓰므로, 전체 사용량은 다른 사람 파일까지 합산해야 한다.
-- 그래서 security definer로 실행하되 개별 파일 정보는 돌려주지 않고 합계만 돌려준다.
-- Supabase 대시보드 > SQL Editor에 붙여넣고 실행한다. 여러 번 실행해도 안전하다.
-- =============================================================

create or replace function public.storage_usage()
returns table (my_bytes bigint, total_bytes bigint, db_bytes bigint)
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
  select
    coalesce(sum((o.metadata ->> 'size')::bigint)
      filter (where o.bucket_id = 'images' and (storage.foldername(o.name))[1] = (select auth.uid())::text), 0)::bigint,
    coalesce(sum((o.metadata ->> 'size')::bigint), 0)::bigint,
    pg_database_size(current_database())
  from storage.objects o;
end;
$$;

revoke all on function public.storage_usage() from public, anon;
grant execute on function public.storage_usage() to authenticated;

-- =============================================================
-- 009: 목록 화면용 본문 미리보기
-- 홈·일기·묵상 목록과 검색 결과는 카드에 본문 앞부분만 보여주므로, 본문 전체 대신
-- 앞 500자만 받는다. PostgREST 계산 칸이라 앱에서는 select('content:content_preview')로 쓴다.
-- RLS는 entries 테이블 정책이 그대로 적용된다.
--
-- ⚠️ 새 버전 앱을 배포하기 전에 실행할 것 (새 앱이 이 함수를 조회한다).
-- Supabase 대시보드 > SQL Editor에 붙여넣고 실행한다. 여러 번 실행해도 안전하다.
-- =============================================================

create or replace function public.content_preview(public.entries)
returns text
language sql
stable
set search_path = ''
as $$
  select left($1.content, 500);
$$;

revoke all on function public.content_preview(public.entries) from public, anon;
grant execute on function public.content_preview(public.entries) to authenticated;

-- PostgREST가 새 함수를 바로 인식하도록 스키마 캐시를 다시 읽게 한다
notify pgrst, 'reload schema';

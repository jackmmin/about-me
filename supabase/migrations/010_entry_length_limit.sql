-- =============================================================
-- 010: 기록 제목·본문 글자 수 제한 (제목 100자, 본문 20,000자)
-- 입력 화면(EntryEditPage)과 같은 한도. 화면을 거치지 않는 요청·백업 복원도 막는다.
-- 용량 때문이 아니라(한글 20,000자 ≈ 60KB) 실수로 거대한 글을 붙여넣는 것을 막기 위한 한도다.
--
-- not valid: 이미 한도를 넘은 기록이 있어도 실행은 실패하지 않고, 이후 저장·수정되는 행부터 검사한다.
-- 한도를 넘은 기존 기록 확인:
--   select id, record_date, char_length(title), char_length(content) from public.entries
--   where char_length(title) > 100 or char_length(content) > 20000;
--
-- Supabase 대시보드 > SQL Editor에 붙여넣고 실행한다. 여러 번 실행해도 안전하다.
-- =============================================================

alter table public.entries drop constraint if exists entries_title_length;
alter table public.entries
  add constraint entries_title_length check (char_length(title) <= 100) not valid;

alter table public.entries drop constraint if exists entries_content_length;
alter table public.entries
  add constraint entries_content_length check (char_length(content) <= 20000) not valid;

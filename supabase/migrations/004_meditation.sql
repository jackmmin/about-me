-- =============================================================
-- 004: 묵상 기록 유형 추가
-- 말씀 목록은 entries.meta.passages 에 [{ book, chapter, verses }] 형태로 저장한다.
-- Supabase 대시보드 > SQL Editor에 붙여넣고 실행한다. 여러 번 실행해도 안전하다.
-- =============================================================

alter table public.entries drop constraint if exists entries_type_check;
alter table public.entries
  add constraint entries_type_check check (type in ('diary', 'photo', 'meditation'));

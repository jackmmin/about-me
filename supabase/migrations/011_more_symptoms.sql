-- =============================================================
-- 011: 식후 증상 종류 추가 (소화불량, 구토, 어지러움, 식은땀)
-- 앱의 증상 목록(src/lib/health.ts SYMPTOMS)과 같은 값만 저장할 수 있게 한다.
--
-- Supabase 대시보드 > SQL Editor에 붙여넣고 실행한다. 여러 번 실행해도 안전하다.
-- =============================================================

alter table public.meal_logs drop constraint if exists meal_logs_symptoms_check;
alter table public.meal_logs
  add constraint meal_logs_symptoms_check
  check (symptoms <@ array[
    'diarrhea', 'bloating', 'pain', 'gas', 'constipation', 'nausea',
    'indigestion', 'vomiting', 'dizziness', 'cold_sweat'
  ]::text[]);

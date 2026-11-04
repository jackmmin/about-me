-- =============================================================
-- 005: 간식은 하루에 여러 건 기록할 수 있게 한다.
-- 아침·점심·저녁은 지금처럼 하루 끼니당 한 행만 허용한다.
-- Supabase 대시보드 > SQL Editor에 붙여넣고 실행한다. 여러 번 실행해도 안전하다.
-- =============================================================

-- 002의 unique (user_id, log_date, meal) 제약 제거 (이름이 달라도 찾아서 지운다)
do $$
declare
  c text;
begin
  for c in
    select conname from pg_constraint
    where conrelid = 'public.meal_logs'::regclass and contype = 'u'
  loop
    execute format('alter table public.meal_logs drop constraint %I', c);
  end loop;
end;
$$;

create unique index if not exists meal_logs_main_meal_once
  on public.meal_logs (user_id, log_date, meal)
  where meal <> 'snack';

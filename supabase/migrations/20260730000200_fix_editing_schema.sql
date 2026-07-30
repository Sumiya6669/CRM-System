-- =====================================================================
-- Исправления схемы под формы редактирования.
--
-- 1. В таблице trainers не было колонки hire_date, хотя форма тренера
--    её отправляла. Из-за этого сохранение падало с ошибкой
--    "Could not find the 'hire_date' column of 'trainers'".
-- 2. Добавлены недостающие поля, которые используются в интерфейсе.
--
-- Миграция идемпотентна, выполняется в SQL Editor Supabase.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Тренеры: дата найма и заметки
-- ---------------------------------------------------------------------
alter table public.trainers
  add column if not exists hire_date date,
  add column if not exists notes text;

-- ---------------------------------------------------------------------
-- 2. Группы: max_students как синоним capacity.
--    Интерфейс исторически использует max_students, схема — capacity.
--    Приводим к одному имени capacity и оставляем max_students,
--    если он уже был создан вручную.
-- ---------------------------------------------------------------------
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'groups' and column_name = 'max_students'
  ) then
    update public.groups
      set capacity = coalesce(capacity, max_students)
      where capacity is null and max_students is not null;
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 3. Остатки по филиалам: гарантируем уникальность пары товар+филиал,
--    чтобы upsert остатков работал корректно.
-- ---------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_indexes
    where schemaname = 'public'
      and tablename = 'inventory_stock'
      and indexdef like '%UNIQUE%(product_id, branch_id)%'
  ) then
    -- убираем возможные дубли перед созданием уникального индекса
    delete from public.inventory_stock a
    using public.inventory_stock b
    where a.ctid < b.ctid
      and a.product_id = b.product_id
      and a.branch_id is not distinct from b.branch_id;

    create unique index if not exists inventory_stock_product_branch_uniq
      on public.inventory_stock (product_id, branch_id);
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 4. Остаток не может быть отрицательным
-- ---------------------------------------------------------------------
update public.inventory_stock set quantity = 0 where quantity < 0;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.inventory_stock'::regclass
      and conname = 'inventory_stock_quantity_non_negative'
  ) then
    alter table public.inventory_stock
      add constraint inventory_stock_quantity_non_negative check (quantity >= 0);
  end if;
end $$;

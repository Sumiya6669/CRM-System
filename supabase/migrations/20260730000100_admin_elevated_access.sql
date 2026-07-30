-- =====================================================================
-- Расширенные права администраторов ("Полный доступ как у Owner").
--
-- Идея: app_private.is_owner() теперь возвращает true не только для роли
-- owner, но и для admin, которому Owner явно включил permissions.full_access.
-- Все существующие RLS-политики, триггеры и RPC-функции, построенные на
-- is_owner(), автоматически начинают работать и для таких администраторов.
--
-- Управление самими администраторами (profiles / users / admin_slots)
-- остаётся строго за Owner — иначе админ смог бы выдать права сам себе.
-- Для этого введена функция app_private.is_strict_owner().
--
-- Миграция идемпотентна, её можно выполнить в SQL Editor Supabase.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Настоящий владелец (только роль owner)
-- ---------------------------------------------------------------------
create or replace function app_private.is_strict_owner()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(app_private.current_role() = 'owner', false)
$$;

-- ---------------------------------------------------------------------
-- 2. Чтение флага из profiles.permissions текущего пользователя
--    owner -> всегда true
--    admin -> true, если включён full_access либо конкретный флаг
--    остальные роли -> false
-- ---------------------------------------------------------------------
create or replace function app_private.admin_flag(flag_name text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((
    select case
      when p.role::text = 'owner' then true
      when p.role::text <> 'admin' then false
      when coalesce((p.permissions ->> 'full_access')::boolean, false) then true
      else coalesce((p.permissions ->> flag_name)::boolean, false)
    end
    from public.profiles p
    where p.id = auth.uid() and p.status = 'active'
  ), false)
$$;

-- ---------------------------------------------------------------------
-- 3. Owner-полномочия: owner или admin с full_access
--    Переопределяем существующую функцию — все политики подхватят её сами.
-- ---------------------------------------------------------------------
create or replace function app_private.is_owner()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select app_private.admin_flag('full_access')
$$;

-- ---------------------------------------------------------------------
-- 4. Гранулярные полномочия (работают и без full_access)
-- ---------------------------------------------------------------------
create or replace function app_private.can_edit_records()
returns boolean language sql stable security definer set search_path = public
as $$ select app_private.admin_flag('can_edit') $$;

create or replace function app_private.can_delete_records()
returns boolean language sql stable security definer set search_path = public
as $$ select app_private.admin_flag('can_delete') $$;

create or replace function app_private.can_archive_records()
returns boolean language sql stable security definer set search_path = public
as $$ select app_private.admin_flag('can_archive') $$;

create or replace function app_private.can_unlock_documents()
returns boolean language sql stable security definer set search_path = public
as $$ select app_private.admin_flag('can_unlock') $$;

create or replace function app_private.can_read_audit()
returns boolean language sql stable security definer set search_path = public
as $$ select app_private.admin_flag('can_view_audit') $$;

-- ---------------------------------------------------------------------
-- 5. Модульные переключатели.
--    Модули проверяются даже у admin с full_access — Owner может выдать
--    полные права, но, например, только на склад.
--    Теперь поддерживаются и отдельные ключи 'trainers' / 'groups'.
-- ---------------------------------------------------------------------
create or replace function app_private.resource_allowed(resource_name text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((
    select
      p.role::text = 'owner'
      or coalesce(
           (p.permissions ->> resource_name)::boolean,
           (p.permissions ->> case
              when resource_name in ('parents', 'student_transfers') then 'students'
              when resource_name in ('inventory_stock', 'inventory_movements', 'inventory_receipts', 'stock_adjustments') then 'inventory'
              else resource_name
            end)::boolean,
           true
         )
    from public.profiles p
    where p.id = auth.uid() and p.status = 'active'
  ), false)
$$;

-- ---------------------------------------------------------------------
-- 6. Управление пользователями остаётся только у настоящего Owner.
--    Переписываем политики profiles / users / admin_slots на is_strict_owner().
-- ---------------------------------------------------------------------
do $$
declare
  current_policy record;
  using_expression text;
  check_expression text;
begin
  for current_policy in
    select tablename, policyname, cmd, qual, with_check
    from pg_policies
    where schemaname = 'public'
      and tablename in ('profiles', 'users', 'admin_slots')
      and (coalesce(qual, '') like '%is_owner()%' or coalesce(with_check, '') like '%is_owner()%')
  loop
    using_expression := replace(current_policy.qual, 'app_private.is_owner()', 'app_private.is_strict_owner()');
    check_expression := replace(current_policy.with_check, 'app_private.is_owner()', 'app_private.is_strict_owner()');

    if using_expression is not null and check_expression is not null then
      execute format('alter policy %I on public.%I using (%s) with check (%s)',
        current_policy.policyname, current_policy.tablename, using_expression, check_expression);
    elsif check_expression is not null then
      execute format('alter policy %I on public.%I with check (%s)',
        current_policy.policyname, current_policy.tablename, check_expression);
    elsif using_expression is not null then
      execute format('alter policy %I on public.%I using (%s)',
        current_policy.policyname, current_policy.tablename, using_expression);
    end if;
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- 7. Мягкое удаление: разрешаем администраторам с правом can_delete
-- ---------------------------------------------------------------------
create or replace function app_private.protect_soft_delete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' and not app_private.can_delete_records() then
    raise exception 'Физическое удаление запрещено. Запись можно удалить только через корзину.'
      using errcode = '42501';
  end if;

  if tg_op = 'UPDATE'
     and not app_private.can_delete_records()
     and (
       old.is_deleted is distinct from new.is_deleted
       or old.deleted_at is distinct from new.deleted_at
       or old.deleted_by is distinct from new.deleted_by
       or old.restored_at is distinct from new.restored_at
       or old.restored_by is distinct from new.restored_by
     ) then
    raise exception 'Недостаточно прав для удаления и восстановления записей.'
      using errcode = '42501';
  end if;

  if tg_op = 'UPDATE' and new.is_deleted is distinct from (new.deleted_at is not null) then
    raise exception 'Некорректное состояние удаления записи.'
      using errcode = '23514';
  end if;

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

-- ---------------------------------------------------------------------
-- 8. Архивация товаров: право can_archive
-- ---------------------------------------------------------------------
create or replace function app_private.protect_product_archive()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not app_private.can_archive_records()
     and (
       old.is_archived is distinct from new.is_archived
       or old.archived_at is distinct from new.archived_at
       or old.archived_by is distinct from new.archived_by
     ) then
    raise exception 'Недостаточно прав для архивации товаров.'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------
-- 9. Проведённые (заблокированные) документы: право can_unlock
-- ---------------------------------------------------------------------
create or replace function app_private.protect_locked_document()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  can_unlock boolean := app_private.can_unlock_documents();
begin
  if tg_op = 'DELETE' then
    if coalesce(old.is_locked, false) and not can_unlock then
      raise exception 'Документ заблокирован. Изменить или удалить проведённый документ может только пользователь с правом разблокировки.'
        using errcode = '42501';
    end if;
    return old;
  end if;

  if tg_op = 'UPDATE' and coalesce(old.is_locked, false) and not can_unlock then
    raise exception 'Документ заблокирован. Изменить или удалить проведённый документ может только пользователь с правом разблокировки.'
      using errcode = '42501';
  end if;

  if tg_op = 'UPDATE'
     and coalesce(old.is_locked, false)
     and can_unlock
     and not coalesce(new.is_locked, false) then
    new.unlocked_at := now();
    new.unlocked_by := auth.uid();
    return new;
  end if;

  if lower(coalesce(new.document_status, '')) = any(array['completed', 'posted', 'confirmed', 'approved'])
     and not coalesce(new.is_locked, false) then
    new.is_locked := true;
    new.locked_at := now();
    new.locked_by := auth.uid();
  end if;

  return new;
end;
$$;

-- ---------------------------------------------------------------------
-- 10. Политики update/delete: заменяем жёсткую привязку к владельцу
--     на соответствующие гранулярные права.
-- ---------------------------------------------------------------------
do $$
declare
  current_policy record;
  using_expression text;
  check_expression text;
  replacement text;
begin
  for current_policy in
    select tablename, policyname, cmd, qual, with_check
    from pg_policies
    where schemaname = 'public'
      and tablename not in ('profiles', 'users', 'admin_slots')
      and (policyname like '%_update_unlocked' or policyname like '%_delete_unlocked'
           or policyname like '%_write_staff_delete')
      and (coalesce(qual, '') like '%is_owner()%' or coalesce(with_check, '') like '%is_owner()%')
  loop
    replacement := case
      when current_policy.policyname like '%_update_unlocked' then 'app_private.can_unlock_documents()'
      else 'app_private.can_delete_records()'
    end;

    using_expression := replace(current_policy.qual, 'app_private.is_owner()', replacement);
    check_expression := replace(current_policy.with_check, 'app_private.is_owner()', replacement);

    if using_expression is not null and check_expression is not null then
      execute format('alter policy %I on public.%I using (%s) with check (%s)',
        current_policy.policyname, current_policy.tablename, using_expression, check_expression);
    elsif check_expression is not null then
      execute format('alter policy %I on public.%I with check (%s)',
        current_policy.policyname, current_policy.tablename, check_expression);
    elsif using_expression is not null then
      execute format('alter policy %I on public.%I using (%s)',
        current_policy.policyname, current_policy.tablename, using_expression);
    end if;
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- 11. Видимость удалённых записей в корзине — по праву can_delete
-- ---------------------------------------------------------------------
do $$
declare
  current_policy record;
  using_expression text;
begin
  for current_policy in
    select tablename, policyname, qual
    from pg_policies
    where schemaname = 'public'
      and cmd = 'SELECT'
      and tablename not in ('profiles', 'users', 'admin_slots', 'audit_logs')
      and coalesce(qual, '') like '%is_owner()%'
  loop
    using_expression := replace(current_policy.qual, 'app_private.is_owner()', 'app_private.can_delete_records()');
    execute format('alter policy %I on public.%I using (%s)',
      current_policy.policyname, current_policy.tablename, using_expression);
  end loop;
end $$;

-- Архив товаров виден тем, кто может архивировать
alter policy inventory_select_org on public.inventory
  using (
    organization_id = app_private.current_organization_id()
    and (
      (not is_deleted and not is_archived)
      or app_private.can_delete_records()
      or app_private.can_archive_records()
    )
  );

-- Журнал изменений
alter policy audit_logs_select_owner on public.audit_logs
  using (
    organization_id = app_private.current_organization_id()
    and (app_private.is_owner() or app_private.can_read_audit())
  );

-- ---------------------------------------------------------------------
-- 12. RPC-функции Owner: гранулярная проверка прав по типу действия
-- ---------------------------------------------------------------------
create or replace function app_private.action_allowed(p_action text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case
    when p_action in ('delete', 'restore', 'permanent_delete') then app_private.can_delete_records()
    when p_action in ('archive', 'unarchive') then app_private.can_archive_records()
    when p_action in ('unlock', 'reopen', 'repost', 'recalculate') then app_private.can_unlock_documents()
    else app_private.is_owner()
  end
$$;

create or replace function public.owner_manage_record(
  p_table text,
  p_record_id uuid,
  p_action text,
  p_reason text default null
)
returns jsonb
language plpgsql
security invoker
set search_path = public, app_private
as $$
declare
  allowed_tables constant text[] := array[
    'students', 'subscriptions', 'payments', 'inventory', 'inventory_movements',
    'inventory_receipts', 'stock_adjustments', 'sales', 'attendance', 'student_transfers'
  ];
  document_tables constant text[] := array[
    'payments', 'inventory_movements', 'inventory_receipts', 'stock_adjustments', 'sales'
  ];
  actor_id uuid := auth.uid();
  actor_name text;
  actor_role text := app_private.current_role();
  actor_organization_id uuid := app_private.current_organization_id();
  old_value jsonb;
  new_value jsonb;
  action_reason text := coalesce(nullif(trim(p_reason), ''), 'Действие: ' || p_action);
  target_branch_id uuid;
  target_branch_name text;
begin
  if actor_id is null or not app_private.action_allowed(p_action) then
    raise exception 'Недостаточно прав для выполнения этого действия.' using errcode = '42501';
  end if;
  if not (p_table = any(allowed_tables)) then
    raise exception 'Неподдерживаемый тип записи.' using errcode = '22023';
  end if;
  if not app_private.resource_allowed(p_table) then
    raise exception 'Модуль недоступен для вашей учётной записи.' using errcode = '42501';
  end if;

  select full_name into actor_name from public.profiles where id = actor_id;
  execute format(
    'select to_jsonb(target) from public.%I as target where id = $1 and organization_id = $2 for update',
    p_table
  ) into old_value using p_record_id, actor_organization_id;
  if old_value is null then
    raise exception 'Запись не найдена.' using errcode = 'P0002';
  end if;

  target_branch_id := nullif(old_value ->> 'branch_id', '')::uuid;
  target_branch_name := old_value ->> 'branch_name';

  case p_action
    when 'delete' then
      execute format(
        'update public.%I as target set is_deleted = true, deleted_at = now(), deleted_by = $1
         where id = $2 and organization_id = $3 returning to_jsonb(target)', p_table
      ) into new_value using actor_id, p_record_id, actor_organization_id;
    when 'restore' then
      execute format(
        'update public.%I as target set is_deleted = false, deleted_at = null, deleted_by = null,
                restored_at = now(), restored_by = $1
         where id = $2 and organization_id = $3 returning to_jsonb(target)', p_table
      ) into new_value using actor_id, p_record_id, actor_organization_id;
    when 'archive' then
      if p_table <> 'inventory' then
        raise exception 'Архивирование доступно только для товаров.' using errcode = '22023';
      end if;
      update public.inventory as target
      set is_archived = true, archived_at = now(), archived_by = actor_id, status = 'archived'
      where id = p_record_id and target.organization_id = actor_organization_id
      returning to_jsonb(target) into new_value;
    when 'unarchive' then
      if p_table <> 'inventory' then
        raise exception 'Возврат из архива доступен только для товаров.' using errcode = '22023';
      end if;
      update public.inventory as target
      set is_archived = false, archived_at = null, archived_by = null, status = 'active'
      where id = p_record_id and target.organization_id = actor_organization_id
      returning to_jsonb(target) into new_value;
    when 'unlock' then
      if not (p_table = any(document_tables)) then
        raise exception 'Этот тип записи не поддерживает разблокировку.' using errcode = '22023';
      end if;
      execute format(
        'update public.%I as target set is_locked = false, unlocked_at = now(), unlocked_by = $1
         where id = $2 and organization_id = $3 returning to_jsonb(target)', p_table
      ) into new_value using actor_id, p_record_id, actor_organization_id;
    when 'reopen' then
      if not (p_table = any(document_tables)) then
        raise exception 'Этот тип записи не поддерживает повторное открытие.' using errcode = '22023';
      end if;
      execute format(
        'update public.%I as target set document_status = ''draft'', is_locked = false,
                unlocked_at = now(), unlocked_by = $1
         where id = $2 and organization_id = $3 returning to_jsonb(target)', p_table
      ) into new_value using actor_id, p_record_id, actor_organization_id;
    when 'repost' then
      if not (p_table = any(document_tables)) then
        raise exception 'Этот тип записи не поддерживает перепроведение.' using errcode = '22023';
      end if;
      execute format(
        'update public.%I as target set document_status = $1, is_locked = false,
                locked_at = null, locked_by = null
         where id = $2 and organization_id = $3 returning to_jsonb(target)', p_table
      ) into new_value using
        case when p_table = 'sales' then 'completed' when p_table = 'payments' then 'confirmed' else 'posted' end,
        p_record_id, actor_organization_id;
    when 'recalculate' then
      if not (p_table = any(document_tables)) then
        raise exception 'Этот тип записи не поддерживает пересчет.' using errcode = '22023';
      end if;
      if p_table = 'sales' then
        update public.sales as target
        set total = round(coalesce(quantity, 0) * coalesce(unit_price, 0) * (1 - coalesce(discount, 0) / 100.0)),
            recalculated_at = now(), recalculated_by = actor_id
        where id = p_record_id and target.organization_id = actor_organization_id
        returning to_jsonb(target) into new_value;
      else
        execute format(
          'update public.%I as target set recalculated_at = now(), recalculated_by = $1
           where id = $2 and organization_id = $3 returning to_jsonb(target)', p_table
        ) into new_value using actor_id, p_record_id, actor_organization_id;
      end if;
    when 'permanent_delete' then
      if not app_private.is_strict_owner() then
        raise exception 'Безвозвратное удаление доступно только Owner.' using errcode = '42501';
      end if;
      insert into public.audit_logs (
        organization_id, branch_id, branch_name, user_id, user_name, role,
        operation, action_type, entity_type, entity_id, document_id, document_type,
        description, old_value, new_value, metadata, reason, created_by
      ) values (
        actor_organization_id, target_branch_id, target_branch_name, actor_id, actor_name, actor_role,
        p_action, 'owner_' || p_action, p_table, p_record_id, p_record_id, p_table,
        p_table || ': ' || p_action, old_value, null, jsonb_build_object('owner_action', true),
        action_reason, actor_id
      );
      execute format('delete from public.%I where id = $1 and organization_id = $2', p_table)
        using p_record_id, actor_organization_id;
      return jsonb_build_object('id', p_record_id, 'permanently_deleted', true);
    else
      raise exception 'Неподдерживаемое действие.' using errcode = '22023';
  end case;

  insert into public.audit_logs (
    organization_id, branch_id, branch_name, user_id, user_name, role,
    operation, action_type, entity_type, entity_id, document_id, document_type,
    description, old_value, new_value, metadata, reason, created_by
  ) values (
    actor_organization_id, target_branch_id, target_branch_name, actor_id, actor_name, actor_role,
    p_action, 'owner_' || p_action, p_table, p_record_id, p_record_id, p_table,
    p_table || ': ' || p_action, old_value, new_value, jsonb_build_object('owner_action', true),
    action_reason, actor_id
  );

  return new_value;
end;
$$;

-- Корзина доступна тем, кто может удалять/восстанавливать
create or replace function public.owner_list_deleted_records()
returns table (
  record_type text, record_id uuid, label text, deleted_at timestamptz,
  deleted_by uuid, deleted_by_name text, branch_id uuid, branch_name text, snapshot jsonb
)
language plpgsql
security invoker
set search_path = public, app_private
as $$
begin
  if not app_private.can_delete_records() then
    raise exception 'Недостаточно прав для доступа к корзине.' using errcode = '42501';
  end if;

  return query
  select
    records.record_type, records.record_id, records.label, records.deleted_at,
    records.deleted_by, profile.full_name, records.branch_id, records.branch_name, records.snapshot
  from (
    select 'inventory'::text, item.id, item.name, item.deleted_at, item.deleted_by, null::uuid, null::text, to_jsonb(item)
      from public.inventory item where item.is_deleted
    union all
    select 'payments', item.id, coalesce(item.student_name, 'Оплата'), item.deleted_at, item.deleted_by, item.branch_id, item.branch_name, to_jsonb(item)
      from public.payments item where item.is_deleted
    union all
    select 'sales', item.id, coalesce(item.product_name, 'Продажа'), item.deleted_at, item.deleted_by, item.branch_id, item.branch_name, to_jsonb(item)
      from public.sales item where item.is_deleted
    union all
    select 'inventory_movements', item.id, coalesce(item.product_name, 'Перемещение'), item.deleted_at, item.deleted_by, item.branch_id, item.branch_name, to_jsonb(item)
      from public.inventory_movements item where item.is_deleted
    union all
    select 'inventory_receipts', item.id, coalesce(item.document_number, item.supplier_name, 'Поступление'), item.deleted_at, item.deleted_by, item.branch_id, item.branch_name, to_jsonb(item)
      from public.inventory_receipts item where item.is_deleted
    union all
    select 'stock_adjustments', item.id, coalesce(item.product_name, 'Корректировка'), item.deleted_at, item.deleted_by, item.branch_id, item.branch_name, to_jsonb(item)
      from public.stock_adjustments item where item.is_deleted
    union all
    select 'students', item.id, item.full_name, item.deleted_at, item.deleted_by, item.branch_id, item.branch_name, to_jsonb(item)
      from public.students item where item.is_deleted
    union all
    select 'attendance', item.id, coalesce(item.student_name, 'Посещаемость'), item.deleted_at, item.deleted_by, item.branch_id, item.branch_name, to_jsonb(item)
      from public.attendance item where item.is_deleted
    union all
    select 'subscriptions', item.id, item.name, item.deleted_at, item.deleted_by, null::uuid, null::text, to_jsonb(item)
      from public.subscriptions item where item.is_deleted
    union all
    select 'student_transfers', item.id, coalesce(item.student_name, 'Перевод'), item.deleted_at, item.deleted_by, item.from_branch_id, item.from_branch_name, to_jsonb(item)
      from public.student_transfers item where item.is_deleted
  ) as records(record_type, record_id, label, deleted_at, deleted_by, branch_id, branch_name, snapshot)
  left join public.profiles profile on profile.id = records.deleted_by
  order by records.deleted_at desc;
end;
$$;

-- ---------------------------------------------------------------------
-- 13. Минимальный остаток товара по умолчанию = 0 (было 5 на фронтенде)
-- ---------------------------------------------------------------------
alter table public.inventory alter column min_stock set default 0;
update public.inventory set min_stock = 0 where min_stock is null;

-- ---------------------------------------------------------------------
-- 14. Гранты
-- ---------------------------------------------------------------------
grant execute on function public.owner_manage_record(text, uuid, text, text) to authenticated;
grant execute on function public.owner_list_deleted_records() to authenticated;

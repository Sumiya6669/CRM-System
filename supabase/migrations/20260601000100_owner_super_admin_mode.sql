-- Owner Super Admin mode: soft delete, product archival, owner overrides and recycle bin.

alter table public.audit_logs
  add column if not exists document_id uuid,
  add column if not exists document_type text,
  add column if not exists reason text;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'students',
    'subscriptions',
    'payments',
    'inventory',
    'inventory_movements',
    'inventory_receipts',
    'stock_adjustments',
    'sales',
    'attendance',
    'student_transfers'
  ]
  loop
    execute format(
      'alter table public.%I
        add column if not exists is_deleted boolean not null default false,
        add column if not exists deleted_at timestamptz,
        add column if not exists deleted_by uuid references public.profiles(id) on delete set null,
        add column if not exists restored_at timestamptz,
        add column if not exists restored_by uuid references public.profiles(id) on delete set null',
      table_name
    );
    execute format(
      'update public.%I set is_deleted = (deleted_at is not null) where is_deleted is distinct from (deleted_at is not null)',
      table_name
    );
    execute format(
      'create index if not exists %I on public.%I (organization_id, deleted_at desc) where is_deleted',
      table_name || '_deleted_org_date_idx',
      table_name
    );
  end loop;

  foreach table_name in array array[
    'payments',
    'inventory_movements',
    'inventory_receipts',
    'stock_adjustments',
    'sales'
  ]
  loop
    execute format(
      'alter table public.%I
        add column if not exists recalculated_at timestamptz,
        add column if not exists recalculated_by uuid references public.profiles(id) on delete set null',
      table_name
    );
  end loop;
end $$;

alter table public.inventory
  add column if not exists is_archived boolean not null default false,
  add column if not exists archived_at timestamptz,
  add column if not exists archived_by uuid references public.profiles(id) on delete set null;

create index if not exists inventory_active_org_idx
  on public.inventory (organization_id, name)
  where not is_deleted and not is_archived;

create or replace function app_private.protect_soft_delete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' and not app_private.is_owner() then
    raise exception 'Физическое удаление запрещено. Запись можно удалить только через корзину Owner.'
      using errcode = '42501';
  end if;

  if tg_op = 'UPDATE'
     and not app_private.is_owner()
     and (
       old.is_deleted is distinct from new.is_deleted
       or old.deleted_at is distinct from new.deleted_at
       or old.deleted_by is distinct from new.deleted_by
       or old.restored_at is distinct from new.restored_at
       or old.restored_by is distinct from new.restored_by
     ) then
    raise exception 'Удалять и восстанавливать записи может только Owner.'
      using errcode = '42501';
  end if;

  if tg_op = 'UPDATE' and new.is_deleted is distinct from (new.deleted_at is not null) then
    raise exception 'Некорректное состояние удаления записи.'
      using errcode = '23514';
  end if;

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

create or replace function app_private.protect_product_archive()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not app_private.is_owner()
     and (
       old.is_archived is distinct from new.is_archived
       or old.archived_at is distinct from new.archived_at
       or old.archived_by is distinct from new.archived_by
     ) then
    raise exception 'Архивировать и возвращать товары из архива может только Owner.'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'students',
    'subscriptions',
    'payments',
    'inventory',
    'inventory_movements',
    'inventory_receipts',
    'stock_adjustments',
    'sales',
    'attendance',
    'student_transfers'
  ]
  loop
    execute format('drop trigger if exists protect_%I_soft_delete on public.%I', table_name, table_name);
    execute format(
      'create trigger protect_%I_soft_delete before update or delete on public.%I for each row execute function app_private.protect_soft_delete()',
      table_name,
      table_name
    );
  end loop;
end $$;

drop trigger if exists protect_inventory_archive on public.inventory;
create trigger protect_inventory_archive
  before update on public.inventory
  for each row execute function app_private.protect_product_archive();

alter policy inventory_select_org on public.inventory
  using (
    organization_id = app_private.current_organization_id()
    and ((not is_deleted and not is_archived) or app_private.is_owner())
  );
alter policy students_select_scoped on public.students
  using (
    organization_id = app_private.current_organization_id()
    and app_private.can_access_branch(branch_id)
    and (not is_deleted or app_private.is_owner())
  );
alter policy attendance_select_scoped on public.attendance
  using (
    organization_id = app_private.current_organization_id()
    and app_private.can_access_branch(branch_id)
    and (not is_deleted or app_private.is_owner())
  );
alter policy subscriptions_select_org on public.subscriptions
  using (
    organization_id = app_private.current_organization_id()
    and (not is_deleted or app_private.is_owner())
  );
alter policy student_transfers_select_scoped on public.student_transfers
  using (
    organization_id = app_private.current_organization_id()
    and (
      app_private.can_access_branch(from_branch_id)
      or app_private.can_access_branch(to_branch_id)
    )
    and (not is_deleted or app_private.is_owner())
  );

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'payments',
    'inventory_movements',
    'inventory_receipts',
    'stock_adjustments',
    'sales'
  ]
  loop
    execute format(
      'alter policy %I on public.%I using (
        organization_id = app_private.current_organization_id()
        and app_private.can_access_branch(branch_id)
        and (not is_deleted or app_private.is_owner())
      )',
      table_name || '_select_scoped',
      table_name
    );
    execute format(
      'alter policy %I on public.%I using (
        organization_id = app_private.current_organization_id()
        and app_private.can_access_branch(branch_id)
        and app_private.is_owner()
      )',
      table_name || '_delete_unlocked',
      table_name
    );
  end loop;
end $$;

alter policy inventory_write_staff_delete on public.inventory
  using (
    organization_id = app_private.current_organization_id()
    and app_private.is_owner()
  );
alter policy students_write_staff_delete on public.students
  using (
    organization_id = app_private.current_organization_id()
    and app_private.can_access_branch(branch_id)
    and app_private.is_owner()
  );
alter policy attendance_write_staff_delete on public.attendance
  using (
    organization_id = app_private.current_organization_id()
    and app_private.can_access_branch(branch_id)
    and app_private.is_owner()
  );
alter policy student_transfers_write_staff_delete on public.student_transfers
  using (
    organization_id = app_private.current_organization_id()
    and (
      app_private.can_access_branch(from_branch_id)
      or app_private.can_access_branch(to_branch_id)
    )
    and app_private.is_owner()
  );

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
    'students',
    'subscriptions',
    'payments',
    'inventory',
    'inventory_movements',
    'inventory_receipts',
    'stock_adjustments',
    'sales',
    'attendance',
    'student_transfers'
  ];
  document_tables constant text[] := array[
    'payments',
    'inventory_movements',
    'inventory_receipts',
    'stock_adjustments',
    'sales'
  ];
  actor_id uuid := auth.uid();
  actor_name text;
  actor_organization_id uuid := app_private.current_organization_id();
  old_value jsonb;
  new_value jsonb;
  action_reason text := coalesce(nullif(trim(p_reason), ''), 'Owner action: ' || p_action);
  target_branch_id uuid;
  target_branch_name text;
begin
  if actor_id is null or not app_private.is_owner() then
    raise exception 'Операция доступна только Owner.' using errcode = '42501';
  end if;
  if not (p_table = any(allowed_tables)) then
    raise exception 'Неподдерживаемый тип записи.' using errcode = '22023';
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
        'update public.%I as target
         set is_deleted = true, deleted_at = now(), deleted_by = $1
         where id = $2 and organization_id = $3
         returning to_jsonb(target)',
        p_table
      ) into new_value using actor_id, p_record_id, actor_organization_id;
    when 'restore' then
      execute format(
        'update public.%I as target
         set is_deleted = false, deleted_at = null, deleted_by = null, restored_at = now(), restored_by = $1
         where id = $2 and organization_id = $3
         returning to_jsonb(target)',
        p_table
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
        'update public.%I as target
         set is_locked = false, unlocked_at = now(), unlocked_by = $1
         where id = $2 and organization_id = $3
         returning to_jsonb(target)',
        p_table
      ) into new_value using actor_id, p_record_id, actor_organization_id;
    when 'reopen' then
      if not (p_table = any(document_tables)) then
        raise exception 'Этот тип записи не поддерживает повторное открытие.' using errcode = '22023';
      end if;
      execute format(
        'update public.%I as target
         set document_status = ''draft'', is_locked = false, unlocked_at = now(), unlocked_by = $1
         where id = $2 and organization_id = $3
         returning to_jsonb(target)',
        p_table
      ) into new_value using actor_id, p_record_id, actor_organization_id;
    when 'repost' then
      if not (p_table = any(document_tables)) then
        raise exception 'Этот тип записи не поддерживает перепроведение.' using errcode = '22023';
      end if;
      execute format(
        'update public.%I as target
         set document_status = $1, is_locked = false, locked_at = null, locked_by = null
         where id = $2 and organization_id = $3
         returning to_jsonb(target)',
        p_table
      ) into new_value using
        case when p_table = 'sales' then 'completed' when p_table = 'payments' then 'confirmed' else 'posted' end,
        p_record_id,
        actor_organization_id;
    when 'recalculate' then
      if not (p_table = any(document_tables)) then
        raise exception 'Этот тип записи не поддерживает пересчет.' using errcode = '22023';
      end if;
      if p_table = 'sales' then
        update public.sales as target
        set total = round(coalesce(quantity, 0) * coalesce(unit_price, 0) * (1 - coalesce(discount, 0) / 100.0)),
            recalculated_at = now(),
            recalculated_by = actor_id
        where id = p_record_id and target.organization_id = actor_organization_id
        returning to_jsonb(target) into new_value;
      else
        execute format(
          'update public.%I as target
           set recalculated_at = now(), recalculated_by = $1
           where id = $2 and organization_id = $3
           returning to_jsonb(target)',
          p_table
        ) into new_value using actor_id, p_record_id, actor_organization_id;
      end if;
    when 'permanent_delete' then
      insert into public.audit_logs (
        organization_id, branch_id, branch_name, user_id, user_name, role,
        operation, action_type, entity_type, entity_id, document_id, document_type,
        description, old_value, new_value, metadata, reason, created_by
      ) values (
        actor_organization_id, target_branch_id, target_branch_name, actor_id, actor_name, 'owner',
        p_action, 'owner_' || p_action, p_table, p_record_id, p_record_id, p_table,
        p_table || ': ' || p_action, old_value, null, jsonb_build_object('owner_action', true),
        action_reason, actor_id
      );
      execute format(
        'delete from public.%I where id = $1 and organization_id = $2',
        p_table
      ) using p_record_id, actor_organization_id;
      return jsonb_build_object('id', p_record_id, 'permanently_deleted', true);
    else
      raise exception 'Неподдерживаемое действие Owner.' using errcode = '22023';
  end case;

  insert into public.audit_logs (
    organization_id, branch_id, branch_name, user_id, user_name, role,
    operation, action_type, entity_type, entity_id, document_id, document_type,
    description, old_value, new_value, metadata, reason, created_by
  ) values (
    actor_organization_id, target_branch_id, target_branch_name, actor_id, actor_name, 'owner',
    p_action, 'owner_' || p_action, p_table, p_record_id, p_record_id, p_table,
    p_table || ': ' || p_action, old_value, new_value, jsonb_build_object('owner_action', true),
    action_reason, actor_id
  );

  return new_value;
end;
$$;

create or replace function public.owner_list_deleted_records()
returns table (
  record_type text,
  record_id uuid,
  label text,
  deleted_at timestamptz,
  deleted_by uuid,
  deleted_by_name text,
  branch_id uuid,
  branch_name text,
  snapshot jsonb
)
language plpgsql
security invoker
set search_path = public, app_private
as $$
begin
  if not app_private.is_owner() then
    raise exception 'Корзина доступна только Owner.' using errcode = '42501';
  end if;

  return query
  select
    records.record_type,
    records.record_id,
    records.label,
    records.deleted_at,
    records.deleted_by,
    profile.full_name,
    records.branch_id,
    records.branch_name,
    records.snapshot
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

revoke all on function public.owner_manage_record(text, uuid, text, text) from public;
revoke all on function public.owner_list_deleted_records() from public;
grant execute on function public.owner_manage_record(text, uuid, text, text) to authenticated;
grant execute on function public.owner_list_deleted_records() to authenticated;

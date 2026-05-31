-- Owner/Admin security hardening, immutable audit trail and locked operational documents.

alter function public.set_updated_date() set search_path = public;

alter table public.profiles
  add column if not exists permissions jsonb not null default '{}'::jsonb,
  add column if not exists assigned_branch_ids uuid[] not null default '{}'::uuid[],
  add column if not exists admin_slot smallint,
  add column if not exists last_login_at timestamptz;

alter table public.users
  add column if not exists assigned_branch_ids uuid[] not null default '{}'::uuid[];

alter table public.attendance
  add column if not exists coach_id uuid references public.trainers(id) on delete set null,
  add column if not exists coach_name text;

alter table public.payments
  add column if not exists payment_method text,
  add column if not exists period text,
  add column if not exists confirmed boolean not null default false,
  add column if not exists document_status text not null default 'draft',
  add column if not exists is_locked boolean not null default false,
  add column if not exists locked_at timestamptz,
  add column if not exists locked_by uuid references public.profiles(id) on delete set null,
  add column if not exists unlocked_at timestamptz,
  add column if not exists unlocked_by uuid references public.profiles(id) on delete set null,
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by uuid references public.profiles(id) on delete set null,
  add column if not exists restored_at timestamptz,
  add column if not exists restored_by uuid references public.profiles(id) on delete set null;

update public.payments
set payment_method = method
where payment_method is null;

alter table public.payments
  alter column payment_method set default 'cash',
  alter column payment_method set not null;

alter table public.sales
  add column if not exists unit_price numeric(12,2),
  add column if not exists document_status text not null default 'draft',
  add column if not exists is_locked boolean not null default false,
  add column if not exists locked_at timestamptz,
  add column if not exists locked_by uuid references public.profiles(id) on delete set null,
  add column if not exists unlocked_at timestamptz,
  add column if not exists unlocked_by uuid references public.profiles(id) on delete set null,
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by uuid references public.profiles(id) on delete set null,
  add column if not exists restored_at timestamptz,
  add column if not exists restored_by uuid references public.profiles(id) on delete set null;

alter table public.inventory_movements
  add column if not exists transfer_date date not null default current_date,
  add column if not exists document_status text not null default 'draft',
  add column if not exists is_locked boolean not null default false,
  add column if not exists locked_at timestamptz,
  add column if not exists locked_by uuid references public.profiles(id) on delete set null,
  add column if not exists unlocked_at timestamptz,
  add column if not exists unlocked_by uuid references public.profiles(id) on delete set null,
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by uuid references public.profiles(id) on delete set null,
  add column if not exists restored_at timestamptz,
  add column if not exists restored_by uuid references public.profiles(id) on delete set null;

alter table public.audit_logs
  add column if not exists role text,
  add column if not exists operation text,
  add column if not exists old_value jsonb,
  add column if not exists new_value jsonb;

create table if not exists public.admin_slots (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  slot_number smallint not null check (slot_number between 1 and 3),
  label text not null,
  profile_id uuid unique references public.profiles(id) on delete set null,
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now(),
  unique (organization_id, slot_number)
);

create table if not exists public.inventory_receipts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  branch_id uuid references public.branches(id) on delete set null,
  branch_name text,
  document_number text,
  supplier_name text,
  items jsonb not null default '[]'::jsonb,
  total numeric(12,2) not null default 0,
  receipt_date date not null default current_date,
  document_status text not null default 'draft',
  is_locked boolean not null default false,
  locked_at timestamptz,
  locked_by uuid references public.profiles(id) on delete set null,
  unlocked_at timestamptz,
  unlocked_by uuid references public.profiles(id) on delete set null,
  deleted_at timestamptz,
  deleted_by uuid references public.profiles(id) on delete set null,
  restored_at timestamptz,
  restored_by uuid references public.profiles(id) on delete set null,
  created_by uuid references public.profiles(id) on delete set null,
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now()
);

create table if not exists public.stock_adjustments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  branch_id uuid references public.branches(id) on delete set null,
  branch_name text,
  product_id uuid references public.inventory(id) on delete set null,
  product_name text,
  quantity_delta integer not null,
  reason text,
  adjustment_date date not null default current_date,
  document_status text not null default 'draft',
  is_locked boolean not null default false,
  locked_at timestamptz,
  locked_by uuid references public.profiles(id) on delete set null,
  unlocked_at timestamptz,
  unlocked_by uuid references public.profiles(id) on delete set null,
  deleted_at timestamptz,
  deleted_by uuid references public.profiles(id) on delete set null,
  restored_at timestamptz,
  restored_by uuid references public.profiles(id) on delete set null,
  created_by uuid references public.profiles(id) on delete set null,
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now()
);

create unique index if not exists groups_org_name_idx on public.groups(organization_id, name);
create index if not exists admin_slots_org_slot_idx on public.admin_slots(organization_id, slot_number);
create index if not exists inventory_receipts_org_date_idx on public.inventory_receipts(organization_id, receipt_date desc);
create index if not exists stock_adjustments_org_date_idx on public.stock_adjustments(organization_id, adjustment_date desc);

create or replace function app_private.current_assigned_branch_ids()
returns uuid[]
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(assigned_branch_ids, '{}'::uuid[])
  from public.profiles
  where id = auth.uid() and status = 'active'
$$;

create or replace function app_private.is_owner()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(app_private.current_role() = 'owner', false)
$$;

create or replace function app_private.can_access_branch(requested_branch_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    app_private.is_owner()
    or requested_branch_id is null
    or app_private.current_branch_id() is null
    or requested_branch_id = app_private.current_branch_id()
    or requested_branch_id = any(app_private.current_assigned_branch_ids())
$$;

create or replace function app_private.set_organization_scope()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.organization_id is null then
    new.organization_id := app_private.current_organization_id();
  end if;
  return new;
end;
$$;

create or replace function app_private.set_created_by()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.created_by is null then
    new.created_by := auth.uid();
  end if;
  return new;
end;
$$;

create or replace function app_private.protect_locked_document()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_role text := app_private.current_role();
begin
  if tg_op = 'DELETE' then
    if coalesce(old.is_locked, false) and actor_role <> 'owner' then
      raise exception 'Документ заблокирован. Изменить или удалить завершенный документ может только Owner.'
        using errcode = '42501';
    end if;
    return old;
  end if;

  if tg_op = 'UPDATE' and coalesce(old.is_locked, false) and actor_role <> 'owner' then
    raise exception 'Документ заблокирован. Изменить или удалить завершенный документ может только Owner.'
      using errcode = '42501';
  end if;

  if tg_op = 'UPDATE'
     and coalesce(old.is_locked, false)
     and actor_role = 'owner'
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

create or replace function app_private.audit_row_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  row_value jsonb;
  old_value jsonb;
  new_value jsonb;
  actor_name text;
begin
  old_value := case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) else null end;
  new_value := case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) else null end;
  row_value := coalesce(new_value, old_value);

  select full_name into actor_name from public.profiles where id = auth.uid();

  insert into public.audit_logs (
    organization_id,
    branch_id,
    branch_name,
    user_id,
    user_name,
    role,
    operation,
    action_type,
    entity_type,
    entity_id,
    description,
    old_value,
    new_value,
    metadata,
    created_by
  )
  values (
    coalesce(nullif(row_value ->> 'organization_id', '')::uuid, app_private.current_organization_id()),
    nullif(row_value ->> 'branch_id', '')::uuid,
    row_value ->> 'branch_name',
    auth.uid(),
    actor_name,
    app_private.current_role(),
    lower(tg_op),
    tg_table_name || '_' || lower(tg_op),
    tg_table_name,
    nullif(row_value ->> 'id', '')::uuid,
    tg_table_name || ': ' || lower(tg_op),
    old_value,
    new_value,
    jsonb_build_object('table', tg_table_name),
    auth.uid()
  );

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'branches', 'students', 'parents', 'groups', 'trainers', 'subscriptions',
    'payments', 'inventory', 'inventory_stock', 'inventory_movements', 'sales',
    'attendance', 'notifications', 'student_transfers', 'invites', 'admin_slots',
    'inventory_receipts', 'stock_adjustments'
  ]
  loop
    execute format('drop trigger if exists set_%I_organization_scope on public.%I', table_name, table_name);
    execute format(
      'create trigger set_%I_organization_scope before insert on public.%I for each row execute function app_private.set_organization_scope()',
      table_name,
      table_name
    );
  end loop;

  foreach table_name in array array[
    'payments', 'inventory_movements', 'sales', 'attendance', 'student_transfers',
    'invites', 'inventory_receipts', 'stock_adjustments', 'audit_logs'
  ]
  loop
    execute format('drop trigger if exists set_%I_created_by on public.%I', table_name, table_name);
    execute format(
      'create trigger set_%I_created_by before insert on public.%I for each row execute function app_private.set_created_by()',
      table_name,
      table_name
    );
  end loop;

  foreach table_name in array array[
    'payments', 'inventory_movements', 'sales', 'inventory_receipts', 'stock_adjustments'
  ]
  loop
    execute format('drop trigger if exists protect_%I_document on public.%I', table_name, table_name);
    execute format(
      'create trigger protect_%I_document before insert or update or delete on public.%I for each row execute function app_private.protect_locked_document()',
      table_name,
      table_name
    );
  end loop;

  foreach table_name in array array[
    'organizations', 'branches', 'profiles', 'users', 'students', 'parents',
    'groups', 'trainers', 'subscriptions', 'payments', 'inventory',
    'inventory_stock', 'inventory_movements', 'sales', 'attendance',
    'student_transfers', 'invites', 'admin_slots', 'inventory_receipts',
    'stock_adjustments'
  ]
  loop
    execute format('drop trigger if exists audit_%I_changes on public.%I', table_name, table_name);
    execute format(
      'create trigger audit_%I_changes after insert or update or delete on public.%I for each row execute function app_private.audit_row_change()',
      table_name,
      table_name
    );
  end loop;
end $$;

do $$
declare
  table_name text;
  policy_name text;
begin
  foreach table_name in array array[
    'organizations', 'branches', 'profiles', 'users', 'students', 'parents',
    'groups', 'trainers', 'subscriptions', 'payments', 'inventory',
    'inventory_stock', 'inventory_movements', 'sales', 'attendance',
    'audit_logs', 'notifications', 'student_transfers', 'invites', 'admin_slots',
    'inventory_receipts', 'stock_adjustments'
  ]
  loop
    for policy_name in
      select policyname from pg_policies where schemaname = 'public' and tablename = table_name
    loop
      execute format('drop policy if exists %I on public.%I', policy_name, table_name);
    end loop;
    execute format('alter table public.%I enable row level security', table_name);
  end loop;
end $$;

create policy organizations_select_org on public.organizations for select
  using (id = app_private.current_organization_id());
create policy organizations_update_owner on public.organizations for update
  using (id = app_private.current_organization_id() and app_private.is_owner())
  with check (id = app_private.current_organization_id() and app_private.is_owner());

create policy branches_select_scoped on public.branches for select
  using (organization_id = app_private.current_organization_id() and app_private.can_access_branch(id));
create policy branches_manage_owner on public.branches for all
  using (organization_id = app_private.current_organization_id() and app_private.is_owner())
  with check (organization_id = app_private.current_organization_id() and app_private.is_owner());

create policy profiles_select_self_or_owner on public.profiles for select
  using (id = auth.uid() or (organization_id = app_private.current_organization_id() and app_private.is_owner()));
create policy profiles_manage_owner on public.profiles for all
  using (organization_id = app_private.current_organization_id() and app_private.is_owner())
  with check (organization_id = app_private.current_organization_id() and app_private.is_owner());

create policy users_select_self_or_owner on public.users for select
  using (id = auth.uid() or (organization_id = app_private.current_organization_id() and app_private.is_owner()));
create policy users_manage_owner on public.users for all
  using (organization_id = app_private.current_organization_id() and app_private.is_owner())
  with check (organization_id = app_private.current_organization_id() and app_private.is_owner());

create policy admin_slots_owner_only on public.admin_slots for all
  using (organization_id = app_private.current_organization_id() and app_private.is_owner())
  with check (organization_id = app_private.current_organization_id() and app_private.is_owner());

create policy parents_select_org on public.parents for select
  using (organization_id = app_private.current_organization_id());
create policy parents_write_staff on public.parents for all
  using (organization_id = app_private.current_organization_id() and app_private.has_role(array['owner','admin','branch_admin']))
  with check (organization_id = app_private.current_organization_id() and app_private.has_role(array['owner','admin','branch_admin']));

create policy subscriptions_select_org on public.subscriptions for select
  using (organization_id = app_private.current_organization_id());
create policy subscriptions_manage_owner on public.subscriptions for all
  using (organization_id = app_private.current_organization_id() and app_private.is_owner())
  with check (organization_id = app_private.current_organization_id() and app_private.is_owner());

create policy inventory_select_org on public.inventory for select
  using (organization_id = app_private.current_organization_id());
create policy inventory_write_staff on public.inventory for all
  using (organization_id = app_private.current_organization_id() and app_private.has_role(array['owner','admin','warehouse_manager']))
  with check (organization_id = app_private.current_organization_id() and app_private.has_role(array['owner','admin','warehouse_manager']));

do $$
declare
  table_name text;
  write_roles text;
begin
  foreach table_name in array array['students']
  loop
    write_roles := 'array[''owner'',''admin'',''branch_admin'']';
    execute format('create policy %I on public.%I for select using (organization_id = app_private.current_organization_id() and app_private.can_access_branch(branch_id))', table_name || '_select_scoped', table_name);
    execute format('create policy %I on public.%I for all using (organization_id = app_private.current_organization_id() and app_private.can_access_branch(branch_id) and app_private.has_role(%s)) with check (organization_id = app_private.current_organization_id() and app_private.can_access_branch(branch_id) and app_private.has_role(%s))', table_name || '_write_staff', table_name, write_roles, write_roles);
  end loop;

  foreach table_name in array array['groups', 'trainers', 'attendance']
  loop
    write_roles := 'array[''owner'',''admin'',''branch_admin'',''trainer'']';
    execute format('create policy %I on public.%I for select using (organization_id = app_private.current_organization_id() and app_private.can_access_branch(branch_id))', table_name || '_select_scoped', table_name);
    execute format('create policy %I on public.%I for all using (organization_id = app_private.current_organization_id() and app_private.can_access_branch(branch_id) and app_private.has_role(%s)) with check (organization_id = app_private.current_organization_id() and app_private.can_access_branch(branch_id) and app_private.has_role(%s))', table_name || '_write_staff', table_name, write_roles, write_roles);
  end loop;

  foreach table_name in array array['inventory_stock']
  loop
    write_roles := 'array[''owner'',''admin'',''warehouse_manager'']';
    execute format('create policy %I on public.%I for select using (organization_id = app_private.current_organization_id() and app_private.can_access_branch(branch_id))', table_name || '_select_scoped', table_name);
    execute format('create policy %I on public.%I for all using (organization_id = app_private.current_organization_id() and app_private.can_access_branch(branch_id) and app_private.has_role(%s)) with check (organization_id = app_private.current_organization_id() and app_private.can_access_branch(branch_id) and app_private.has_role(%s))', table_name || '_write_staff', table_name, write_roles, write_roles);
  end loop;
end $$;

create policy student_transfers_select_scoped on public.student_transfers for select
  using (
    organization_id = app_private.current_organization_id()
    and (
      app_private.can_access_branch(from_branch_id)
      or app_private.can_access_branch(to_branch_id)
    )
  );
create policy student_transfers_write_staff on public.student_transfers for all
  using (
    organization_id = app_private.current_organization_id()
    and (
      app_private.can_access_branch(from_branch_id)
      or app_private.can_access_branch(to_branch_id)
    )
    and app_private.has_role(array['owner','admin','branch_admin'])
  )
  with check (
    organization_id = app_private.current_organization_id()
    and (
      app_private.can_access_branch(from_branch_id)
      or app_private.can_access_branch(to_branch_id)
    )
    and app_private.has_role(array['owner','admin','branch_admin'])
  );

do $$
declare
  table_name text;
  write_roles text;
begin
  foreach table_name in array array['payments']
  loop
    write_roles := 'array[''owner'',''admin'',''branch_admin'',''cashier'']';
    execute format('create policy %I on public.%I for select using (organization_id = app_private.current_organization_id() and app_private.can_access_branch(branch_id) and (deleted_at is null or app_private.is_owner()))', table_name || '_select_scoped', table_name);
    execute format('create policy %I on public.%I for insert with check (organization_id = app_private.current_organization_id() and app_private.can_access_branch(branch_id) and app_private.has_role(%s))', table_name || '_insert_staff', table_name, write_roles);
    execute format('create policy %I on public.%I for update using (organization_id = app_private.current_organization_id() and app_private.can_access_branch(branch_id) and app_private.has_role(%s) and (app_private.is_owner() or not is_locked)) with check (organization_id = app_private.current_organization_id() and app_private.can_access_branch(branch_id) and app_private.has_role(%s))', table_name || '_update_unlocked', table_name, write_roles, write_roles);
    execute format('create policy %I on public.%I for delete using (organization_id = app_private.current_organization_id() and app_private.can_access_branch(branch_id) and app_private.has_role(%s) and (app_private.is_owner() or not is_locked))', table_name || '_delete_unlocked', table_name, write_roles);
  end loop;

  foreach table_name in array array['inventory_movements', 'inventory_receipts', 'stock_adjustments']
  loop
    write_roles := 'array[''owner'',''admin'',''warehouse_manager'']';
    execute format('create policy %I on public.%I for select using (organization_id = app_private.current_organization_id() and app_private.can_access_branch(branch_id) and (deleted_at is null or app_private.is_owner()))', table_name || '_select_scoped', table_name);
    execute format('create policy %I on public.%I for insert with check (organization_id = app_private.current_organization_id() and app_private.can_access_branch(branch_id) and app_private.has_role(%s))', table_name || '_insert_staff', table_name, write_roles);
    execute format('create policy %I on public.%I for update using (organization_id = app_private.current_organization_id() and app_private.can_access_branch(branch_id) and app_private.has_role(%s) and (app_private.is_owner() or not is_locked)) with check (organization_id = app_private.current_organization_id() and app_private.can_access_branch(branch_id) and app_private.has_role(%s))', table_name || '_update_unlocked', table_name, write_roles, write_roles);
    execute format('create policy %I on public.%I for delete using (organization_id = app_private.current_organization_id() and app_private.can_access_branch(branch_id) and app_private.has_role(%s) and (app_private.is_owner() or not is_locked))', table_name || '_delete_unlocked', table_name, write_roles);
  end loop;

  foreach table_name in array array['sales']
  loop
    write_roles := 'array[''owner'',''admin'',''cashier'',''warehouse_manager'']';
    execute format('create policy %I on public.%I for select using (organization_id = app_private.current_organization_id() and app_private.can_access_branch(branch_id) and (deleted_at is null or app_private.is_owner()))', table_name || '_select_scoped', table_name);
    execute format('create policy %I on public.%I for insert with check (organization_id = app_private.current_organization_id() and app_private.can_access_branch(branch_id) and app_private.has_role(%s))', table_name || '_insert_staff', table_name, write_roles);
    execute format('create policy %I on public.%I for update using (organization_id = app_private.current_organization_id() and app_private.can_access_branch(branch_id) and app_private.has_role(%s) and (app_private.is_owner() or not is_locked)) with check (organization_id = app_private.current_organization_id() and app_private.can_access_branch(branch_id) and app_private.has_role(%s))', table_name || '_update_unlocked', table_name, write_roles, write_roles);
    execute format('create policy %I on public.%I for delete using (organization_id = app_private.current_organization_id() and app_private.can_access_branch(branch_id) and app_private.has_role(%s) and (app_private.is_owner() or not is_locked))', table_name || '_delete_unlocked', table_name, write_roles);
  end loop;
end $$;

create policy audit_logs_select_owner on public.audit_logs for select
  using (organization_id = app_private.current_organization_id() and app_private.is_owner());
create policy audit_logs_insert_staff on public.audit_logs for insert
  with check (
    organization_id = app_private.current_organization_id()
    and created_by = auth.uid()
    and app_private.has_role(array['owner','admin','branch_admin','cashier','trainer','warehouse_manager'])
  );

create policy notifications_select_own on public.notifications for select
  using (user_id = auth.uid());
create policy notifications_update_own on public.notifications for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy invites_owner_only on public.invites for all
  using (organization_id = app_private.current_organization_id() and app_private.is_owner())
  with check (organization_id = app_private.current_organization_id() and app_private.is_owner());

revoke update, delete on public.audit_logs from authenticated;
grant select, insert on public.audit_logs to authenticated;
grant select, insert, update, delete on public.admin_slots to authenticated;
grant select, insert, update, delete on public.inventory_receipts to authenticated;
grant select, insert, update, delete on public.stock_adjustments to authenticated;

do $$
declare
  table_name text;
begin
  foreach table_name in array array['admin_slots', 'inventory_receipts', 'stock_adjustments']
  loop
    execute format('drop trigger if exists set_%I_updated_date on public.%I', table_name, table_name);
    execute format(
      'create trigger set_%I_updated_date before update on public.%I for each row execute function public.set_updated_date()',
      table_name,
      table_name
    );
  end loop;
end $$;

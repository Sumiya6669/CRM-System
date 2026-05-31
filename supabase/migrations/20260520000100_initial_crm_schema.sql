create extension if not exists pgcrypto;

create schema if not exists app_private;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'crm_role') then
    create type public.crm_role as enum (
      'owner',
      'admin',
      'branch_admin',
      'cashier',
      'trainer',
      'warehouse_manager'
    );
  end if;
end $$;

create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  legal_name text,
  bin text,
  country text default 'Kazakhstan',
  city text,
  phone text,
  email text,
  status text not null default 'active',
  settings jsonb not null default '{}'::jsonb,
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now()
);

create table if not exists public.branches (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  city text,
  address text,
  phone text,
  status text not null default 'active',
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now()
);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  organization_id uuid references public.organizations(id) on delete set null,
  branch_id uuid references public.branches(id) on delete set null,
  full_name text,
  email text,
  phone text,
  role public.crm_role not null default 'trainer',
  status text not null default 'active',
  invited_by uuid references public.profiles(id) on delete set null,
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now()
);

create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  profile_id uuid unique references public.profiles(id) on delete cascade,
  organization_id uuid references public.organizations(id) on delete set null,
  email text,
  status text not null default 'active',
  last_sign_in_at timestamptz,
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now()
);

create table if not exists public.trainers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  branch_id uuid references public.branches(id) on delete set null,
  branch_name text,
  full_name text not null,
  phone text,
  email text,
  belt text,
  specialization text,
  status text not null default 'active',
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now()
);

create table if not exists public.groups (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  branch_id uuid references public.branches(id) on delete set null,
  branch_name text,
  coach_id uuid references public.trainers(id) on delete set null,
  coach_name text,
  name text not null,
  age_group text,
  schedule jsonb not null default '[]'::jsonb,
  capacity integer,
  status text not null default 'active',
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now()
);

create table if not exists public.parents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  full_name text not null,
  phone text,
  email text,
  notes text,
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now()
);

create table if not exists public.students (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  branch_id uuid references public.branches(id) on delete set null,
  group_id uuid references public.groups(id) on delete set null,
  coach_id uuid references public.trainers(id) on delete set null,
  parent_id uuid references public.parents(id) on delete set null,
  student_id text,
  full_name text not null,
  birth_date date,
  gender text,
  branch_name text,
  group_name text,
  coach_name text,
  parent_name text,
  parent_phone text,
  start_date date,
  paid_until date,
  belt text not null default 'white',
  debt numeric(12,2) not null default 0,
  status text not null default 'active',
  notes text,
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now()
);

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  price numeric(12,2) not null default 0,
  duration_days integer not null default 30,
  visits_limit integer,
  status text not null default 'active',
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now()
);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  branch_id uuid references public.branches(id) on delete set null,
  student_id uuid references public.students(id) on delete set null,
  subscription_id uuid references public.subscriptions(id) on delete set null,
  student_name text,
  branch_name text,
  amount numeric(12,2) not null default 0,
  payment_date date not null default current_date,
  method text not null default 'cash',
  status text not null default 'paid',
  period_from date,
  period_to date,
  comment text,
  created_by uuid references public.profiles(id) on delete set null,
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now()
);

create table if not exists public.inventory (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  sku text,
  category text not null default 'other',
  size text,
  color text,
  cost_price numeric(12,2) not null default 0,
  sell_price numeric(12,2) not null default 0,
  min_stock integer not null default 0,
  status text not null default 'active',
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now()
);

create table if not exists public.inventory_stock (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  product_id uuid not null references public.inventory(id) on delete cascade,
  product_name text,
  branch_id uuid references public.branches(id) on delete cascade,
  branch_name text,
  quantity integer not null default 0,
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now(),
  unique (product_id, branch_id)
);

create table if not exists public.inventory_movements (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  product_id uuid references public.inventory(id) on delete set null,
  product_name text,
  branch_id uuid references public.branches(id) on delete set null,
  branch_name text,
  from_branch_id uuid references public.branches(id) on delete set null,
  from_branch_name text,
  to_branch_id uuid references public.branches(id) on delete set null,
  to_branch_name text,
  quantity integer not null default 0,
  movement_type text not null default 'transfer',
  reason text,
  created_by uuid references public.profiles(id) on delete set null,
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now()
);

create table if not exists public.sales (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  branch_id uuid references public.branches(id) on delete set null,
  branch_name text,
  student_id uuid references public.students(id) on delete set null,
  student_name text,
  product_id uuid references public.inventory(id) on delete set null,
  product_name text,
  buyer_name text,
  items jsonb not null default '[]'::jsonb,
  quantity integer not null default 1,
  total numeric(12,2) not null default 0,
  payment_method text not null default 'cash',
  sale_date date not null default current_date,
  discount numeric(5,2) not null default 0,
  comment text,
  created_by uuid references public.profiles(id) on delete set null,
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now()
);

create table if not exists public.attendance (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  branch_id uuid references public.branches(id) on delete set null,
  group_id uuid references public.groups(id) on delete set null,
  student_id uuid references public.students(id) on delete cascade,
  student_name text,
  branch_name text,
  group_name text,
  date date not null default current_date,
  present boolean not null default false,
  comment text,
  created_by uuid references public.profiles(id) on delete set null,
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now(),
  unique (student_id, date)
);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  branch_id uuid references public.branches(id) on delete set null,
  branch_name text,
  user_id uuid references public.profiles(id) on delete set null,
  user_name text,
  action_type text not null,
  entity_type text,
  entity_id uuid,
  description text,
  amount numeric(12,2),
  quantity integer,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles(id) on delete set null,
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now()
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete cascade,
  title text not null,
  body text,
  type text not null default 'info',
  read_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now()
);

create table if not exists public.student_transfers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  student_id uuid references public.students(id) on delete cascade,
  student_name text,
  from_branch_id uuid references public.branches(id) on delete set null,
  from_branch_name text,
  to_branch_id uuid references public.branches(id) on delete set null,
  to_branch_name text,
  transfer_date date not null default current_date,
  reason text,
  created_by uuid references public.profiles(id) on delete set null,
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now()
);

create table if not exists public.invites (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  branch_id uuid references public.branches(id) on delete set null,
  email text not null,
  role public.crm_role not null,
  token text not null unique default encode(gen_random_bytes(24), 'hex'),
  status text not null default 'pending',
  expires_at timestamptz not null default now() + interval '7 days',
  accepted_by uuid references public.profiles(id) on delete set null,
  created_by uuid references public.profiles(id) on delete set null,
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now()
);

create or replace function app_private.current_organization_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select organization_id from public.profiles where id = auth.uid() and status = 'active'
$$;

create or replace function app_private.current_branch_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select branch_id from public.profiles where id = auth.uid() and status = 'active'
$$;

create or replace function app_private.current_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role::text from public.profiles where id = auth.uid() and status = 'active'
$$;

create or replace function app_private.has_role(required_roles text[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(app_private.current_role() = any(required_roles), false)
$$;

create or replace function public.set_updated_date()
returns trigger
language plpgsql
as $$
begin
  new.updated_date = now();
  return new;
end;
$$;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'organizations',
    'branches',
    'profiles',
    'users',
    'students',
    'parents',
    'groups',
    'trainers',
    'subscriptions',
    'payments',
    'inventory',
    'inventory_stock',
    'inventory_movements',
    'sales',
    'attendance',
    'audit_logs',
    'notifications',
    'student_transfers',
    'invites'
  ]
  loop
    execute format('drop trigger if exists set_%I_updated_date on public.%I', table_name, table_name);
    execute format(
      'create trigger set_%I_updated_date before update on public.%I for each row execute function public.set_updated_date()',
      table_name,
      table_name
    );
  end loop;
end $$;

alter table public.organizations enable row level security;
alter table public.branches enable row level security;
alter table public.profiles enable row level security;
alter table public.users enable row level security;
alter table public.students enable row level security;
alter table public.parents enable row level security;
alter table public.groups enable row level security;
alter table public.trainers enable row level security;
alter table public.subscriptions enable row level security;
alter table public.payments enable row level security;
alter table public.inventory enable row level security;
alter table public.inventory_stock enable row level security;
alter table public.inventory_movements enable row level security;
alter table public.sales enable row level security;
alter table public.attendance enable row level security;
alter table public.audit_logs enable row level security;
alter table public.notifications enable row level security;
alter table public.student_transfers enable row level security;
alter table public.invites enable row level security;

create policy "organizations_select_by_members"
  on public.organizations for select
  using (id = app_private.current_organization_id());

create policy "organizations_manage_by_owner_admin"
  on public.organizations for all
  using (app_private.has_role(array['owner','admin']))
  with check (app_private.has_role(array['owner','admin']));

create policy "profiles_select_self_or_management"
  on public.profiles for select
  using (
    id = auth.uid()
    or (
      organization_id = app_private.current_organization_id()
      and app_private.has_role(array['owner','admin','branch_admin'])
    )
  );

create policy "profiles_manage_by_owner_admin"
  on public.profiles for all
  using (
    organization_id = app_private.current_organization_id()
    and app_private.has_role(array['owner','admin'])
  )
  with check (
    organization_id = app_private.current_organization_id()
    and app_private.has_role(array['owner','admin'])
  );

create policy "notifications_select_own"
  on public.notifications for select
  using (user_id = auth.uid() or organization_id = app_private.current_organization_id());

create policy "notifications_update_own"
  on public.notifications for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'branches',
    'users',
    'students',
    'parents',
    'groups',
    'trainers',
    'subscriptions',
    'payments',
    'inventory',
    'inventory_stock',
    'inventory_movements',
    'sales',
    'attendance',
    'audit_logs',
    'student_transfers',
    'invites'
  ]
  loop
    execute format(
      'create policy %I on public.%I for select using (organization_id = app_private.current_organization_id())',
      table_name || '_select_by_org',
      table_name
    );

    execute format(
      'create policy %I on public.%I for insert with check (organization_id = app_private.current_organization_id() and app_private.has_role(array[''owner'',''admin'',''branch_admin'',''cashier'',''warehouse_manager'']))',
      table_name || '_insert_by_staff',
      table_name
    );

    execute format(
      'create policy %I on public.%I for update using (organization_id = app_private.current_organization_id() and app_private.has_role(array[''owner'',''admin'',''branch_admin'',''cashier'',''warehouse_manager''])) with check (organization_id = app_private.current_organization_id() and app_private.has_role(array[''owner'',''admin'',''branch_admin'',''cashier'',''warehouse_manager'']))',
      table_name || '_update_by_staff',
      table_name
    );

    execute format(
      'create policy %I on public.%I for delete using (organization_id = app_private.current_organization_id() and app_private.has_role(array[''owner'',''admin'']))',
      table_name || '_delete_by_admin',
      table_name
    );
  end loop;
end $$;

create index if not exists branches_org_idx on public.branches(organization_id);
create index if not exists profiles_org_role_idx on public.profiles(organization_id, role);
create index if not exists users_org_idx on public.users(organization_id);
create index if not exists students_org_branch_status_idx on public.students(organization_id, branch_id, status);
create index if not exists students_search_idx on public.students using gin (to_tsvector('simple', coalesce(full_name, '') || ' ' || coalesce(student_id, '') || ' ' || coalesce(parent_phone, '')));
create index if not exists payments_org_date_idx on public.payments(organization_id, payment_date desc);
create index if not exists payments_student_idx on public.payments(student_id);
create index if not exists inventory_org_category_idx on public.inventory(organization_id, category);
create index if not exists inventory_stock_product_branch_idx on public.inventory_stock(product_id, branch_id);
create index if not exists sales_org_date_idx on public.sales(organization_id, sale_date desc);
create index if not exists attendance_org_date_idx on public.attendance(organization_id, date desc);
create index if not exists audit_logs_org_created_idx on public.audit_logs(organization_id, created_date desc);
create index if not exists notifications_user_read_idx on public.notifications(user_id, read_at);

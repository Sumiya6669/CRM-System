create or replace function app_private.resource_allowed(resource_name text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    app_private.is_owner()
    or coalesce((
      permissions ->> case
        when resource_name in ('parents', 'groups', 'trainers', 'student_transfers') then 'students'
        when resource_name in ('inventory_stock', 'inventory_movements', 'inventory_receipts', 'stock_adjustments') then 'inventory'
        else resource_name
      end
    )::boolean, true)
  from public.profiles
  where id = auth.uid() and status = 'active'
$$;

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
      and tablename = any(array[
        'students', 'parents', 'groups', 'trainers', 'attendance', 'payments',
        'inventory', 'inventory_stock', 'inventory_movements', 'inventory_receipts',
        'stock_adjustments', 'sales', 'student_transfers'
      ])
      and (
        policyname like '%_write_staff_%'
        or policyname like '%_insert_staff'
        or policyname like '%_update_unlocked'
        or policyname like '%_delete_unlocked'
      )
  loop
    using_expression := case
      when current_policy.qual is null then null
      else '(' || current_policy.qual || ') and app_private.resource_allowed(' || quote_literal(current_policy.tablename) || ')'
    end;
    check_expression := case
      when current_policy.with_check is null then null
      else '(' || current_policy.with_check || ') and app_private.resource_allowed(' || quote_literal(current_policy.tablename) || ')'
    end;

    if current_policy.cmd = 'INSERT' then
      execute format('alter policy %I on public.%I with check (%s)', current_policy.policyname, current_policy.tablename, check_expression);
    elsif current_policy.cmd = 'UPDATE' then
      execute format('alter policy %I on public.%I using (%s) with check (%s)', current_policy.policyname, current_policy.tablename, using_expression, check_expression);
    elsif current_policy.cmd = 'DELETE' then
      execute format('alter policy %I on public.%I using (%s)', current_policy.policyname, current_policy.tablename, using_expression);
    end if;
  end loop;
end $$;

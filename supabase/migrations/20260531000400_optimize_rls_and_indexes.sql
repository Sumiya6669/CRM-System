create index if not exists attendance_branch_idx on public.attendance(branch_id);
create index if not exists attendance_group_idx on public.attendance(group_id);
create index if not exists attendance_coach_idx on public.attendance(coach_id);
create index if not exists attendance_created_by_idx on public.attendance(created_by);
create index if not exists audit_logs_branch_idx on public.audit_logs(branch_id);
create index if not exists audit_logs_user_idx on public.audit_logs(user_id);
create index if not exists audit_logs_created_by_idx on public.audit_logs(created_by);
create index if not exists groups_branch_idx on public.groups(branch_id);
create index if not exists groups_coach_idx on public.groups(coach_id);
create index if not exists inventory_stock_org_idx on public.inventory_stock(organization_id);
create index if not exists inventory_stock_branch_idx on public.inventory_stock(branch_id);
create index if not exists inventory_movements_org_idx on public.inventory_movements(organization_id);
create index if not exists inventory_movements_product_idx on public.inventory_movements(product_id);
create index if not exists inventory_movements_branch_idx on public.inventory_movements(branch_id);
create index if not exists inventory_movements_from_branch_idx on public.inventory_movements(from_branch_id);
create index if not exists inventory_movements_to_branch_idx on public.inventory_movements(to_branch_id);
create index if not exists inventory_receipts_branch_idx on public.inventory_receipts(branch_id);
create index if not exists stock_adjustments_branch_idx on public.stock_adjustments(branch_id);
create index if not exists stock_adjustments_product_idx on public.stock_adjustments(product_id);
create index if not exists payments_branch_idx on public.payments(branch_id);
create index if not exists sales_branch_idx on public.sales(branch_id);
create index if not exists sales_product_idx on public.sales(product_id);

do $$
declare
  current_policy record;
  check_expression text;
begin
  for current_policy in
    select tablename, policyname, qual, with_check
    from pg_policies
    where schemaname = 'public'
      and policyname = any(array[
        'branches_manage_owner',
        'profiles_manage_owner',
        'users_manage_owner',
        'subscriptions_manage_owner',
        'parents_write_staff',
        'inventory_write_staff',
        'students_write_staff',
        'groups_write_staff',
        'trainers_write_staff',
        'attendance_write_staff',
        'inventory_stock_write_staff',
        'student_transfers_write_staff'
      ])
  loop
    check_expression := coalesce(current_policy.with_check, current_policy.qual);
    execute format('drop policy if exists %I on public.%I', current_policy.policyname, current_policy.tablename);
    execute format(
      'create policy %I on public.%I for insert with check (%s)',
      current_policy.policyname || '_insert',
      current_policy.tablename,
      check_expression
    );
    execute format(
      'create policy %I on public.%I for update using (%s) with check (%s)',
      current_policy.policyname || '_update',
      current_policy.tablename,
      current_policy.qual,
      check_expression
    );
    execute format(
      'create policy %I on public.%I for delete using (%s)',
      current_policy.policyname || '_delete',
      current_policy.tablename,
      current_policy.qual
    );
  end loop;
end $$;

alter policy profiles_select_self_or_owner on public.profiles
  using (id = (select auth.uid()) or (organization_id = app_private.current_organization_id() and app_private.is_owner()));
alter policy users_select_self_or_owner on public.users
  using (id = (select auth.uid()) or (organization_id = app_private.current_organization_id() and app_private.is_owner()));
alter policy audit_logs_insert_staff on public.audit_logs
  with check (
    organization_id = app_private.current_organization_id()
    and created_by = (select auth.uid())
    and app_private.current_role() is not null
  );
alter policy notifications_select_own on public.notifications
  using (user_id = (select auth.uid()));
alter policy notifications_update_own on public.notifications
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

do $$
declare
  foreign_key record;
begin
  for foreign_key in
    select table_class.relname as table_name, attribute.attname as column_name
    from pg_constraint constraint_row
    join pg_class table_class on table_class.oid = constraint_row.conrelid
    join pg_namespace namespace_row on namespace_row.oid = table_class.relnamespace
    join pg_attribute attribute
      on attribute.attrelid = constraint_row.conrelid
      and attribute.attnum = constraint_row.conkey[1]
    where constraint_row.contype = 'f'
      and namespace_row.nspname = 'public'
      and array_length(constraint_row.conkey, 1) = 1
      and not exists (
        select 1
        from pg_index index_row
        where index_row.indrelid = constraint_row.conrelid
          and index_row.indisvalid
          and index_row.indkey[0] = constraint_row.conkey[1]
      )
  loop
    execute format(
      'create index if not exists %I on public.%I (%I)',
      foreign_key.table_name || '_' || foreign_key.column_name || '_fk_idx',
      foreign_key.table_name,
      foreign_key.column_name
    );
  end loop;
end $$;

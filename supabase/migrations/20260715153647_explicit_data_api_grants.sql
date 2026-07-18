-- Explicit Data API grants for new Supabase projects.
-- RLS policies still decide which rows authenticated users can access.

grant usage on schema public to anon, authenticated, service_role;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'organizations',
    'branches',
    'profiles',
    'users',
    'trainers',
    'groups',
    'parents',
    'students',
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
    'invites',
    'admin_slots',
    'inventory_receipts',
    'stock_adjustments'
  ]
  loop
    execute format('revoke all on table public.%I from anon', table_name);
    execute format('grant select, insert, update, delete on table public.%I to authenticated', table_name);
    execute format('grant select, insert, update, delete on table public.%I to service_role', table_name);
  end loop;
end $$;

revoke update, delete on public.audit_logs from authenticated;
grant select, insert on public.audit_logs to authenticated;

revoke all on function public.owner_manage_record(text, uuid, text, text) from public, anon;
revoke all on function public.owner_list_deleted_records() from public, anon;
grant execute on function public.owner_manage_record(text, uuid, text, text) to authenticated, service_role;
grant execute on function public.owner_list_deleted_records() to authenticated, service_role;

notify pgrst, 'reload schema';

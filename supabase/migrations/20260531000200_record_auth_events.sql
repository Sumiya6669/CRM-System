create or replace function public.record_auth_event(event_name text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  current_profile public.profiles%rowtype;
begin
  if event_name not in ('login', 'logout') then
    raise exception 'Unsupported auth event';
  end if;

  select * into current_profile
  from public.profiles
  where id = auth.uid() and status = 'active';

  if current_profile.id is null then
    raise exception 'Active profile is required';
  end if;

  if event_name = 'login' then
    update public.profiles
    set last_login_at = now()
    where id = current_profile.id;

    update public.users
    set last_sign_in_at = now()
    where id = current_profile.id;
  end if;

  insert into public.audit_logs (
    organization_id,
    branch_id,
    user_id,
    user_name,
    role,
    operation,
    action_type,
    entity_type,
    entity_id,
    description,
    created_by
  )
  values (
    current_profile.organization_id,
    current_profile.branch_id,
    current_profile.id,
    current_profile.full_name,
    current_profile.role::text,
    event_name,
    'auth_' || event_name,
    'profiles',
    current_profile.id,
    'auth: ' || event_name,
    current_profile.id
  );
end;
$$;

revoke all on function public.record_auth_event(text) from public;
grant execute on function public.record_auth_event(text) to authenticated;

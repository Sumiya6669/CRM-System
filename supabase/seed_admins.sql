-- Creates the three Owner-managed administrator slots and ten attendance groups.
-- It never stores or creates passwords. Auth users are created by Owner through admin-users.

insert into public.admin_slots (organization_id, slot_number, label)
select organization_id, slot_number, 'Admin ' || slot_number
from (
  select distinct organization_id from public.profiles where role = 'owner' and organization_id is not null
) organizations
cross join generate_series(1, 3) as slot_number
on conflict (organization_id, slot_number) do update set label = excluded.label;

insert into public.groups (organization_id, name, schedule, status)
select organization_id, 'Group ' || group_number, '[]'::jsonb, 'active'
from (
  select distinct organization_id from public.profiles where role = 'owner' and organization_id is not null
) organizations
cross join generate_series(1, 10) as group_number
on conflict (organization_id, name) do nothing;

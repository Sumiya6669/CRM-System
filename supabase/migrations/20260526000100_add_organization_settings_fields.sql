alter table public.organizations
  add column if not exists address text,
  add column if not exists description text,
  add column if not exists logo_url text,
  add column if not exists primary_color text default '#83213f',
  add column if not exists branch_information text,
  add column if not exists timezone text default 'Asia/Almaty',
  add column if not exists currency text default 'KZT';

update public.organizations
set
  address = coalesce(address, settings ->> 'address'),
  description = coalesce(description, settings ->> 'description'),
  logo_url = coalesce(logo_url, settings ->> 'logo_url'),
  primary_color = coalesce(primary_color, settings ->> 'primary_color', '#83213f'),
  branch_information = coalesce(branch_information, settings ->> 'branch_information'),
  timezone = coalesce(timezone, settings ->> 'timezone', 'Asia/Almaty'),
  currency = coalesce(currency, settings ->> 'currency', 'KZT');

comment on column public.organizations.address is 'Organization public address for CRM settings.';
comment on column public.organizations.description is 'Short organization description displayed in internal settings.';
comment on column public.organizations.logo_url is 'Logo URL used by the CRM UI.';
comment on column public.organizations.primary_color is 'Primary brand color in HEX format.';
comment on column public.organizations.branch_information is 'Operational branch information shown in settings.';
comment on column public.organizations.timezone is 'Default organization timezone, e.g. Asia/Almaty.';
comment on column public.organizations.currency is 'Default accounting currency code, e.g. KZT.';

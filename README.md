# Taekwondo CRM

Production-ready React/Vite CRM для управления филиалами, учениками, оплатами, складом, продажами, посещаемостью и отчетами.

## Stack

- React + Vite
- Supabase Auth + Postgres + RLS
- TanStack Query
- Tailwind CSS + Radix UI primitives
- Vercel

## Local Setup

1. Установите зависимости:

```bash
npm install
```

2. Создайте Supabase проект.

3. Заполните `.env.local` значениями из Supabase Dashboard:

```bash
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
VITE_APP_NAME=Taekwondo CRM
VITE_APP_ENV=development
VITE_APP_URL=http://localhost:5173
VITE_COMPANY_NAME=
VITE_SUPPORT_EMAIL=
```

Где взять значения:

- `VITE_SUPABASE_URL`: Supabase Dashboard -> Project Settings -> API -> Project URL.
- `VITE_SUPABASE_ANON_KEY`: Supabase Dashboard -> Project Settings -> API -> Project API keys -> anon public / publishable key.
- `SUPABASE_SERVICE_ROLE_KEY`: Supabase Dashboard -> Project Settings -> API -> Project API keys -> service_role. Использовать только на сервере/CI, не в frontend.

4. Примените схему базы:

```bash
supabase db push
```

Если Supabase CLI не установлен, откройте Supabase Dashboard -> SQL Editor и выполните SQL из `supabase/migrations/20260520000100_initial_crm_schema.sql`.

5. Запустите локально:

```bash
npm run dev
```

## Production Build

```bash
npm run build
npm run preview
```

## Auth And Roles

Поддерживаются роли:

- Owner
- Admin
- Branch Admin
- Cashier
- Trainer
- Warehouse Manager

Роли и разрешения описаны в `src/constants/roles.js`. RLS политики используют `profiles.role`, не пользовательские `user_metadata`.

## Project Structure

```text
src/
  assets/
  components/
  constants/
  contexts/
  features/
  hooks/
  integrations/
  layouts/
  lib/
  pages/
  providers/
  services/
  store/
  types/
  utils/
```

## Documentation

- Database: `docs/database.md`
- Deployment: `docs/deployment.md`
- Supabase schema notes: `supabase/schema/README.md`

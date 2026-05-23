# Architecture Notes

## Цель

Проект больше не зависит от внешнего prototype runtime, SDK или генераторского Vite plugin. UI-структура страниц сохранена, а данные идут через Supabase.

## Основные слои

- `src/lib/supabase.ts`: создание Supabase client, env validation, typed query errors.
- `src/services/supabaseRepository.js`: generic repository поверх Supabase tables.
- `src/services/crm.js`: CRM facade, используемый существующими страницами.
- `src/contexts/AuthContext.jsx`: Supabase Auth session persistence, profile loading, logout.
- `src/constants/roles.js`: роли и permission map.
- `src/layouts`: application shell без бизнес-логики.

## Data Contracts

Существующие страницы используют поля вида `created_date`, `branch_name`, `student_name`, поэтому схема базы сохраняет эти имена, чтобы не менять визуальный слой и JSX экранов.

## Production Notes

- В браузере используется только publishable/anon key.
- Service role key запрещено импортировать во frontend.
- Все exposed tables защищены RLS.
- Route splitting включен через `React.lazy`.

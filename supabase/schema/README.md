# Supabase Schema

Основная миграция лежит в `supabase/migrations/20260520000100_initial_crm_schema.sql`.

Схема рассчитана на multi-tenant CRM:

- `organizations` является корневой сущностью.
- Все рабочие таблицы несут `organization_id`.
- `profiles` хранит роль и связку Supabase Auth пользователя с организацией/филиалом.
- RLS включен на всех таблицах публичной схемы.
- `SUPABASE_SERVICE_ROLE_KEY` используется только для серверных операций, миграций и админских скриптов.

Локально применить миграции можно через Supabase CLI после установки:

```bash
supabase start
supabase db reset
```

Для hosted проекта выполните SQL из миграции через Supabase Dashboard -> SQL Editor или подключите CLI к проекту и выполните `supabase db push`.

# Supabase Schema

Основная миграция лежит в `supabase/migrations/20260520000100_initial_crm_schema.sql`. Последующие миграции расширяют RLS, document locking и Owner Super Admin режим.

Схема рассчитана на multi-tenant CRM:

- `organizations` является корневой сущностью.
- Все рабочие таблицы несут `organization_id`.
- `profiles` хранит роль и связку Supabase Auth пользователя с организацией/филиалом.
- RLS включен на всех таблицах публичной схемы.
- `SUPABASE_SERVICE_ROLE_KEY` используется только для серверных операций, миграций и админских скриптов.
- Удаляемые бизнес-записи используют soft delete. Корзина и permanent delete доступны только Owner.

Локально применить миграции можно через Supabase CLI после установки:

```bash
supabase start
supabase db reset
```

Для hosted проекта выполните SQL из миграции через Supabase Dashboard -> SQL Editor или подключите CLI к проекту и выполните `supabase db push`.

# Vercel Deployment Guide

## Environment Variables

В Vercel добавьте переменные в Project Settings -> Environment Variables:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `VITE_APP_NAME`
- `VITE_APP_ENV`
- `VITE_APP_URL`
- `VITE_COMPANY_NAME`
- `VITE_SUPPORT_EMAIL`

`SUPABASE_SERVICE_ROLE_KEY` не используется в браузере, но может понадобиться серверным задачам, миграциям или будущим Vercel Functions. Не импортируйте его в код с `VITE_` префиксом.

## Build Settings

- Framework Preset: Vite
- Install Command: `npm install`
- Build Command: `npm run build`
- Output Directory: `dist`

## SPA Routing

`vercel.json` настроен так, чтобы все frontend routes возвращали `index.html`.

## Recommended Release Flow

1. Применить Supabase миграции.
2. Проверить RLS и создать первого `owner` профиля через service role или SQL Editor.
3. Выполнить локально:

```bash
npm install
npm run build
```

4. Задеплоить на Vercel через Git integration или CLI.
5. Проверить login, dashboard, CRUD операции и RLS доступы для ролей.

# Миграции Supabase

## Применение миграций

### Через Supabase Dashboard

1. Откройте Supabase Dashboard
2. Перейдите в SQL Editor
3. Скопируйте содержимое файла миграции
4. Выполните SQL запрос

### Через Supabase CLI

```bash
# Установите Supabase CLI (если еще не установлен)
npm install -g supabase

# Войдите в Supabase
supabase login

# Свяжите проект
supabase link --project-ref ваш-project-ref

# Примените миграции
supabase db push
```

## Миграции

### 001_add_missing_fields.sql
Добавляет недостающие поля:
- `initial_quantity`, `purchase_price`, `total_cost` в таблицу `materials`
- `profile_id` в таблицу `projects` (связь с профилем монтажа)
- `is_default` в таблицу `installation_profiles` (профиль по умолчанию)

### 002_update_sync_fields.sql
Проверяет и добавляет поля синхронизации (защитная миграция)

## Важно

После применения миграций:
1. Обновите RLS политики, если необходимо
2. Проверьте, что все поля корректно созданы
3. Перезапустите приложение для применения изменений

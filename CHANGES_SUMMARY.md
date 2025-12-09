# Сводка изменений: Множественные профили монтажа и миграции

## Выполненные задачи

### ✅ 1. Анализ недостающих полей в Supabase

**Обнаружены отсутствующие поля:**
- `materials.initial_quantity` - изначальное количество из Excel
- `materials.purchase_price` - стоимость закупа
- `materials.total_cost` - общая себестоимость
- `projects.profile_id` - связь проекта с профилем монтажа
- `installation_profiles.is_default` - флаг профиля по умолчанию

### ✅ 2. Созданы SQL миграции

**Файлы:**
- `supabase/migrations/001_add_missing_fields.sql` - основная миграция
- `supabase/migrations/002_update_sync_fields.sql` - защитная миграция
- `supabase/migrations/README.md` - инструкция по применению

**Что добавляется:**
- Поля в таблицу `materials`
- Поле `profile_id` в таблицу `projects` с внешним ключом
- Поле `is_default` в таблицу `installation_profiles`
- Уникальный индекс для одного профиля по умолчанию на пользователя
- Индекс для быстрого поиска проектов по профилю

### ✅ 3. Множественные профили монтажа

**Новые возможности:**
- Создание нескольких профилей монтажа
- Установка профиля по умолчанию
- Выбор профиля при создании/редактировании проекта
- Автоматическое использование профиля по умолчанию, если профиль не выбран

**Обновленные компоненты:**
- `ProfilesList.tsx` - список всех профилей с выбором активного
- `ProjectEditor.tsx` - выбор профиля для проекта
- `profileService.ts` - методы для работы с несколькими профилями

### ✅ 4. Исправления синхронизации

**Исправлено:**
- Синхронизация материалов теперь отправляет все поля (включая `initial_quantity`, `purchase_price`, `total_cost`)
- Исправлена ошибка `onConflict` для новых работ (используется `insert` вместо `upsert`)
- Добавлена синхронизация профилей с Supabase
- Улучшена обработка ошибок с детальным логированием

## Структура изменений

### Модели данных

```typescript
// Project
interface Project {
  profileId?: string | null  // NEW: ID профиля монтажа
  // ... остальные поля
}

// InstallationProfile
interface InstallationProfile {
  isDefault?: boolean  // NEW: Профиль по умолчанию
  // ... остальные поля
}
```

### Новые методы в profileService

```typescript
getAllProfiles(userId: string): Promise<InstallationProfile[]>
createProfile(userId: string, name: string, isDefault: boolean): Promise<InstallationProfile>
updateProfile(id: string | number, data: Partial<InstallationProfile>): Promise<InstallationProfile>
syncProfileToServer(profile: InstallationProfile): Promise<void>
```

### Обновленные методы

```typescript
// estimateService.calculate() - использует project.profileId или профиль по умолчанию
// projectsService.syncToServer() - отправляет profile_id если это UUID
// profileService.syncMaterialToServer() - отправляет все поля включая initial_quantity
```

## Применение миграций

### Шаг 1: Применить SQL миграции

Выполните в Supabase SQL Editor:

```sql
-- Скопируйте содержимое supabase/migrations/001_add_missing_fields.sql
-- Выполните запрос
```

### Шаг 2: Проверка

После применения миграций проверьте:
1. Поля добавлены в таблицы
2. Индексы созданы
3. Внешний ключ установлен

### Шаг 3: Тестирование

1. Создайте несколько профилей монтажа
2. Установите один по умолчанию
3. Создайте проект и выберите профиль
4. Проверьте расчет сметы
5. Проверьте синхронизацию

## Важные замечания

1. **Профиль по умолчанию**: Только один профиль может быть по умолчанию для пользователя
2. **Синхронизация profileId**: В проектах сохраняется только UUID профиля (после синхронизации)
3. **Обратная совместимость**: Старые проекты без `profileId` будут использовать профиль по умолчанию
4. **Миграция данных**: Существующие профили не будут иметь `isDefault`, нужно установить вручную

## Следующие шаги (опционально)

1. Добавить удаление профилей
2. Добавить редактирование названия профиля
3. Добавить копирование профилей
4. Добавить экспорт/импорт отдельных профилей

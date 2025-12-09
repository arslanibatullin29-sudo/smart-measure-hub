# Анализ проекта на соответствие принципам DRY (Don't Repeat Yourself)

## Обнаруженные нарушения принципа DRY

### 1. Дублирование логики автосохранения в EditableMaterialsTable.tsx

**Проблема:** Функции `handleMaterialChange` и `handleWorkChange` содержат практически идентичную логику:
- Одинаковая логика debounce с таймаутами
- Одинаковая валидация (проверка пустых имен и невалидных чисел)
- Одинаковая логика оптимистичного обновления
- Одинаковая обработка ошибок

**Файл:** `src/features/profiles/components/EditableMaterialsTable.tsx` (строки 103-184)

**Рекомендация:** Создать универсальную функцию `useAutoSave` hook, которая принимает:
- Тип сущности (material/work)
- Функцию обновления
- Функцию валидации
- Callback для обновления состояния

---

### 2. Дублирование компонента select для calculationType

**Проблема:** Компонент select с опциями "По площади", "По периметру", "По количеству" повторяется в нескольких местах:
- `EditableMaterialsTable.tsx` - 3 раза (строки 295-303, 402-410, 510-518)
- `ProfilesList.tsx` - 2 раза (строки 276-286, 332-342)
- `EditableWorksTable.tsx` - 1 раз (строки 129-137)

**Рекомендация:** Создать переиспользуемый компонент `CalculationTypeSelect`:
```tsx
<CalculationTypeSelect 
  value={value} 
  onChange={onChange} 
  className={className}
/>
```

---

### 3. Дублирование стилей Input компонентов

**Проблема:** Классы `border-2 border-transparent hover:border-primary/50 focus:border-primary bg-background` повторяются множество раз в `EditableMaterialsTable.tsx`:
- Строки 268, 278, 288, 331, 339, 349, 357, 367, 377, 387, 397, 456, 466, 474, 485, 495, 505, 526

**Рекомендация:** 
1. Создать переиспользуемый компонент `EditableInput` с этими стилями
2. Или добавить вариант в существующий компонент `Input`

---

### 4. Дублирование логики удаления в EditableMaterialsTable.tsx

**Проблема:** Функции `handleDelete` и `handleDeleteWork` содержат идентичную логику:
- Подтверждение через `confirm()`
- Оптимистичное обновление состояния
- Вызов сервиса удаления
- Обработка ошибок с toast
- Вызов `onUpdate()`

**Файл:** `src/features/profiles/components/EditableMaterialsTable.tsx` (строки 194-232)

**Рекомендация:** Создать универсальную функцию `useDeleteHandler` hook или общую функцию `handleDeleteEntity`:
```tsx
const handleDeleteEntity = async (
  id: string | number,
  type: 'material' | 'work',
  confirmMessage: string,
  successMessage: string,
  deleteFn: (id: string | number) => Promise<void>
) => { ... }
```

---

### 5. Дублирование логики поиска по ID в profileService.ts

**Проблема:** В методах `updateMaterial`, `updateWork`, `deleteMaterial`, `deleteWork` повторяется одинаковая логика поиска записи по ID:
```typescript
let entity = await db.table.get(id as any)
if (!entity) {
  const allEntities = await db.table.toArray()
  entity = allEntities.find((e) => String(e.id) === String(id)) || null
}
```

**Файл:** `src/features/projects/estimate/profile/services/profileService.ts`

**Рекомендация:** Создать вспомогательную функцию:
```typescript
async function findEntityById<T>(
  table: Dexie.Table<T, any>,
  id: string | number
): Promise<T | null> {
  let entity = await table.get(id as any)
  if (!entity) {
    const allEntities = await table.toArray()
    entity = allEntities.find((e: any) => String(e.id) === String(id)) || null
  }
  return entity
}
```

---

### 6. Дублирование логики синхронизации в profileService.ts

**Проблема:** Методы `syncMaterialToServer` и `syncWorkToServer` имеют очень похожую структуру:
- Одинаковая обработка ошибок
- Одинаковая логика обновления `syncStatus`
- Одинаковая структура try-catch

**Файл:** `src/features/projects/estimate/profile/services/profileService.ts` (строки 305-366)

**Рекомендация:** Создать универсальную функцию `syncEntityToServer` с параметрами:
- Таблица Supabase
- Объект для синхронизации
- Маппинг полей
- Таблица IndexedDB для обновления статуса

---

### 7. Дублирование логики удаления на сервере в profileService.ts

**Проблема:** Методы `deleteMaterialFromServer` и `deleteWorkFromServer` идентичны, отличаются только названием таблицы.

**Файл:** `src/features/projects/estimate/profile/services/profileService.ts` (строки 368-392)

**Рекомендация:** Создать универсальную функцию:
```typescript
async function deleteEntityFromServer(
  tableName: 'materials' | 'works',
  id: string | number
): Promise<void> { ... }
```

---

### 8. Дублирование обработки ошибок с toast

**Проблема:** Паттерн `console.error(...) + toast.error(...)` повторяется во многих местах:
- `EditableMaterialsTable.tsx` - строки 134-135, 176-177, 207-208, 227-228
- `ProfilesList.tsx` - строки 46, 59, 91, 119, 151, 177
- `ProjectsList.tsx` - строка 30

**Рекомендация:** Создать утилиту `handleError`:
```typescript
export function handleError(error: any, context: string, userMessage?: string) {
  console.error(`${context}:`, error)
  toast.error(userMessage || `Ошибка: ${error.message}`)
}
```

---

### 9. Дублирование логики валидации

**Проблема:** Валидация пустых имен и невалидных чисел повторяется:
- `EditableMaterialsTable.tsx` - строки 114-119, 156-161
- `EditableWorksTable.tsx` - строки 33-40

**Рекомендация:** Создать утилиты валидации:
```typescript
export const validators = {
  isNotEmpty: (value: string) => value && value.trim() !== '',
  isPositiveNumber: (value: any) => !isNaN(parseFloat(value)) && parseFloat(value) >= 0
}
```

---

### 10. Дублирование паттерна confirm + delete

**Проблема:** Паттерн подтверждения удаления через `confirm()` встречается в:
- `EditableMaterialsTable.tsx` - строки 195, 215
- `CustomersList.tsx` - строка 31
- `EditableWorksTable.tsx` - строка 54

**Рекомендация:** Создать переиспользуемый компонент `ConfirmDeleteDialog` или hook `useConfirmDelete`

---

### 11. Дублирование структуры таблиц в EditableMaterialsTable.tsx

**Проблема:** В рендеринге таблицы повторяются похожие структуры для разных типов строк:
- Input поля с одинаковыми классами и логикой
- Похожие структуры для работы и материала

**Рекомендация:** Вынести повторяющиеся части в отдельные компоненты:
- `MaterialInput` - для полей материала
- `WorkInput` - для полей работы
- `CalculationTypeCell` - для ячейки с типом расчета

---

## Приоритеты исправления

### Высокий приоритет:
1. **Компонент CalculationTypeSelect** - используется в 6+ местах
2. **Универсальная логика автосохранения** - большой дублированный блок кода
3. **Утилита обработки ошибок** - используется везде

### Средний приоритет:
4. **Универсальная логика удаления** - упростит поддержку
5. **Вспомогательные функции для работы с БД** - уменьшит дублирование в сервисах
6. **Переиспользуемые Input компоненты** - улучшит консистентность UI

### Низкий приоритет:
7. **Универсальная логика синхронизации** - можно оптимизировать позже
8. **Компонент подтверждения удаления** - улучшит UX

---

## Метрики дублирования

- **Дублированные строки кода:** ~400+ строк
- **Повторяющиеся паттерны:** 11 основных
- **Файлы с наибольшим дублированием:**
  1. `EditableMaterialsTable.tsx` - ~200 строк дублирования
  2. `profileService.ts` - ~150 строк дублирования
  3. `ProfilesList.tsx` - ~50 строк дублирования

---

## Рекомендации по рефакторингу

1. **Создать папку `src/shared/hooks`** для переиспользуемых хуков:
   - `useAutoSave.ts`
   - `useConfirmDelete.ts`
   - `useDebounce.ts`

2. **Создать папку `src/shared/components`** для переиспользуемых компонентов:
   - `CalculationTypeSelect.tsx`
   - `EditableInput.tsx`
   - `ConfirmDeleteDialog.tsx`

3. **Создать папку `src/shared/utils`** для утилит:
   - `errorHandler.ts`
   - `validators.ts`
   - `dbHelpers.ts`

4. **Рефакторинг сервисов:**
   - Вынести общую логику в `baseService.ts`
   - Использовать generic типы для универсальных методов

---

## Заключение

Проект содержит значительное количество дублирования кода, что усложняет поддержку и увеличивает риск ошибок. Рекомендуется провести рефакторинг с приоритетом на наиболее часто используемые паттерны.

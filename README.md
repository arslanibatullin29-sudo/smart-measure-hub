# Room App

Приложение для замеров помещений и расчёта смет на React + TypeScript + Supabase.

## Технологии

- React 18 + TypeScript
- Vite
- Supabase (Backend as a Service)
- Dexie.js (IndexedDB)
- React Router
- React Query
- jsPDF

## Установка

1. Установите зависимости:
```bash
npm install
```

2. Создайте файл `.env` на основе `.env.example` и заполните переменные:
```bash
cp .env.example .env
```

Затем отредактируйте `.env` и укажите ваши значения:
```
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY=your_supabase_anon_key
```

**Важно:** Файл `.env` уже добавлен в `.gitignore` и не будет закоммичен в репозиторий.

3. Запустите dev сервер:
```bash
npm run dev
```

## Структура проекта

```
src/
  features/          # Функциональные модули
    auth/           # Авторизация
    customers/      # Клиенты
    projects/       # Проекты/замеры
    pdf/            # Генерация PDF
  core/             # Ядро приложения
    router/         # Роутинг
    theme/          # Темизация
    utils/          # Утилиты
  services/         # Сервисы
    supabase/       # Supabase клиент
    storage/        # IndexedDB
```

## Разработка

См. `ТЗ_ОБНОВЛЕНИЕ.md` для полного описания требований.
Логика работы приложения описана в `app_ruled.md`.

## Тестирование

Проект включает тесты на Vitest и React Testing Library.

### Запуск тестов

```bash
# Запустить все тесты
npm test

# Запустить тесты в watch режиме
npm test -- --watch

# Запустить тесты с UI
npm run test:ui

# Запустить тесты с покрытием кода
npm run test:coverage
```

Подробная документация: [TESTING.md](./TESTING.md)

## Docker

Проект включает Docker конфигурацию для production и development режимов.

### Быстрый старт с Docker

```bash
# Production
docker-compose up -d

# Development
docker-compose -f docker-compose.dev.yml up
```

Подробная документация: [DOCKER.md](./DOCKER.md)

### Использование Makefile

```bash
make build    # Собрать образ
make up       # Запустить контейнер
make logs     # Просмотр логов
make down     # Остановить
make dev      # Dev режим
```

Полный список команд: `make help`


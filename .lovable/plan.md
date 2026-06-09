
# План доработки Smart Measure Pro: режим «Головная компания + Франчайзи»

Объём огромный, поэтому делаю поэтапно. Каждый шаг — отдельная итерация: сначала бэкенд (миграции + RLS), потом UI. После каждого шага можно проверить, прежде чем идти дальше.

## Анализ текущего состояния

**Что уже есть в БД (Lovable Cloud):**
- `customers`, `projects`, `installation_profiles`, `materials`, `works`, `work_materials`
- RLS: на каждой таблице политика `auth.uid() = user_id` — данные привязаны к пользователю, не к организации.
- Нет таблиц `organizations`, `organization_members`, `organization_invitations`.
- Нет ролей, нет приглашений, нет дашбордов.

**Что есть в коде:**
- Маршруты: `/customers`, `/customers/:id/projects`, `/profiles` — плоская навигация, без понятия организации.
- `useAuth` — только `user`, нет `activeOrganization`.
- Dexie/IndexedDB — записи без `organization_id`.
- PDF — использует данные пользователя, не организации.

## Этапы реализации

### Этап 1. База данных и RLS (самый критичный)

**Новые таблицы:**
- `organizations` — id, name, organization_type (`head`/`franchise`), parent_organization_id, logo_url, phone, email, address, tax_id, details, default_installation_profile_id, created_by, timestamps.
- `organization_members` — id, organization_id, user_id, email, full_name, role (enum), status (`active`/`invited`/`disabled`), invited_by, timestamps. UNIQUE(organization_id, user_id).
- `organization_invitations` — id, organization_id, email, role, token, status (`pending`/`accepted`/`expired`/`cancelled`), expires_at, invited_by, timestamps.

**Enums:**
- `app_role`: `head_owner`, `head_admin`, `head_viewer`, `franchise_owner`, `franchise_admin`, `manager`, `measurer`, `viewer`.
- `org_type`: `head`, `franchise`.
- `member_status`, `invitation_status`, `project_status`.

**SECURITY DEFINER функции** (чтобы избежать рекурсии в RLS):
- `is_org_member(_user, _org)` — состоит ли пользователь в организации.
- `has_org_role(_user, _org, _roles[])` — есть ли у пользователя одна из ролей в организации.
- `accessible_org_ids(_user)` — список org_id, к которым у пользователя есть доступ (включая дочерние франчайзи для head-сотрудников).
- `is_head_member_of_parent(_user, _franchise_org)` — пользователь является членом головной компании, к которой относится этот франчайзи.

**Обновление существующих таблиц** (добавить колонки, не ломая старые данные):
- `customers`: + `organization_id` (nullable пока, потом NOT NULL после миграции данных), `created_by`, `assigned_to`, `status`.
- `projects`: + `organization_id`, `created_by`, `assigned_to`, `status` (enum project_status), `estimate_total`, `sent_at`, `approved_at`.
- `installation_profiles`: + `organization_id`, `created_by`, `is_shared`, `is_locked` (`is_default` уже есть).
- `materials`, `works`: + `organization_id`, `created_by`.

**Миграция существующих данных:**
Для каждого существующего пользователя создать персональный франчайзи (organization_type='franchise', parent_organization_id=null), добавить его в `organization_members` с ролью `franchise_owner`, и проставить `organization_id` всем его записям. Это сохраняет работоспособность для текущих аккаунтов.

**RLS-политики (общая логика):**
```text
USING (organization_id = ANY(accessible_org_ids(auth.uid())))
```
Для INSERT/UPDATE/DELETE дополнительно проверяется роль через `has_org_role`. Это автоматически даёт:
- франчайзи видит только свои данные (он член только своей org);
- head-сотрудник видит свою org + все дочерние франчайзи;
- роли с пониженным доступом (manager/measurer/viewer) ограничиваются на уровне политик write/update.

**Жёсткие ограничения по ролям:**
- `measurer`: UPDATE/DELETE только если `created_by = auth.uid()` или `assigned_to = auth.uid()`.
- `viewer`: только SELECT.
- `manager`: не может менять `installation_profiles` где `is_locked = true` и не может менять `materials.price`/`works.work_price`, если профиль заблокирован (на уровне триггера BEFORE UPDATE).

### Этап 2. Активная организация и переключатель

- Хук `useOrganization()` + контекст `OrganizationProvider`.
- После логина: получить `organization_members` пользователя.
  - 0 организаций → экран «Создать организацию» (выбор head/franchise).
  - 1 → автовыбор.
  - >1 → экран выбора.
- `activeOrganizationId` хранится в localStorage и в контексте.
- Все запросы используют `activeOrganizationId` для фильтрации (хотя RLS уже это обеспечивает, явный фильтр ускоряет UX и нужен для INSERT).

### Этап 3. UI-страницы

**Общие:**
- `/select-organization` — выбор активной организации.
- `/organization/settings` — профиль организации (название, логотип, контакты, реквизиты).
- `/organization/members` — сотрудники: список, приглашение по email, смена роли, отключение.
- Приглашения: edge-функция `invite-member` создаёт запись в `organization_invitations` и (опционально) отправляет email. Принятие — страница `/accept-invite?token=...`.

**Только для head:**
- `/dashboard/head` — карточки по сети, топы франчайзи, фильтры.
- `/franchises` — список франчайзи, создание, карточка.
- `/franchises/:id` — детальная карточка с вкладками.

**Только для franchise:**
- `/dashboard/franchise` — карточки, последние замеры, топ сотрудников.

**Навигация (Sidebar):**
Динамически меняется по типу организации и роли активного пользователя. Для measurer — упрощённое меню.

### Этап 4. Привязка существующих данных к организации

- В `customersService`, `projectsService`, `profileService` подставлять `organization_id = activeOrganizationId` при INSERT.
- Запросы списков добавляют `.eq('organization_id', activeOrganizationId)`.
- Dexie-схема v3: новые поля `organizationId`, `createdBy`, `assignedTo`, `status` в `customers`, `projects`, `installationProfiles`, `materials`, `works`.
- Локальная выдача фильтруется по `activeOrganizationId`.
- Sync-сервис при отправке наверх включает `organization_id`. При приёме — фильтрует по активной организации.
- Защита для measurer на клиенте: дизейблить UI редактирования цен (плюс RLS на сервере уже не пустит).

### Этап 5. Статусы проектов

- Enum `project_status`: new / measurement_done / estimate_sent / approved / in_progress / completed / rejected.
- В UI проекта — селектор статуса, отображение чипа с человекочитаемым названием (русские лейблы из словаря).
- Авто-обновления: `estimate_sent` → проставляет `sent_at`; `approved` → `approved_at`.

### Этап 6. PDF от имени организации

- В генератор PDF передаётся объект организации (из `organizations` по `project.organization_id`).
- Шапка: логотип, название, контакты, реквизиты.
- Для head: если генерация по проекту франчайзи — данные франчайзи + опциональная строка «Партнёр сети ...».

### Этап 7. Дашборды

- Head: агрегации по всем дочерним франчайзи (count, sum estimate_total за месяц, top-5).
- Franchise: агрегации только по своей org.
- Делаются через обычные запросы (`select count` / `select sum` с фильтрами) — RLS уже изолирует данные. При необходимости — VIEW `mv_dashboard_*` или RPC-функции.

### Этап 8. Сценарии проверки

Контрольный чек-лист (вручную с двумя тестовыми аккаунтами):
1. head_owner видит обоих франчайзи.
2. franchise A не видит данные franchise B (ни в API, ни в дашборде).
3. manager не может изменить цену в заблокированном профиле.
4. measurer видит только свои/назначенные замеры.
5. viewer не может ничего создать.
6. PDF франчайзи содержит данные именно франчайзи.

## Технические детали

- **Без рекурсии в RLS**: все проверки доступа — через SECURITY DEFINER функции, обращающиеся к `organization_members`.
- **GRANT**: на каждую новую таблицу — `GRANT SELECT, INSERT, UPDATE, DELETE ... TO authenticated; GRANT ALL ... TO service_role;`.
- **Триггеры**: `update_updated_at_column` уже есть, переиспользуем. Триггер `enforce_locked_profile` для блокировки изменений цен.
- **Edge-функция приглашений** (`invite-member`): использует service_role, валидирует роль приглашающего, создаёт запись приглашения и (по желанию) отправляет email через Lovable AI / Resend.
- **Старые данные**: миграция в одной транзакции создаёт «personal franchise» для каждого существующего user_id, чтобы текущие пользователи продолжали работать после деплоя.
- **IndexedDB v3**: миграция добавляет колонки и индексы по `[organizationId+userId]`.

## Порядок шагов (что я буду делать)

1. **Миграция БД №1**: enums, `organizations`, `organization_members`, `organization_invitations`, SECURITY DEFINER функции, RLS на них, GRANT.
2. **Миграция БД №2**: добавить `organization_id`/`created_by`/`assigned_to`/`status` в `customers`, `projects`, `installation_profiles`, `materials`, `works`; data-миграция «personal franchise»; новые RLS-политики (заменяют старые `auth.uid()=user_id`).
3. **Контекст организации + выбор организации + первичный экран онбординга**.
4. **Привязка `organization_id` в сервисах + Dexie v3**.
5. **UI: настройки организации, сотрудники, приглашения**.
6. **UI: список франчайзи + карточка (для head)**.
7. **Статусы проектов**.
8. **PDF от имени организации**.
9. **Дашборды head/franchise**.
10. **Финальная проверка сценариев**.

После твоего «ок» начну с шага 1 (две миграции БД). Готов также сначала уточнить:

- **Делать ли email-отправку приглашений сейчас** (нужна edge-функция + Resend), или достаточно генерировать ссылку-токен и копировать вручную для MVP?
- **Создавать ли при первом входе автоматически head/franchise**, или показать экран «Создать организацию» с явным выбором типа?

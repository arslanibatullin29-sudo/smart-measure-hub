-- Миграция 001: Добавление недостающих полей в таблицы

-- Добавляем поля в таблицу materials
ALTER TABLE materials 
ADD COLUMN IF NOT EXISTS initial_quantity NUMERIC(10, 2),
ADD COLUMN IF NOT EXISTS purchase_price NUMERIC(10, 2),
ADD COLUMN IF NOT EXISTS total_cost NUMERIC(10, 2);

-- Добавляем комментарии к полям
COMMENT ON COLUMN materials.initial_quantity IS 'Изначальное количество из Excel (умножается на площадь/периметр/количество)';
COMMENT ON COLUMN materials.purchase_price IS 'Стоимость закупа';
COMMENT ON COLUMN materials.total_cost IS 'Общая себестоимость';

-- Добавляем поле profile_id в таблицу projects для связи с профилем монтажа
ALTER TABLE projects 
ADD COLUMN IF NOT EXISTS profile_id UUID REFERENCES installation_profiles(id) ON DELETE SET NULL;

-- Добавляем комментарий
COMMENT ON COLUMN projects.profile_id IS 'ID профиля монтажа, используемого для расчета сметы';

-- Создаем индекс для быстрого поиска проектов по профилю
CREATE INDEX IF NOT EXISTS idx_projects_profile_id ON projects(profile_id);

-- Обновляем таблицу installation_profiles, если нужно добавить поле is_default
ALTER TABLE installation_profiles 
ADD COLUMN IF NOT EXISTS is_default BOOLEAN DEFAULT FALSE;

-- Создаем уникальный индекс для одного профиля по умолчанию на пользователя
CREATE UNIQUE INDEX IF NOT EXISTS idx_installation_profiles_user_default 
ON installation_profiles(user_id) 
WHERE is_default = TRUE;

COMMENT ON COLUMN installation_profiles.is_default IS 'Профиль по умолчанию для пользователя';

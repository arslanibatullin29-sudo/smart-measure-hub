-- Миграция 002: Обновление полей синхронизации

-- Обновляем syncMaterialToServer для отправки новых полей
-- (это делается в коде, здесь только проверяем структуру)

-- Убеждаемся, что все необходимые поля есть в materials
DO $$
BEGIN
    -- Проверяем наличие initial_quantity
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'materials' AND column_name = 'initial_quantity'
    ) THEN
        ALTER TABLE materials ADD COLUMN initial_quantity NUMERIC(10, 2);
    END IF;
    
    -- Проверяем наличие purchase_price
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'materials' AND column_name = 'purchase_price'
    ) THEN
        ALTER TABLE materials ADD COLUMN purchase_price NUMERIC(10, 2);
    END IF;
    
    -- Проверяем наличие total_cost
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'materials' AND column_name = 'total_cost'
    ) THEN
        ALTER TABLE materials ADD COLUMN total_cost NUMERIC(10, 2);
    END IF;
END $$;

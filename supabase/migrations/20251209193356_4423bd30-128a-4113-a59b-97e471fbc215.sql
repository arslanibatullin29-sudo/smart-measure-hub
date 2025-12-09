-- Обновляем check constraint для materials, добавляем 'fixed'
ALTER TABLE public.materials DROP CONSTRAINT IF EXISTS materials_calculation_type_check;
ALTER TABLE public.materials ADD CONSTRAINT materials_calculation_type_check 
  CHECK (calculation_type = ANY (ARRAY['byArea'::text, 'byPerimeter'::text, 'byCount'::text, 'fixed'::text]));
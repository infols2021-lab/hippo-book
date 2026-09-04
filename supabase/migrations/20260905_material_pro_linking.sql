BEGIN;

-- Связка «База + PRO» в таблице материалов
ALTER TABLE public.materials
  ADD COLUMN IF NOT EXISTS is_pro BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.materials
  ADD COLUMN IF NOT EXISTS pro_material_id UUID REFERENCES public.materials(id) ON DELETE SET NULL;

ALTER TABLE public.materials
  ADD COLUMN IF NOT EXISTS checkout_description TEXT;

-- CHECK-ограничения (идемпотентно)
ALTER TABLE public.materials DROP CONSTRAINT IF EXISTS materials_no_self_pro;
ALTER TABLE public.materials
  ADD CONSTRAINT materials_no_self_pro CHECK (id <> pro_material_id);

ALTER TABLE public.materials DROP CONSTRAINT IF EXISTS materials_pro_has_no_link;
ALTER TABLE public.materials
  ADD CONSTRAINT materials_pro_has_no_link CHECK (is_pro = false OR pro_material_id IS NULL);

-- Индексы для выборки витрины и связи
CREATE INDEX IF NOT EXISTS idx_materials_is_pro_active
  ON public.materials (is_pro, is_active);

CREATE INDEX IF NOT EXISTS idx_materials_pro_material_id
  ON public.materials (pro_material_id);

COMMIT;


-- Timestamp helper
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql SET search_path = public;

-- CUSTOMERS
CREATE TABLE public.customers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  full_name TEXT NOT NULL,
  address TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  comment TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_synced_at TIMESTAMPTZ
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.customers TO authenticated;
GRANT ALL ON public.customers TO service_role;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own customers" ON public.customers
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER trg_customers_updated BEFORE UPDATE ON public.customers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- INSTALLATION PROFILES
CREATE TABLE public.installation_profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_synced_at TIMESTAMPTZ
);
CREATE UNIQUE INDEX one_default_profile_per_user
  ON public.installation_profiles (user_id) WHERE is_default;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.installation_profiles TO authenticated;
GRANT ALL ON public.installation_profiles TO service_role;
ALTER TABLE public.installation_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own profiles" ON public.installation_profiles
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.installation_profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- MATERIALS
CREATE TABLE public.materials (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  profile_id UUID NOT NULL REFERENCES public.installation_profiles(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  unit TEXT NOT NULL DEFAULT '',
  price NUMERIC NOT NULL DEFAULT 0,
  calculation_type TEXT NOT NULL DEFAULT 'byArea',
  coefficient NUMERIC NOT NULL DEFAULT 1,
  initial_quantity NUMERIC,
  purchase_price NUMERIC,
  total_cost NUMERIC,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.materials TO authenticated;
GRANT ALL ON public.materials TO service_role;
ALTER TABLE public.materials ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own materials" ON public.materials
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER trg_materials_updated BEFORE UPDATE ON public.materials
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- WORKS
CREATE TABLE public.works (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  profile_id UUID NOT NULL REFERENCES public.installation_profiles(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  unit TEXT NOT NULL DEFAULT '',
  work_price NUMERIC NOT NULL DEFAULT 0,
  calculation_type TEXT NOT NULL DEFAULT 'byArea',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.works TO authenticated;
GRANT ALL ON public.works TO service_role;
ALTER TABLE public.works ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own works" ON public.works
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER trg_works_updated BEFORE UPDATE ON public.works
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- WORK_MATERIALS
CREATE TABLE public.work_materials (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  work_id UUID NOT NULL REFERENCES public.works(id) ON DELETE CASCADE,
  material_id UUID NOT NULL REFERENCES public.materials(id) ON DELETE CASCADE,
  quantity NUMERIC NOT NULL DEFAULT 0,
  calculation_override TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.work_materials TO authenticated;
GRANT ALL ON public.work_materials TO service_role;
ALTER TABLE public.work_materials ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own work_materials" ON public.work_materials
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.works w WHERE w.id = work_id AND w.user_id = auth.uid())
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM public.works w WHERE w.id = work_id AND w.user_id = auth.uid())
  );

-- PROJECTS
CREATE TABLE public.projects (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  profile_id UUID REFERENCES public.installation_profiles(id) ON DELETE SET NULL,
  points JSONB NOT NULL DEFAULT '[]'::jsonb,
  area NUMERIC NOT NULL DEFAULT 0,
  perimeter NUMERIC NOT NULL DEFAULT 0,
  element_count INTEGER NOT NULL DEFAULT 0,
  estimate_data JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_synced_at TIMESTAMPTZ
);
CREATE INDEX projects_profile_id_idx ON public.projects(profile_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.projects TO authenticated;
GRANT ALL ON public.projects TO service_role;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own projects" ON public.projects
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER trg_projects_updated BEFORE UPDATE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

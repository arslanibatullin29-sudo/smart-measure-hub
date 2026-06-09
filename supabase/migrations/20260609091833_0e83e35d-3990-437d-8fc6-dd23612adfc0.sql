
-- ===== ENUM статусов проекта =====
CREATE TYPE public.project_status AS ENUM (
  'new','measurement_done','estimate_sent','approved','in_progress','completed','rejected'
);

-- ===== ALTER existing tables =====
ALTER TABLE public.customers
  ADD COLUMN organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  ADD COLUMN created_by UUID,
  ADD COLUMN assigned_to UUID,
  ADD COLUMN status TEXT NOT NULL DEFAULT 'active';

ALTER TABLE public.projects
  ADD COLUMN organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  ADD COLUMN created_by UUID,
  ADD COLUMN assigned_to UUID,
  ADD COLUMN status public.project_status NOT NULL DEFAULT 'new',
  ADD COLUMN estimate_total NUMERIC,
  ADD COLUMN sent_at TIMESTAMPTZ,
  ADD COLUMN approved_at TIMESTAMPTZ;

ALTER TABLE public.installation_profiles
  ADD COLUMN organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  ADD COLUMN created_by UUID,
  ADD COLUMN is_shared BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN is_locked BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.materials
  ADD COLUMN organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  ADD COLUMN created_by UUID;

ALTER TABLE public.works
  ADD COLUMN organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  ADD COLUMN created_by UUID;

-- ===== DATA MIGRATION: personal franchise для каждого существующего user_id =====
DO $$
DECLARE
  v_user UUID;
  v_org  UUID;
BEGIN
  FOR v_user IN
    SELECT DISTINCT user_id FROM (
      SELECT user_id FROM public.customers
      UNION SELECT user_id FROM public.projects
      UNION SELECT user_id FROM public.installation_profiles
      UNION SELECT user_id FROM public.materials
      UNION SELECT user_id FROM public.works
    ) u WHERE user_id IS NOT NULL
  LOOP
    INSERT INTO public.organizations(name, organization_type, parent_organization_id, created_by)
    VALUES ('Моя организация', 'franchise', NULL, v_user)
    RETURNING id INTO v_org;

    INSERT INTO public.organization_members(organization_id, user_id, role, status)
    VALUES (v_org, v_user, 'franchise_owner', 'active')
    ON CONFLICT DO NOTHING;

    UPDATE public.customers SET organization_id = v_org, created_by = user_id WHERE user_id = v_user;
    UPDATE public.projects  SET organization_id = v_org, created_by = user_id WHERE user_id = v_user;
    UPDATE public.installation_profiles SET organization_id = v_org, created_by = user_id WHERE user_id = v_user;
    UPDATE public.materials SET organization_id = v_org, created_by = user_id WHERE user_id = v_user;
    UPDATE public.works     SET organization_id = v_org, created_by = user_id WHERE user_id = v_user;
  END LOOP;
END$$;

-- Делаем organization_id NOT NULL после миграции
ALTER TABLE public.customers              ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.projects               ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.installation_profiles  ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.materials              ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.works                  ALTER COLUMN organization_id SET NOT NULL;

CREATE INDEX idx_customers_org ON public.customers(organization_id);
CREATE INDEX idx_projects_org  ON public.projects(organization_id);
CREATE INDEX idx_profiles_org  ON public.installation_profiles(organization_id);
CREATE INDEX idx_materials_org ON public.materials(organization_id);
CREATE INDEX idx_works_org     ON public.works(organization_id);

-- ===== Триггер защиты заблокированных профилей =====
CREATE OR REPLACE FUNCTION public.enforce_locked_profile()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_profile_id UUID;
  v_locked BOOLEAN;
  v_org UUID;
BEGIN
  IF TG_TABLE_NAME = 'installation_profiles' THEN
    IF NEW.is_locked AND OLD.is_locked
       AND NOT public.has_org_role(auth.uid(), NEW.organization_id,
            ARRAY['head_owner','head_admin','franchise_owner','franchise_admin']::public.app_role[]) THEN
      RAISE EXCEPTION 'Profile is locked';
    END IF;
    RETURN NEW;
  END IF;

  v_profile_id := NEW.profile_id;
  SELECT is_locked, organization_id INTO v_locked, v_org
    FROM public.installation_profiles WHERE id = v_profile_id;
  IF v_locked AND NOT public.has_org_role(auth.uid(), v_org,
       ARRAY['head_owner','head_admin','franchise_owner','franchise_admin']::public.app_role[]) THEN
    -- запрещаем менять цены
    IF TG_TABLE_NAME = 'materials' AND (NEW.price IS DISTINCT FROM OLD.price
        OR NEW.purchase_price IS DISTINCT FROM OLD.purchase_price) THEN
      RAISE EXCEPTION 'Profile is locked: price change forbidden';
    END IF;
    IF TG_TABLE_NAME = 'works' AND NEW.work_price IS DISTINCT FROM OLD.work_price THEN
      RAISE EXCEPTION 'Profile is locked: price change forbidden';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_lock_profile BEFORE UPDATE ON public.installation_profiles
  FOR EACH ROW EXECUTE FUNCTION public.enforce_locked_profile();
CREATE TRIGGER trg_lock_materials BEFORE UPDATE ON public.materials
  FOR EACH ROW EXECUTE FUNCTION public.enforce_locked_profile();
CREATE TRIGGER trg_lock_works BEFORE UPDATE ON public.works
  FOR EACH ROW EXECUTE FUNCTION public.enforce_locked_profile();

-- ===== Заменяем старые RLS-политики =====

-- customers
DROP POLICY IF EXISTS "Users manage own customers" ON public.customers;
CREATE POLICY "customers_select" ON public.customers FOR SELECT TO authenticated
  USING (public.can_access_org(auth.uid(), organization_id));
CREATE POLICY "customers_insert" ON public.customers FOR INSERT TO authenticated
  WITH CHECK (
    public.has_org_role(auth.uid(), organization_id,
      ARRAY['head_owner','head_admin','franchise_owner','franchise_admin','manager','measurer']::public.app_role[])
    AND created_by = auth.uid()
  );
CREATE POLICY "customers_update" ON public.customers FOR UPDATE TO authenticated
  USING (
    public.has_org_role(auth.uid(), organization_id,
      ARRAY['head_owner','head_admin','franchise_owner','franchise_admin','manager']::public.app_role[])
    OR (
      public.has_org_role(auth.uid(), organization_id, ARRAY['measurer']::public.app_role[])
      AND (created_by = auth.uid() OR assigned_to = auth.uid())
    )
  )
  WITH CHECK (
    public.has_org_role(auth.uid(), organization_id,
      ARRAY['head_owner','head_admin','franchise_owner','franchise_admin','manager']::public.app_role[])
    OR (
      public.has_org_role(auth.uid(), organization_id, ARRAY['measurer']::public.app_role[])
      AND (created_by = auth.uid() OR assigned_to = auth.uid())
    )
  );
CREATE POLICY "customers_delete" ON public.customers FOR DELETE TO authenticated
  USING (public.has_org_role(auth.uid(), organization_id,
    ARRAY['head_owner','head_admin','franchise_owner','franchise_admin']::public.app_role[]));

-- projects
DROP POLICY IF EXISTS "Users manage own projects" ON public.projects;
CREATE POLICY "projects_select" ON public.projects FOR SELECT TO authenticated
  USING (public.can_access_org(auth.uid(), organization_id));
CREATE POLICY "projects_insert" ON public.projects FOR INSERT TO authenticated
  WITH CHECK (
    public.has_org_role(auth.uid(), organization_id,
      ARRAY['head_owner','head_admin','franchise_owner','franchise_admin','manager','measurer']::public.app_role[])
    AND created_by = auth.uid()
  );
CREATE POLICY "projects_update" ON public.projects FOR UPDATE TO authenticated
  USING (
    public.has_org_role(auth.uid(), organization_id,
      ARRAY['head_owner','head_admin','franchise_owner','franchise_admin','manager']::public.app_role[])
    OR (
      public.has_org_role(auth.uid(), organization_id, ARRAY['measurer']::public.app_role[])
      AND (created_by = auth.uid() OR assigned_to = auth.uid())
    )
  )
  WITH CHECK (
    public.has_org_role(auth.uid(), organization_id,
      ARRAY['head_owner','head_admin','franchise_owner','franchise_admin','manager']::public.app_role[])
    OR (
      public.has_org_role(auth.uid(), organization_id, ARRAY['measurer']::public.app_role[])
      AND (created_by = auth.uid() OR assigned_to = auth.uid())
    )
  );
CREATE POLICY "projects_delete" ON public.projects FOR DELETE TO authenticated
  USING (public.has_org_role(auth.uid(), organization_id,
    ARRAY['head_owner','head_admin','franchise_owner','franchise_admin']::public.app_role[]));

-- installation_profiles
DROP POLICY IF EXISTS "Users manage own profiles" ON public.installation_profiles;
CREATE POLICY "profiles_select" ON public.installation_profiles FOR SELECT TO authenticated
  USING (public.can_access_org(auth.uid(), organization_id) OR is_shared = true);
CREATE POLICY "profiles_insert" ON public.installation_profiles FOR INSERT TO authenticated
  WITH CHECK (
    public.has_org_role(auth.uid(), organization_id,
      ARRAY['head_owner','head_admin','franchise_owner','franchise_admin']::public.app_role[])
    AND created_by = auth.uid()
  );
CREATE POLICY "profiles_update" ON public.installation_profiles FOR UPDATE TO authenticated
  USING (public.has_org_role(auth.uid(), organization_id,
    ARRAY['head_owner','head_admin','franchise_owner','franchise_admin']::public.app_role[]))
  WITH CHECK (public.has_org_role(auth.uid(), organization_id,
    ARRAY['head_owner','head_admin','franchise_owner','franchise_admin']::public.app_role[]));
CREATE POLICY "profiles_delete" ON public.installation_profiles FOR DELETE TO authenticated
  USING (public.has_org_role(auth.uid(), organization_id,
    ARRAY['head_owner','head_admin','franchise_owner','franchise_admin']::public.app_role[]));

-- materials
DROP POLICY IF EXISTS "Users manage own materials" ON public.materials;
CREATE POLICY "materials_select" ON public.materials FOR SELECT TO authenticated
  USING (public.can_access_org(auth.uid(), organization_id));
CREATE POLICY "materials_insert" ON public.materials FOR INSERT TO authenticated
  WITH CHECK (
    public.has_org_role(auth.uid(), organization_id,
      ARRAY['head_owner','head_admin','franchise_owner','franchise_admin']::public.app_role[])
    AND created_by = auth.uid()
  );
CREATE POLICY "materials_update" ON public.materials FOR UPDATE TO authenticated
  USING (public.has_org_role(auth.uid(), organization_id,
    ARRAY['head_owner','head_admin','franchise_owner','franchise_admin','manager']::public.app_role[]))
  WITH CHECK (public.has_org_role(auth.uid(), organization_id,
    ARRAY['head_owner','head_admin','franchise_owner','franchise_admin','manager']::public.app_role[]));
CREATE POLICY "materials_delete" ON public.materials FOR DELETE TO authenticated
  USING (public.has_org_role(auth.uid(), organization_id,
    ARRAY['head_owner','head_admin','franchise_owner','franchise_admin']::public.app_role[]));

-- works
DROP POLICY IF EXISTS "Users manage own works" ON public.works;
CREATE POLICY "works_select" ON public.works FOR SELECT TO authenticated
  USING (public.can_access_org(auth.uid(), organization_id));
CREATE POLICY "works_insert" ON public.works FOR INSERT TO authenticated
  WITH CHECK (
    public.has_org_role(auth.uid(), organization_id,
      ARRAY['head_owner','head_admin','franchise_owner','franchise_admin']::public.app_role[])
    AND created_by = auth.uid()
  );
CREATE POLICY "works_update" ON public.works FOR UPDATE TO authenticated
  USING (public.has_org_role(auth.uid(), organization_id,
    ARRAY['head_owner','head_admin','franchise_owner','franchise_admin','manager']::public.app_role[]))
  WITH CHECK (public.has_org_role(auth.uid(), organization_id,
    ARRAY['head_owner','head_admin','franchise_owner','franchise_admin','manager']::public.app_role[]));
CREATE POLICY "works_delete" ON public.works FOR DELETE TO authenticated
  USING (public.has_org_role(auth.uid(), organization_id,
    ARRAY['head_owner','head_admin','franchise_owner','franchise_admin']::public.app_role[]));

-- work_materials политика уже существует и привязана к works.user_id; оставляем как есть
-- (works теперь имеет organization_id, и доступ к ним регулируется новыми политиками works)

-- enforce_locked_profile тоже SECURITY DEFINER → revoke from anon
REVOKE EXECUTE ON FUNCTION public.enforce_locked_profile() FROM PUBLIC, anon;

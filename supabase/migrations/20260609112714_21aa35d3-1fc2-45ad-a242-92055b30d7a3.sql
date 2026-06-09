
-- 1. installation_profiles SELECT: убрать OR is_shared = true
DROP POLICY IF EXISTS profiles_select ON public.installation_profiles;
CREATE POLICY profiles_select ON public.installation_profiles
  FOR SELECT TO authenticated
  USING (can_access_org(auth.uid(), organization_id));

-- 2. work_materials: переписать на authenticated + org-проверку через works
DROP POLICY IF EXISTS "Users manage own work_materials" ON public.work_materials;

CREATE POLICY work_materials_select ON public.work_materials
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.works w
    WHERE w.id = work_materials.work_id
      AND public.can_access_org(auth.uid(), w.organization_id)
  ));

CREATE POLICY work_materials_insert ON public.work_materials
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.works w
    WHERE w.id = work_materials.work_id
      AND public.has_org_role(auth.uid(), w.organization_id,
        ARRAY['head_owner','head_admin','franchise_owner','franchise_admin','manager']::public.app_role[])
  ));

CREATE POLICY work_materials_update ON public.work_materials
  FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.works w
    WHERE w.id = work_materials.work_id
      AND public.has_org_role(auth.uid(), w.organization_id,
        ARRAY['head_owner','head_admin','franchise_owner','franchise_admin','manager']::public.app_role[])
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.works w
    WHERE w.id = work_materials.work_id
      AND public.has_org_role(auth.uid(), w.organization_id,
        ARRAY['head_owner','head_admin','franchise_owner','franchise_admin','manager']::public.app_role[])
  ));

CREATE POLICY work_materials_delete ON public.work_materials
  FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.works w
    WHERE w.id = work_materials.work_id
      AND public.has_org_role(auth.uid(), w.organization_id,
        ARRAY['head_owner','head_admin','franchise_owner','franchise_admin','manager']::public.app_role[])
  ));

-- 3. SECURITY DEFINER функции: убрать execute у PUBLIC, оставить только нужным ролям
REVOKE EXECUTE ON FUNCTION public.is_org_member(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.has_org_role(uuid, uuid, public.app_role[]) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.accessible_org_ids(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.can_access_org(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.can_manage_org(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.accept_invitation(text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.enforce_locked_profile() FROM PUBLIC, anon, authenticated;

-- helper-функции нужны RLS-политикам (вызываются в qual), оставляем authenticated +
-- service_role. Они не раскрывают данные — только булев результат по текущему пользователю.
GRANT EXECUTE ON FUNCTION public.is_org_member(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.has_org_role(uuid, uuid, public.app_role[]) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.accessible_org_ids(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_access_org(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_manage_org(uuid, uuid) TO authenticated, service_role;

-- accept_invitation вызывается из клиента (RPC) — оставляем authenticated.
-- Внутри уже проверяется auth.uid(), статус pending, expires_at, совпадение email.
GRANT EXECUTE ON FUNCTION public.accept_invitation(text) TO authenticated, service_role;

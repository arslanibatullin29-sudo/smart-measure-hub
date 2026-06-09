
GRANT EXECUTE ON FUNCTION public.is_org_member(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_org_role(uuid, uuid, public.app_role[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.accessible_org_ids(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_access_org(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_manage_org(uuid, uuid) TO authenticated;

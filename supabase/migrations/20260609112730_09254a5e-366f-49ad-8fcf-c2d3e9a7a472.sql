
REVOKE EXECUTE ON FUNCTION public.is_org_member(uuid, uuid) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.has_org_role(uuid, uuid, public.app_role[]) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.accessible_org_ids(uuid) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.can_access_org(uuid, uuid) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.can_manage_org(uuid, uuid) FROM authenticated;

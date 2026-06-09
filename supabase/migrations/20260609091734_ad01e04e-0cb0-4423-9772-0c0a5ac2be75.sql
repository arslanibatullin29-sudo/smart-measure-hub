
REVOKE EXECUTE ON FUNCTION public.is_org_member(UUID, UUID) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.has_org_role(UUID, UUID, public.app_role[]) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.accessible_org_ids(UUID) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.can_access_org(UUID, UUID) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.can_manage_org(UUID, UUID) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.accept_invitation(TEXT) FROM PUBLIC, anon;

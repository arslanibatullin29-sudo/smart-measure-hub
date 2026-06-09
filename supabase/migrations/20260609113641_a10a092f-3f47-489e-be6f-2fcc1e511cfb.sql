
CREATE OR REPLACE FUNCTION public.create_organization(
  _name TEXT,
  _type public.org_type,
  _parent UUID DEFAULT NULL
) RETURNS public.organizations
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user UUID := auth.uid();
  v_email TEXT := lower(coalesce((auth.jwt() ->> 'email'), ''));
  v_full_name TEXT := coalesce((auth.jwt() -> 'user_metadata' ->> 'full_name'), '');
  v_role public.app_role;
  v_org public.organizations;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF _type = 'franchise' AND _parent IS NOT NULL THEN
    -- создавать дочерний франчайзи может только head_owner/head_admin родителя
    IF NOT public.has_org_role(v_user, _parent,
        ARRAY['head_owner','head_admin']::public.app_role[]) THEN
      RAISE EXCEPTION 'Only head owners/admins can create child franchises';
    END IF;
  END IF;

  INSERT INTO public.organizations(name, organization_type, parent_organization_id, created_by)
  VALUES (_name, _type, CASE WHEN _type='franchise' THEN _parent ELSE NULL END, v_user)
  RETURNING * INTO v_org;

  v_role := CASE WHEN _type='head' THEN 'head_owner'::public.app_role
                 ELSE 'franchise_owner'::public.app_role END;

  INSERT INTO public.organization_members(organization_id, user_id, email, full_name, role, status)
  VALUES (v_org.id, v_user, NULLIF(v_email,''), NULLIF(v_full_name,''), v_role, 'active');

  RETURN v_org;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.create_organization(TEXT, public.org_type, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_organization(TEXT, public.org_type, UUID) TO authenticated, service_role;

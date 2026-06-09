
-- ===== ENUMS =====
CREATE TYPE public.org_type AS ENUM ('head', 'franchise');
CREATE TYPE public.app_role AS ENUM (
  'head_owner', 'head_admin', 'head_viewer',
  'franchise_owner', 'franchise_admin', 'manager', 'measurer', 'viewer'
);
CREATE TYPE public.member_status AS ENUM ('active', 'invited', 'disabled');
CREATE TYPE public.invitation_status AS ENUM ('pending', 'accepted', 'expired', 'cancelled');

-- ===== organizations =====
CREATE TABLE public.organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  organization_type public.org_type NOT NULL,
  parent_organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL,
  logo_url TEXT,
  phone TEXT,
  email TEXT,
  address TEXT,
  tax_id TEXT,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  default_installation_profile_id UUID,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT head_has_no_parent CHECK (
    (organization_type = 'head' AND parent_organization_id IS NULL)
    OR organization_type = 'franchise'
  )
);
CREATE INDEX idx_organizations_parent ON public.organizations(parent_organization_id);
CREATE INDEX idx_organizations_type ON public.organizations(organization_type);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.organizations TO authenticated;
GRANT ALL ON public.organizations TO service_role;

-- ===== organization_members =====
CREATE TABLE public.organization_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  email TEXT,
  full_name TEXT,
  role public.app_role NOT NULL,
  status public.member_status NOT NULL DEFAULT 'active',
  invited_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(organization_id, user_id)
);
CREATE INDEX idx_org_members_user ON public.organization_members(user_id);
CREATE INDEX idx_org_members_org ON public.organization_members(organization_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.organization_members TO authenticated;
GRANT ALL ON public.organization_members TO service_role;

-- ===== organization_invitations =====
CREATE TABLE public.organization_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role public.app_role NOT NULL,
  token TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(24), 'hex'),
  status public.invitation_status NOT NULL DEFAULT 'pending',
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '14 days'),
  invited_by UUID NOT NULL,
  accepted_by UUID,
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_invitations_org ON public.organization_invitations(organization_id);
CREATE INDEX idx_invitations_email ON public.organization_invitations(lower(email));
CREATE INDEX idx_invitations_token ON public.organization_invitations(token);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.organization_invitations TO authenticated;
GRANT ALL ON public.organization_invitations TO service_role;

-- ===== SECURITY DEFINER ACCESS HELPERS =====

-- Прямое членство в организации (активное)
CREATE OR REPLACE FUNCTION public.is_org_member(_user UUID, _org UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE user_id = _user AND organization_id = _org AND status = 'active'
  );
$$;

-- Проверка одной из ролей в организации
CREATE OR REPLACE FUNCTION public.has_org_role(_user UUID, _org UUID, _roles public.app_role[])
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE user_id = _user AND organization_id = _org
      AND status = 'active' AND role = ANY(_roles)
  );
$$;

-- Все организации, к которым у пользователя есть доступ:
-- (а) где он напрямую состоит; (б) франчайзи головных компаний, в которых он состоит.
CREATE OR REPLACE FUNCTION public.accessible_org_ids(_user UUID)
RETURNS SETOF UUID LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT organization_id FROM public.organization_members
    WHERE user_id = _user AND status = 'active'
  UNION
  SELECT o.id FROM public.organizations o
   WHERE o.organization_type = 'franchise'
     AND o.parent_organization_id IN (
       SELECT m.organization_id FROM public.organization_members m
         JOIN public.organizations h ON h.id = m.organization_id
        WHERE m.user_id = _user AND m.status = 'active'
          AND h.organization_type = 'head'
     );
$$;

-- Доступ к организации (членство или head→franchise)
CREATE OR REPLACE FUNCTION public.can_access_org(_user UUID, _org UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.accessible_org_ids(_user) a WHERE a = _org);
$$;

-- Может ли пользователь управлять организацией (owner/admin прямой или head→franchise admin/owner)
CREATE OR REPLACE FUNCTION public.can_manage_org(_user UUID, _org UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    -- прямой owner/admin
    EXISTS (
      SELECT 1 FROM public.organization_members
      WHERE user_id = _user AND organization_id = _org AND status = 'active'
        AND role IN ('head_owner','head_admin','franchise_owner','franchise_admin')
    )
    OR
    -- head owner/admin родителя франчайзи
    EXISTS (
      SELECT 1 FROM public.organizations o
        JOIN public.organization_members m ON m.organization_id = o.parent_organization_id
       WHERE o.id = _org AND o.organization_type = 'franchise'
         AND m.user_id = _user AND m.status = 'active'
         AND m.role IN ('head_owner','head_admin')
    );
$$;

-- ===== updated_at триггеры =====
CREATE TRIGGER trg_organizations_updated_at BEFORE UPDATE ON public.organizations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_org_members_updated_at BEFORE UPDATE ON public.organization_members
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_invitations_updated_at BEFORE UPDATE ON public.organization_invitations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ===== ENABLE RLS =====
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_invitations ENABLE ROW LEVEL SECURITY;

-- ===== POLICIES: organizations =====
-- Видеть: пользователь видит свою организацию + (если он head) дочерних франчайзи
CREATE POLICY "org_select" ON public.organizations
  FOR SELECT TO authenticated
  USING (public.can_access_org(auth.uid(), id));

-- Создавать: любой авторизованный (создатель сразу становится owner — через приложение)
-- Ограничиваем: при создании head/franchise — created_by должен быть текущим пользователем.
CREATE POLICY "org_insert" ON public.organizations
  FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid());

-- Менять: только те, кто может управлять
CREATE POLICY "org_update" ON public.organizations
  FOR UPDATE TO authenticated
  USING (public.can_manage_org(auth.uid(), id))
  WITH CHECK (public.can_manage_org(auth.uid(), id));

-- Удалять: только прямой owner (head_owner для head или franchise_owner для franchise)
CREATE POLICY "org_delete" ON public.organizations
  FOR DELETE TO authenticated
  USING (
    public.has_org_role(auth.uid(), id, ARRAY['head_owner','franchise_owner']::public.app_role[])
  );

-- ===== POLICIES: organization_members =====
-- Видеть: свои записи + всех членов организаций, к которым есть доступ
CREATE POLICY "members_select" ON public.organization_members
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR public.can_access_org(auth.uid(), organization_id)
  );

-- Создавать: только управляющие организацией, ИЛИ сам пользователь при принятии приглашения
-- (для принятия приглашения используется отдельный flow — пока разрешим owner/admin)
CREATE POLICY "members_insert" ON public.organization_members
  FOR INSERT TO authenticated
  WITH CHECK (
    public.can_manage_org(auth.uid(), organization_id)
    -- разрешаем пользователю самому добавить себя (через accept_invitation RPC, который установит invited_by)
    OR user_id = auth.uid()
  );

CREATE POLICY "members_update" ON public.organization_members
  FOR UPDATE TO authenticated
  USING (public.can_manage_org(auth.uid(), organization_id))
  WITH CHECK (public.can_manage_org(auth.uid(), organization_id));

CREATE POLICY "members_delete" ON public.organization_members
  FOR DELETE TO authenticated
  USING (public.can_manage_org(auth.uid(), organization_id));

-- ===== POLICIES: organization_invitations =====
CREATE POLICY "invitations_select" ON public.organization_invitations
  FOR SELECT TO authenticated
  USING (
    public.can_manage_org(auth.uid(), organization_id)
    OR lower(email) = lower(coalesce((auth.jwt() ->> 'email'), ''))
  );

CREATE POLICY "invitations_insert" ON public.organization_invitations
  FOR INSERT TO authenticated
  WITH CHECK (
    public.can_manage_org(auth.uid(), organization_id)
    AND invited_by = auth.uid()
  );

CREATE POLICY "invitations_update" ON public.organization_invitations
  FOR UPDATE TO authenticated
  USING (
    public.can_manage_org(auth.uid(), organization_id)
    OR lower(email) = lower(coalesce((auth.jwt() ->> 'email'), ''))
  )
  WITH CHECK (
    public.can_manage_org(auth.uid(), organization_id)
    OR lower(email) = lower(coalesce((auth.jwt() ->> 'email'), ''))
  );

CREATE POLICY "invitations_delete" ON public.organization_invitations
  FOR DELETE TO authenticated
  USING (public.can_manage_org(auth.uid(), organization_id));

-- ===== Принятие приглашения (RPC) =====
CREATE OR REPLACE FUNCTION public.accept_invitation(_token TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  inv public.organization_invitations%ROWTYPE;
  v_user UUID := auth.uid();
  v_email TEXT := lower(coalesce((auth.jwt() ->> 'email'), ''));
  v_member_id UUID;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT * INTO inv FROM public.organization_invitations WHERE token = _token;
  IF NOT FOUND THEN RAISE EXCEPTION 'Invitation not found'; END IF;
  IF inv.status <> 'pending' THEN RAISE EXCEPTION 'Invitation is %', inv.status; END IF;
  IF inv.expires_at < now() THEN
    UPDATE public.organization_invitations SET status='expired' WHERE id=inv.id;
    RAISE EXCEPTION 'Invitation expired';
  END IF;
  IF lower(inv.email) <> v_email THEN RAISE EXCEPTION 'Invitation email mismatch'; END IF;

  INSERT INTO public.organization_members(organization_id, user_id, email, role, status, invited_by)
  VALUES (inv.organization_id, v_user, v_email, inv.role, 'active', inv.invited_by)
  ON CONFLICT (organization_id, user_id)
  DO UPDATE SET role = EXCLUDED.role, status = 'active', updated_at = now()
  RETURNING id INTO v_member_id;

  UPDATE public.organization_invitations
     SET status='accepted', accepted_by=v_user, accepted_at=now()
   WHERE id=inv.id;

  RETURN v_member_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.accept_invitation(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_org_member(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_org_role(UUID, UUID, public.app_role[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.accessible_org_ids(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_access_org(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_manage_org(UUID, UUID) TO authenticated;

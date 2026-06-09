import { supabase } from '@/services/supabase/supabaseClient'

export type OrgType = 'head' | 'franchise'
export type AppRole =
  | 'head_owner' | 'head_admin' | 'head_viewer'
  | 'franchise_owner' | 'franchise_admin' | 'manager' | 'measurer' | 'viewer'

export interface Organization {
  id: string
  name: string
  organization_type: OrgType
  parent_organization_id: string | null
  logo_url: string | null
  phone: string | null
  email: string | null
  address: string | null
  tax_id: string | null
  details: any
  default_installation_profile_id: string | null
  is_active: boolean
  created_by: string
  created_at: string
  updated_at: string
}

export interface OrgMember {
  id: string
  organization_id: string
  user_id: string
  email: string | null
  full_name: string | null
  role: AppRole
  status: 'active' | 'invited' | 'disabled'
  invited_by: string | null
  created_at: string
  updated_at: string
}

export interface OrgInvitation {
  id: string
  organization_id: string
  email: string
  role: AppRole
  token: string
  status: 'pending' | 'accepted' | 'expired' | 'cancelled'
  expires_at: string
  invited_by: string
  created_at: string
}

export const organizationsService = {
  async listMyMemberships(): Promise<Array<OrgMember & { organization: Organization }>> {
    const { data, error } = await supabase
      .from('organization_members')
      .select('*, organization:organizations(*)')
      .eq('status', 'active')
      .order('created_at', { ascending: true })
    if (error) throw error
    return (data as any[]).filter(m => m.organization) as any
  },

  async getById(id: string): Promise<Organization | null> {
    const { data, error } = await supabase.from('organizations').select('*').eq('id', id).maybeSingle()
    if (error) throw error
    return data as any
  },

  async update(id: string, patch: Partial<Organization>): Promise<Organization> {
    const { data, error } = await supabase.from('organizations').update(patch as any).eq('id', id).select().single()
    if (error) throw error
    return data as any
  },

  async createPersonalFranchise(userId: string, name = 'Моя организация'): Promise<Organization> {
    const { data: userRes } = await supabase.auth.getUser()
    const email = userRes?.user?.email ?? null
    const fullName = (userRes?.user?.user_metadata as any)?.full_name ?? null
    const { data: org, error } = await supabase
      .from('organizations')
      .insert({ name, organization_type: 'franchise', created_by: userId } as any)
      .select()
      .single()
    if (error) throw error
    const { error: mErr } = await supabase
      .from('organization_members')
      .insert({ organization_id: org.id, user_id: userId, role: 'franchise_owner', status: 'active', email, full_name: fullName } as any)
    if (mErr) throw mErr
    return org as any
  },

  async createOrganization(
    userId: string,
    name: string,
    type: OrgType,
    parentOrganizationId: string | null = null,
  ): Promise<Organization> {
    const { data: org, error } = await supabase
      .from('organizations')
      .insert({
        name,
        organization_type: type,
        parent_organization_id: type === 'franchise' ? parentOrganizationId : null,
        created_by: userId,
      } as any)
      .select()
      .single()
    if (error) throw error
    const ownerRole: AppRole = type === 'head' ? 'head_owner' : 'franchise_owner'
    const { error: mErr } = await supabase
      .from('organization_members')
      .insert({ organization_id: org.id, user_id: userId, role: ownerRole, status: 'active' } as any)
    if (mErr) throw mErr
    return org as any
  },

  async listChildFranchises(headOrgId: string): Promise<Organization[]> {
    const { data, error } = await supabase
      .from('organizations')
      .select('*')
      .eq('parent_organization_id', headOrgId)
      .order('created_at')
    if (error) throw error
    return (data || []) as any
  },

  async listMembers(orgId: string): Promise<OrgMember[]> {
    const { data, error } = await supabase
      .from('organization_members')
      .select('*')
      .eq('organization_id', orgId)
      .order('created_at')
    if (error) throw error
    return (data || []) as any
  },

  async updateMember(memberId: string, patch: Partial<Pick<OrgMember, 'role' | 'status' | 'full_name'>>): Promise<OrgMember> {
    const { data, error } = await supabase
      .from('organization_members')
      .update(patch as any)
      .eq('id', memberId)
      .select()
      .single()
    if (error) throw error
    return data as any
  },

  async removeMember(memberId: string): Promise<void> {
    const { error } = await supabase.from('organization_members').delete().eq('id', memberId)
    if (error) throw error
  },

  async listInvitations(orgId: string): Promise<OrgInvitation[]> {
    const { data, error } = await supabase
      .from('organization_invitations')
      .select('*')
      .eq('organization_id', orgId)
      .order('created_at', { ascending: false })
    if (error) throw error
    return (data || []) as any
  },

  async createInvitation(orgId: string, email: string, role: AppRole, userId: string): Promise<OrgInvitation> {
    const { data, error } = await supabase
      .from('organization_invitations')
      .insert({ organization_id: orgId, email: email.trim().toLowerCase(), role, invited_by: userId } as any)
      .select()
      .single()
    if (error) throw error
    return data as any
  },

  async cancelInvitation(id: string): Promise<void> {
    const { error } = await supabase
      .from('organization_invitations')
      .update({ status: 'cancelled' } as any)
      .eq('id', id)
    if (error) throw error
  },

  async acceptInvitation(token: string): Promise<string> {
    const { data, error } = await supabase.rpc('accept_invitation', { _token: token })
    if (error) throw error
    return data as string
  },
}

import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { organizationsService, Organization, OrgMember, AppRole } from '../services/organizationsService'
import {
  getActiveOrgIdSync,
  setActiveOrgId as persistActiveOrgId,
  invalidateActiveOrgCache,
  clearActiveOrgId,
} from '../services/activeOrg'

interface OrgContextValue {
  loading: boolean
  memberships: Array<OrgMember & { organization: Organization }>
  activeOrgId: string | null
  activeOrg: Organization | null
  activeRole: AppRole | null
  setActiveOrgId: (id: string) => void
  refresh: () => Promise<void>
  isHead: boolean
  canManage: boolean
}

const Ctx = createContext<OrgContextValue | undefined>(undefined)

export function OrganizationProvider({ children }: { children: ReactNode }) {
  const { user, loading: authLoading } = useAuth()
  const [memberships, setMemberships] = useState<Array<OrgMember & { organization: Organization }>>([])
  const [activeOrgId, setActiveOrgIdState] = useState<string | null>(getActiveOrgIdSync())
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!user) {
      setMemberships([])
      setActiveOrgIdState(null)
      clearActiveOrgId()
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      let list = await organizationsService.listMyMemberships()
      if (list.length === 0) {
        // Auto-onboarding: создаём персональный франчайзи.
        await organizationsService.createPersonalFranchise(user.id)
        list = await organizationsService.listMyMemberships()
      }
      // Бэкфилл email/ФИО для отображения в списках сотрудников.
      await organizationsService.backfillOwnMemberInfo(
        user.id,
        user.email ?? null,
        (user.user_metadata as any)?.full_name ?? null,
      )
      setMemberships(list)
      const stored = getActiveOrgIdSync()
      const chosen = (stored && list.find(m => m.organization_id === stored))
        || list[0]
      if (chosen) {
        setActiveOrgIdState(chosen.organization_id)
        persistActiveOrgId(chosen.organization_id)
      }
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    if (!authLoading) load()
  }, [authLoading, load])

  const setActiveOrgId = useCallback((id: string) => {
    setActiveOrgIdState(id)
    persistActiveOrgId(id)
    if (user) invalidateActiveOrgCache(user.id)
  }, [user])

  const active = memberships.find(m => m.organization_id === activeOrgId) || null
  const activeOrg = active?.organization || null
  const activeRole = active?.role || null
  const isHead = activeOrg?.organization_type === 'head'
  const canManage = activeRole
    ? ['head_owner', 'head_admin', 'franchise_owner', 'franchise_admin'].includes(activeRole)
    : false

  return (
    <Ctx.Provider
      value={{
        loading: loading || authLoading,
        memberships,
        activeOrgId,
        activeOrg,
        activeRole,
        setActiveOrgId,
        refresh: load,
        isHead,
        canManage,
      }}
    >
      {children}
    </Ctx.Provider>
  )
}

export function useOrganization() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useOrganization must be used within OrganizationProvider')
  return ctx
}

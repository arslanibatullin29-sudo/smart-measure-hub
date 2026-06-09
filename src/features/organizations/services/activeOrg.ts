import { supabase } from '@/services/supabase/supabaseClient'

const STORAGE_KEY = 'activeOrganizationId'
let cache: Record<string, string> = {}

export function getActiveOrgIdSync(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY)
  } catch {
    return null
  }
}

export function setActiveOrgId(orgId: string) {
  try {
    localStorage.setItem(STORAGE_KEY, orgId)
  } catch {
    /* ignore */
  }
}

export function clearActiveOrgId() {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    /* ignore */
  }
}

/**
 * Возвращает id активной организации для пользователя.
 * Сначала проверяет localStorage, затем загружает первый active membership.
 * Если организаций нет — кидает понятную ошибку (вызывающий код должен направить
 * пользователя на онбординг/создание организации).
 */
export async function getActiveOrgIdForUser(userId: string): Promise<string> {
  if (cache[userId]) return cache[userId]

  const stored = getActiveOrgIdSync()
  if (stored) {
    // валидируем что пользователь действительно в этой org
    const { data } = await supabase
      .from('organization_members')
      .select('organization_id')
      .eq('user_id', userId)
      .eq('organization_id', stored)
      .eq('status', 'active')
      .maybeSingle()
    if (data?.organization_id) {
      cache[userId] = data.organization_id
      return data.organization_id
    }
  }

  const { data: members, error } = await supabase
    .from('organization_members')
    .select('organization_id')
    .eq('user_id', userId)
    .eq('status', 'active')
    .order('created_at', { ascending: true })
    .limit(1)
  if (error) throw error
  const first = members?.[0]?.organization_id
  if (!first) {
    throw new Error('NO_ORGANIZATION')
  }
  cache[userId] = first
  setActiveOrgId(first)
  return first
}

export function invalidateActiveOrgCache(userId?: string) {
  if (userId) delete cache[userId]
  else cache = {}
}

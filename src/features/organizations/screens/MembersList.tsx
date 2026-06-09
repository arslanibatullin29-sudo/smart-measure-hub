import { useEffect, useState } from 'react'
import { useOrganization } from '../contexts/OrganizationProvider'
import { organizationsService, OrgMember, OrgInvitation, AppRole } from '../services/organizationsService'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { toast } from 'sonner'

const ROLE_LABELS: Record<AppRole, string> = {
  head_owner: 'Владелец головной',
  head_admin: 'Админ головной',
  head_viewer: 'Просмотр головной',
  franchise_owner: 'Владелец франчайзи',
  franchise_admin: 'Админ франчайзи',
  manager: 'Менеджер',
  measurer: 'Замерщик',
  viewer: 'Просмотр',
}

export default function MembersList() {
  const { user } = useAuth()
  const { activeOrg, activeOrgId, canManage, isHead } = useOrganization()
  const [members, setMembers] = useState<OrgMember[]>([])
  const [invites, setInvites] = useState<OrgInvitation[]>([])
  const [loading, setLoading] = useState(true)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<AppRole>(isHead ? 'head_viewer' : 'manager')

  const availableRoles: AppRole[] = isHead
    ? ['head_owner', 'head_admin', 'head_viewer']
    : ['franchise_owner', 'franchise_admin', 'manager', 'measurer', 'viewer']

  const load = async () => {
    if (!activeOrgId) return
    setLoading(true)
    try {
      const [m, i] = await Promise.all([
        organizationsService.listMembers(activeOrgId),
        organizationsService.listInvitations(activeOrgId),
      ])
      setMembers(m)
      setInvites(i)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [activeOrgId])

  const onInvite = async () => {
    if (!activeOrgId || !user || !inviteEmail.trim()) return
    try {
      const inv = await organizationsService.createInvitation(activeOrgId, inviteEmail, inviteRole, user.id)
      setInviteEmail('')
      const link = `${window.location.origin}/accept-invite?token=${inv.token}`
      await navigator.clipboard.writeText(link).catch(() => {})
      toast.success('Приглашение создано — ссылка скопирована')
      await load()
    } catch (e: any) {
      toast.error(e.message || 'Ошибка приглашения')
    }
  }

  const onChangeRole = async (id: string, role: AppRole) => {
    try {
      await organizationsService.updateMember(id, { role })
      toast.success('Роль обновлена')
      await load()
    } catch (e: any) { toast.error(e.message) }
  }

  const onToggleStatus = async (m: OrgMember) => {
    try {
      await organizationsService.updateMember(m.id, { status: m.status === 'active' ? 'disabled' : 'active' })
      await load()
    } catch (e: any) { toast.error(e.message) }
  }

  const onCancel = async (id: string) => {
    try {
      await organizationsService.cancelInvitation(id)
      await load()
    } catch (e: any) { toast.error(e.message) }
  }

  if (!activeOrg) return <div>Нет активной организации</div>

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Сотрудники — {activeOrg.name}</h1>

      {canManage && (
        <div className="border rounded-lg p-4 space-y-3">
          <h2 className="font-semibold">Пригласить сотрудника</h2>
          <div className="flex flex-wrap gap-2">
            <input
              type="email"
              placeholder="email@example.com"
              value={inviteEmail}
              onChange={e => setInviteEmail(e.target.value)}
              className="flex-1 min-w-[200px] px-3 py-2 rounded-md border border-input bg-background"
            />
            <select
              value={inviteRole}
              onChange={e => setInviteRole(e.target.value as AppRole)}
              className="px-3 py-2 rounded-md border border-input bg-background"
            >
              {availableRoles.map(r => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
            </select>
            <button onClick={onInvite} className="px-4 py-2 rounded-md bg-primary text-primary-foreground">
              Пригласить
            </button>
          </div>
          <p className="text-xs text-muted-foreground">
            После создания ссылка будет скопирована в буфер. Передайте её сотруднику.
          </p>
        </div>
      )}

      <div>
        <h2 className="font-semibold mb-2">Сотрудники</h2>
        {loading ? <div>Загрузка...</div> : (
          <div className="border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted">
                <tr>
                  <th className="text-left p-2">Email / ФИО</th>
                  <th className="text-left p-2">Роль</th>
                  <th className="text-left p-2">Статус</th>
                  {canManage && <th className="text-left p-2">Действия</th>}
                </tr>
              </thead>
              <tbody>
                {members.map(m => (
                  <tr key={m.id} className="border-t">
                    <td className="p-2">{m.full_name || m.email || m.user_id.slice(0, 8)}</td>
                    <td className="p-2">
                      {canManage && m.user_id !== user?.id ? (
                        <select value={m.role} onChange={e => onChangeRole(m.id, e.target.value as AppRole)}
                                className="px-2 py-1 rounded border border-input bg-background">
                          {availableRoles.map(r => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
                        </select>
                      ) : ROLE_LABELS[m.role]}
                    </td>
                    <td className="p-2">{m.status}</td>
                    {canManage && (
                      <td className="p-2">
                        {m.user_id !== user?.id && (
                          <button onClick={() => onToggleStatus(m)} className="text-sm underline">
                            {m.status === 'active' ? 'Отключить' : 'Включить'}
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {canManage && (
        <div>
          <h2 className="font-semibold mb-2">Приглашения</h2>
          {invites.length === 0 ? <div className="text-muted-foreground text-sm">Нет приглашений</div> : (
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted">
                  <tr>
                    <th className="text-left p-2">Email</th>
                    <th className="text-left p-2">Роль</th>
                    <th className="text-left p-2">Статус</th>
                    <th className="text-left p-2">Ссылка</th>
                    <th className="text-left p-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {invites.map(i => {
                    const link = `${window.location.origin}/accept-invite?token=${i.token}`
                    return (
                      <tr key={i.id} className="border-t">
                        <td className="p-2">{i.email}</td>
                        <td className="p-2">{ROLE_LABELS[i.role]}</td>
                        <td className="p-2">{i.status}</td>
                        <td className="p-2">
                          {i.status === 'pending' && (
                            <button onClick={() => { navigator.clipboard.writeText(link); toast.success('Скопировано') }}
                                    className="text-sm underline">
                              Скопировать
                            </button>
                          )}
                        </td>
                        <td className="p-2">
                          {i.status === 'pending' && (
                            <button onClick={() => onCancel(i.id)} className="text-sm text-destructive underline">
                              Отменить
                            </button>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { organizationsService } from '../services/organizationsService'
import { setActiveOrgId } from '../services/activeOrg'

export default function AcceptInvite() {
  const [params] = useSearchParams()
  const { user, loading } = useAuth()
  const nav = useNavigate()
  const [status, setStatus] = useState<'pending' | 'ok' | 'error'>('pending')
  const [msg, setMsg] = useState('')

  useEffect(() => {
    const token = params.get('token')
    if (!token) { setStatus('error'); setMsg('Нет токена'); return }
    if (loading) return
    if (!user) { nav('/login?next=' + encodeURIComponent(window.location.pathname + window.location.search)); return }
    organizationsService.acceptInvitation(token)
      .then(async () => {
        // загрузим членства и активируем новую
        const list = await organizationsService.listMyMemberships()
        const last = list[list.length - 1]
        if (last) setActiveOrgId(last.organization_id)
        setStatus('ok')
        setMsg('Вы добавлены в организацию')
        setTimeout(() => nav('/customers'), 1200)
      })
      .catch(e => { setStatus('error'); setMsg(e.message || 'Не удалось принять приглашение') })
  }, [params, user, loading, nav])

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="max-w-md w-full border rounded-lg p-6 space-y-2">
        <h1 className="text-xl font-bold">Приглашение в организацию</h1>
        {status === 'pending' && <p>Обработка...</p>}
        {status === 'ok' && <p className="text-green-600">{msg}</p>}
        {status === 'error' && <p className="text-destructive">{msg}</p>}
      </div>
    </div>
  )
}

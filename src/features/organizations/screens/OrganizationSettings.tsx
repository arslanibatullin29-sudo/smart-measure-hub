import { useEffect, useState } from 'react'
import { useOrganization } from '../contexts/OrganizationProvider'
import { organizationsService } from '../services/organizationsService'
import { toast } from 'sonner'

export default function OrganizationSettings() {
  const { activeOrg, activeOrgId, canManage, refresh } = useOrganization()
  const [form, setForm] = useState({
    name: '', phone: '', email: '', address: '', tax_id: '', logo_url: '',
  })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (activeOrg) {
      setForm({
        name: activeOrg.name || '',
        phone: activeOrg.phone || '',
        email: activeOrg.email || '',
        address: activeOrg.address || '',
        tax_id: activeOrg.tax_id || '',
        logo_url: activeOrg.logo_url || '',
      })
    }
  }, [activeOrg])

  if (!activeOrg || !activeOrgId) {
    return <div className="p-4 text-muted-foreground">Нет активной организации</div>
  }

  const onSave = async () => {
    if (!canManage) return
    setSaving(true)
    try {
      await organizationsService.update(activeOrgId, form)
      await refresh()
      toast.success('Сохранено')
    } catch (e: any) {
      toast.error(e.message || 'Ошибка сохранения')
    } finally {
      setSaving(false)
    }
  }

  const readOnly = !canManage

  return (
    <div className="max-w-2xl space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Настройки организации</h1>
        <p className="text-sm text-muted-foreground">
          Тип: <b>{activeOrg.organization_type === 'head' ? 'Головная компания' : 'Франчайзи'}</b>
        </p>
      </div>

      {[
        { k: 'name', label: 'Название' },
        { k: 'phone', label: 'Телефон' },
        { k: 'email', label: 'Email' },
        { k: 'address', label: 'Адрес' },
        { k: 'tax_id', label: 'Реквизиты (ИНН/ОГРН)' },
        { k: 'logo_url', label: 'URL логотипа' },
      ].map(({ k, label }) => (
        <div key={k} className="space-y-1">
          <label className="text-sm font-medium">{label}</label>
          <input
            type="text"
            value={(form as any)[k]}
            disabled={readOnly}
            onChange={e => setForm({ ...form, [k]: e.target.value })}
            className="w-full px-3 py-2 rounded-md border border-input bg-background disabled:opacity-60"
          />
        </div>
      ))}

      <button
        onClick={onSave}
        disabled={saving || readOnly}
        className="px-4 py-2 rounded-md bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50"
      >
        {saving ? 'Сохранение...' : 'Сохранить'}
      </button>
      {readOnly && <p className="text-sm text-muted-foreground">У вас нет прав редактировать организацию.</p>}
    </div>
  )
}

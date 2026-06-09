import { useState } from 'react'
import { useOrganization } from '../contexts/OrganizationProvider'
import { organizationsService, OrgType } from '../services/organizationsService'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog'
import { Plus } from 'lucide-react'
import { toast } from 'sonner'

export default function OrgSwitcher() {
  const { memberships, activeOrgId, setActiveOrgId, refresh } = useOrganization()
  const { user } = useAuth()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [type, setType] = useState<OrgType>('head')
  const [busy, setBusy] = useState(false)

  const handleCreate = async () => {
    if (!user || !name.trim()) return
    setBusy(true)
    try {
      const org = await organizationsService.createOrganization(user.id, name.trim(), type, null)
      toast.success('Организация создана')
      await refresh()
      setActiveOrgId(org.id)
      setOpen(false)
      setName('')
    } catch (e: any) {
      toast.error(e.message || 'Не удалось создать организацию')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-1.5">
      {memberships.length > 1 && (
        <select
          value={activeOrgId || ''}
          onChange={e => setActiveOrgId(e.target.value)}
          className="w-full px-2 py-1 text-xs rounded border border-input bg-background"
        >
          {memberships.map(m => (
            <option key={m.organization_id} value={m.organization_id}>
              {m.organization.name} {m.organization.organization_type === 'head' ? '(головная)' : ''}
            </option>
          ))}
        </select>
      )}
      <Button
        size="sm" variant="outline"
        className="w-full h-7 text-xs gap-1"
        onClick={() => setOpen(true)}
      >
        <Plus className="h-3 w-3" /> Создать организацию
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Новая организация</DialogTitle>
            <DialogDescription>
              Головная компания управляет сетью франчайзи. Франчайзи — независимая точка.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Название</Label>
              <Input value={name} onChange={e => setName(e.target.value)} placeholder="ООО Ромашка" />
            </div>
            <div>
              <Label>Тип</Label>
              <div className="grid grid-cols-2 gap-2 mt-1">
                <button
                  type="button"
                  onClick={() => setType('head')}
                  className={`border rounded-md p-3 text-left text-sm ${type === 'head' ? 'border-primary bg-primary/5' : 'border-input'}`}
                >
                  <div className="font-medium">Головная</div>
                  <div className="text-xs text-muted-foreground">Видит все свои франчайзи</div>
                </button>
                <button
                  type="button"
                  onClick={() => setType('franchise')}
                  className={`border rounded-md p-3 text-left text-sm ${type === 'franchise' ? 'border-primary bg-primary/5' : 'border-input'}`}
                >
                  <div className="font-medium">Франчайзи</div>
                  <div className="text-xs text-muted-foreground">Отдельная точка</div>
                </button>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={busy}>Отмена</Button>
            <Button onClick={handleCreate} disabled={busy || !name.trim()}>
              {busy ? 'Создание...' : 'Создать'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

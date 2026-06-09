import { useEffect, useState } from 'react'
import { useOrganization } from '../contexts/OrganizationProvider'
import { organizationsService, Organization } from '../services/organizationsService'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Building2, Plus } from 'lucide-react'
import { toast } from 'sonner'

export default function FranchisesList() {
  const { activeOrg, isHead, refresh, setActiveOrgId } = useOrganization()
  const { user } = useAuth()
  const [franchises, setFranchises] = useState<Organization[]>([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')

  const load = async () => {
    if (!activeOrg || !isHead) return
    setLoading(true)
    try {
      const list = await organizationsService.listChildFranchises(activeOrg.id)
      setFranchises(list)
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [activeOrg?.id, isHead])

  if (!isHead) {
    return (
      <div className="p-6">
        <p className="text-muted-foreground">Раздел доступен только для головной организации.</p>
      </div>
    )
  }

  const handleCreate = async () => {
    if (!name.trim() || !user || !activeOrg) return
    try {
      await organizationsService.createOrganization(user.id, name.trim(), 'franchise', activeOrg.id)
      toast.success('Франчайзи создан')
      setName('')
      setOpen(false)
      await load()
      await refresh()
      // Активная организация не меняется, владелец head остаётся в head
    } catch (e: any) {
      toast.error(e.message)
    }
  }

  return (
    <div className="p-4 sm:p-6 animate-fade-in">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold">Франчайзи</h1>
          <p className="text-sm text-muted-foreground">Дочерние организации головной компании</p>
        </div>
        <Button onClick={() => setOpen(true)} size="sm" className="gap-1.5">
          <Plus className="h-4 w-4" /> Новый франчайзи
        </Button>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Загрузка...</p>
      ) : franchises.length === 0 ? (
        <Card><CardContent className="p-8 text-center text-muted-foreground">Нет франчайзи. Создайте первого.</CardContent></Card>
      ) : (
        <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {franchises.map(f => (
            <Card key={f.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Building2 className="h-4 w-4 text-primary" />
                  {f.name}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-xs text-muted-foreground">
                {f.phone && <div>📞 {f.phone}</div>}
                {f.email && <div>✉️ {f.email}</div>}
                {f.address && <div>📍 {f.address}</div>}
                <Button
                  size="sm" variant="outline" className="w-full mt-2"
                  onClick={() => { setActiveOrgId(f.id); toast.success(`Активна: ${f.name}`) }}
                >
                  Открыть как активную
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Новый франчайзи</DialogTitle></DialogHeader>
          <Input placeholder="Название" value={name} onChange={e => setName(e.target.value)} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Отмена</Button>
            <Button onClick={handleCreate}>Создать</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

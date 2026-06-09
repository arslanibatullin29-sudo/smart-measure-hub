import { useEffect, useState } from 'react'
import { useOrganization } from '../contexts/OrganizationProvider'
import { supabase } from '@/services/supabase/supabaseClient'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Users, FolderKanban, Building2, Ruler } from 'lucide-react'

interface Stats {
  customers: number
  projects: number
  franchises: number
  totalArea: number
}

export default function Dashboard() {
  const { activeOrg, isHead } = useOrganization()
  const [stats, setStats] = useState<Stats>({ customers: 0, projects: 0, franchises: 0, totalArea: 0 })
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!activeOrg) return
    let cancelled = false
    ;(async () => {
      setLoading(true)
      try {
        // RLS уже ограничит видимость, поэтому для head автоматически попадут все дочерние.
        const orgIds: string[] = [activeOrg.id]
        if (isHead) {
          const { data: kids } = await supabase
            .from('organizations').select('id').eq('parent_organization_id', activeOrg.id)
          if (kids) orgIds.push(...kids.map((k: any) => k.id))
        }

        const [{ count: c }, { count: p }, { data: areas }, { count: fr }] = await Promise.all([
          supabase.from('customers').select('id', { count: 'exact', head: true }).in('organization_id', orgIds),
          supabase.from('projects').select('id', { count: 'exact', head: true }).in('organization_id', orgIds),
          supabase.from('projects').select('area').in('organization_id', orgIds),
          isHead
            ? supabase.from('organizations').select('id', { count: 'exact', head: true }).eq('parent_organization_id', activeOrg.id)
            : Promise.resolve({ count: 0 } as any),
        ])

        if (cancelled) return
        const totalArea = (areas || []).reduce((s: number, r: any) => s + Number(r.area || 0), 0)
        setStats({ customers: c || 0, projects: p || 0, franchises: fr || 0, totalArea })
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [activeOrg?.id, isHead])

  const cards = [
    { label: 'Клиенты', value: stats.customers, icon: Users },
    { label: 'Объекты', value: stats.projects, icon: FolderKanban },
    { label: 'Общая площадь, м²', value: stats.totalArea.toFixed(1), icon: Ruler },
    ...(isHead ? [{ label: 'Франчайзи', value: stats.franchises, icon: Building2 }] : []),
  ]

  return (
    <div className="p-4 sm:p-6 animate-fade-in">
      <div className="mb-4">
        <h1 className="text-2xl font-bold">Дашборд</h1>
        <p className="text-sm text-muted-foreground">
          {isHead ? 'Сводка по головной компании и франчайзи' : `Сводка по организации: ${activeOrg?.name}`}
        </p>
      </div>

      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        {cards.map(({ label, value, icon: Icon }) => (
          <Card key={label}>
            <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-xs font-medium text-muted-foreground">{label}</CardTitle>
              <Icon className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{loading ? '…' : value}</div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}

import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '@/features/auth/hooks/useAuth'
import Canvas from '../editor/Canvas'
import { projectsService } from '../services/projectsService'
import { useProjects } from '../hooks/useProjects'
import { profileService } from '../estimate/profile/services/profileService'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { InstallationProfile } from '@/services/storage/indexedDB'

function ProjectEditor() {
  const { customerId, projectId } = useParams<{ customerId: string; projectId?: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { createProject, updateProject, isCreating, isUpdating } = useProjects()
  const [points, setPoints] = useState<Array<{ x: number; y: number }>>([])
  const [area, setArea] = useState(0)
  const [perimeter, setPerimeter] = useState(0)
  const [profiles, setProfiles] = useState<InstallationProfile[]>([])
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null)

  useEffect(() => {
    if (user?.id) {
      loadProfiles()
    }
  }, [user?.id])

  useEffect(() => {
    if (projectId && user?.id) {
      projectsService.getById(projectId).then((project) => {
        if (project) {
          setPoints(project.points)
          setArea(project.area)
          setPerimeter(project.perimeter)
          setSelectedProfileId(project.profileId || null)
        }
      })
    }
  }, [projectId, user?.id])

  const loadProfiles = async () => {
    if (!user?.id) return
    try {
      const allProfiles = await profileService.getAllProfiles(user.id)
      setProfiles(allProfiles)
      
      // Если нет выбранного профиля, выбираем по умолчанию
      if (!selectedProfileId) {
        const defaultProfile = allProfiles.find(p => p.isDefault) || allProfiles[0]
        if (defaultProfile) {
          setSelectedProfileId(String(defaultProfile.id))
        }
      }
    } catch (error: any) {
      console.error('Ошибка загрузки профилей:', error)
    }
  }

  // Prevent double-submit on mobile
  const isSavingRef = useRef(false)
  
  const handleSave = useCallback(async () => {
    // Prevent double-submit
    if (isSavingRef.current) {
      return
    }
    
    if (!customerId || !user?.id) {
      toast.error('Ошибка: не указан клиент или пользователь')
      return
    }
    
    if (points.length < 3) {
      toast.error('Добавьте минимум 3 точки для сохранения объекта')
      return
    }

    isSavingRef.current = true
    
    try {
      const projectData = {
        customerId,
        userId: user.id,
        profileId: selectedProfileId || undefined,
        points: [...points], // Create copy to avoid mutation issues
        area: Number(area.toFixed(2)),
        perimeter: Number(perimeter.toFixed(2)),
        elementCount: 0,
        estimateData: null,
      }

      if (projectId) {
        await updateProject({ id: projectId, data: projectData })
        toast.success('Объект обновлен')
      } else {
        await createProject(projectData)
        toast.success('Объект создан')
      }

      navigate(`/customers/${customerId}/projects`)
    } catch (error: any) {
      console.error('Save error:', error)
      toast.error('Ошибка сохранения: ' + (error.message || 'Попробуйте еще раз'))
    } finally {
      // Small delay to prevent rapid re-clicks on mobile
      setTimeout(() => {
        isSavingRef.current = false
      }, 500)
    }
  }, [customerId, user?.id, points, area, perimeter, selectedProfileId, projectId, updateProject, createProject, navigate])

  return (
    <div className="w-full space-y-2 sm:space-y-4 md:space-y-6 px-2 sm:px-4 md:px-6 pb-4">
      {/* Compact Header for mobile */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => navigate(`/customers/${customerId}/projects`)}
            className="h-9 w-9 shrink-0"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-lg sm:text-2xl md:text-3xl font-bold text-foreground truncate">
            {projectId ? 'Редактировать' : 'Новый объект'}
          </h1>
        </div>
        <Button
          onClick={handleSave}
          disabled={(isCreating || isUpdating) || points.length < 3}
          className="h-9 px-3 sm:px-4 text-sm touch-manipulation shrink-0"
        >
          {(isCreating || isUpdating) ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : 'Сохранить'}
        </Button>
      </div>

      {/* Canvas */}
      <Canvas
        points={points}
        onPointsChange={setPoints}
        onAreaChange={setArea}
        onPerimeterChange={setPerimeter}
      />

      {/* Profile Selection Card */}
      {profiles.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base sm:text-lg">Профиль монтажа</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="space-y-2">
              <Label htmlFor="profileSelect" className="text-sm">Выберите профиль для расчета сметы</Label>
              <select
                id="profileSelect"
                value={selectedProfileId || ''}
                onChange={(e) => setSelectedProfileId(e.target.value || null)}
                className="flex h-11 sm:h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-base sm:text-sm touch-manipulation"
              >
                <option value="">Не выбран</option>
                {profiles.map((profile) => (
                  <option key={profile.id} value={profile.id}>
                    {profile.name} {profile.isDefault ? '(По умолчанию)' : ''}
                  </option>
                ))}
              </select>
              <p className="text-xs sm:text-sm text-muted-foreground">
                Профиль определяет материалы и работы, используемые при расчете сметы
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Параметры помещения - добавляем визуальные подсказки */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base sm:text-lg">Параметры помещения</CardTitle>
          <p className="text-xs text-muted-foreground">Значения рассчитываются автоматически на основе нарисованного контура</p>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="grid grid-cols-3 gap-3 sm:gap-4 md:gap-6">
            <div className="space-y-1 sm:space-y-2" title="Площадь = сумма площадей треугольников контура (формула Шнурка)">
              <Label className="text-muted-foreground text-xs sm:text-sm flex items-center gap-1">
                Площадь
                <span className="text-[10px] text-primary">(авто)</span>
              </Label>
              <div className="text-lg sm:text-xl md:text-2xl font-semibold font-mono">{area.toFixed(2)} м²</div>
              <p className="text-[10px] text-muted-foreground">Используется для расчёта материалов "по площади"</p>
            </div>
            <div className="space-y-1 sm:space-y-2" title="Периметр = сумма длин всех сторон контура">
              <Label className="text-muted-foreground text-xs sm:text-sm flex items-center gap-1">
                Периметр
                <span className="text-[10px] text-primary">(авто)</span>
              </Label>
              <div className="text-lg sm:text-xl md:text-2xl font-semibold font-mono">{perimeter.toFixed(2)} м</div>
              <p className="text-[10px] text-muted-foreground">Используется для расчёта материалов "по периметру"</p>
            </div>
            <div className="space-y-1 sm:space-y-2" title="Количество точек/углов в контуре">
              <Label className="text-muted-foreground text-xs sm:text-sm">Углов</Label>
              <div className="text-lg sm:text-xl md:text-2xl font-semibold font-mono">{points.length}</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default ProjectEditor


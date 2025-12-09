import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '@/features/auth/hooks/useAuth'
import Canvas from '../editor/Canvas'
import { projectsService } from '../services/projectsService'
import { useProjects } from '../hooks/useProjects'
import { profileService } from '../estimate/profile/services/profileService'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ArrowLeft } from 'lucide-react'
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
  const [elementCount, setElementCount] = useState(0)
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
          setElementCount(project.elementCount)
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

  const handleSave = async () => {
    if (!customerId || !user?.id || points.length < 3) {
      toast.error('Добавьте минимум 3 точки для сохранения проекта')
      return
    }

    try {
      const projectData = {
        customerId,
        userId: user.id,
        profileId: selectedProfileId || undefined,
        points,
        area,
        perimeter,
        elementCount,
        estimateData: null,
      }

      if (projectId) {
        await updateProject({ id: projectId, data: projectData })
        toast.success('Проект обновлен')
      } else {
        await createProject(projectData)
        toast.success('Проект создан')
      }

      // Навигация происходит после успешного создания/обновления
      // React Query автоматически обновит список через invalidateQueries
      navigate(`/customers/${customerId}/projects`)
    } catch (error: any) {
      toast.error('Ошибка сохранения: ' + error.message)
    }
  }

  return (
    <div className="w-full space-y-3 sm:space-y-4 md:space-y-6 px-2 sm:px-4 md:px-6 pb-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
        <div className="flex items-center gap-2 sm:gap-4">
          <Button
            variant="outline"
            size="icon"
            onClick={() => navigate(`/customers/${customerId}/projects`)}
            className="h-10 w-10 sm:h-9 sm:w-9"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-foreground truncate">
              {projectId ? 'Редактировать проект' : 'Новый проект'}
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground mt-0.5 sm:mt-1 hidden sm:block">
              Нарисуйте план помещения, кликая по canvas для добавления точек
            </p>
          </div>
        </div>
        <div className="flex gap-2 sm:gap-3">
          <Button
            variant="outline"
            onClick={() => navigate(`/customers/${customerId}/projects`)}
            className="flex-1 sm:flex-initial h-10 sm:h-9 text-sm"
          >
            Отмена
          </Button>
          <Button
            onClick={handleSave}
            disabled={(isCreating || isUpdating) || points.length < 3}
            className="flex-1 sm:flex-initial h-10 sm:h-9 text-sm"
          >
            {(isCreating || isUpdating) ? 'Сохранение...' : 'Сохранить'}
          </Button>
        </div>
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

      {/* Parameters Card */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base sm:text-lg">Параметры помещения</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 md:gap-6">
            <div className="space-y-1 sm:space-y-2">
              <Label className="text-muted-foreground text-xs sm:text-sm">Площадь</Label>
              <div className="text-lg sm:text-xl md:text-2xl font-semibold font-mono">{area.toFixed(2)} м²</div>
            </div>
            <div className="space-y-1 sm:space-y-2">
              <Label className="text-muted-foreground text-xs sm:text-sm">Периметр</Label>
              <div className="text-lg sm:text-xl md:text-2xl font-semibold font-mono">{perimeter.toFixed(2)} м</div>
            </div>
            <div className="space-y-1 sm:space-y-2">
              <Label className="text-muted-foreground text-xs sm:text-sm">Углов</Label>
              <div className="text-lg sm:text-xl md:text-2xl font-semibold font-mono">{points.length}</div>
            </div>
            <div className="space-y-1 sm:space-y-2 col-span-2 sm:col-span-1">
              <Label htmlFor="elementCount" className="text-xs sm:text-sm">Элементов</Label>
              <Input
                id="elementCount"
                type="number"
                value={elementCount}
                onChange={(e) => setElementCount(parseInt(e.target.value) || 0)}
                min="0"
                placeholder="0"
                className="h-11 sm:h-10 text-base sm:text-sm touch-manipulation"
              />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default ProjectEditor


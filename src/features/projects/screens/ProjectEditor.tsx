import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '@/features/auth/hooks/useAuth'
import Canvas from '../editor/Canvas'
import { projectsService } from '../services/projectsService'
import { useProjects } from '../hooks/useProjects'
import { profileService } from '../estimate/profile/services/profileService'
import { Button } from '@/components/ui/button'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { InstallationProfile } from '@/services/storage/indexedDB'
import { LoadingBar } from '@/components/LoadingBar'

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
  const [isLoadingProfiles, setIsLoadingProfiles] = useState(false)
  const [isLoadingProject, setIsLoadingProject] = useState(false)

  useEffect(() => {
    if (user?.id) {
      loadProfiles()
    }
  }, [user?.id])

  useEffect(() => {
    if (projectId && user?.id) {
      setIsLoadingProject(true)
      projectsService.getById(projectId).then((project) => {
        if (project) {
          setPoints(project.points)
          setArea(project.area)
          setPerimeter(project.perimeter)
          setSelectedProfileId(project.profileId || null)
        }
      }).finally(() => {
        setIsLoadingProject(false)
      })
    }
  }, [projectId, user?.id])

  const loadProfiles = async () => {
    if (!user?.id) return
    setIsLoadingProfiles(true)
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
    } finally {
      setIsLoadingProfiles(false)
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
    <div className="w-full h-[100dvh] sm:h-screen flex flex-col overflow-hidden">
      <LoadingBar isLoading={isLoadingProfiles || isLoadingProject || isCreating || isUpdating} />
      
      {/* Compact Header for mobile */}
      <div className="flex items-center justify-between gap-2 py-2 px-2 sm:px-4 md:px-6 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <Button
            variant="outline"
            size="icon"
            onClick={() => navigate(`/customers/${customerId}/projects`)}
            className="h-8 w-8 shrink-0"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-base sm:text-xl font-bold text-foreground truncate">
            {projectId ? 'Редактировать' : 'Новый объект'}
          </h1>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {/* Compact Profile Selection */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            <label className="text-xs sm:text-sm text-muted-foreground whitespace-nowrap hidden sm:block">
              Профиль:
            </label>
            {isLoadingProfiles ? (
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            ) : profiles.length > 0 ? (
              <select
                value={selectedProfileId || ''}
                onChange={(e) => setSelectedProfileId(e.target.value || null)}
                className="h-8 rounded-md border border-input bg-background px-2 text-xs sm:text-sm touch-manipulation max-w-[120px] sm:max-w-[180px]"
              >
                <option value="">Профиль...</option>
                {profiles.map((profile) => (
                  <option key={profile.id} value={profile.id}>
                    {profile.name}
                  </option>
                ))}
              </select>
            ) : null}
          </div>
          <Button
            onClick={handleSave}
            disabled={(isCreating || isUpdating) || points.length < 3}
            className="h-8 px-3 text-sm touch-manipulation shrink-0"
          >
            {(isCreating || isUpdating) ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : 'Сохранить'}
          </Button>
        </div>
      </div>

      {/* Canvas - takes remaining space */}
      <div className="flex-1 min-h-0 w-full">
        <Canvas
          points={points}
          onPointsChange={setPoints}
          onAreaChange={setArea}
          onPerimeterChange={setPerimeter}
        />
      </div>
    </div>
  )
}

export default ProjectEditor


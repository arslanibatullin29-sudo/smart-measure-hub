import { useParams, useNavigate } from 'react-router-dom'
import { useProjects } from '../hooks/useProjects'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { LoadingBar } from '@/components/LoadingBar'
import { ArrowLeft, Plus, FileText, Edit, Trash2, Square, Maximize2, Grid3X3 } from 'lucide-react'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { useState } from 'react'

function ProjectsList() {
  const { customerId } = useParams<{ customerId: string }>()
  const navigate = useNavigate()
  const { projects, isLoading, deleteProject, isDeleting } = useProjects()
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [projectToDelete, setProjectToDelete] = useState<string | null>(null)

  // Показываем все проекты (удалённые отфильтрованы на уровне сервиса)

  const handleDelete = async (id: string) => {
    setProjectToDelete(id)
    setDeleteDialogOpen(true)
  }

  const confirmDelete = async () => {
    if (projectToDelete) {
      try {
        await deleteProject(projectToDelete)
        toast.success('Объект удален')
        setDeleteDialogOpen(false)
        setProjectToDelete(null)
      } catch (error: any) {
        toast.error('Ошибка: ' + error.message)
      }
    }
  }

  return (
    <div className="w-full animate-fade-in">
      <LoadingBar isLoading={isLoading || isDeleting} />
      
      {/* Компактный заголовок */}
      <div className="flex items-center justify-between mb-4 sm:mb-6">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/customers')}
            className="h-8 w-8 p-0 flex-shrink-0"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold text-foreground truncate">Объекты</h1>
            <p className="text-xs sm:text-sm text-muted-foreground hidden sm:block">Управление объектами</p>
          </div>
        </div>
        <Button
          onClick={() => navigate(`/customers/${customerId}/projects/new`)}
          size="sm"
          className="gap-1.5"
        >
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">Новый</span>
        </Button>
      </div>

      {isLoading ? (
        <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardContent className="p-3 sm:p-4">
                <div className="grid grid-cols-2 gap-2 mb-3">
                  <Skeleton className="h-12" />
                  <Skeleton className="h-12" />
                  <Skeleton className="h-12" />
                  <Skeleton className="h-12" />
                </div>
                <div className="flex gap-2">
                  <Skeleton className="h-8 flex-1" />
                  <Skeleton className="h-8 w-8" />
                  <Skeleton className="h-8 w-8" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : projects.length === 0 ? (
        <div className="text-center py-8 sm:py-12">
          <p className="text-muted-foreground mb-4 text-sm">Нет объектов</p>
          <Button
            onClick={() => navigate(`/customers/${customerId}/projects/new`)}
            size="sm"
            className="gap-1.5"
          >
            <Plus className="h-4 w-4" />
            Создать первый
          </Button>
        </div>
      ) : (
        <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => (
            <Card key={project.id} className="group hover:shadow-md transition-shadow">
              <CardContent className="p-3 sm:p-4">
                {/* Компактная сетка параметров */}
                <div className="grid grid-cols-3 gap-2 sm:gap-3 mb-3">
                  <div className="flex items-center gap-2 p-2 bg-muted/50 rounded-md" title="Площадь рассчитывается автоматически по нарисованному контуру">
                    <Square className="h-3.5 w-3.5 text-muted-foreground" />
                    <div>
                      <p className="text-xs text-muted-foreground">Площадь</p>
                      <p className="text-sm font-semibold font-mono">{project.area.toFixed(2)} м²</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 p-2 bg-muted/50 rounded-md" title="Периметр рассчитывается автоматически по контуру">
                    <Maximize2 className="h-3.5 w-3.5 text-muted-foreground" />
                    <div>
                      <p className="text-xs text-muted-foreground">Периметр</p>
                      <p className="text-sm font-semibold font-mono">{project.perimeter.toFixed(2)} м</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 p-2 bg-muted/50 rounded-md" title="Количество углов в контуре помещения">
                    <Grid3X3 className="h-3.5 w-3.5 text-muted-foreground" />
                    <div>
                      <p className="text-xs text-muted-foreground">Углов</p>
                      <p className="text-sm font-semibold">{project.points.length}</p>
                    </div>
                  </div>
                </div>

                <p className="text-xs text-muted-foreground mb-3">
                  {new Date(project.createdAt).toLocaleDateString('ru-RU')}
                </p>

                <div className="flex gap-1.5 sm:gap-2">
                  <Button
                    onClick={() => navigate(`/customers/${customerId}/projects/${String(project.id!)}/estimate`)}
                    size="sm"
                    variant="outline"
                    className="flex-1 h-8 text-xs sm:text-sm"
                  >
                    <FileText className="h-3.5 w-3.5 mr-1" />
                    Смета
                  </Button>
                  <Button
                    onClick={() => navigate(`/customers/${customerId}/projects/${String(project.id!)}/edit`)}
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0"
                  >
                    <Edit className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    onClick={() => handleDelete(String(project.id!))}
                    disabled={isDeleting}
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Удалить объект?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">Это действие необратимо.</p>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" size="sm" onClick={() => setDeleteDialogOpen(false)}>Отмена</Button>
            <Button variant="destructive" size="sm" onClick={confirmDelete} disabled={isDeleting}>
              {isDeleting ? 'Удаление...' : 'Удалить'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default ProjectsList

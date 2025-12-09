import { useParams, useNavigate, Link } from 'react-router-dom'
import { useProjects } from '../hooks/useProjects'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { ArrowLeft, Plus, FileText, Edit, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { useState } from 'react'

function ProjectsList() {
  const { customerId } = useParams<{ customerId: string }>()
  const navigate = useNavigate()
  const { projects, isLoading, deleteProject, isDeleting } = useProjects()
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [projectToDelete, setProjectToDelete] = useState<string | null>(null)

  const handleDelete = async (id: string) => {
    setProjectToDelete(id)
    setDeleteDialogOpen(true)
  }

  const confirmDelete = async () => {
    if (projectToDelete) {
      try {
        await deleteProject(projectToDelete)
        toast.success('Проект удален')
        setDeleteDialogOpen(false)
        setProjectToDelete(null)
      } catch (error: any) {
        toast.error('Ошибка удаления: ' + error.message)
      }
    }
  }

  return (
    <div className="max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <Link to="/customers" className="flex items-center gap-2 text-muted-foreground hover:text-foreground mb-2">
            <ArrowLeft className="h-4 w-4" />
            Назад к клиентам
          </Link>
          <h1 className="text-3xl font-bold text-foreground mb-2">Проекты</h1>
          <p className="text-muted-foreground">Управление проектами клиента</p>
        </div>
        <Button
          onClick={() => navigate(`/customers/${customerId}/projects/new`)}
          className="gap-2"
        >
          <Plus className="h-4 w-4" />
          Новый проект
        </Button>
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">Загрузка...</div>
      ) : projects.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground mb-4">Нет проектов</p>
          <Button
            onClick={() => navigate(`/customers/${customerId}/projects/new`)}
            className="gap-2"
          >
            <Plus className="h-4 w-4" />
            Создать первый проект
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => (
            <Card key={project.id} className="flex flex-col">
              <CardContent className="p-6 flex flex-col flex-1">
                <div className="flex-1 mb-4">
                  <div className="grid grid-cols-2 gap-3 mb-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Площадь</p>
                      <p className="text-lg font-semibold font-mono">{project.area.toFixed(2)} м²</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Периметр</p>
                      <p className="text-lg font-semibold font-mono">{project.perimeter.toFixed(2)} м</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Углов</p>
                      <p className="text-lg font-semibold">{project.points.length}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Элементов</p>
                      <p className="text-lg font-semibold">{project.elementCount}</p>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Создан: {new Date(project.createdAt).toLocaleDateString('ru-RU')}
                  </p>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <Button
                    onClick={() => navigate(`/customers/${customerId}/projects/${String(project.id!)}/estimate`)}
                    className="flex-1 min-w-0"
                    size="sm"
                    variant="outline"
                  >
                    <FileText className="h-4 w-4 mr-1" />
                    Смета
                  </Button>
                  <Button
                    onClick={() => navigate(`/customers/${customerId}/projects/${String(project.id!)}/edit`)}
                    variant="secondary"
                    size="sm"
                    className="flex-shrink-0"
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    onClick={() => handleDelete(String(project.id!))}
                    disabled={isDeleting}
                    variant="destructive"
                    size="sm"
                    className="flex-shrink-0"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Подтвердите удаление</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p>Вы уверены, что хотите удалить этот проект? Это действие необратимо.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>Отмена</Button>
            <Button variant="destructive" onClick={confirmDelete} disabled={isDeleting}>
              {isDeleting ? 'Удаление...' : 'Удалить'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default ProjectsList


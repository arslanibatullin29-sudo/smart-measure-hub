import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { projectsService } from '../services/projectsService'
import { customersService } from '@/features/customers/services/customersService'
import { estimateService } from '../estimate/services/estimateService'
import { pdfService } from '@/features/pdf/services/pdfService'
import { EstimateResult } from '../estimate/calculators/estimateCalculator'
import { EditableEstimateTable } from '../estimate/components/EditableEstimateTable'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ArrowLeft, Download, Loader2, Save } from 'lucide-react'
import { toast } from 'sonner'
import { Project } from '../models/Project'

function ProjectEstimate() {
  const { customerId, projectId } = useParams<{ customerId: string; projectId: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [estimate, setEstimate] = useState<EstimateResult | null>(null)
  
  const [project, setProject] = useState<Project | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isGenerating, setIsGenerating] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [hasChanges, setHasChanges] = useState(false)

  useEffect(() => {
    if (projectId && user?.id) {
      loadEstimate()
    }
  }, [projectId, user?.id])

  const loadEstimate = async () => {
    if (!projectId || !user?.id) return
    setIsLoading(true)
    try {
      const proj = await projectsService.getById(projectId)
      if (!proj) {
        alert('Проект не найден')
        navigate(`/customers/${customerId}/projects`)
        return
      }
      setProject(proj)

      // Проверяем, есть ли сохранённая смета в проекте
      if (proj.estimateData) {
        setEstimate(proj.estimateData as EstimateResult)
      } else {
        // Рассчитываем новую смету
        const result = await estimateService.calculate(proj)
        setEstimate(result)
      }
    } catch (error: any) {
      toast.error('Ошибка расчёта сметы: ' + error.message)
    } finally {
      setIsLoading(false)
    }
  }

  const handleEstimateChange = (newEstimate: EstimateResult) => {
    setEstimate(newEstimate)
    setHasChanges(true)
  }

  const handleSaveEstimate = async () => {
    if (!projectId || !estimate || !project) return

    setIsSaving(true)
    try {
      await projectsService.update(projectId, {
        ...project,
        estimateData: estimate,
      })
      
      setHasChanges(false)
      toast.success('Смета сохранена')
    } catch (error: any) {
      toast.error('Ошибка сохранения сметы: ' + error.message)
    } finally {
      setIsSaving(false)
    }
  }

  const handleRecalculate = async () => {
    if (!project) return
    
    setIsLoading(true)
    try {
      const result = await estimateService.calculate(project)
      setEstimate(result)
      setHasChanges(true)
      toast.success('Смета пересчитана')
    } catch (error: any) {
      toast.error('Ошибка пересчёта сметы: ' + error.message)
    } finally {
      setIsLoading(false)
    }
  }

  const handleGeneratePDF = async () => {
    if (!projectId || !customerId || !user?.id || !estimate) return

    setIsGenerating(true)
    try {
      const proj = await projectsService.getById(projectId)
      const customers = await customersService.getAll(user.id)
      const customer = customers.find((c) => c.id === customerId)

      if (!proj || !customer) {
        toast.error('Данные не найдены')
        return
      }

      await pdfService.downloadPDF(customer, proj, estimate)
      toast.success('PDF успешно сгенерирован')
    } catch (error: any) {
      toast.error('Ошибка генерации PDF: ' + error.message)
    } finally {
      setIsGenerating(false)
    }
  }

  if (isLoading) {
    return (
      <div className="p-8 text-center">
        <Loader2 className="mx-auto h-8 w-8 animate-spin text-muted-foreground" />
        <p className="mt-4 text-muted-foreground">Расчёт сметы...</p>
      </div>
    )
  }

  if (!estimate) {
    return (
      <div className="p-8 text-center">
        <p className="text-muted-foreground mb-4">Не удалось рассчитать смету</p>
        <Button onClick={() => navigate(`/customers/${customerId}/projects`)}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Назад
        </Button>
      </div>
    )
  }

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Смета проекта</h1>
          <p className="text-muted-foreground mt-1">
            Детальный расчет стоимости работ и материалов
            {hasChanges && <span className="text-orange-500 ml-2">(есть несохранённые изменения)</span>}
          </p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" onClick={() => navigate(`/customers/${customerId}/projects`)}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Назад
          </Button>
          <Button variant="outline" onClick={handleRecalculate} disabled={isLoading}>
            Пересчитать
          </Button>
          {hasChanges && (
            <Button onClick={handleSaveEstimate} disabled={isSaving}>
              {isSaving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Сохранение...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Сохранить
                </>
              )}
            </Button>
          )}
          <Button onClick={handleGeneratePDF} disabled={isGenerating}>
            {isGenerating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Генерация...
              </>
            ) : (
              <>
                <Download className="mr-2 h-4 w-4" />
                Скачать PDF
              </>
            )}
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Редактирование сметы</CardTitle>
        </CardHeader>
        <CardContent>
          <EditableEstimateTable
            estimate={estimate}
            onEstimateChange={handleEstimateChange}
          />
        </CardContent>
      </Card>
    </div>
  )
}

export default ProjectEstimate

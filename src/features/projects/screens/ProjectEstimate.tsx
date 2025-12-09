import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { projectsService } from '../services/projectsService'
import { customersService } from '@/features/customers/services/customersService'
import { estimateService } from '../estimate/services/estimateService'
import { pdfService } from '@/features/pdf/services/pdfService'
import { EstimateResult } from '../estimate/calculators/estimateCalculator'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ArrowLeft, Download, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

function ProjectEstimate() {
  const { customerId, projectId } = useParams<{ customerId: string; projectId: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [estimate, setEstimate] = useState<EstimateResult | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isGenerating, setIsGenerating] = useState(false)

  useEffect(() => {
    if (projectId && user?.id) {
      loadEstimate()
    }
  }, [projectId, user?.id])

  const loadEstimate = async () => {
    if (!projectId || !user?.id) return
    setIsLoading(true)
    try {
      const project = await projectsService.getById(projectId)
      if (!project) {
        alert('Проект не найден')
        navigate(`/customers/${customerId}/projects`)
        return
      }

      const result = await estimateService.calculate(project)
      setEstimate(result)
    } catch (error: any) {
      toast.error('Ошибка расчёта сметы: ' + error.message)
    } finally {
      setIsLoading(false)
    }
  }

  const handleGeneratePDF = async () => {
    if (!projectId || !customerId || !user?.id || !estimate) return

    setIsGenerating(true)
    try {
      const project = await projectsService.getById(projectId)
      const customers = await customersService.getAll(user.id)
      const customer = customers.find((c) => c.id === customerId)

      if (!project || !customer) {
        toast.error('Данные не найдены')
        return
      }

      await pdfService.downloadPDF(customer, project, estimate)
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
          <p className="text-muted-foreground mt-1">Детальный расчет стоимости работ и материалов</p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" onClick={() => navigate(`/customers/${customerId}/projects`)}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Назад
          </Button>
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
          <CardTitle>Детализация сметы</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b-2 border-border">
                  <th className="p-3 text-left font-semibold">Наименование</th>
                  <th className="p-3 text-center font-semibold">Ед.изм</th>
                  <th className="p-3 text-right font-semibold">Кол-во</th>
                  <th className="p-3 text-right font-semibold">Цена</th>
                  <th className="p-3 text-right font-semibold">Сумма</th>
                </tr>
              </thead>
              <tbody>
                {estimate.items.map((item) => (
                  <React.Fragment key={item.workId}>
                    <tr className="border-b border-border">
                      <td className="p-3 font-bold" colSpan={5}>
                        {item.workName}
                      </td>
                    </tr>
                    <tr>
                      <td className="p-3 pl-8">Работа</td>
                      <td className="p-3 text-center">{item.workUnit}</td>
                      <td className="p-3 text-right font-mono">{item.workQuantity.toFixed(2)}</td>
                      <td className="p-3 text-right font-mono">{item.workPrice.toFixed(2)}</td>
                      <td className="p-3 text-right font-mono">{item.workTotal.toFixed(2)}</td>
                    </tr>
                    {item.materials.map((material) => (
                      <tr key={material.materialId} className="text-muted-foreground">
                        <td className="p-3 pl-12">— {material.materialName}</td>
                        <td className="p-3 text-center">{material.materialUnit}</td>
                        <td className="p-3 text-right font-mono">{material.materialQuantity.toFixed(2)}</td>
                        <td className="p-3 text-right font-mono">{material.materialPrice.toFixed(2)}</td>
                        <td className="p-3 text-right font-mono">{material.materialTotal.toFixed(2)}</td>
                      </tr>
                    ))}
                    <tr className="bg-muted/30 border-b border-border">
                      <td className="p-3 font-semibold" colSpan={4}>
                        Итого по работе:
                      </td>
                      <td className="p-3 text-right font-semibold font-mono">
                        {item.workTotalWithMaterials.toFixed(2)} руб.
                      </td>
                    </tr>
                  </React.Fragment>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-primary/10 border-t-2 border-primary font-bold text-lg">
                  <td className="p-4" colSpan={4}>
                    ИТОГО:
                  </td>
                  <td className="p-4 text-right font-mono">
                    {estimate.total.toFixed(2)} руб.
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default ProjectEstimate


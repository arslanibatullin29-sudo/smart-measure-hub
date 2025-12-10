import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { projectsService } from "../services/projectsService";
import { customersService } from "@/features/customers/services/customersService";
import { estimateService } from "../estimate/services/estimateService";
import { pdfService } from "@/features/pdf/services/pdfService";
import { EstimateResult } from "../estimate/calculators/estimateCalculator";
import { EditableEstimateTable } from "../estimate/components/EditableEstimateTable";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { LoadingBar } from "@/components/LoadingBar";
import { ArrowLeft, Download, Loader2, Save, RefreshCw, Square, Maximize2 } from "lucide-react";
import { toast } from "sonner";
import { Project } from "../models/Project";
import { Customer } from "@/features/customers/models/Customer";

function ProjectEstimate() {
  const { customerId, projectId } = useParams<{ customerId: string; projectId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [estimate, setEstimate] = useState<EstimateResult | null>(null);
  const [project, setProject] = useState<Project | null>(null);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    if (projectId && customerId && user?.id) {
      loadData();
    }
  }, [projectId, customerId, user?.id]);

  const loadData = async () => {
    if (!projectId || !customerId || !user?.id) return;
    setIsLoading(true);
    try {
      // Загружаем проект и клиента параллельно
      const [proj, customers] = await Promise.all([
        projectsService.getById(projectId),
        customersService.getAll(user.id),
      ]);

      if (!proj) {
        toast.error("Объект не найден");
        navigate(`/customers/${customerId}/projects`);
        return;
      }

      const cust = customers.find((c) => String(c.id) === customerId);
      setProject(proj);
      setCustomer(cust || null);

      // Проверяем, есть ли сохранённая смета
      if (proj.estimateData) {
        setEstimate(proj.estimateData as EstimateResult);
      } else {
        const result = await estimateService.calculate(proj);
        setEstimate(result);
      }
    } catch (error: any) {
      toast.error("Ошибка: " + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleEstimateChange = (newEstimate: EstimateResult) => {
    setEstimate(newEstimate);
    setHasChanges(true);
  };

  const handleSaveEstimate = async () => {
    if (!projectId || !estimate || !project) return;

    setIsSaving(true);
    try {
      await projectsService.update(projectId, {
        ...project,
        estimateData: estimate,
      });
      setHasChanges(false);
      toast.success("Сохранено");
    } catch (error: any) {
      toast.error("Ошибка: " + error.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleRecalculate = async () => {
    if (!project) return;

    setIsLoading(true);
    try {
      const result = await estimateService.calculate(project);
      setEstimate(result);
      setHasChanges(true);
      toast.success("Пересчитано");
    } catch (error: any) {
      toast.error("Ошибка: " + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGeneratePDF = async () => {
    if (!project || !customer || !estimate) {
      toast.error("Недостаточно данных")
      return
    }

    setIsGenerating(true)
    try {
      await pdfService.downloadPDF(customer, project, estimate)
      toast.success("PDF сгенерирован")
    } catch (error: any) {
      // Проверяем офлайн ошибку
      if (!navigator.onLine) {
        toast.error("Для генерации PDF требуется загрузить шрифты. Подключитесь к интернету.")
      } else {
        toast.error("Ошибка: " + error.message)
      }
    } finally {
      setIsGenerating(false)
    }
  }

  if (isLoading) {
    return (
      <div className="w-full space-y-4 animate-fade-in">
        <LoadingBar isLoading={true} />
        <div className="flex items-center gap-3">
          <Skeleton className="h-8 w-8" />
          <Skeleton className="h-6 w-48" />
        </div>
        <Card>
          <CardContent className="p-4">
            <Skeleton className="h-8 w-full mb-2" />
            <Skeleton className="h-6 w-full mb-1" />
            <Skeleton className="h-6 w-full mb-1" />
            <Skeleton className="h-6 w-3/4" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!estimate) {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground mb-4 text-sm">Не удалось рассчитать смету</p>
        <Button size="sm" onClick={() => navigate(`/customers/${customerId}/projects`)}>
          <ArrowLeft className="mr-1.5 h-4 w-4" />
          Назад
        </Button>
      </div>
    );
  }

  return (
    <div className="w-full space-y-4 animate-fade-in">
      <LoadingBar isLoading={isLoading || isSaving || isGenerating} />

      {/* Компактный заголовок */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate(`/customers/${customerId}/projects`)}
            className="h-8 w-8 p-0 flex-shrink-0"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="min-w-0">
            <h1 className="text-lg sm:text-xl font-bold truncate">
              Смета
              {hasChanges && <span className="text-warning text-sm ml-2">•</span>}
            </h1>
            {customer && <p className="text-xs sm:text-sm text-muted-foreground truncate">{customer.fullName}</p>}
          </div>
        </div>

        <div className="flex gap-1.5 sm:gap-2 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRecalculate}
            disabled={isLoading}
            className="h-8 text-xs sm:text-sm"
          >
            <RefreshCw className="h-3.5 w-3.5 sm:mr-1" />
            <span className="hidden sm:inline">Сбросить</span>
          </Button>

          {hasChanges && (
            <Button size="sm" onClick={handleSaveEstimate} disabled={isSaving} className="h-8 text-xs sm:text-sm">
              {isSaving ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <>
                  <Save className="h-3.5 w-3.5 sm:mr-1" />
                  <span className="hidden sm:inline">Сохранить</span>
                </>
              )}
            </Button>
          )}

          <Button size="sm" onClick={handleGeneratePDF} disabled={isGenerating} className="h-8 text-xs sm:text-sm">
            {isGenerating ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <>
                <Download className="h-3.5 w-3.5 sm:mr-1" />
                <span className="hidden sm:inline">PDF</span>
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Параметры объекта - компактно с подсказками */}
      {project && (
        <div className="flex flex-wrap gap-2 sm:gap-3">
          <div
            className="flex items-center gap-1.5 px-2.5 py-1.5 bg-muted/50 rounded-md cursor-help"
            title="Площадь используется для расчёта материалов типа 'по площади'"
          >
            <Square className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-xs sm:text-sm font-mono">{project.area.toFixed(2)} м²</span>
          </div>
          <div
            className="flex items-center gap-1.5 px-2.5 py-1.5 bg-muted/50 rounded-md cursor-help"
            title="Периметр используется для расчёта материалов типа 'по периметру'"
          >
            <Maximize2 className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-xs sm:text-sm font-mono">{project.perimeter.toFixed(2)} м</span>
          </div>
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-muted/50 rounded-md">
            <span className="text-xs text-muted-foreground">Углов:</span>
            <span className="text-xs sm:text-sm font-semibold">{project.points.length}</span>
          </div>
        </div>
      )}

      {/* Таблица сметы */}
      <Card>
        <CardContent className="p-2 sm:p-4">
          <EditableEstimateTable estimate={estimate} onEstimateChange={handleEstimateChange} />
        </CardContent>
      </Card>
    </div>
  );
}

export default ProjectEstimate;

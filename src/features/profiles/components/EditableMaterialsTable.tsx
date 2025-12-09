import { useState, useEffect, useCallback } from 'react'
import { Material, Work, WorkMaterial } from '@/services/storage/indexedDB'
import { db } from '@/services/storage/indexedDB'
import { profileService } from '@/features/projects/estimate/profile/services/profileService'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Trash2, Edit, Plus } from 'lucide-react'
import { useConfirmDelete } from '@/shared/hooks/useConfirmDelete'
import { syncService } from '@/services/sync/syncService'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface EditableMaterialsTableProps {
  materials: Material[]
  works: Work[]
  onUpdate: () => void
  onEditMaterial?: (material: Material) => void
  profileId?: string
  userId?: string
}

interface MaterialRow {
  type: 'work' | 'material'
  work?: Work
  material?: Material
  workMaterial?: WorkMaterial
}

export function EditableMaterialsTable({ materials, works, onUpdate, onEditMaterial, profileId, userId }: EditableMaterialsTableProps) {
  const [rows, setRows] = useState<MaterialRow[]>([])
  const [localMaterials, setLocalMaterials] = useState<Material[]>(materials)
  const [localWorks, setLocalWorks] = useState<Work[]>(works)
  const [showMaterialDialog, setShowMaterialDialog] = useState(false)
  const [editingMaterial, setEditingMaterial] = useState<Material | null>(null)
  const [showWorkDialog, setShowWorkDialog] = useState(false)
  const [editingWork, setEditingWork] = useState<Work | null>(null)
  const [showNewWorkDialog, setShowNewWorkDialog] = useState(false)
  const [showNewMaterialDialog, setShowNewMaterialDialog] = useState(false)
  const [selectedWorkId, setSelectedWorkId] = useState<string | number | null>(null)

  // Функция для обновления данных без сброса состояния таблицы
  const updateDataSilently = useCallback(async () => {
    try {
      // Обновляем только локальные данные из БД, не вызывая полную перезагрузку
      // Используем текущий выбранный профиль из props
      if (materials.length > 0 || works.length > 0) {
        const profileId = materials[0]?.profileId || works[0]?.profileId
        if (profileId) {
          const [mats, wrks] = await Promise.all([
            profileService.getMaterials(String(profileId)),
            profileService.getWorks(String(profileId))
          ])
          // Обновляем состояние напрямую - оптимистичное обновление уже сделано в useAutoSave
          setLocalMaterials(mats)
          setLocalWorks(wrks)
        }
      }
    } catch (error) {
      console.error('Ошибка обновления данных:', error)
      // В случае ошибки не вызываем onUpdate, чтобы не сбросить таблицу
    }
  }, [materials, works])

  // Функция для запуска синхронизации
  const triggerSync = useCallback(async () => {
    try {
      await syncService.processSyncQueue()
    } catch (error) {
      console.error('Ошибка синхронизации:', error)
    }
  }, [])

  // Обработчик редактирования материала
  const handleEditMaterial = useCallback((material: Material) => {
    if (onEditMaterial) {
      onEditMaterial(material)
    } else {
      setEditingMaterial(material)
      setShowMaterialDialog(true)
    }
  }, [onEditMaterial])

  // Обработчик редактирования работы
  const handleEditWork = useCallback((work: Work) => {
    setEditingWork(work)
    setShowWorkDialog(true)
  }, [])

  // Сохранение работы из диалога
  const handleSaveWork = async (e: any) => {
    e.preventDefault()
    if (!editingWork) return

    const formData = new FormData(e.currentTarget)
    const data = {
      name: formData.get('name') as string,
    }

    try {
      await profileService.updateWork(String(editingWork.id), data)
      await triggerSync()
      setShowWorkDialog(false)
      setEditingWork(null)
      await updateDataSilently()
      onUpdate()
    } catch (error: any) {
      console.error('Ошибка сохранения спецификации:', error)
    }
  }

  // Создание новой работы
  const handleCreateWork = async (e: any) => {
    e.preventDefault()
    if (!profileId || !userId) return

    const formData = new FormData(e.currentTarget)
    const data = {
      name: formData.get('name') as string,
      unit: formData.get('unit') as string || 'шт',
      workPrice: parseFloat(formData.get('workPrice') as string) || 0,
      calculationType: (formData.get('calculationType') as 'byArea' | 'byPerimeter' | 'byCount') || 'byArea',
    }

    try {
      await profileService.createWork(profileId, userId, data, [])
      await triggerSync()
      setShowNewWorkDialog(false)
      await updateDataSilently()
      onUpdate()
    } catch (error: any) {
      console.error('Ошибка создания спецификации:', error)
    }
  }

  // Создание нового материала для работы
  const handleCreateMaterialForWork = async (e: any) => {
    e.preventDefault()
    if (!profileId || !userId || !selectedWorkId) return

    const formData = new FormData(e.currentTarget)
    const materialData = {
      name: formData.get('name') as string,
      unit: formData.get('unit') as string,
      price: parseFloat(formData.get('price') as string),
      purchasePrice: formData.get('purchasePrice') ? parseFloat(formData.get('purchasePrice') as string) : undefined,
      totalCost: formData.get('totalCost') ? parseFloat(formData.get('totalCost') as string) : undefined,
      calculationType: formData.get('calculationType') as 'byArea' | 'byPerimeter' | 'byCount' | 'fixed',
      coefficient: parseFloat(formData.get('coefficient') as string) || 1,
      initialQuantity: formData.get('initialQuantity') ? parseFloat(formData.get('initialQuantity') as string) : undefined,
    }

    try {
      const newMaterial = await profileService.createMaterial(profileId, userId, materialData)
      // Создаем связь между работой и материалом через сервис (который синхронизирует с сервером)
      await profileService.addMaterialToWork(String(selectedWorkId), String(newMaterial.id))
      await triggerSync()
      setShowNewMaterialDialog(false)
      setSelectedWorkId(null)
      await updateDataSilently()
      onUpdate()
    } catch (error: any) {
      console.error('Ошибка создания комплектующего:', error)
    }
  }

  // Обработчик добавления комплектующего к работе
  const handleAddMaterialToWork = useCallback((workId: string | number) => {
    setSelectedWorkId(workId)
    setShowNewMaterialDialog(true)
  }, [])

  // Сохранение материала из диалога
  const handleSaveMaterial = async (e: any) => {
    e.preventDefault()
    if (!editingMaterial) return

    const formData = new FormData(e.currentTarget)
    const data = {
      name: formData.get('name') as string,
      unit: formData.get('unit') as string,
      price: parseFloat(formData.get('price') as string),
      purchasePrice: formData.get('purchasePrice') ? parseFloat(formData.get('purchasePrice') as string) : undefined,
      totalCost: formData.get('totalCost') ? parseFloat(formData.get('totalCost') as string) : undefined,
      calculationType: formData.get('calculationType') as 'byArea' | 'byPerimeter' | 'byCount',
      coefficient: parseFloat(formData.get('coefficient') as string) || 1,
      initialQuantity: formData.get('initialQuantity') ? parseFloat(formData.get('initialQuantity') as string) : undefined,
    }

    try {
      await profileService.updateMaterial(String(editingMaterial.id), data)
      await triggerSync()
      setShowMaterialDialog(false)
      setEditingMaterial(null)
      await updateDataSilently()
      onUpdate()
    } catch (error: any) {
      console.error('Ошибка сохранения комплектующего:', error)
    }
  }

  // Используем универсальный хук для удаления материалов
  const { handleDelete: handleDeleteMaterial } = useConfirmDelete({
    onDelete: async (id: string | number) => {
      await profileService.deleteMaterial(id)
      await triggerSync()
    },
    onUpdate: updateDataSilently,
    successMessage: 'Комплектующее удалено',
    confirmMessage: 'Вы уверены, что хотите удалить это комплектующее?',
    optimisticUpdate: (_id: string | number, updateFn: (prev: Material[]) => Material[]) => {
      setLocalMaterials(updateFn)
    }
  })

  // Используем универсальный хук для удаления работ
  const { handleDelete: handleDeleteWork } = useConfirmDelete({
    onDelete: async (id: string | number) => {
      // Находим все материалы, связанные с этой работой
      const workMaterials = await db.workMaterials.where('workId').equals(String(id)).toArray()
      const materialIds = workMaterials.map(wm => wm.materialId)
      
      // Удаляем все связанные материалы
      for (const materialId of materialIds) {
        try {
          await profileService.deleteMaterial(materialId)
        } catch (error) {
          console.error(`Ошибка удаления материала ${materialId}:`, error)
        }
      }
      
      // Удаляем саму работу (это также удалит связи workMaterials)
      await profileService.deleteWork(id)
      await triggerSync()
    },
    onUpdate: updateDataSilently,
    successMessage: 'Спецификация и связанные комплектующие удалены',
    confirmMessage: 'Вы уверены, что хотите удалить эту спецификацию? Все связанные комплектующие также будут удалены.',
    optimisticUpdate: (_id: string | number, updateFn: (prev: Work[]) => Work[]) => {
      setLocalWorks(updateFn)
    }
  })

  // Синхронизируем локальное состояние с props
  useEffect(() => {
    setLocalMaterials(materials)
  }, [materials])

  useEffect(() => {
    setLocalWorks(works)
  }, [works])

  useEffect(() => {
    // Группируем материалы по работам: сначала работа, потом её комплектующие
    const loadRows = async () => {
      if (!profileId) {
        setRows([])
        return
      }

      // Получаем все связи workMaterials
      const allWorkMaterials = await db.workMaterials.toArray()
      
      // Фильтруем только те связи, которые относятся к работам текущего профиля
      const profileWorkIds = new Set(localWorks.map(w => String(w.id)))
      const workMaterials = allWorkMaterials.filter(wm => profileWorkIds.has(String(wm.workId)))
      
      // Также фильтруем материалы по profileId для надежности
      const profileMaterials = localMaterials.filter(m => String(m.profileId) === String(profileId))
      
      const newRows: MaterialRow[] = []
      
      if (localWorks.length === 0 && profileMaterials.length === 0) {
        setRows([])
        return
      }

      // Если есть работы, группируем по ним
      if (localWorks.length > 0) {
        // Фильтруем дубликаты работ только по ID (не по имени, чтобы не потерять привязки материалов)
        const uniqueWorks = Array.from(
          new Map(localWorks.map(w => [String(w.id), w])).values()
        )
        
        // Группируем материалы по работам для быстрого поиска
        const materialsByWorkId = new Map<string, Array<{ material: Material; workMaterial: WorkMaterial }>>()
        
        // Сначала собираем все материалы по работам
        for (const wm of workMaterials) {
          const workId = String(wm.workId)
          // Ищем материал среди профильных материалов
          const material = profileMaterials.find((m: Material) => String(m.id) === String(wm.materialId))
          
          if (material) {
            if (!materialsByWorkId.has(workId)) {
              materialsByWorkId.set(workId, [])
            }
            materialsByWorkId.get(workId)!.push({ material, workMaterial: wm })
          } else {
            // Если материал не найден в профильных, пробуем найти в общих localMaterials
            const materialFromAll = localMaterials.find((m: Material) => String(m.id) === String(wm.materialId))
            if (materialFromAll && String(materialFromAll.profileId) === String(profileId)) {
              if (!materialsByWorkId.has(workId)) {
                materialsByWorkId.set(workId, [])
              }
              materialsByWorkId.get(workId)!.push({ material: materialFromAll, workMaterial: wm })
            } else {
              console.warn(`Материал с ID ${wm.materialId} не найден для работы ${workId} (profileId: ${profileId})`)
            }
          }
        }
        
        // Логируем для отладки
        console.log('Отладка отображения:', {
          profileId,
          worksCount: uniqueWorks.length,
          localMaterialsCount: localMaterials.length,
          profileMaterialsCount: profileMaterials.length,
          workMaterialsCount: workMaterials.length,
          materialsByWorkId: Array.from(materialsByWorkId.entries()).map(([workId, mats]) => ({
            workId,
            workName: uniqueWorks.find(w => String(w.id) === workId)?.name,
            materialsCount: mats.length,
            materialIds: mats.map(m => m.material.id)
          }))
        })
        
        // Теперь отображаем работы и их материалы
        for (const work of uniqueWorks) {
          const workId = String(work.id)
          
          // Сначала добавляем работу
          newRows.push({ type: 'work', work })

          // Находим материалы для этой работы
          const workMaterialsList = materialsByWorkId.get(workId) || []

          // Затем добавляем все комплектующие этой работы
          for (const item of workMaterialsList) {
            newRows.push({
              type: 'material',
              material: item.material,
              workMaterial: item.workMaterial
            })
          }
        }
      }

      // НЕ добавляем материалы без привязки к работе - все материалы должны быть привязаны к работам
      // Если материал не привязан к работе, это ошибка данных, и его не нужно показывать

      setRows(newRows)
    }

    loadRows()
  }, [localMaterials, localWorks, profileId])


  // Если данные еще загружаются, показываем таблицу с текущими данными
  if (rows.length === 0 && (localMaterials.length > 0 || localWorks.length > 0)) {
    // Данные есть, но rows еще не сформированы - это нормально, useEffect обработает
    return (
      <div className="w-full h-full border rounded-lg overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-2 border-b">
          <span className="text-sm font-medium">Спецификации и комплектующие</span>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setShowNewWorkDialog(true)}
            title="Добавить спецификацию"
          >
            <Plus className="w-4 h-4 mr-1" />
            Добавить спецификацию
          </Button>
        </div>
        <div className="text-center py-4 text-muted-foreground">Загрузка...</div>
      </div>
    )
  }

  const isEmpty = rows.length === 0 && localMaterials.length === 0 && localWorks.length === 0

  return (
    <div className="w-full h-full border rounded-lg overflow-hidden flex flex-col">
      <div className="flex items-center justify-between p-2 border-b">
        <span className="text-sm font-medium">Спецификации и комплектующие</span>
        <Button
          size="sm"
          variant="outline"
          onClick={() => setShowNewWorkDialog(true)}
          title="Добавить спецификацию"
        >
          <Plus className="w-4 h-4 mr-1" />
          Добавить спецификацию
        </Button>
      </div>
      {isEmpty ? (
        <div className="flex-1 flex items-center justify-center py-8">
          <p className="text-muted-foreground text-center">Нет спецификаций и комплектующих</p>
        </div>
      ) : (
        <div className="flex-1 overflow-auto w-full">
          <Table className="w-full">
        <TableHeader>
          <TableRow>
            <TableHead className="min-w-[200px]">Спецификация</TableHead>
            <TableHead className="min-w-[200px]">Комплектующие</TableHead>
            <TableHead>Количество</TableHead>
            <TableHead>Ед.изм</TableHead>
            <TableHead>Цена продажи</TableHead>
            <TableHead>Стоимость закупа</TableHead>
            <TableHead>Общая себестоимость</TableHead>
            <TableHead>Тип расчета</TableHead>
            <TableHead>Коэффициент</TableHead>
            <TableHead className="w-[120px]">Действия</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row: MaterialRow, index: number) => {
            // Определяем, является ли это первым материалом после работы
            const prevRow = index > 0 ? rows[index - 1] : null
            const isFirstMaterialAfterWork = row.type === 'material' && prevRow?.type === 'work'

            if (row.type === 'work') {
              // Строка с работой (спецификацией)
              const work = row.work!

              return (
                <TableRow key={`work-${work.id}`} className="bg-primary/5 font-semibold border-y-2 border-primary/20">
                  <TableCell className="p-1">
                    <span className="font-semibold block w-full">{work.name || 'Без названия'}</span>
                  </TableCell>
                  <TableCell className="p-1" colSpan={8}>
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleAddMaterialToWork(work.id!)}
                        title="Добавить комплектующее"
                        className="text-xs"
                      >
                        <Plus className="w-3 h-3 mr-1" />
                        Добавить комплектующее
                      </Button>
                    </div>
                  </TableCell>
                  <TableCell className="p-1">
                    <div className="flex gap-1 justify-center w-full">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleEditWork(work)}
                        title="Редактировать спецификацию"
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDeleteWork(work.id!)}
                        title="Удалить спецификацию"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              )
            }

            // Строка с материалом (комплектующим)
            const material = row.material!

            const getCalculationTypeLabel = (type: string) => {
              switch (type) {
                case 'byArea': return 'По площади'
                case 'byPerimeter': return 'По периметру'
                case 'byCount': return 'По количеству'
                case 'fixed': return 'Фиксированное'
                default: return type
              }
            }

            return (
              <TableRow 
                key={`material-${material.id}`}
                className={`hover:bg-muted/30 ${isFirstMaterialAfterWork ? 'border-t border-border/30' : ''}`}
              >
                <TableCell className="p-1">
                  <div className="flex items-center h-full">
                    <div className="w-1 h-full bg-primary/20 rounded"></div>
                  </div>
                </TableCell>
                <TableCell className="p-1">
                  <span className="break-words block w-full">{material.name || 'Без названия'}</span>
                </TableCell>
                <TableCell className="p-1">
                  <span className="block w-full text-center">{material.initialQuantity ?? 0}</span>
                </TableCell>
                <TableCell className="p-1">
                  <span className="block w-full text-center">{material.unit || '-'}</span>
                </TableCell>
                <TableCell className="p-1">
                  <span className="block w-full text-center">{material.price ?? 0}</span>
                </TableCell>
                <TableCell className="p-1">
                  <span className="block w-full text-center">{material.purchasePrice ?? 0}</span>
                </TableCell>
                <TableCell className="p-1">
                  <span className="block w-full text-center">{material.totalCost ?? 0}</span>
                </TableCell>
                <TableCell className="p-1">
                  <span className="block w-full text-center">{getCalculationTypeLabel(material.calculationType || 'byArea')}</span>
                </TableCell>
                <TableCell className="p-1">
                  <span className="block w-full text-center">{material.coefficient ?? 1}</span>
                </TableCell>
                <TableCell className="p-1">
                  <div className="flex gap-1 justify-center w-full">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleEditMaterial(material)}
                      title="Редактировать комплектующее"
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleDeleteMaterial(material.id!, 'Вы уверены, что хотите удалить это комплектующее?')}
                      title="Удалить комплектующее"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
        </div>
      )}

      {/* Диалог создания новой работы */}
      <Dialog open={showNewWorkDialog} onOpenChange={setShowNewWorkDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Новая спецификация</DialogTitle>
            <DialogDescription>
              Заполните данные для новой спецификации
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateWork}>
            <div className="space-y-4 py-4">
              <div>
                <Label htmlFor="newWorkName">Наименование</Label>
                <Input id="newWorkName" name="name" required />
              </div>
              <div>
                <Label htmlFor="newWorkUnit">Единица измерения</Label>
                <Input id="newWorkUnit" name="unit" defaultValue="шт" required />
              </div>
              <div>
                <Label htmlFor="newWorkPrice">Стоимость работы</Label>
                <Input id="newWorkPrice" name="workPrice" type="number" step="any" defaultValue="0" required />
              </div>
              <div>
                <Label htmlFor="newWorkCalculationType">Тип расчета</Label>
                <select
                  id="newWorkCalculationType"
                  name="calculationType"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  defaultValue="byArea"
                  required
                >
                  <option value="byArea">По площади</option>
                  <option value="byPerimeter">По периметру</option>
                  <option value="byCount">По количеству</option>
                  <option value="fixed">Фиксированное</option>
                </select>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowNewWorkDialog(false)}>
                Отмена
              </Button>
              <Button type="submit">Создать</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Диалог редактирования работы */}
      <Dialog open={showWorkDialog} onOpenChange={setShowWorkDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Редактировать спецификацию</DialogTitle>
            <DialogDescription>
              Измените наименование спецификации и нажмите "Сохранить"
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSaveWork}>
            <div className="space-y-4 py-4">
              <div>
                <Label htmlFor="workName">Наименование</Label>
                <Input id="workName" name="name" defaultValue={editingWork?.name} required />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => {
                setShowWorkDialog(false)
                setEditingWork(null)
              }}>
                Отмена
              </Button>
              <Button type="submit">Сохранить</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Диалог создания нового комплектующего для работы */}
      <Dialog open={showNewMaterialDialog} onOpenChange={setShowNewMaterialDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Новое комплектующее</DialogTitle>
            <DialogDescription>
              Заполните данные для нового комплектующего
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateMaterialForWork}>
            <div className="space-y-4 py-4">
              <div>
                <Label htmlFor="newMaterialName">Наименование</Label>
                <Input id="newMaterialName" name="name" required />
              </div>
              <div>
                <Label htmlFor="newMaterialUnit">Единица измерения</Label>
                <Input id="newMaterialUnit" name="unit" required />
              </div>
              <div>
                <Label htmlFor="newMaterialPrice">Цена продажи</Label>
                <Input id="newMaterialPrice" name="price" type="number" step="any" defaultValue="0" required />
              </div>
              <div>
                <Label htmlFor="newMaterialPurchasePrice">Стоимость закупа</Label>
                <Input id="newMaterialPurchasePrice" name="purchasePrice" type="number" step="any" />
              </div>
              <div>
                <Label htmlFor="newMaterialTotalCost">Общая себестоимость</Label>
                <Input id="newMaterialTotalCost" name="totalCost" type="number" step="any" />
              </div>
              <div>
                <Label htmlFor="newMaterialCalculationType">Тип расчета</Label>
                <select
                  id="newMaterialCalculationType"
                  name="calculationType"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  defaultValue="byArea"
                  required
                >
                  <option value="byArea">По площади</option>
                  <option value="byPerimeter">По периметру</option>
                  <option value="byCount">По количеству</option>
                  <option value="fixed">Фиксированное</option>
                </select>
              </div>
              <div>
                <Label htmlFor="newMaterialCoefficient">Коэффициент</Label>
                <Input id="newMaterialCoefficient" name="coefficient" type="number" step="any" defaultValue="1" />
              </div>
              <div>
                <Label htmlFor="newMaterialInitialQuantity">Изначальное количество</Label>
                <Input id="newMaterialInitialQuantity" name="initialQuantity" type="number" step="any" />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => {
                setShowNewMaterialDialog(false)
                setSelectedWorkId(null)
              }}>
                Отмена
              </Button>
              <Button type="submit">Создать</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Диалог редактирования материала */}
      <Dialog open={showMaterialDialog} onOpenChange={setShowMaterialDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Редактировать комплектующее</DialogTitle>
            <DialogDescription>
              Измените данные комплектующего и нажмите "Сохранить"
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSaveMaterial}>
            <div className="space-y-4 py-4">
              <div>
                <Label htmlFor="name">Наименование</Label>
                <Input id="name" name="name" defaultValue={editingMaterial?.name} required />
              </div>
              <div>
                <Label htmlFor="unit">Единица измерения</Label>
                <Input id="unit" name="unit" defaultValue={editingMaterial?.unit} required />
              </div>
              <div>
                <Label htmlFor="price">Цена продажи</Label>
                <Input id="price" name="price" type="number" step="any" defaultValue={editingMaterial?.price} required />
              </div>
              <div>
                <Label htmlFor="purchasePrice">Стоимость закупа</Label>
                <Input id="purchasePrice" name="purchasePrice" type="number" step="any" defaultValue={editingMaterial?.purchasePrice} />
              </div>
              <div>
                <Label htmlFor="totalCost">Общая себестоимость</Label>
                <Input id="totalCost" name="totalCost" type="number" step="any" defaultValue={editingMaterial?.totalCost} />
              </div>
              <div>
                <Label htmlFor="calculationType">Тип расчета</Label>
                <select
                  id="calculationType"
                  name="calculationType"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  defaultValue={editingMaterial?.calculationType}
                  required
                >
                  <option value="byArea">По площади</option>
                  <option value="byPerimeter">По периметру</option>
                  <option value="byCount">По количеству</option>
                  <option value="fixed">Фиксированное</option>
                </select>
              </div>
              <div>
                <Label htmlFor="coefficient">Коэффициент</Label>
                <Input id="coefficient" name="coefficient" type="number" step="any" defaultValue={editingMaterial?.coefficient || 1} />
              </div>
              <div>
                <Label htmlFor="initialQuantity">Изначальное количество</Label>
                <Input id="initialQuantity" name="initialQuantity" type="number" step="any" defaultValue={editingMaterial?.initialQuantity} />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => {
                setShowMaterialDialog(false)
                setEditingMaterial(null)
              }}>
                Отмена
              </Button>
              <Button type="submit">Сохранить</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}


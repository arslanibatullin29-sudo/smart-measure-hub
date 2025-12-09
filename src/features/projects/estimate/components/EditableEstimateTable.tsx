import { useState, useEffect } from 'react'
import { EstimateResult, EstimateItem, MaterialEstimateItem } from '../calculators/estimateCalculator'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

interface EditableEstimateTableProps {
  estimate: EstimateResult
  onEstimateChange: (estimate: EstimateResult) => void
  readOnly?: boolean
}

export function EditableEstimateTable({ estimate, onEstimateChange, readOnly = false }: EditableEstimateTableProps) {
  const [localEstimate, setLocalEstimate] = useState<EstimateResult>(estimate)
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [selectedWorkId, setSelectedWorkId] = useState<string | null>(null)
  const [editingCell, setEditingCell] = useState<{ workId: string; materialId: string; field: string } | null>(null)
  const [editValue, setEditValue] = useState('')

  useEffect(() => {
    setLocalEstimate(estimate)
  }, [estimate])

  const recalculateTotal = (items: EstimateItem[]): EstimateResult => {
    const total = items.reduce((sum, item) => sum + item.workTotalWithMaterials, 0)
    return { items, total }
  }

  const handleAddMaterial = (workId: string, formData: { 
    name: string
    unit: string
    quantity: number
    price: number
    calculationType: 'byArea' | 'byPerimeter' | 'byCount' | 'fixed'
  }) => {
    const materialTotal = formData.quantity * formData.price
    const newMaterial: MaterialEstimateItem = {
      materialId: `custom_mat_${Date.now()}`,
      materialName: formData.name,
      materialUnit: formData.unit,
      materialQuantity: formData.quantity,
      materialPrice: formData.price,
      materialTotal,
      calculationType: formData.calculationType,
    }

    const updatedItems = localEstimate.items.map(item => {
      if (item.workId === workId) {
        const newMaterials = [...item.materials, newMaterial]
        const materialsTotal = newMaterials.reduce((sum, m) => sum + m.materialTotal, 0)
        return {
          ...item,
          materials: newMaterials,
          workTotalWithMaterials: materialsTotal,
        }
      }
      return item
    })

    const newEstimate = recalculateTotal(updatedItems)
    setLocalEstimate(newEstimate)
    onEstimateChange(newEstimate)
    setShowAddDialog(false)
    setSelectedWorkId(null)
    toast.success('Материал добавлен')
  }

  const handleAddNewGroup = (formData: { 
    groupName: string
    materialName: string
    unit: string
    quantity: number
    price: number
    calculationType: 'byArea' | 'byPerimeter' | 'byCount' | 'fixed'
  }) => {
    const materialTotal = formData.quantity * formData.price
    const newMaterial: MaterialEstimateItem = {
      materialId: `custom_mat_${Date.now()}`,
      materialName: formData.materialName,
      materialUnit: formData.unit,
      materialQuantity: formData.quantity,
      materialPrice: formData.price,
      materialTotal,
      calculationType: formData.calculationType,
    }

    const newItem: EstimateItem = {
      workId: `custom_group_${Date.now()}`,
      workName: formData.groupName,
      workUnit: '',
      workQuantity: 0,
      workPrice: 0,
      workTotal: 0,
      materials: [newMaterial],
      workTotalWithMaterials: materialTotal,
    }

    const newEstimate = recalculateTotal([...localEstimate.items, newItem])
    setLocalEstimate(newEstimate)
    onEstimateChange(newEstimate)
    setShowAddDialog(false)
    toast.success('Группа материалов добавлена')
  }

  const handleDeleteMaterial = (workId: string, materialId: string) => {
    const updatedItems = localEstimate.items.map(item => {
      if (item.workId === workId) {
        const newMaterials = item.materials.filter(m => m.materialId !== materialId)
        const materialsTotal = newMaterials.reduce((sum, m) => sum + m.materialTotal, 0)
        return {
          ...item,
          materials: newMaterials,
          workTotalWithMaterials: materialsTotal,
        }
      }
      return item
    }).filter(item => item.materials.length > 0) // Удаляем пустые группы

    const newEstimate = recalculateTotal(updatedItems)
    setLocalEstimate(newEstimate)
    onEstimateChange(newEstimate)
    toast.success('Материал удалён')
  }

  const handleDeleteGroup = (workId: string) => {
    const updatedItems = localEstimate.items.filter(item => item.workId !== workId)
    const newEstimate = recalculateTotal(updatedItems)
    setLocalEstimate(newEstimate)
    onEstimateChange(newEstimate)
    toast.success('Группа удалена')
  }

  const handleStartEdit = (workId: string, materialId: string, field: string, value: number) => {
    setEditingCell({ workId, materialId, field })
    setEditValue(String(value))
  }

  const handleSaveEdit = () => {
    if (!editingCell) return

    const newValue = parseFloat(editValue)
    if (isNaN(newValue) || newValue < 0) {
      setEditingCell(null)
      return
    }

    const updatedItems = localEstimate.items.map(item => {
      if (item.workId !== editingCell.workId) return item

      const newMaterials = item.materials.map(m => {
        if (m.materialId !== editingCell.materialId) return m

        let updated = { ...m }
        if (editingCell.field === 'quantity') {
          updated.materialQuantity = newValue
          updated.materialTotal = newValue * m.materialPrice
        } else if (editingCell.field === 'price') {
          updated.materialPrice = newValue
          updated.materialTotal = m.materialQuantity * newValue
        }
        return updated
      })

      const materialsTotal = newMaterials.reduce((sum, m) => sum + m.materialTotal, 0)
      return {
        ...item,
        materials: newMaterials,
        workTotalWithMaterials: materialsTotal,
      }
    })

    const newEstimate = recalculateTotal(updatedItems)
    setLocalEstimate(newEstimate)
    onEstimateChange(newEstimate)
    setEditingCell(null)
  }

  const openAddMaterialDialog = (workId: string | null) => {
    setSelectedWorkId(workId)
    setShowAddDialog(true)
  }

  const getCalculationTypeLabel = (type: string) => {
    switch (type) {
      case 'byArea': return 'м²'
      case 'byPerimeter': return 'п.м.'
      case 'byCount': return 'шт'
      case 'fixed': return 'фикс.'
      default: return type
    }
  }

  return (
    <div className="space-y-4">
      {!readOnly && (
        <div className="flex justify-end gap-2">
          <Button onClick={() => openAddMaterialDialog(null)} size="sm" variant="outline">
            <Plus className="w-4 h-4 mr-2" />
            Добавить группу
          </Button>
        </div>
      )}

      <div className="overflow-x-auto border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="w-[35%]">Наименование</TableHead>
              <TableHead className="text-center w-[10%]">Ед.изм</TableHead>
              <TableHead className="text-center w-[10%]">Расчёт</TableHead>
              <TableHead className="text-right w-[12%]">Кол-во</TableHead>
              <TableHead className="text-right w-[13%]">Цена</TableHead>
              <TableHead className="text-right w-[12%]">Сумма</TableHead>
              {!readOnly && <TableHead className="w-[8%]">Действия</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {localEstimate.items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={readOnly ? 6 : 7} className="text-center py-8 text-muted-foreground">
                  Нет материалов в смете. Добавьте группу материалов.
                </TableCell>
              </TableRow>
            ) : (
              localEstimate.items.map((item) => (
                <>
                  {/* Заголовок группы */}
                  <TableRow key={item.workId} className="bg-muted/30">
                    <TableCell colSpan={5} className="font-semibold">{item.workName}</TableCell>
                    <TableCell className="text-right font-bold font-mono">
                      {item.workTotalWithMaterials.toFixed(2)} ₽
                    </TableCell>
                    {!readOnly && (
                      <TableCell>
                        <div className="flex gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7"
                            onClick={() => openAddMaterialDialog(item.workId)}
                            title="Добавить материал"
                          >
                            <Plus className="w-4 h-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 text-destructive"
                            onClick={() => handleDeleteGroup(item.workId)}
                            title="Удалить группу"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    )}
                  </TableRow>

                  {/* Материалы */}
                  {item.materials.map((material) => (
                    <TableRow key={material.materialId} className="text-muted-foreground">
                      <TableCell className="pl-8">— {material.materialName}</TableCell>
                      <TableCell className="text-center">{material.materialUnit}</TableCell>
                      <TableCell className="text-center text-xs">
                        {getCalculationTypeLabel(material.calculationType)}
                      </TableCell>
                      <TableCell 
                        className={`text-right ${!readOnly ? 'cursor-pointer hover:bg-muted' : ''}`}
                        onClick={() => !readOnly && handleStartEdit(item.workId, material.materialId, 'quantity', material.materialQuantity)}
                      >
                        {editingCell?.workId === item.workId && editingCell.materialId === material.materialId && editingCell.field === 'quantity' ? (
                          <Input 
                            type="number"
                            step="0.01"
                            min="0"
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            onBlur={handleSaveEdit}
                            onKeyDown={(e) => e.key === 'Enter' && handleSaveEdit()}
                            className="w-20 h-8 text-right"
                            autoFocus
                          />
                        ) : (
                          material.materialQuantity.toFixed(2)
                        )}
                      </TableCell>
                      <TableCell 
                        className={`text-right ${!readOnly ? 'cursor-pointer hover:bg-muted' : ''}`}
                        onClick={() => !readOnly && handleStartEdit(item.workId, material.materialId, 'price', material.materialPrice)}
                      >
                        {editingCell?.workId === item.workId && editingCell.materialId === material.materialId && editingCell.field === 'price' ? (
                          <Input 
                            type="number"
                            step="0.01"
                            min="0"
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            onBlur={handleSaveEdit}
                            onKeyDown={(e) => e.key === 'Enter' && handleSaveEdit()}
                            className="w-24 h-8 text-right"
                            autoFocus
                          />
                        ) : (
                          material.materialPrice.toFixed(2)
                        )}
                      </TableCell>
                      <TableCell className="text-right font-mono">{material.materialTotal.toFixed(2)}</TableCell>
                      {!readOnly && (
                        <TableCell>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 text-destructive"
                            onClick={() => handleDeleteMaterial(item.workId, material.materialId)}
                            title="Удалить материал"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </>
              ))
            )}

            {/* Общий итог */}
            {localEstimate.items.length > 0 && (
              <TableRow className="bg-primary/10 font-bold text-lg">
                <TableCell colSpan={5} className="text-right">
                  ИТОГО:
                </TableCell>
                <TableCell className="text-right font-mono">
                  {localEstimate.total.toFixed(2)} ₽
                </TableCell>
                {!readOnly && <TableCell />}
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Диалог добавления */}
      <AddMaterialDialog
        open={showAddDialog}
        onClose={() => {
          setShowAddDialog(false)
          setSelectedWorkId(null)
        }}
        isNewGroup={selectedWorkId === null}
        onSubmit={(data) => {
          if (selectedWorkId === null && data.groupName && data.materialName) {
            handleAddNewGroup({
              groupName: data.groupName,
              materialName: data.materialName,
              unit: data.unit,
              quantity: data.quantity,
              price: data.price,
              calculationType: data.calculationType,
            })
          } else if (selectedWorkId && data.name) {
            handleAddMaterial(selectedWorkId, {
              name: data.name,
              unit: data.unit,
              quantity: data.quantity,
              price: data.price,
              calculationType: data.calculationType,
            })
          }
        }}
      />
    </div>
  )
}

interface AddMaterialDialogProps {
  open: boolean
  onClose: () => void
  isNewGroup: boolean
  onSubmit: (data: { 
    groupName?: string
    name?: string
    materialName?: string
    unit: string
    quantity: number
    price: number
    calculationType: 'byArea' | 'byPerimeter' | 'byCount' | 'fixed'
  }) => void
}

function AddMaterialDialog({ open, onClose, isNewGroup, onSubmit }: AddMaterialDialogProps) {
  const [groupName, setGroupName] = useState('')
  const [name, setName] = useState('')
  const [unit, setUnit] = useState('шт')
  const [quantity, setQuantity] = useState('1')
  const [price, setPrice] = useState('0')
  const [calculationType, setCalculationType] = useState<'byArea' | 'byPerimeter' | 'byCount' | 'fixed'>('fixed')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (isNewGroup && !groupName.trim()) {
      toast.error('Введите название группы')
      return
    }
    if (!name.trim()) {
      toast.error('Введите наименование материала')
      return
    }
    
    if (isNewGroup) {
      onSubmit({
        groupName: groupName.trim(),
        materialName: name.trim(),
        unit,
        quantity: parseFloat(quantity) || 0,
        price: parseFloat(price) || 0,
        calculationType,
      })
    } else {
      onSubmit({
        name: name.trim(),
        unit,
        quantity: parseFloat(quantity) || 0,
        price: parseFloat(price) || 0,
        calculationType,
      })
    }
    
    // Reset form
    setGroupName('')
    setName('')
    setUnit('шт')
    setQuantity('1')
    setPrice('0')
    setCalculationType('fixed')
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {isNewGroup ? 'Добавить группу материалов' : 'Добавить материал'}
          </DialogTitle>
          <DialogDescription>
            {isNewGroup 
              ? 'Создайте новую группу и добавьте первый материал' 
              : 'Добавьте материал в выбранную группу'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {isNewGroup && (
            <div className="space-y-2">
              <Label htmlFor="groupName">Название группы</Label>
              <Input
                id="groupName"
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                placeholder="Например: Полотно"
                required
              />
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="name">Наименование материала</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Название материала"
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="unit">Ед.изм</Label>
              <Input
                id="unit"
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="calculationType">Тип расчёта</Label>
              <Select value={calculationType} onValueChange={(v) => setCalculationType(v as any)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="byArea">По площади (м²)</SelectItem>
                  <SelectItem value="byPerimeter">По периметру (п.м.)</SelectItem>
                  <SelectItem value="byCount">По количеству элементов</SelectItem>
                  <SelectItem value="fixed">Фиксированное</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="quantity">Количество</Label>
              <Input
                id="quantity"
                type="number"
                step="0.01"
                min="0"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="price">Цена продажи</Label>
              <Input
                id="price"
                type="number"
                step="0.01"
                min="0"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Отмена
            </Button>
            <Button type="submit">
              Добавить
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

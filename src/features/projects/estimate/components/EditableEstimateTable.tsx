import { useState, useEffect } from 'react'
import { EstimateResult, EstimateItem } from '../calculators/estimateCalculator'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Plus, Trash2, Save } from 'lucide-react'
import { toast } from 'sonner'

interface EditableEstimateTableProps {
  estimate: EstimateResult
  onEstimateChange: (estimate: EstimateResult) => void
  readOnly?: boolean
}


export function EditableEstimateTable({ estimate, onEstimateChange, readOnly = false }: EditableEstimateTableProps) {
  const [localEstimate, setLocalEstimate] = useState<EstimateResult>(estimate)
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [addType, setAddType] = useState<'work' | 'material'>('work')
  const [selectedWorkId, setSelectedWorkId] = useState<string | null>(null)
  const [editingCell, setEditingCell] = useState<{ workId: string; materialId?: string; field: string } | null>(null)
  const [editValue, setEditValue] = useState('')

  useEffect(() => {
    setLocalEstimate(estimate)
  }, [estimate])

  const recalculateTotal = (items: EstimateItem[]): EstimateResult => {
    const total = items.reduce((sum, item) => sum + item.workTotalWithMaterials, 0)
    return { items, total }
  }

  const handleAddWork = (formData: { name: string; unit: string; quantity: number; price: number }) => {
    const workTotal = formData.quantity * formData.price
    const newItem: EstimateItem = {
      workId: `custom_${Date.now()}`,
      workName: formData.name,
      workUnit: formData.unit,
      workQuantity: formData.quantity,
      workPrice: formData.price,
      workTotal,
      materials: [],
      workTotalWithMaterials: workTotal,
    }

    const newEstimate = recalculateTotal([...localEstimate.items, newItem])
    setLocalEstimate(newEstimate)
    onEstimateChange(newEstimate)
    setShowAddDialog(false)
    toast.success('Работа добавлена')
  }

  const handleAddMaterial = (workId: string, formData: { name: string; unit: string; quantity: number; price: number }) => {
    const materialTotal = formData.quantity * formData.price
    const newMaterial = {
      materialId: `custom_mat_${Date.now()}`,
      materialName: formData.name,
      materialUnit: formData.unit,
      materialQuantity: formData.quantity,
      materialPrice: formData.price,
      materialTotal,
    }

    const updatedItems = localEstimate.items.map(item => {
      if (item.workId === workId) {
        const newMaterials = [...item.materials, newMaterial]
        const materialsTotal = newMaterials.reduce((sum, m) => sum + m.materialTotal, 0)
        return {
          ...item,
          materials: newMaterials,
          workTotalWithMaterials: item.workTotal + materialsTotal,
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

  const handleDeleteWork = (workId: string) => {
    const updatedItems = localEstimate.items.filter(item => item.workId !== workId)
    const newEstimate = recalculateTotal(updatedItems)
    setLocalEstimate(newEstimate)
    onEstimateChange(newEstimate)
    toast.success('Работа удалена')
  }

  const handleDeleteMaterial = (workId: string, materialId: string) => {
    const updatedItems = localEstimate.items.map(item => {
      if (item.workId === workId) {
        const newMaterials = item.materials.filter(m => m.materialId !== materialId)
        const materialsTotal = newMaterials.reduce((sum, m) => sum + m.materialTotal, 0)
        return {
          ...item,
          materials: newMaterials,
          workTotalWithMaterials: item.workTotal + materialsTotal,
        }
      }
      return item
    })

    const newEstimate = recalculateTotal(updatedItems)
    setLocalEstimate(newEstimate)
    onEstimateChange(newEstimate)
    toast.success('Материал удалён')
  }

  const handleStartEdit = (workId: string, field: string, value: number, materialId?: string) => {
    setEditingCell({ workId, materialId, field })
    setEditValue(String(value))
  }

  const handleSaveEdit = () => {
    if (!editingCell) return

    const newValue = parseFloat(editValue)
    if (isNaN(newValue)) {
      setEditingCell(null)
      return
    }

    const updatedItems = localEstimate.items.map(item => {
      if (item.workId !== editingCell.workId) return item

      if (editingCell.materialId) {
        // Редактируем материал
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
          workTotalWithMaterials: item.workTotal + materialsTotal,
        }
      } else {
        // Редактируем работу
        let updated = { ...item }
        if (editingCell.field === 'quantity') {
          updated.workQuantity = newValue
          updated.workTotal = newValue * item.workPrice
        } else if (editingCell.field === 'price') {
          updated.workPrice = newValue
          updated.workTotal = item.workQuantity * newValue
        }
        
        const materialsTotal = updated.materials.reduce((sum, m) => sum + m.materialTotal, 0)
        updated.workTotalWithMaterials = updated.workTotal + materialsTotal
        return updated
      }
    })

    const newEstimate = recalculateTotal(updatedItems)
    setLocalEstimate(newEstimate)
    onEstimateChange(newEstimate)
    setEditingCell(null)
  }

  const openAddMaterialDialog = (workId: string) => {
    setAddType('material')
    setSelectedWorkId(workId)
    setShowAddDialog(true)
  }

  const openAddWorkDialog = () => {
    setAddType('work')
    setSelectedWorkId(null)
    setShowAddDialog(true)
  }

  return (
    <div className="space-y-4">
      {!readOnly && (
        <div className="flex justify-end">
          <Button onClick={openAddWorkDialog} size="sm">
            <Plus className="w-4 h-4 mr-2" />
            Добавить работу
          </Button>
        </div>
      )}

      <div className="overflow-x-auto border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="w-[40%]">Наименование</TableHead>
              <TableHead className="text-center">Ед.изм</TableHead>
              <TableHead className="text-right">Кол-во</TableHead>
              <TableHead className="text-right">Цена</TableHead>
              <TableHead className="text-right">Сумма</TableHead>
              {!readOnly && <TableHead className="w-[100px]">Действия</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {localEstimate.items.map((item) => (
              <>
                {/* Строка работы */}
                <TableRow key={item.workId} className="bg-muted/30 font-medium">
                  <TableCell className="font-semibold">{item.workName}</TableCell>
                  <TableCell className="text-center">{item.workUnit}</TableCell>
                  <TableCell 
                    className="text-right cursor-pointer hover:bg-muted"
                    onClick={() => !readOnly && handleStartEdit(item.workId, 'quantity', item.workQuantity)}
                  >
                    {editingCell?.workId === item.workId && !editingCell.materialId && editingCell.field === 'quantity' ? (
                      <Input 
                        type="number"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onBlur={handleSaveEdit}
                        onKeyDown={(e) => e.key === 'Enter' && handleSaveEdit()}
                        className="w-20 h-8 text-right"
                        autoFocus
                      />
                    ) : (
                      item.workQuantity.toFixed(2)
                    )}
                  </TableCell>
                  <TableCell 
                    className="text-right cursor-pointer hover:bg-muted"
                    onClick={() => !readOnly && handleStartEdit(item.workId, 'price', item.workPrice)}
                  >
                    {editingCell?.workId === item.workId && !editingCell.materialId && editingCell.field === 'price' ? (
                      <Input 
                        type="number"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onBlur={handleSaveEdit}
                        onKeyDown={(e) => e.key === 'Enter' && handleSaveEdit()}
                        className="w-20 h-8 text-right"
                        autoFocus
                      />
                    ) : (
                      item.workPrice.toFixed(2)
                    )}
                  </TableCell>
                  <TableCell className="text-right font-mono">{item.workTotal.toFixed(2)}</TableCell>
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
                          onClick={() => handleDeleteWork(item.workId)}
                          title="Удалить работу"
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
                    <TableCell 
                      className="text-right cursor-pointer hover:bg-muted"
                      onClick={() => !readOnly && handleStartEdit(item.workId, 'quantity', material.materialQuantity, material.materialId)}
                    >
                      {editingCell?.workId === item.workId && editingCell.materialId === material.materialId && editingCell.field === 'quantity' ? (
                        <Input 
                          type="number"
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
                      className="text-right cursor-pointer hover:bg-muted"
                      onClick={() => !readOnly && handleStartEdit(item.workId, 'price', material.materialPrice, material.materialId)}
                    >
                      {editingCell?.workId === item.workId && editingCell.materialId === material.materialId && editingCell.field === 'price' ? (
                        <Input 
                          type="number"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onBlur={handleSaveEdit}
                          onKeyDown={(e) => e.key === 'Enter' && handleSaveEdit()}
                          className="w-20 h-8 text-right"
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

                {/* Итого по работе */}
                <TableRow className="border-b-2">
                  <TableCell colSpan={readOnly ? 4 : 5} className="text-right font-medium">
                    Итого по работе:
                  </TableCell>
                  <TableCell className="text-right font-bold font-mono">
                    {item.workTotalWithMaterials.toFixed(2)} ₽
                  </TableCell>
                </TableRow>
              </>
            ))}

            {/* Общий итог */}
            <TableRow className="bg-primary/10 font-bold text-lg">
              <TableCell colSpan={readOnly ? 4 : 5} className="text-right">
                ИТОГО:
              </TableCell>
              <TableCell className="text-right font-mono">
                {localEstimate.total.toFixed(2)} ₽
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>

      {/* Диалог добавления */}
      <AddItemDialog
        open={showAddDialog}
        onClose={() => {
          setShowAddDialog(false)
          setSelectedWorkId(null)
        }}
        type={addType}
        onSubmit={(data) => {
          if (addType === 'work') {
            handleAddWork(data)
          } else if (selectedWorkId) {
            handleAddMaterial(selectedWorkId, data)
          }
        }}
      />
    </div>
  )
}

interface AddItemDialogProps {
  open: boolean
  onClose: () => void
  type: 'work' | 'material'
  onSubmit: (data: { name: string; unit: string; quantity: number; price: number }) => void
}

function AddItemDialog({ open, onClose, type, onSubmit }: AddItemDialogProps) {
  const [name, setName] = useState('')
  const [unit, setUnit] = useState(type === 'work' ? 'м²' : 'шт')
  const [quantity, setQuantity] = useState('1')
  const [price, setPrice] = useState('0')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) {
      toast.error('Введите наименование')
      return
    }
    onSubmit({
      name: name.trim(),
      unit,
      quantity: parseFloat(quantity) || 0,
      price: parseFloat(price) || 0,
    })
    setName('')
    setUnit(type === 'work' ? 'м²' : 'шт')
    setQuantity('1')
    setPrice('0')
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {type === 'work' ? 'Добавить работу' : 'Добавить материал'}
          </DialogTitle>
          <DialogDescription>
            {type === 'work' 
              ? 'Добавьте новую работу в смету проекта' 
              : 'Добавьте материал к выбранной работе'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Наименование</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={type === 'work' ? 'Название работы' : 'Название материала'}
              required
            />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="unit">Ед.изм</Label>
              <Input
                id="unit"
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="quantity">Кол-во</Label>
              <Input
                id="quantity"
                type="number"
                step="0.01"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="price">Цена</Label>
              <Input
                id="price"
                type="number"
                step="0.01"
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
              <Save className="w-4 h-4 mr-2" />
              Добавить
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

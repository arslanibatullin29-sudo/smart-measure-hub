import { useState } from 'react'
import { Work } from '@/services/storage/indexedDB'
import { profileService } from '@/features/projects/estimate/profile/services/profileService'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Trash2, Save, X, Edit } from 'lucide-react'
import { CalculationTypeSelect } from '@/shared/components/CalculationTypeSelect'
import { handleError, handleSuccess } from '@/shared/utils/errorHandler'
import { validators } from '@/shared/utils/validators'

interface EditableWorksTableProps {
  works: Work[]
  onUpdate: () => void
}

export function EditableWorksTable({ works, onUpdate }: EditableWorksTableProps) {
  const [editingId, setEditingId] = useState<string | number | null>(null)
  const [editedWork, setEditedWork] = useState<Partial<Work> | null>(null)

  const handleEdit = (work: Work) => {
    setEditingId(work.id!)
    setEditedWork({ ...work })
  }

  const handleCancel = () => {
    setEditingId(null)
    setEditedWork(null)
  }

  const handleSave = async (id: string | number) => {
    if (!editedWork) return

    // Валидация
    if (!validators.isNotEmpty(editedWork.name || '')) {
      handleError(new Error('Наименование не может быть пустым'), 'Валидация', 'Наименование не может быть пустым')
      return
    }
    if (editedWork.workPrice !== undefined && !validators.isPositiveNumber(editedWork.workPrice)) {
      handleError(new Error('Невалидная стоимость'), 'Валидация', 'Стоимость работы должна быть положительным числом')
      return
    }

    try {
      await profileService.updateWork(String(id), editedWork)
      handleSuccess('Спецификация обновлена')
      setEditingId(null)
      setEditedWork(null)
      onUpdate()
    } catch (error: any) {
      handleError(error, 'Ошибка обновления', 'Ошибка обновления: ' + error.message)
    }
  }

  const handleDelete = async (id: string | number) => {
    if (!confirm('Вы уверены, что хотите удалить эту спецификацию?')) return

    try {
      await profileService.deleteWork(String(id))
      handleSuccess('Спецификация удалена')
      onUpdate()
    } catch (error: any) {
      handleError(error, 'Ошибка удаления', 'Ошибка удаления: ' + error.message)
    }
  }

  const handleFieldChange = (field: keyof Work, value: any) => {
    if (!editedWork) return
    setEditedWork({ ...editedWork, [field]: value })
  }

  if (works.length === 0) {
    return <p className="text-muted-foreground text-center py-8">Нет спецификаций</p>
  }

  return (
    <div className="border rounded-lg overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Спецификация</TableHead>
            <TableHead>Ед.изм</TableHead>
            <TableHead>Стоимость работы</TableHead>
            <TableHead>Тип расчета</TableHead>
            <TableHead className="w-[100px]">Действия</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {works.map((work) => {
            const isEditing = editingId === work.id

            return (
              <TableRow key={work.id}>
                <TableCell>
                  {isEditing ? (
                    <Input
                      value={editedWork?.name || ''}
                      onChange={(e) => handleFieldChange('name', e.target.value)}
                      className="w-full"
                    />
                  ) : (
                    work.name
                  )}
                </TableCell>
                <TableCell>
                  {isEditing ? (
                    <Input
                      value={editedWork?.unit || ''}
                      onChange={(e) => handleFieldChange('unit', e.target.value)}
                      className="w-20"
                    />
                  ) : (
                    work.unit
                  )}
                </TableCell>
                <TableCell>
                  {isEditing ? (
                    <Input
                      type="number"
                      step="0.01"
                      value={editedWork?.workPrice || ''}
                      onChange={(e) => handleFieldChange('workPrice', parseFloat(e.target.value) || 0)}
                      className="w-32"
                    />
                  ) : (
                    `${work.workPrice} руб.`
                  )}
                </TableCell>
                <TableCell>
                  {isEditing ? (
                    <CalculationTypeSelect
                      value={editedWork?.calculationType || 'byArea'}
                      onChange={(value) => handleFieldChange('calculationType', value)}
                    />
                  ) : (
                    work.calculationType === 'byArea' ? 'По площади' :
                    work.calculationType === 'byPerimeter' ? 'По периметру' : 'По количеству'
                  )}
                </TableCell>
                <TableCell>
                  {isEditing ? (
                    <div className="flex gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleSave(work.id!)}
                      >
                        <Save className="w-4 h-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={handleCancel}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  ) : (
                    <div className="flex gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleEdit(work)}
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDelete(work.id!)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  )}
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}


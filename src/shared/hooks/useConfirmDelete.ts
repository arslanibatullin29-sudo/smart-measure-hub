import { useState, useCallback } from 'react'
import { handleError, handleSuccess } from '../utils/errorHandler'

interface UseConfirmDeleteOptions {
  onDelete: (id: string | number) => Promise<void>
  onUpdate?: () => void
  successMessage?: string
  confirmMessage?: string
  optimisticUpdate?: (id: string | number, updateFn: (prev: any[]) => any[]) => void
}

export function useConfirmDelete({
  onDelete,
  onUpdate,
  successMessage = 'Элемент удален',
  confirmMessage,
  optimisticUpdate
}: UseConfirmDeleteOptions) {
  const [isDeleting, setIsDeleting] = useState(false)

  const handleDelete = useCallback(async (id: string | number, customConfirmMessage?: string) => {
    const message = customConfirmMessage || confirmMessage || 'Вы уверены, что хотите удалить этот элемент?'
    
    if (!confirm(message)) return

    setIsDeleting(true)
    
    try {
      // Оптимистичное обновление, если предоставлено
      if (optimisticUpdate) {
        optimisticUpdate(id, (prev) => prev.filter((item: any) => {
          const itemId = typeof item.id === 'number' ? String(item.id) : item.id
          const deleteId = typeof id === 'number' ? String(id) : id
          return itemId !== deleteId
        }))
      }

      await onDelete(id)
      handleSuccess(successMessage)
      
      if (onUpdate) {
        onUpdate()
      }
    } catch (error: any) {
      handleError(error, 'Ошибка удаления', `Ошибка удаления: ${error.message}`)
      
      if (onUpdate) {
        onUpdate()
      }
    } finally {
      setIsDeleting(false)
    }
  }, [onDelete, onUpdate, successMessage, confirmMessage, optimisticUpdate])

  return { handleDelete, isDeleting }
}

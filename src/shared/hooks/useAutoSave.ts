import { useCallback, useRef, useEffect } from 'react'
import { handleError } from '../utils/errorHandler'
import { validators } from '../utils/validators'
import { normalizeId } from '../utils/dbHelpers'

interface UseAutoSaveOptions<T> {
  onSave: (id: string | number, field: keyof T, value: any) => Promise<void>
  onUpdate: () => void
  debounceMs?: number
  validateField?: (field: keyof T, value: any) => boolean
}

export function useAutoSave<T extends { id?: string | number }>({
  onSave,
  onUpdate,
  debounceMs = 500,
  validateField
}: UseAutoSaveOptions<T>) {
  const saveTimeouts = useRef<Map<string, number>>(new Map())

  // Очистка таймаутов при размонтировании
  useEffect(() => {
    return () => {
      saveTimeouts.current.forEach(timeout => clearTimeout(timeout))
      saveTimeouts.current.clear()
    }
  }, [])

  const handleChange = useCallback(async (
    id: string | number,
    field: keyof T,
    value: any,
    updateLocalState: (updater: (prev: T[]) => T[]) => void
  ) => {
    const entityId = normalizeId(id)
    const timeoutKey = `${entityId}-${String(field)}`
    
    // Отменяем предыдущий таймаут для этого поля
    const existingTimeout = saveTimeouts.current.get(timeoutKey)
    if (existingTimeout) {
      clearTimeout(existingTimeout)
    }

    // Валидация перед сохранением
    if (validateField) {
      if (!validateField(field, value)) {
        return
      }
    } else {
      // Дефолтная валидация
      if (field === 'name' && !validators.isNotEmpty(value)) {
        return
      }
      if ((field === 'price' || field === 'purchasePrice' || field === 'totalCost' || field === 'workPrice') 
          && !validators.isPositiveNumber(value)) {
        return
      }
    }

    // Оптимистичное обновление - сразу обновляем локальное состояние
    updateLocalState(prev => prev.map(item => 
      normalizeId(item.id!) === entityId ? { ...item, [field]: value } : item
    ))

    // Устанавливаем новый таймаут
    const timeout = setTimeout(async () => {
      try {
        await onSave(id, field, value)
        saveTimeouts.current.delete(timeoutKey)
        onUpdate()
      } catch (error: any) {
        handleError(error, 'Ошибка автосохранения', `Ошибка сохранения: ${error.message}`)
        onUpdate()
      }
    }, debounceMs)

    saveTimeouts.current.set(timeoutKey, timeout)
  }, [onSave, onUpdate, debounceMs, validateField])

  return { handleChange }
}

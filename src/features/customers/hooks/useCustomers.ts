import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { customersService } from '../services/customersService'
import { Customer, CustomerFormData } from '../models/Customer'
import { useAuth } from '@/features/auth/hooks/useAuth'

export function useCustomers() {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  const { data: customers = [], isLoading } = useQuery({
    queryKey: ['customers', user?.id],
    queryFn: () => customersService.getAll(user?.id || ''),
    enabled: !!user?.id,
    refetchOnWindowFocus: true, // Автоматически обновлять при фокусе окна
    refetchInterval: 30000, // Обновлять каждые 30 секунд
  })

  // Автоматическая синхронизация при монтировании и при изменении user
  // Отключено, чтобы избежать дублирования - синхронизация происходит через SyncService
  // useEffect(() => {
  //   if (user?.id) {
  //     // Синхронизируем с сервера в фоне
  //     customersService.syncFromServer(user.id)
  //       .then(() => {
  //         // Обновляем кэш после синхронизации
  //         queryClient.invalidateQueries({ queryKey: ['customers', user.id] })
  //       })
  //       .catch(console.error)
  //   }
  // }, [user?.id, queryClient])

  const createMutation = useMutation({
    mutationFn: (data: CustomerFormData) => {
      if (!user?.id) throw new Error('Пользователь не авторизован')
      return customersService.create({
        userId: user.id,
        fullName: data.fullName,
        address: data.address,
        phone: data.phone,
        comment: data.comment,
      })
    },
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: ['customers', user?.id] })
      // Автоматическая синхронизация после создания
      if (user?.id && navigator.onLine) {
        try {
          const { syncService } = await import('@/services/sync/syncService')
          await syncService.processSyncQueue()
          // Обновляем кэш после синхронизации
          queryClient.invalidateQueries({ queryKey: ['customers', user.id] })
        } catch (error) {
          console.error('Ошибка автоматической синхронизации:', error)
        }
      }
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Customer> }) =>
      customersService.update(id, data),
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: ['customers', user?.id] })
      // Автоматическая синхронизация после обновления
      if (user?.id && navigator.onLine) {
        try {
          const { syncService } = await import('@/services/sync/syncService')
          await syncService.processSyncQueue()
          queryClient.invalidateQueries({ queryKey: ['customers', user.id] })
        } catch (error) {
          console.error('Ошибка автоматической синхронизации:', error)
        }
      }
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => customersService.delete(id),
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: ['customers', user?.id] })
      // Автоматическая синхронизация после удаления
      if (user?.id && navigator.onLine) {
        try {
          const { syncService } = await import('@/services/sync/syncService')
          await syncService.processSyncQueue()
          queryClient.invalidateQueries({ queryKey: ['customers', user.id] })
        } catch (error) {
          console.error('Ошибка автоматической синхронизации:', error)
        }
      }
    },
  })

  return {
    customers,
    isLoading,
    createCustomer: createMutation.mutateAsync,
    updateCustomer: updateMutation.mutateAsync,
    deleteCustomer: deleteMutation.mutateAsync,
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
  }
}


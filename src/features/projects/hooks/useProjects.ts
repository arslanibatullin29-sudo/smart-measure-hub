import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { projectsService } from '../services/projectsService'
import { Project } from '../models/Project'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { useParams } from 'react-router-dom'

export function useProjects() {
  const { customerId } = useParams<{ customerId: string }>()
  const { user } = useAuth()
  const queryClient = useQueryClient()

  const { data: projects = [], isLoading } = useQuery({
    queryKey: ['projects', customerId, user?.id],
    queryFn: () => projectsService.getAll(customerId || '', user?.id || ''),
    enabled: !!customerId && !!user?.id,
    refetchOnWindowFocus: true,
    refetchInterval: 30000,
  })

  const createMutation = useMutation({
    mutationFn: (data: Omit<Project, 'id' | 'createdAt' | 'updatedAt' | 'lastSyncedAt' | 'syncStatus'>) => {
      if (!customerId || !user?.id) throw new Error('Не указан клиент или пользователь')
      return projectsService.create(data)
    },
    onSuccess: async (newProject: Project) => {
      // Сразу обновляем кэш, добавляя новый проект
      queryClient.setQueryData(['projects', customerId, user?.id], (old: Project[] = []) => {
        return [...old, newProject]
      })
      
      // Также инвалидируем для полного обновления
      queryClient.invalidateQueries({ queryKey: ['projects', customerId, user?.id] })
      
      // Автоматическая синхронизация после создания (в фоне)
      if (user?.id && navigator.onLine) {
        try {
          const { syncService } = await import('@/services/sync/syncService')
          await syncService.processSyncQueue()
          // Обновляем кэш после синхронизации, чтобы получить актуальный UUID
          queryClient.invalidateQueries({ queryKey: ['projects', customerId, user.id] })
        } catch (error) {
          console.error('Ошибка автоматической синхронизации:', error)
        }
      }
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string | number; data: Partial<Project> }) =>
      projectsService.update(id, data),
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: ['projects', customerId, user?.id] })
      // Автоматическая синхронизация после обновления
      if (user?.id && navigator.onLine) {
        try {
          const { syncService } = await import('@/services/sync/syncService')
          await syncService.processSyncQueue()
          queryClient.invalidateQueries({ queryKey: ['projects', customerId, user.id] })
        } catch (error) {
          console.error('Ошибка автоматической синхронизации:', error)
        }
      }
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string | number) => projectsService.delete(id),
    onSuccess: async (_: void, deletedId: string | number) => {
      // Оптимистично удаляем проект из кэша сразу
      queryClient.setQueryData(['projects', customerId, user?.id], (old: Project[] = []) => {
        // Удаляем проект по ID (может быть число или строка)
        return old.filter((p) => {
          // Сравниваем как строки для надежности
          return String(p.id) !== String(deletedId)
        })
      })
      
      // Автоматическая синхронизация после удаления (в фоне)
      // НЕ инвалидируем сразу, чтобы не вызвать повторный запрос, который вернет проект обратно
      if (user?.id && navigator.onLine) {
        try {
          const { syncService } = await import('@/services/sync/syncService')
          await syncService.processSyncQueue()
          // Обновляем кэш только после синхронизации, чтобы убедиться, что проект удален на сервере
          // Используем refetch вместо invalidate, чтобы не терять оптимистичное обновление
          await queryClient.refetchQueries({ queryKey: ['projects', customerId, user.id] })
        } catch (error) {
          console.error('Ошибка автоматической синхронизации:', error)
          // В случае ошибки все равно обновляем кэш
          queryClient.invalidateQueries({ queryKey: ['projects', customerId, user.id] })
        }
      } else {
        // Если офлайн, просто инвалидируем для обновления при следующем запросе
        queryClient.invalidateQueries({ queryKey: ['projects', customerId, user?.id] })
      }
    },
  })

  return {
    projects,
    isLoading,
    createProject: createMutation.mutateAsync,
    updateProject: updateMutation.mutateAsync,
    deleteProject: deleteMutation.mutateAsync,
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
  }
}


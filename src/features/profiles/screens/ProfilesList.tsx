import { useState, useEffect } from 'react'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { profileService } from '@/features/projects/estimate/profile/services/profileService'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Settings, Plus, Package, Wrench, Upload, Download, Star, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { handleError, handleSuccess, handleInfo } from '@/shared/utils/errorHandler'
import { InstallationProfile, Material, Work } from '@/services/storage/indexedDB'
import { importProfileFromExcel, exportProfileToExcel } from '@/features/projects/estimate/profile/services/excelService'
import { EditableMaterialsTable } from '../components/EditableMaterialsTable'
import { db } from '@/services/storage/indexedDB'

function ProfilesList() {
  const { user } = useAuth()
  const [profiles, setProfiles] = useState<InstallationProfile[]>([])
  const [selectedProfile, setSelectedProfile] = useState<InstallationProfile | null>(null)
  const [materials, setMaterials] = useState<Material[]>([])
  const [works, setWorks] = useState<Work[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showMaterialDialog, setShowMaterialDialog] = useState(false)
  const [showWorkDialog, setShowWorkDialog] = useState(false)
  const [showProfileDialog, setShowProfileDialog] = useState(false)
  const [editingMaterial, setEditingMaterial] = useState<Material | null>(null)
  const [editingWork, setEditingWork] = useState<Work | null>(null)
  const [showImportDialog, setShowImportDialog] = useState(false)
  const [deletingProfileId, setDeletingProfileId] = useState<string | number | null>(null)
  const [importingProfileId, setImportingProfileId] = useState<string | number | null>(null)

  useEffect(() => {
    if (user?.id) {
      loadProfiles()
    }
  }, [user?.id])

  const loadProfiles = async (autoSelect: boolean = true) => {
    if (!user?.id) return
    setIsLoading(true)
    try {
      // Очищаем завершенные операции удаления из очереди синхронизации
      const completedDeletes = await db.syncQueue
        .where('table').equals('installation_profiles')
        .and(item => item.operation === 'delete')
        .toArray()
      
      // Удаляем из очереди те, которые уже были синхронизированы (старше 1 минуты)
      const now = Date.now()
      for (const item of completedDeletes) {
        const itemTime = new Date(item.timestamp).getTime()
        if (now - itemTime > 60000) { // 1 минута
          await db.syncQueue.delete(item.id!)
        }
      }

      const allProfiles = await profileService.getAllProfiles(user.id)
      // Фильтруем дубликаты по id еще раз для надежности
      const uniqueProfiles = Array.from(
        new Map(allProfiles.map(p => [String(p.id), p])).values()
      )
      
      // Фильтруем профили, которые в процессе удаления
      const filteredProfiles = uniqueProfiles.filter(p => 
        String(p.id) !== String(deletingProfileId)
      )
      
      setProfiles(filteredProfiles)
      
      // Если нужно автоматически выбрать профиль и его еще нет
      if (autoSelect && !selectedProfile && filteredProfiles.length > 0) {
        const defaultProfile = filteredProfiles.find(p => p.isDefault) || filteredProfiles[0] || null
        if (defaultProfile) {
          setSelectedProfile(defaultProfile)
          await loadProfileData(defaultProfile.id as string)
        }
      } else if (selectedProfile) {
        // Проверяем, что выбранный профиль все еще существует
        const stillExists = filteredProfiles.find(p => String(p.id) === String(selectedProfile.id))
        if (!stillExists) {
          setSelectedProfile(null)
          setMaterials([])
          setWorks([])
        } else {
          // Обновляем данные выбранного профиля
          await loadProfileData(selectedProfile.id as string, true)
        }
      }
    } catch (error: any) {
      console.error('Ошибка загрузки профилей:', error)
      // Не показываем ошибку пользователю, если это просто проблема синхронизации
      if (!error.message?.includes('профиль не создан')) {
        handleError(error, 'Ошибка загрузки профилей', 'Ошибка загрузки профилей: ' + error.message)
      }
    } finally {
      setIsLoading(false)
    }
  }

  const loadProfileData = async (profileId: string, silent: boolean = false) => {
    try {
      // Проверяем, что профиль существует
      const profile = await db.installationProfiles.get(profileId as any)
      if (!profile) {
        // Пробуем найти по строковому ID
        const allProfiles = await db.installationProfiles.where('userId').equals(user?.id || '').toArray()
        const foundProfile = allProfiles.find(p => String(p.id) === String(profileId))
        if (!foundProfile) {
          if (!silent) {
            console.warn(`Профиль ${profileId} не найден`)
          }
          return
        }
      }
      
      // Загружаем материалы и работы для профиля
      const mats = await profileService.getMaterials(String(profileId))
      const wrks = await profileService.getWorks(String(profileId))
      
      // Фильтруем дубликаты
      const uniqueMaterials = Array.from(
        new Map(mats.map(m => [String(m.id), m])).values()
      )
      const uniqueWorks = Array.from(
        new Map(wrks.map(w => [String(w.id), w])).values()
      )
      
      setMaterials(uniqueMaterials)
      setWorks(uniqueWorks)
    } catch (error: any) {
      // Не показываем ошибку, если это просто отсутствие профиля
      if (!error.message?.includes('не найден') && !error.message?.includes('не создан')) {
        console.error('Ошибка загрузки данных профиля:', error)
        if (!silent) {
          handleError(error, 'Ошибка загрузки данных профиля', 'Ошибка загрузки данных профиля: ' + error.message)
        }
      }
    }
  }

  const handleProfileChange = async (profileId: string) => {
    const profile = profiles.find(p => String(p.id) === profileId)
    if (profile) {
      setSelectedProfile(profile)
      await loadProfileData(profileId)
    }
  }

  const handleSetDefault = async (profileId: string | number, e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation()
    }
    try {
      await profileService.updateProfile(profileId, { isDefault: true })
      await loadProfiles(false) // Перезагружаем профили
      handleSuccess('Профиль установлен по умолчанию')
    } catch (error: any) {
      await loadProfiles(false) // Перезагружаем в случае ошибки
      handleError(error, 'Ошибка обновления профиля', 'Ошибка обновления профиля: ' + error.message)
    }
  }

  const handleDeleteProfile = async (profileId: string | number, e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation()
    }
    
    if (!confirm('Вы уверены, что хотите удалить этот профиль? Все связанные спецификации и комплектующие также будут удалены.')) {
      return
    }

    // Устанавливаем состояние удаления для показа индикатора
    setDeletingProfileId(profileId)
    
    // Оптимистичное обновление UI - сразу удаляем профиль из списка
    setProfiles(prev => prev.filter(p => String(p.id) !== String(profileId)))
    
    // Если удаляемый профиль был выбран, сбрасываем выбор
    if (selectedProfile?.id === profileId) {
      setSelectedProfile(null)
      setMaterials([])
      setWorks([])
    }

    try {
      handleInfo('Удаление профиля...')
      
      // Получаем все работы профиля
      const profileWorks = await profileService.getWorks(String(profileId))
      
      // Удаляем все материалы, связанные с работами этого профиля
      const workMaterials = await db.workMaterials.toArray()
      const materialIds = new Set<string>()
      
      for (const work of profileWorks) {
        const relatedMaterials = workMaterials.filter(wm => wm.workId === String(work.id))
        relatedMaterials.forEach(wm => materialIds.add(wm.materialId))
      }
      
      // Удаляем все материалы профиля
      const profileMaterials = await profileService.getMaterials(String(profileId))
      for (const material of profileMaterials) {
        try {
          await profileService.deleteMaterial(material.id!)
        } catch (error) {
          console.error(`Ошибка удаления материала ${material.id}:`, error)
        }
      }
      
      // Удаляем все работы профиля
      for (const work of profileWorks) {
        try {
          await profileService.deleteWork(work.id!)
        } catch (error) {
          console.error(`Ошибка удаления работы ${work.id}:`, error)
        }
      }
      
      // Добавляем в очередь синхронизации для удаления на сервере ПЕРЕД удалением из локальной БД
      const profileToDelete = await db.installationProfiles.get(profileId as any)
      if (profileToDelete) {
        await db.syncQueue.add({
          table: 'installation_profiles',
          recordId: String(profileId),
          operation: 'delete',
          data: profileToDelete,
          timestamp: new Date().toISOString(),
          retries: 0,
        })
      }
      
      // Удаляем сам профиль из локальной БД
      await db.installationProfiles.delete(profileId as any)
      
      // Запускаем синхронизацию
      const { syncService } = await import('@/services/sync/syncService')
      await syncService.processSyncQueue()
      
      // Перезагружаем профили для синхронизации с сервером
      await loadProfiles(false)
      handleSuccess('Профиль и все связанные данные удалены')
    } catch (error: any) {
      // В случае ошибки возвращаем профиль в список
      await loadProfiles(false)
      handleError(error, 'Ошибка удаления профиля', 'Ошибка удаления профиля: ' + error.message)
    } finally {
      setDeletingProfileId(null)
    }
  }

  const handleCreateProfile = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!user?.id) return

    const formData = new FormData(e.currentTarget)
    const name = formData.get('name') as string
    const isDefault = formData.get('isDefault') === 'on'

    try {
      const newProfile = await profileService.createProfile(user.id, name, isDefault)
      
      setShowProfileDialog(false)
      handleSuccess('Профиль создан')
      
      // Перезагружаем профили из БД для получения актуальных данных
      await loadProfiles(false)
      
      // Выбираем созданный профиль
      const allProfiles = await profileService.getAllProfiles(user.id)
      const createdProfile = allProfiles.find(p => p.name === name) || newProfile
      setSelectedProfile(createdProfile)
      await loadProfileData(String(createdProfile.id))
    } catch (error: any) {
      // В случае ошибки перезагружаем профили
      await loadProfiles(false)
      handleError(error, 'Ошибка создания профиля', 'Ошибка создания профиля: ' + error.message)
    }
  }

  const handleCreateMaterial = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!selectedProfile || !user?.id) return

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
      if (editingMaterial) {
        await profileService.updateMaterial(String(editingMaterial.id), data)
        handleSuccess('Комплектующее обновлено')
      } else {
        await profileService.createMaterial(selectedProfile.id as string, user.id, data)
        handleSuccess('Комплектующее создано')
      }
      // Запускаем синхронизацию после создания/обновления материала
      const { syncService } = await import('@/services/sync/syncService')
      await syncService.processSyncQueue()
      setShowMaterialDialog(false)
      setEditingMaterial(null)
      await loadProfileData(selectedProfile.id as string)
    } catch (error: any) {
      handleError(error, 'Ошибка сохранения комплектующего', 'Ошибка: ' + error.message)
    }
  }

  const handleCreateWork = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!selectedProfile || !user?.id) return

    const formData = new FormData(e.currentTarget)
    const data = {
      name: formData.get('name') as string,
      unit: formData.get('unit') as string,
      workPrice: parseFloat(formData.get('workPrice') as string),
      calculationType: formData.get('calculationType') as 'byArea' | 'byPerimeter' | 'byCount',
    }

    try {
      if (editingWork) {
        // TODO: добавить updateWork
        toast.info('Обновление работ пока не реализовано')
      } else {
        await profileService.createWork(selectedProfile.id as string, user.id, data, [])
        handleSuccess('Работа создана')
        // Запускаем синхронизацию после создания работы
        const { syncService } = await import('@/services/sync/syncService')
        await syncService.processSyncQueue()
      }
      setShowWorkDialog(false)
      setEditingWork(null)
      await loadProfileData(selectedProfile.id as string)
    } catch (error: any) {
      handleError(error, 'Ошибка сохранения работы', 'Ошибка: ' + error.message)
    }
  }

  const handleImportExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !user?.id || !selectedProfile) return

    // Проверяем, что профиль существует в БД перед импортом
    const profileExists = await db.installationProfiles.get(selectedProfile.id as any)
    if (!profileExists) {
      handleError(new Error('Профиль не найден в базе данных'), 'Ошибка импорта', 'Пожалуйста, обновите страницу и попробуйте снова')
      return
    }

    // Устанавливаем состояние импорта для показа индикатора
    setImportingProfileId(selectedProfile.id as string | number)
    
    try {
      handleInfo('Импорт профиля из Excel...')
      const result = await importProfileFromExcel(
        file, 
        user.id, 
        selectedProfile.name,
        selectedProfile.id
      )
      
      // Запускаем синхронизацию после импорта
      const { syncService } = await import('@/services/sync/syncService')
      await syncService.processSyncQueue()
      
      await loadProfileData(selectedProfile.id as string)
      handleSuccess(`Импортировано: ${result.works.length} работ, ${result.materials.length} материалов`)
      setShowImportDialog(false)
    } catch (error: any) {
      handleError(error, 'Ошибка импорта', 'Ошибка импорта: ' + (error.message || 'Неизвестная ошибка'))
    } finally {
      setImportingProfileId(null)
      e.target.value = ''
    }
  }

  const handleExportExcel = async () => {
    if (!selectedProfile) return

    try {
      handleInfo('Экспорт профиля в Excel...')
      const blob = await exportProfileToExcel(String(selectedProfile.id))
      
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${selectedProfile.name || 'Профиль'}.xlsx`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      
      handleSuccess('Профиль экспортирован')
    } catch (error: any) {
      handleError(error, 'Ошибка экспорта', 'Ошибка экспорта: ' + (error.message || 'Неизвестная ошибка'))
    }
  }

  if (isLoading) {
    return <div className="p-8 text-center">Загрузка...</div>
  }

  return (
    <div className="p-8 w-full space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Профили монтажа</h1>
          <p className="text-muted-foreground mt-1">Управление профилями монтажа и их материалами</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setShowProfileDialog(true)} variant="outline">
            <Plus className="mr-2 h-4 w-4" />
            Создать профиль
          </Button>
        </div>
      </div>

      {profiles.length === 0 && (
        <div className="p-8 max-w-2xl mx-auto text-center">
          <Settings className="mx-auto h-16 w-16 mb-4 text-muted" />
          <h2 className="text-2xl font-bold mb-4">Профили монтажа не созданы</h2>
          <p className="text-muted-foreground mb-6">
            Создайте профиль для настройки материалов и работ
          </p>
          <Button onClick={() => setShowProfileDialog(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Создать профиль
          </Button>
        </div>
      )}

      {/* Список профилей */}
      {profiles.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {profiles.map((profile) => {
            const isDeleting = deletingProfileId === profile.id
            const isImporting = importingProfileId === profile.id
            
            return (
              <Card
              key={profile.id}
              className={`cursor-pointer transition-all hover:shadow-lg hover:scale-[1.02] ${
                selectedProfile?.id === profile.id ? 'ring-2 ring-primary shadow-md' : ''
              } ${isDeleting ? 'opacity-50 pointer-events-none' : ''} ${isImporting ? 'ring-2 ring-blue-500' : ''}`}
              onClick={() => !isDeleting && handleProfileChange(String(profile.id))}
            >
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2 text-lg truncate flex-1">
                    <Package className="w-5 h-5 flex-shrink-0" />
                    <span className="truncate">{profile.name}</span>
                  </CardTitle>
                  {profile.isDefault && (
                    <Star className="w-5 h-5 text-yellow-500 fill-yellow-500 flex-shrink-0" />
                  )}
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="space-y-3">
                  {profile.isDefault && (
                    <div className="inline-flex items-center gap-1 px-2 py-1 bg-yellow-50 dark:bg-yellow-900/20 rounded-md">
                      <Star className="w-3 h-3 text-yellow-600 dark:text-yellow-400" />
                      <span className="text-xs font-medium text-yellow-700 dark:text-yellow-300">По умолчанию</span>
                    </div>
                  )}
                  {isDeleting ? (
                    <div className="w-full py-2 px-3 bg-destructive/10 border border-destructive/20 rounded-md text-center">
                      <span className="text-sm text-destructive font-medium">Удаление...</span>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      {!profile.isDefault && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => handleSetDefault(profile.id!, e)}
                          className="flex-1 text-xs"
                        >
                          <Star className="mr-1 h-3 w-3" />
                          По умолчанию
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => handleDeleteProfile(profile.id!, e)}
                        className={`${!profile.isDefault ? 'flex-1' : 'w-full'} text-destructive hover:text-destructive text-xs`}
                      >
                        <Trash2 className="mr-1 h-3 w-3" />
                        Удалить
                      </Button>
                    </div>
                  )}
                </div>
              </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* Таблица материалов и работ для выбранного профиля */}
      {selectedProfile && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold">{selectedProfile.name}</h2>
              {selectedProfile.isDefault && (
                <span className="text-sm text-muted-foreground">Профиль по умолчанию</span>
              )}
            </div>
            <div className="flex gap-2">
              <Button 
                onClick={() => setShowImportDialog(true)} 
                variant="outline"
                disabled={importingProfileId === selectedProfile.id}
              >
                <Upload className="mr-2 h-4 w-4" />
                {importingProfileId === selectedProfile.id ? 'Импорт...' : 'Импорт Excel'}
              </Button>
              <Button onClick={handleExportExcel} variant="outline">
                <Download className="mr-2 h-4 w-4" />
                Экспорт Excel
              </Button>
            </div>
          </div>

          {/* Спецификации и Комплектующие */}
          <div className="flex flex-col w-full">
            <div className="flex items-center gap-2 mb-4">
              <Wrench className="w-5 h-5" />
              <h3 className="text-lg font-semibold">Спецификации</h3>
            </div>
            <div className="flex-1 overflow-hidden flex flex-col">
              <EditableMaterialsTable 
                key={`${materials.length}-${works.length}-${selectedProfile?.id}`}
                materials={materials} 
                works={works} 
                onUpdate={() => loadProfileData(selectedProfile.id as string)}
                profileId={selectedProfile.id as string}
                userId={user?.id}
              />
            </div>
          </div>
        </div>
      )}

      {/* Диалог материала */}
      <Dialog open={showMaterialDialog} onOpenChange={setShowMaterialDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingMaterial ? 'Редактировать комплектующее' : 'Новое комплектующее'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateMaterial}>
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
                <Input id="price" name="price" type="number" step="0.01" defaultValue={editingMaterial?.price} required />
              </div>
              <div>
                <Label htmlFor="purchasePrice">Стоимость закупа</Label>
                <Input id="purchasePrice" name="purchasePrice" type="number" step="0.01" defaultValue={editingMaterial?.purchasePrice} />
              </div>
              <div>
                <Label htmlFor="totalCost">Общая себестоимость</Label>
                <Input id="totalCost" name="totalCost" type="number" step="0.01" defaultValue={editingMaterial?.totalCost} />
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
                </select>
              </div>
              <div>
                <Label htmlFor="coefficient">Коэффициент</Label>
                <Input id="coefficient" name="coefficient" type="number" step="0.01" defaultValue={editingMaterial?.coefficient || 1} />
              </div>
              <div>
                <Label htmlFor="initialQuantity">Изначальное количество</Label>
                <Input id="initialQuantity" name="initialQuantity" type="number" step="0.01" defaultValue={editingMaterial?.initialQuantity} />
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

      {/* Диалог работы */}
      <Dialog open={showWorkDialog} onOpenChange={setShowWorkDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingWork ? 'Редактировать работу' : 'Новая работа'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateWork}>
            <div className="space-y-4 py-4">
              <div>
                <Label htmlFor="workName">Наименование</Label>
                <Input id="workName" name="name" defaultValue={editingWork?.name} required />
              </div>
              <div>
                <Label htmlFor="workUnit">Единица измерения</Label>
                <Input id="workUnit" name="unit" defaultValue={editingWork?.unit} required />
              </div>
              <div>
                <Label htmlFor="workPrice">Цена работы</Label>
                <Input id="workPrice" name="workPrice" type="number" step="0.01" defaultValue={editingWork?.workPrice} required />
              </div>
              <div>
                <Label htmlFor="workCalculationType">Тип расчета</Label>
                <select
                  id="workCalculationType"
                  name="calculationType"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  defaultValue={editingWork?.calculationType}
                  required
                >
                  <option value="byArea">По площади</option>
                  <option value="byPerimeter">По периметру</option>
                  <option value="byCount">По количеству</option>
                </select>
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

      {/* Диалог создания/редактирования профиля */}
      <Dialog open={showProfileDialog} onOpenChange={setShowProfileDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Новый профиль</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateProfile}>
            <div className="space-y-4 py-4">
              <div>
                <Label htmlFor="profileName">Название профиля</Label>
                <Input id="profileName" name="name" required placeholder="Например: Стандартный профиль" />
              </div>
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="isDefault"
                  name="isDefault"
                  className="rounded border-gray-300"
                />
                <Label htmlFor="isDefault">Установить профилем по умолчанию</Label>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowProfileDialog(false)}>
                Отмена
              </Button>
              <Button type="submit">Создать</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Диалог импорта Excel */}
      <Dialog open={showImportDialog} onOpenChange={(open) => {
        if (!open && importingProfileId) {
          // Не позволяем закрыть диалог во время импорта
          return
        }
        setShowImportDialog(open)
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Импорт профиля из Excel</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {importingProfileId ? (
              <div className="space-y-4">
                <div className="py-6 px-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md text-center">
                  <div className="flex flex-col items-center gap-2">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                    <p className="text-sm font-medium text-blue-700 dark:text-blue-300">
                      Идет импорт: не закрывайте страницу
                    </p>
                    <p className="text-xs text-blue-600 dark:text-blue-400">
                      Пожалуйста, дождитесь завершения операции
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <>
                <p className="text-sm text-muted-foreground">
                  Выберите Excel файл для импорта. Структура файла:
                </p>
                <ul className="text-sm text-muted-foreground list-disc list-inside space-y-1">
                  <li>Столбец "Спецификация" - услуга (работа)</li>
                  <li>Столбец "Комплектующие" - материалы</li>
                  <li>Если услуга не указана, материалы относятся к предыдущей услуге</li>
                  <li>Для комплектующих: Количество, Ед.изм, Цена продажи, Стоимость закупа, Общая себестоимость, Тип расчета, Коэффициент</li>
                </ul>
                <div>
                  <Label htmlFor="excelFile">Файл Excel</Label>
                  <Input
                    id="excelFile"
                    type="file"
                    accept=".xlsx,.xls"
                    onChange={handleImportExcel}
                    className="mt-2"
                    disabled={!!importingProfileId}
                  />
                </div>
                <div className="pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={async () => {
                      try {
                        // Создаем пример Excel файла
                        const exampleRows = [
                          {
                            Спецификация: 'Установка крепежного профиля ПВХ',
                            Комплектующие: '',
                            Количество: '',
                            'Ед.изм': '',
                            'Цена продажи': '',
                            'Стоимость закупа': '',
                            'Общая себестоимость': '',
                            'Тип расчета': '',
                            Коэффициент: '',
                          },
                          {
                            Спецификация: '',
                            Комплектующие: 'Багет настенный ПВХ',
                            Количество: 1,
                            'Ед.изм': 'шт',
                            'Цена продажи': 150,
                            'Стоимость закупа': 100,
                            'Общая себестоимость': 120,
                            'Тип расчета': 'По площади',
                            Коэффициент: 1,
                          },
                          {
                            Спецификация: 'Установка багета потолочного',
                            Комплектующие: '',
                            Количество: '',
                            'Ед.изм': '',
                            'Цена продажи': '',
                            'Стоимость закупа': '',
                            'Общая себестоимость': '',
                            'Тип расчета': '',
                            Коэффициент: '',
                          },
                          {
                            Спецификация: '',
                            Комплектующие: 'Багет потолочный ПВХ',
                            Количество: 1,
                            'Ед.изм': 'шт',
                            'Цена продажи': 200,
                            'Стоимость закупа': 150,
                            'Общая себестоимость': 170,
                            'Тип расчета': 'По периметру',
                            Коэффициент: 1.2,
                          },
                        ]

                        const XLSX = await import('xlsx/xlsx.mjs')
                        const worksheet = XLSX.utils.json_to_sheet(exampleRows)
                        const workbook = XLSX.utils.book_new()
                        XLSX.utils.book_append_sheet(workbook, worksheet, 'Профиль')

                        const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' })
                        const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
                        
                        const url = URL.createObjectURL(blob)
                        const a = document.createElement('a')
                        a.href = url
                        a.download = 'Пример_профиля_монтажа.xlsx'
                        document.body.appendChild(a)
                        a.click()
                        document.body.removeChild(a)
                        URL.revokeObjectURL(url)
                        
                        handleSuccess('Пример файла загружен')
                      } catch (error: any) {
                        handleError(error, 'Ошибка создания примера', 'Ошибка: ' + error.message)
                      }
                    }}
                    className="w-full"
                  >
                    <Download className="mr-2 h-4 w-4" />
                    Скачать пример Excel файла
                  </Button>
                </div>
              </>
            )}
          </div>
          <DialogFooter>
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => setShowImportDialog(false)}
              disabled={!!importingProfileId}
            >
              {importingProfileId ? 'Идет импорт...' : 'Отмена'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default ProfilesList


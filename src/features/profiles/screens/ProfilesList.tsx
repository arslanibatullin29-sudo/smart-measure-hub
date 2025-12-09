import { useState, useEffect, useCallback } from 'react'
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

  const loadProfiles = useCallback(async () => {
    if (!user?.id) return
    setIsLoading(true)
    try {
      const allProfiles = await profileService.getAllProfiles(user.id)
      setProfiles(allProfiles)
      
      // Если есть выбранный профиль, проверяем что он все еще существует
      if (selectedProfile) {
        const stillExists = allProfiles.find(p => String(p.id) === String(selectedProfile.id))
        if (stillExists) {
          // Обновляем данные профиля
          setSelectedProfile(stillExists)
          await loadProfileData(String(stillExists.id))
        } else {
          // Профиль удален, выбираем другой
          const defaultProfile = allProfiles.find(p => p.isDefault) || allProfiles[0]
          if (defaultProfile) {
            setSelectedProfile(defaultProfile)
            await loadProfileData(String(defaultProfile.id))
          } else {
            setSelectedProfile(null)
            setMaterials([])
            setWorks([])
          }
        }
      } else if (allProfiles.length > 0) {
        // Выбираем профиль по умолчанию или первый
        const defaultProfile = allProfiles.find(p => p.isDefault) || allProfiles[0]
        setSelectedProfile(defaultProfile)
        await loadProfileData(String(defaultProfile.id))
      }
    } catch (error: any) {
      console.error('Ошибка загрузки профилей:', error)
      handleError(error, 'Ошибка загрузки профилей')
    } finally {
      setIsLoading(false)
    }
  }, [user?.id, selectedProfile?.id])

  useEffect(() => {
    if (user?.id) {
      loadProfiles()
    }
  }, [user?.id])

  const loadProfileData = async (profileId: string) => {
    try {
      const [mats, wrks] = await Promise.all([
        profileService.getMaterials(profileId),
        profileService.getWorks(profileId)
      ])
      setMaterials(mats)
      setWorks(wrks)
    } catch (error: any) {
      console.error('Ошибка загрузки данных профиля:', error)
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
    if (e) e.stopPropagation()
    try {
      await profileService.updateProfile(profileId, { isDefault: true })
      handleSuccess('Профиль установлен по умолчанию')
      await loadProfiles()
    } catch (error: any) {
      handleError(error, 'Ошибка обновления профиля')
    }
  }

  const handleDeleteProfile = async (profileId: string | number, e?: React.MouseEvent) => {
    if (e) e.stopPropagation()
    
    if (!confirm('Вы уверены, что хотите удалить этот профиль? Все связанные данные будут удалены.')) {
      return
    }

    setDeletingProfileId(profileId)
    
    // Оптимистичное обновление
    setProfiles(prev => prev.filter(p => String(p.id) !== String(profileId)))
    if (String(selectedProfile?.id) === String(profileId)) {
      setSelectedProfile(null)
      setMaterials([])
      setWorks([])
    }

    try {
      await profileService.deleteProfile(profileId)
      handleSuccess('Профиль удален')
      await loadProfiles()
    } catch (error: any) {
      handleError(error, 'Ошибка удаления профиля')
      await loadProfiles() // Восстанавливаем состояние
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
      await loadProfiles()
      // Выбираем созданный профиль
      setSelectedProfile(newProfile)
      await loadProfileData(String(newProfile.id))
    } catch (error: any) {
      handleError(error, 'Ошибка создания профиля')
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
        await profileService.createMaterial(String(selectedProfile.id), user.id, data)
        handleSuccess('Комплектующее создано')
      }
      setShowMaterialDialog(false)
      setEditingMaterial(null)
      await loadProfileData(String(selectedProfile.id))
    } catch (error: any) {
      handleError(error, 'Ошибка сохранения')
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
        toast.info('Обновление работ пока не реализовано')
      } else {
        await profileService.createWork(String(selectedProfile.id), user.id, data, [])
        handleSuccess('Работа создана')
      }
      setShowWorkDialog(false)
      setEditingWork(null)
      await loadProfileData(String(selectedProfile.id))
    } catch (error: any) {
      handleError(error, 'Ошибка сохранения')
    }
  }

  const handleImportExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !user?.id || !selectedProfile) return

    setImportingProfileId(selectedProfile.id as string | number)
    
    try {
      handleInfo('Импорт профиля из Excel...')
      const result = await importProfileFromExcel(
        file, 
        user.id, 
        selectedProfile.name,
        selectedProfile.id
      )
      
      await loadProfileData(String(selectedProfile.id))
      handleSuccess(`Импортировано: ${result.works.length} работ, ${result.materials.length} материалов`)
      setShowImportDialog(false)
    } catch (error: any) {
      handleError(error, 'Ошибка импорта')
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
      handleError(error, 'Ошибка экспорта')
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
                key={String(profile.id)}
                className={`cursor-pointer transition-all hover:shadow-lg hover:scale-[1.02] ${
                  String(selectedProfile?.id) === String(profile.id) ? 'ring-2 ring-primary shadow-md' : ''
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

      {/* Таблица материалов и работ */}
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
                key={`${String(selectedProfile.id)}-${materials.length}-${works.length}`}
                materials={materials} 
                works={works} 
                onUpdate={() => loadProfileData(String(selectedProfile.id))}
                profileId={String(selectedProfile.id)}
                userId={user?.id}
              />
            </div>
          </div>
        </div>
      )}

      {/* Диалог создания профиля */}
      <Dialog open={showProfileDialog} onOpenChange={setShowProfileDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Создать профиль</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateProfile}>
            <div className="space-y-4 py-4">
              <div>
                <Label htmlFor="name">Название профиля</Label>
                <Input id="name" name="name" required />
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" id="isDefault" name="isDefault" className="w-4 h-4" />
                <Label htmlFor="isDefault">Профиль по умолчанию</Label>
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
                <Label htmlFor="initialQuantity">Начальное количество</Label>
                <Input id="initialQuantity" name="initialQuantity" type="number" step="0.01" defaultValue={editingMaterial?.initialQuantity} />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => { setShowMaterialDialog(false); setEditingMaterial(null); }}>
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
                <Label htmlFor="name">Наименование</Label>
                <Input id="name" name="name" defaultValue={editingWork?.name} required />
              </div>
              <div>
                <Label htmlFor="unit">Единица измерения</Label>
                <Input id="unit" name="unit" defaultValue={editingWork?.unit} required />
              </div>
              <div>
                <Label htmlFor="workPrice">Цена работы</Label>
                <Input id="workPrice" name="workPrice" type="number" step="0.01" defaultValue={editingWork?.workPrice} required />
              </div>
              <div>
                <Label htmlFor="calculationType">Тип расчета</Label>
                <select
                  id="calculationType"
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
              <Button type="button" variant="outline" onClick={() => { setShowWorkDialog(false); setEditingWork(null); }}>
                Отмена
              </Button>
              <Button type="submit">Сохранить</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Диалог импорта */}
      <Dialog open={showImportDialog} onOpenChange={setShowImportDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Импорт из Excel</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-muted-foreground mb-4">
              Выберите файл Excel для импорта спецификаций и комплектующих
            </p>
            <Input
              type="file"
              accept=".xlsx,.xls"
              onChange={handleImportExcel}
            />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default ProfilesList

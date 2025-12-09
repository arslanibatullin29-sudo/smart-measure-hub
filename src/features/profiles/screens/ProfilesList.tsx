import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { profileService } from '@/features/projects/estimate/profile/services/profileService'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { LoadingBar } from '@/components/LoadingBar'
import { Settings, Plus, Package, Wrench, Upload, Download, Star, Trash2, Check } from 'lucide-react'
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
  const [isLoadingData, setIsLoadingData] = useState(false)
  const [showProfileDialog, setShowProfileDialog] = useState(false)
  const [showImportDialog, setShowImportDialog] = useState(false)
  const [deletingProfileId, setDeletingProfileId] = useState<string | number | null>(null)
  const [importingProfileId, setImportingProfileId] = useState<string | number | null>(null)

  const loadProfiles = useCallback(async () => {
    if (!user?.id) return
    setIsLoading(true)
    try {
      if (navigator.onLine) {
        await profileService.syncFromServer(user.id)
        profileService.syncLocalToServer(user.id).catch(console.error)
      }
      
      const allProfiles = await profileService.getAllProfiles(user.id)
      setProfiles(allProfiles)
      
      if (selectedProfile) {
        const stillExists = allProfiles.find(p => String(p.id) === String(selectedProfile.id))
        if (stillExists) {
          setSelectedProfile(stillExists)
          await loadProfileData(String(stillExists.id))
        } else {
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
        const defaultProfile = allProfiles.find(p => p.isDefault) || allProfiles[0]
        setSelectedProfile(defaultProfile)
        await loadProfileData(String(defaultProfile.id))
      }
    } catch (error: any) {
      console.error('Ошибка загрузки профилей:', error)
      handleError(error, 'Ошибка загрузки')
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
    setIsLoadingData(true)
    try {
      const [mats, wrks] = await Promise.all([
        profileService.getMaterials(profileId),
        profileService.getWorks(profileId)
      ])
      setMaterials(mats)
      setWorks(wrks)
    } catch (error: any) {
      console.error('Ошибка загрузки данных профиля:', error)
    } finally {
      setIsLoadingData(false)
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
      handleSuccess('Профиль по умолчанию')
      await loadProfiles()
    } catch (error: any) {
      handleError(error, 'Ошибка')
    }
  }

  const handleDeleteProfile = async (profileId: string | number, e?: React.MouseEvent) => {
    if (e) e.stopPropagation()
    
    if (!confirm('Удалить профиль?')) return

    setDeletingProfileId(profileId)
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
      handleError(error, 'Ошибка')
      await loadProfiles()
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
      setSelectedProfile(newProfile)
      await loadProfileData(String(newProfile.id))
    } catch (error: any) {
      handleError(error, 'Ошибка')
    }
  }

  const handleImportExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !user?.id || !selectedProfile) return

    // Проверяем онлайн режим - импорт требует подключения к серверу
    if (!navigator.onLine) {
      handleError(new Error('Для импорта требуется подключение к интернету'), 'Офлайн режим')
      e.target.value = ''
      return
    }

    setImportingProfileId(selectedProfile.id as string | number)
    
    try {
      console.log('Начало импорта для профиля:', selectedProfile.id, selectedProfile.name)
      const result = await importProfileFromExcel(file, user.id, selectedProfile.name, selectedProfile.id)
      console.log('Импорт завершен:', result)
      
      // Принудительно обновляем данные профиля
      setMaterials([])
      setWorks([])
      await new Promise(resolve => setTimeout(resolve, 200))
      await loadProfileData(String(selectedProfile.id))
      
      handleSuccess(`Импорт: ${result.works.length} работ, ${result.materials.length} материалов`)
      setShowImportDialog(false)
    } catch (error: any) {
      console.error('Ошибка импорта:', error)
      handleError(error, 'Ошибка импорта', error?.message)
    } finally {
      setImportingProfileId(null)
      e.target.value = ''
    }
  }

  const handleExportExcel = async () => {
    if (!selectedProfile) return

    try {
      handleInfo('Экспорт...')
      const blob = await exportProfileToExcel(String(selectedProfile.id))
      
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${selectedProfile.name || 'Профиль'}.xlsx`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      
      handleSuccess('Экспортировано')
    } catch (error: any) {
      handleError(error, 'Ошибка')
    }
  }

  return (
    <div className="w-full space-y-4 sm:space-y-6 animate-fade-in">
      <LoadingBar isLoading={isLoading || isLoadingData} />
      
      {/* Компактный заголовок */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold">Профили монтажа</h1>
          <p className="text-xs sm:text-sm text-muted-foreground hidden sm:block">Управление профилями и материалами</p>
        </div>
        <Button onClick={() => setShowProfileDialog(true)} size="sm" variant="outline" className="gap-1.5">
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">Создать</span>
        </Button>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-3">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardContent className="p-3">
                <Skeleton className="h-5 w-3/4 mb-2" />
                <Skeleton className="h-4 w-1/2 mb-3" />
                <Skeleton className="h-7 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : profiles.length === 0 ? (
        <div className="text-center py-8 sm:py-12">
          <Settings className="mx-auto h-10 w-10 mb-3 text-muted-foreground" />
          <p className="text-muted-foreground mb-4 text-sm">Нет профилей</p>
          <Button onClick={() => setShowProfileDialog(true)} size="sm">
            <Plus className="mr-1.5 h-4 w-4" />
            Создать профиль
          </Button>
        </div>
      ) : (
        <>
          {/* Компактные карточки профилей */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-3">
            {profiles.map((profile) => {
              const isSelected = String(selectedProfile?.id) === String(profile.id)
              const isDeleting = deletingProfileId === profile.id
              
              return (
                <Card
                  key={String(profile.id)}
                  className={`cursor-pointer transition-all hover:shadow-md ${
                    isSelected ? 'ring-2 ring-primary shadow-md' : ''
                  } ${isDeleting ? 'opacity-50 pointer-events-none' : ''}`}
                  onClick={() => !isDeleting && handleProfileChange(String(profile.id))}
                >
                  <CardContent className="p-2.5 sm:p-3">
                    <div className="flex items-start justify-between gap-1 mb-2">
                      <div className="flex items-center gap-1.5 min-w-0 flex-1">
                        <Package className="w-4 h-4 flex-shrink-0 text-muted-foreground" />
                        <span className="font-medium text-sm truncate">{profile.name}</span>
                      </div>
                      {profile.isDefault && (
                        <Star className="w-4 h-4 text-yellow-500 fill-yellow-500 flex-shrink-0" />
                      )}
                    </div>
                    
                    {isDeleting ? (
                      <div className="text-xs text-destructive">Удаление...</div>
                    ) : (
                      <div className="flex gap-1">
                        {!profile.isDefault && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => handleSetDefault(profile.id!, e)}
                            className="h-7 px-2 text-xs flex-1"
                          >
                            <Check className="h-3 w-3" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => handleDeleteProfile(profile.id!, e)}
                          className="h-7 px-2 text-xs text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )
            })}
          </div>

          {/* Таблица материалов */}
          {selectedProfile && (
            <div className="space-y-3 sm:space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Wrench className="w-4 h-4" />
                  <h2 className="font-semibold text-base sm:text-lg">{selectedProfile.name}</h2>
                  {selectedProfile.isDefault && (
                    <span className="text-xs bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 px-1.5 py-0.5 rounded">
                      По умолчанию
                    </span>
                  )}
                </div>
                <div className="flex gap-1.5 sm:gap-2">
                  <Button 
                    onClick={() => setShowImportDialog(true)} 
                    variant="outline"
                    size="sm"
                    disabled={importingProfileId === selectedProfile.id}
                    className="h-8 text-xs sm:text-sm"
                  >
                    <Upload className="h-3.5 w-3.5 mr-1" />
                    <span className="hidden sm:inline">Импорт</span>
                  </Button>
                  <Button 
                    onClick={handleExportExcel} 
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs sm:text-sm"
                  >
                    <Download className="h-3.5 w-3.5 mr-1" />
                    <span className="hidden sm:inline">Экспорт</span>
                  </Button>
                </div>
              </div>

              {isLoadingData ? (
                <div className="border rounded-lg p-4">
                  <Skeleton className="h-8 w-full mb-2" />
                  <Skeleton className="h-6 w-full mb-1" />
                  <Skeleton className="h-6 w-full mb-1" />
                  <Skeleton className="h-6 w-3/4" />
                </div>
              ) : (
                <EditableMaterialsTable 
                  key={`${String(selectedProfile.id)}-${materials.length}-${works.length}`}
                  materials={materials} 
                  works={works} 
                  onUpdate={() => loadProfileData(String(selectedProfile.id))}
                  profileId={String(selectedProfile.id)}
                  userId={user?.id}
                />
              )}
            </div>
          )}
        </>
      )}

      {/* Диалог создания профиля */}
      <Dialog open={showProfileDialog} onOpenChange={setShowProfileDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Создать профиль</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateProfile}>
            <div className="space-y-3 py-3">
              <div>
                <Label htmlFor="name" className="text-sm">Название</Label>
                <Input id="name" name="name" required className="mt-1" />
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" id="isDefault" name="isDefault" className="rounded" />
                <Label htmlFor="isDefault" className="text-sm font-normal">По умолчанию</Label>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" size="sm" onClick={() => setShowProfileDialog(false)}>
                Отмена
              </Button>
              <Button type="submit" size="sm">Создать</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Диалог импорта */}
      <Dialog open={showImportDialog} onOpenChange={(open) => !importingProfileId && setShowImportDialog(open)}>
        <DialogContent className="max-w-sm">
          <LoadingBar isLoading={!!importingProfileId} />
          <DialogHeader>
            <DialogTitle>Импорт из Excel</DialogTitle>
          </DialogHeader>
          <div className="py-3">
            {importingProfileId ? (
              <div className="text-center py-4">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-3"></div>
                <p className="text-sm text-muted-foreground">Импорт данных...</p>
              </div>
            ) : (
              <>
                <Input
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={handleImportExcel}
                  className="text-sm"
                />
                <p className="text-xs text-muted-foreground mt-2">
                  Выберите файл Excel с данными профиля
                </p>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default ProfilesList

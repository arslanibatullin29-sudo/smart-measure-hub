import * as XLSX from 'xlsx/xlsx.mjs';
import { InstallationProfile, Material, Work } from '@/services/storage/indexedDB'
import { db } from '@/services/storage/indexedDB'
import { profileService } from './profileService'
import { supabase } from '@/services/supabase/supabaseClient'
import { isUUID } from '@/shared/utils/uuid'

/**
 * Интерфейс для строки Excel файла
 * Структура: Спецификация (услуга) | Комплектующие | Количество | Ед.изм | Цена | ...
 */
export interface ExcelRow {
  specification?: string // Услуга (Work) - если пусто, относится к предыдущей услуге
  component?: string // Комплектующее (Material)
  quantity?: number // Изначальное количество
  unit?: string // Единица измерения
  price?: number // Цена продажи
  purchasePrice?: number // Стоимость закупа
  totalCost?: number // Общая себестоимость
  calculationType?: 'byArea' | 'byPerimeter' | 'byCount' | 'fixed' // Тип расчета
  coefficient?: number // Коэффициент умножения
}

/**
 * Импорт профиля из Excel файла
 * 
 * Логика:
 * - Если указана "Спецификация" (услуга) - создается новая работа
 * - Если "Спецификация" пуста - комплектующие относятся к предыдущей услуге
 * - Изначальное количество умножается на площадь/периметр/количество элементов
 */
export async function importProfileFromExcel(
  file: File,
  userId: string,
  profileName: string,
  existingProfileId?: string | number
): Promise<{ profile: InstallationProfile; works: Work[]; materials: Material[] }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()

    reader.onload = async (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer)
        const workbook = XLSX.read(data, { type: 'array' })

        // Берем первый лист
        const firstSheetName = workbook.SheetNames[0]
        const worksheet = workbook.Sheets[firstSheetName]

        // Конвертируем в JSON
        // Предполагаем, что первая строка - заголовки
        const jsonData: any[] = XLSX.utils.sheet_to_json(worksheet, {
          header: 1, // Используем первую строку как заголовки
          defval: null,
        })

        // Находим индексы колонок по заголовкам
        const headerRow = jsonData[0] as string[]
        
        // Логируем заголовки для отладки
        console.log('Заголовки Excel:', headerRow)
        
        const specIndex = headerRow.findIndex((h: string) => 
          h && (h.toLowerCase().includes('спецификация') || h.toLowerCase().includes('услуга') || h.toLowerCase().includes('работа'))
        )
        const componentIndex = headerRow.findIndex((h: string) => 
          h && (h.toLowerCase().includes('комплектующ') || h.toLowerCase().includes('материал'))
        )
        const quantityIndex = headerRow.findIndex((h: string) => 
          h && (h.toLowerCase().includes('количеств'))
        )
        // Улучшенный поиск для "Ед.изм" - ищем точное совпадение или частичное
        const unitIndex = headerRow.findIndex((h: string) => {
          if (!h) return false
          const lower = h.toLowerCase().trim()
          return lower === 'ед.изм' || lower === 'ед изм' || 
                 lower.includes('ед.изм') || lower.includes('ед изм') ||
                 lower.includes('единиц') || lower.includes('единица') ||
                 lower === 'ед'
        })
        // Улучшенный поиск для "Цена продажи" - приоритет точному совпадению
        const priceIndex = headerRow.findIndex((h: string) => {
          if (!h) return false
          const lower = h.toLowerCase().trim()
          return lower === 'цена продажи' || 
                 (lower.includes('цена') && !lower.includes('закуп') && !lower.includes('себестоимость'))
        })
        const purchasePriceIndex = headerRow.findIndex((h: string) => 
          h && (h.toLowerCase().includes('стоимость закупа') || h.toLowerCase().includes('закуп'))
        )
        // Улучшенный поиск для "Общая себестоимость"
        const totalCostIndex = headerRow.findIndex((h: string) => {
          if (!h) return false
          const lower = h.toLowerCase().trim()
          return lower === 'общая себестоимость' || 
                 (lower.includes('общая') && lower.includes('себестоимость')) ||
                 lower.includes('себестоимость')
        })
        const calcTypeIndex = headerRow.findIndex((h: string) => 
          h && (h.toLowerCase().includes('тип расчета') || (h.toLowerCase().includes('тип') && h.toLowerCase().includes('расчет')))
        )
        const coefficientIndex = headerRow.findIndex((h: string) => 
          h && h.toLowerCase().includes('коэффициент')
        )
        
        // Логируем найденные индексы для отладки
        console.log('Найденные индексы колонок:', {
          specIndex, componentIndex, quantityIndex, unitIndex, 
          priceIndex, purchasePriceIndex, totalCostIndex, calcTypeIndex, coefficientIndex
        })

        // Преобразуем данные в нужный формат
        const processedData: ExcelRow[] = []
        for (let i = 1; i < jsonData.length; i++) {
          const row = jsonData[i] as any[]
          if (!row || row.length === 0) continue

          // Парсим тип расчета
          let calculationType: 'byArea' | 'byPerimeter' | 'byCount' | 'fixed' = 'byArea'
          if (calcTypeIndex >= 0 && row[calcTypeIndex]) {
            const calcTypeStr = String(row[calcTypeIndex]).toLowerCase()
            if (calcTypeStr.includes('фиксир') || calcTypeStr.includes('fixed')) {
              calculationType = 'fixed'
            } else if (calcTypeStr.includes('площад') || calcTypeStr.includes('area')) {
              calculationType = 'byArea'
            } else if (calcTypeStr.includes('периметр') || calcTypeStr.includes('perimeter')) {
              calculationType = 'byPerimeter'
            } else if (calcTypeStr.includes('количеств') || calcTypeStr.includes('count')) {
              calculationType = 'byCount'
            }
          }

          // Вспомогательная функция для безопасного парсинга числа
          const parseNumber = (value: any): number | undefined => {
            if (value === null || value === undefined || value === '') return undefined
            const parsed = parseFloat(String(value))
            return isNaN(parsed) ? undefined : parsed
          }

          // Вспомогательная функция для безопасного получения строки
          const parseString = (value: any): string | undefined => {
            if (value === null || value === undefined) return undefined
            const str = String(value).trim()
            return str === '' ? undefined : str
          }

          processedData.push({
            specification: specIndex >= 0 ? parseString(row[specIndex]) : undefined,
            component: componentIndex >= 0 ? parseString(row[componentIndex]) : undefined,
            quantity: quantityIndex >= 0 ? parseNumber(row[quantityIndex]) : undefined,
            unit: unitIndex >= 0 ? parseString(row[unitIndex]) : undefined,
            price: priceIndex >= 0 ? parseNumber(row[priceIndex]) : undefined,
            purchasePrice: purchasePriceIndex >= 0 ? parseNumber(row[purchasePriceIndex]) : undefined,
            totalCost: totalCostIndex >= 0 ? parseNumber(row[totalCostIndex]) : undefined,
            calculationType,
            coefficient: coefficientIndex >= 0 ? parseNumber(row[coefficientIndex]) : undefined,
          })
        }

        // Создаем или используем существующий профиль
        const now = new Date().toISOString()
        let profile: InstallationProfile
        let profileId: string

        if (existingProfileId) {
          // Используем существующий профиль
          const profileIdStr = String(existingProfileId)
          profile = await db.installationProfiles.get(existingProfileId as any) as InstallationProfile
          
          // Если не нашли по прямому ID, пробуем найти по строковому ID
          if (!profile) {
            const allProfiles = await db.installationProfiles.where('userId').equals(userId).toArray()
            profile = allProfiles.find(p => String(p.id) === profileIdStr) as InstallationProfile
          }
          
          if (!profile) {
            console.error('Профиль не найден. ID:', existingProfileId, 'Тип:', typeof existingProfileId)
            throw new Error(`Профиль не найден. ID: ${existingProfileId}`)
          }
          
          // Используем ID профиля (должен быть UUID от сервера)
          profileId = String(profile.id)
          console.log('Импорт в существующий профиль:', { profileId, isUUID: isUUID(profileId) })
          
          // Проверяем что profileId является валидным UUID
          if (!isUUID(profileId)) {
            throw new Error('Профиль еще не синхронизирован с сервером. Пожалуйста, перезагрузите страницу.')
          }
          
          // УДАЛЯЕМ ВСЕ СТАРЫЕ ДАННЫЕ на СЕРВЕРЕ перед импортом
          console.log('Удаление старых данных на сервере...')
          try {
            // Сначала удаляем work_materials (связи)
            const { data: serverWorks } = await supabase
              .from('works')
              .select('id')
              .eq('profile_id', profileId)
            
            if (serverWorks && serverWorks.length > 0) {
              for (const sw of serverWorks) {
                await supabase.from('work_materials').delete().eq('work_id', sw.id)
              }
            }
            
            // Удаляем работы и материалы с сервера
            await supabase.from('works').delete().eq('profile_id', profileId)
            await supabase.from('materials').delete().eq('profile_id', profileId)
            console.log('Данные на сервере удалены')
          } catch (serverError) {
            console.error('Ошибка удаления на сервере:', serverError)
            // Продолжаем, локальные данные всё равно удалим
          }
          
          // УДАЛЯЕМ ВСЕ СТАРЫЕ ДАННЫЕ в IndexedDB
          console.log('Удаление старых данных в IndexedDB...')
          
          // Получаем все работы профиля
          const existingWorks = await db.works.filter(w => String(w.profileId) === profileId).toArray()
          console.log('Найдено работ для удаления:', existingWorks.length)
          
          // Удаляем связи workMaterials для этих работ
          for (const work of existingWorks) {
            await db.workMaterials.where('workId').equals(String(work.id)).delete()
          }
          
          // Удаляем работы и материалы
          for (const work of existingWorks) {
            await db.works.delete(work.id!)
          }
          
          const existingMaterials = await db.materials.filter(m => String(m.profileId) === profileId).toArray()
          console.log('Найдено материалов для удаления:', existingMaterials.length)
          for (const mat of existingMaterials) {
            await db.materials.delete(mat.id!)
          }
          
          console.log('Старые данные профиля удалены')
          
          // Обновляем время изменения
          await db.installationProfiles.update(profile.id!, {
            updatedAt: now,
            syncStatus: 'synced',
          })
          profile = { ...profile, updatedAt: now, syncStatus: 'synced' }
        } else {
          // Создаем новый профиль через сервер (чтобы получить UUID)
          const { data: serverProfile, error } = await supabase
            .from('installation_profiles')
            .insert({
              user_id: userId,
              name: profileName,
              is_default: false,
              created_at: now,
              updated_at: now,
            })
            .select()
            .single()
          
          if (error) throw error
          
          profileId = serverProfile.id
          
          const profileData: InstallationProfile = {
            id: profileId,
            userId,
            name: profileName,
            isDefault: false,
            createdAt: now,
            updatedAt: now,
            lastSyncedAt: now,
            syncStatus: 'synced',
          }

          await db.installationProfiles.put(profileData)
          profile = profileData
        }

        const works: Work[] = []
        const materials: Material[] = []
        let currentWork: Work | null = null
        // Мапа для отслеживания уже созданных работ по имени (чтобы избежать дубликатов)
        const worksByName = new Map<string, Work>()

        // Обрабатываем строки
        for (const row of processedData) {
          // Пропускаем пустые строки
          if (!row.specification && !row.component) continue

          // Если указана услуга (спецификация)
          if (row.specification) {
            const specificationName = String(row.specification).trim()
            
            // Проверяем, не создали ли мы уже работу с таким именем
            if (worksByName.has(specificationName)) {
              // Используем существующую работу
              currentWork = worksByName.get(specificationName)!
            } else {
              // Создаем новую работу через profileService (синхронизирует с сервером)
              // Для работ тип fixed не поддерживается, используем byArea по умолчанию
              const workCalcType = row.calculationType === 'fixed' ? 'byArea' : (row.calculationType || 'byArea')
              const workData = {
                name: specificationName,
                unit: row.unit || '',
                workPrice: row.price !== undefined ? row.price : 0,
                calculationType: workCalcType as 'byArea' | 'byPerimeter' | 'byCount',
              }

              currentWork = await profileService.createWork(String(profileId), userId, workData, [])
              works.push(currentWork)
              worksByName.set(specificationName, currentWork)
            }
          }

          // Если указано комплектующее
          if (row.component && currentWork) {
            // Создаем материал через profileService (синхронизирует с сервером)
            const materialData = {
              name: String(row.component),
              unit: (row.unit !== undefined && row.unit !== null && String(row.unit).trim() !== '') 
                ? String(row.unit).trim() 
                : 'шт',
              price: (row.price !== undefined && row.price !== null) ? row.price : 0,
              purchasePrice: (row.purchasePrice !== undefined && row.purchasePrice !== null) ? row.purchasePrice : undefined,
              totalCost: (row.totalCost !== undefined && row.totalCost !== null) ? row.totalCost : undefined,
              calculationType: row.calculationType || 'byArea',
              coefficient: row.coefficient !== undefined ? row.coefficient : (row.quantity !== undefined ? row.quantity : 1),
              initialQuantity: row.quantity !== undefined ? row.quantity : 1,
            }

            const material = await profileService.createMaterial(String(profileId), userId, materialData)
            materials.push(material)

            // Связываем материал с работой через profileService (синхронизирует с сервером)
            await profileService.addMaterialToWork(String(currentWork.id), String(material.id))
          }
        }

        resolve({ profile, works, materials })
      } catch (error) {
        reject(error)
      }
    }

    reader.onerror = () => reject(new Error('Ошибка чтения файла'))
    reader.readAsArrayBuffer(file)
  })
}

/**
 * Экспорт профиля в Excel файл
 */
export async function exportProfileToExcel(
  profileId: string
): Promise<Blob> {
  // Получаем данные профиля
  const profile = await db.installationProfiles.get(profileId)
  if (!profile) throw new Error('Профиль не найден')

  const works = await db.works.where('profileId').equals(profileId).toArray()
  const materials = await db.materials.where('profileId').equals(profileId).toArray()
  const workMaterials = await db.workMaterials.toArray()

  // Создаем данные для Excel
  const rows: any[] = []

  for (const work of works) {
    // Получаем материалы для этой работы
    const workMats = workMaterials.filter((wm) => wm.workId === String(work.id))
    const workMaterialsData = workMats.map((wm) => {
      const material = materials.find((m) => m.id === wm.materialId)
      return { ...wm, material }
    })

    // Добавляем строку с услугой (только название спецификации)
    rows.push({
      Спецификация: work.name,
      Комплектующие: '',
      Количество: '',
      'Ед.изм': '',
      'Цена продажи': '',
      'Стоимость закупа': '',
      'Общая себестоимость': '',
      'Тип расчета': '',
      Коэффициент: '',
    })

    // Добавляем строки с комплектующими (без указания услуги)
    for (const wm of workMaterialsData) {
      if (wm.material) {
        rows.push({
          Спецификация: '', // Пусто - относится к предыдущей услуге
          Комплектующие: wm.material.name,
          Количество: wm.material.initialQuantity || wm.quantity || 1,
          'Ед.изм': wm.material.unit,
          'Цена продажи': wm.material.price || 0,
          'Стоимость закупа': wm.material.purchasePrice || 0,
          'Общая себестоимость': wm.material.totalCost || 0,
          'Тип расчета': wm.material.calculationType === 'byArea' ? 'По площади' : 
                        wm.material.calculationType === 'byPerimeter' ? 'По периметру' : 
                        wm.material.calculationType === 'fixed' ? 'Фиксированное' : 'По количеству',
          Коэффициент: wm.material.coefficient || 1,
        })
      }
    }
  }

  // Создаем рабочую книгу
  const worksheet = XLSX.utils.json_to_sheet(rows)
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Профиль')

  // Конвертируем в Blob
  const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' })
  return new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
}


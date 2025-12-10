import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { Customer } from '@/features/customers/models/Customer'
import { Project } from '@/features/projects/models/Project'
import { EstimateResult } from '@/features/projects/estimate/calculators/estimateCalculator'

interface PDFData {
  customer: Customer
  project: Project
  estimate: EstimateResult
  organizationName?: string
}

// Кэш для шрифтов (для офлайн работы)
let cachedRegularFont: string | null = null
let cachedBoldFont: string | null = null

// Загружаем шрифт как base64 с кэшированием
async function loadFont(path: string, useCache: 'regular' | 'bold'): Promise<string> {
  // Проверяем кэш
  if (useCache === 'regular' && cachedRegularFont) return cachedRegularFont
  if (useCache === 'bold' && cachedBoldFont) return cachedBoldFont
  
  try {
    const response = await fetch(path, {
      cache: 'force-cache' // Используем кэш браузера для офлайн
    })
    if (!response.ok) throw new Error(`Font not found: ${path}`)
    const buffer = await response.arrayBuffer()
    const bytes = new Uint8Array(buffer)
    let binary = ''
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i])
    }
    const base64 = btoa(binary)
    
    // Сохраняем в кэш
    if (useCache === 'regular') cachedRegularFont = base64
    if (useCache === 'bold') cachedBoldFont = base64
    
    return base64
  } catch (error) {
    console.error('Ошибка загрузки шрифта:', error)
    throw new Error('Не удалось загрузить шрифт для PDF. Проверьте подключение к интернету.')
  }
}

export class PDFGenerator {
  static async generate(data: PDFData): Promise<jsPDF> {
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    })
    
    // Загружаем и регистрируем шрифты с кириллицей (с кэшированием для офлайн)
    const [regularFont, boldFont] = await Promise.all([
      loadFont('/fonts/Roboto-Regular.ttf', 'regular'),
      loadFont('/fonts/Roboto-Bold.ttf', 'bold')
    ])
    
    doc.addFileToVFS('Roboto-Regular.ttf', regularFont)
    doc.addFileToVFS('Roboto-Bold.ttf', boldFont)
    doc.addFont('Roboto-Regular.ttf', 'Roboto', 'normal')
    doc.addFont('Roboto-Bold.ttf', 'Roboto', 'bold')
    doc.setFont('Roboto')
    
    const fontName = 'Roboto'
    let yPos = 15
    const pageWidth = doc.internal.pageSize.getWidth()
    const marginLeft = 15
    const marginRight = 15
    const contentWidth = pageWidth - marginLeft - marginRight

    // Заголовок
    doc.setFontSize(18)
    doc.setFont(fontName, 'bold')
    doc.text('СМЕТА', pageWidth / 2, yPos, { align: 'center' })
    yPos += 10

    // Дата
    const currentDate = new Date()
    const day = String(currentDate.getDate()).padStart(2, '0')
    const month = String(currentDate.getMonth() + 1).padStart(2, '0')
    const year = String(currentDate.getFullYear())
    doc.setFontSize(11)
    doc.setFont(fontName, 'normal')
    doc.text('от ' + day + '.' + month + '.' + year, pageWidth / 2, yPos, { align: 'center' })
    yPos += 12

    // Блок информации об объекте
    doc.setFontSize(11)
    doc.setFont(fontName, 'normal')
    
    // Параметры помещения
    const areaValue = Number(data.project.area) || 0
    const perimeterValue = Number(data.project.perimeter) || 0
    const cornersValue = Array.isArray(data.project.points) ? data.project.points.length : 0
    
    // Клиент и параметры помещения в двух колонках
    const clientInfo = [
      ['Заказчик:', data.customer.fullName, 'Площадь:', areaValue.toFixed(2) + ' кв.м'],
    ]
    if (data.customer.address) {
      clientInfo.push(['Адрес объекта:', data.customer.address, 'Периметр:', perimeterValue.toFixed(2) + ' м'])
    } else {
      clientInfo.push(['', '', 'Периметр:', perimeterValue.toFixed(2) + ' м'])
    }
    if (data.customer.phone) {
      clientInfo.push(['Телефон:', data.customer.phone, 'Углов:', String(cornersValue)])
    } else {
      clientInfo.push(['', '', 'Углов:', String(cornersValue)])
    }

    autoTable(doc, {
      startY: yPos,
      body: clientInfo,
      theme: 'plain',
      styles: {
        font: fontName,
        fontSize: 10,
        cellPadding: { top: 1.5, bottom: 1.5, left: 0, right: 5 },
      },
      columnStyles: {
        0: { fontStyle: 'bold', cellWidth: 30 },
        1: { cellWidth: (contentWidth - 60) / 2 },
        2: { fontStyle: 'bold', cellWidth: 30 },
        3: { cellWidth: (contentWidth - 60) / 2 },
      },
      margin: { left: marginLeft, right: marginRight },
    })

    yPos = (doc as any).lastAutoTable.finalY + 10

    // Таблица сметы - по группам (спецификациям)
    const tableBody: any[] = []
    let rowNum = 1

    for (const item of data.estimate.items) {
      // Заголовок группы (спецификация)
      tableBody.push([
        { content: item.workName || '', colSpan: 6, styles: { fontStyle: 'bold', fillColor: [240, 240, 240], halign: 'left' } },
      ])

      // Материалы (комплектующие)
      for (const material of item.materials) {
        // Безопасное преобразование значений с проверкой на null/undefined
        const qty = material.materialQuantity != null ? Number(material.materialQuantity) : 0
        const price = material.materialPrice != null ? Number(material.materialPrice) : 0
        const total = material.materialTotal != null ? Number(material.materialTotal) : 0
        
        // Форматируем значения - всегда показываем 2 знака после запятой
        const qtyStr = isNaN(qty) ? '0.00' : qty.toFixed(2)
        const priceStr = isNaN(price) ? '0.00' : price.toFixed(2)
        const totalStr = isNaN(total) ? '0.00' : total.toFixed(2)
        
        tableBody.push([
          { content: String(rowNum++), styles: { halign: 'center' } },
          { content: material.materialName || '', styles: { halign: 'left' } },
          { content: material.materialUnit || '', styles: { halign: 'center' } },
          { content: qtyStr, styles: { halign: 'right' } },
          { content: priceStr, styles: { halign: 'right' } },
          { content: totalStr, styles: { halign: 'right' } },
        ])
      }

      // Подитог по группе
      const groupTotal = Number(item.workTotalWithMaterials) || 0
      tableBody.push([
        { content: '', styles: { fillColor: [248, 248, 248] } },
        { content: 'Итого по "' + (item.workName || '') + '":', colSpan: 4, styles: { fontStyle: 'bold', fillColor: [248, 248, 248], halign: 'right' } },
        { content: groupTotal.toFixed(2), styles: { fontStyle: 'bold', fillColor: [248, 248, 248], halign: 'right' } },
      ])
    }

    if (tableBody.length > 0) {
      autoTable(doc, {
        startY: yPos,
        head: [['№', 'Наименование', 'Ед.', 'Кол-во', 'Цена', 'Сумма']],
        body: tableBody,
        theme: 'grid',
        styles: {
          font: fontName,
          fontSize: 9,
          cellPadding: 2,
          lineWidth: 0.1,
          lineColor: [180, 180, 180],
        },
        headStyles: {
          fillColor: [50, 50, 50],
          textColor: [255, 255, 255],
          font: fontName,
          halign: 'center',
          fontSize: 9,
        },
        columnStyles: {
          0: { cellWidth: 8, halign: 'center' },
          1: { cellWidth: 'auto' },
          2: { cellWidth: 12, halign: 'center' },
          3: { cellWidth: 18, halign: 'right' },
          4: { cellWidth: 20, halign: 'right' },
          5: { cellWidth: 22, halign: 'right' },
        },
        margin: { left: marginLeft, right: marginRight },
      })

      yPos = (doc as any).lastAutoTable.finalY + 5
    }

    // Итоговая сумма
    const grandTotal = Number(data.estimate.total) || 0
    autoTable(doc, {
      startY: yPos,
      body: [[
        { content: 'ИТОГО:', styles: { fontStyle: 'bold', fontSize: 12, halign: 'right' } },
        { content: grandTotal.toFixed(2) + ' руб.', styles: { fontStyle: 'bold', fontSize: 12, halign: 'right' } },
      ]],
      theme: 'plain',
      styles: {
        font: fontName,
        cellPadding: 3,
      },
      columnStyles: {
        0: { cellWidth: contentWidth - 40 },
        1: { cellWidth: 40 },
      },
      margin: { left: marginLeft, right: marginRight },
    })

    yPos = (doc as any).lastAutoTable.finalY + 15

    // Подписи
    if (yPos < doc.internal.pageSize.getHeight() - 40) {
      doc.setFontSize(9)
      doc.setFont(fontName, 'normal')
      
      const signY = yPos
      doc.text('Исполнитель: _____________________', marginLeft, signY)
      doc.text('Заказчик: _____________________', pageWidth - marginRight - 60, signY)
    }

    // Комментарий клиента (если есть)
    if (data.customer.comment) {
      yPos = (doc as any).lastAutoTable.finalY + 25
      if (yPos < doc.internal.pageSize.getHeight() - 20) {
        doc.setFontSize(8)
        doc.text(`Примечание: ${data.customer.comment}`, marginLeft, yPos)
      }
    }

    return doc
  }

  static savePDF(doc: jsPDF, filename: string = 'estimate.pdf'): void {
    doc.save(filename)
  }

  static getPDFBlob(doc: jsPDF): Blob {
    return doc.output('blob')
  }
}

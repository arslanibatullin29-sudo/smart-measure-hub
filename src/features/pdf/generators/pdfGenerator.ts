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

// Загружаем шрифт Roboto с поддержкой кириллицы
async function loadRobotoFont(): Promise<string> {
  try {
    const response = await fetch('/fonts/Roboto-Regular.ttf')
    if (!response.ok) throw new Error('Font not found')
    const buffer = await response.arrayBuffer()
    const bytes = new Uint8Array(buffer)
    let binary = ''
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i])
    }
    return btoa(binary)
  } catch (error) {
    console.error('Error loading font:', error)
    return ''
  }
}

export class PDFGenerator {
  static async generate(data: PDFData): Promise<jsPDF> {
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    })
    
    // Загружаем и регистрируем шрифт с кириллицей
    let fontLoaded = false
    try {
      const fontBase64 = await loadRobotoFont()
      if (fontBase64) {
        doc.addFileToVFS('Roboto-Regular.ttf', fontBase64)
        doc.addFont('Roboto-Regular.ttf', 'Roboto', 'normal')
        doc.setFont('Roboto')
        fontLoaded = true
      }
    } catch (error) {
      console.error('Ошибка загрузки шрифта:', error)
    }
    
    const fontName = fontLoaded ? 'Roboto' : 'helvetica'
    let yPos = 15
    const pageWidth = doc.internal.pageSize.getWidth()
    const marginLeft = 15
    const marginRight = 15
    const contentWidth = pageWidth - marginLeft - marginRight

    // Заголовок
    doc.setFontSize(16)
    doc.setFont(fontName, 'normal')
    doc.text('СМЕТА', pageWidth / 2, yPos, { align: 'center' })
    yPos += 10

    // Дата
    doc.setFontSize(10)
    doc.text(`от ${new Date().toLocaleDateString('ru-RU')}`, pageWidth / 2, yPos, { align: 'center' })
    yPos += 12

    // Блок информации об объекте
    doc.setFontSize(11)
    doc.setFont(fontName, 'normal')
    
    // Клиент
    const clientInfo = [
      ['Заказчик:', data.customer.fullName],
    ]
    if (data.customer.address) {
      clientInfo.push(['Адрес объекта:', data.customer.address])
    }
    if (data.customer.phone) {
      clientInfo.push(['Телефон:', data.customer.phone])
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
        0: { fontStyle: 'bold', cellWidth: 35 },
        1: { cellWidth: contentWidth - 35 },
      },
      margin: { left: marginLeft, right: marginRight },
    })

    yPos = (doc as any).lastAutoTable.finalY + 8

    // Параметры помещения
    autoTable(doc, {
      startY: yPos,
      head: [['Параметры помещения', '', '']],
      body: [[
        `Площадь: ${data.project.area.toFixed(2)} м²`,
        `Периметр: ${data.project.perimeter.toFixed(2)} м`,
        `Углов: ${data.project.points.length}`,
      ]],
      theme: 'grid',
      styles: {
        font: fontName,
        fontSize: 9,
        cellPadding: 3,
        halign: 'center',
      },
      headStyles: {
        fillColor: [80, 80, 80],
        textColor: 255,
        fontStyle: 'bold',
        halign: 'left',
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
        { content: item.workName, colSpan: 6, styles: { fontStyle: 'bold', fillColor: [240, 240, 240], halign: 'left' } },
      ])

      // Материалы (комплектующие)
      for (const material of item.materials) {
        tableBody.push([
          { content: String(rowNum++), styles: { halign: 'center' } },
          material.materialName,
          { content: material.materialUnit, styles: { halign: 'center' } },
          { content: material.materialQuantity.toFixed(2), styles: { halign: 'right' } },
          { content: material.materialPrice.toFixed(2), styles: { halign: 'right' } },
          { content: material.materialTotal.toFixed(2), styles: { halign: 'right' } },
        ])
      }

      // Подитог по группе
      tableBody.push([
        { content: '', styles: { fillColor: [248, 248, 248] } },
        { content: `Итого по "${item.workName}":`, colSpan: 4, styles: { fontStyle: 'bold', fillColor: [248, 248, 248], halign: 'right' } },
        { content: item.workTotalWithMaterials.toFixed(2), styles: { fontStyle: 'bold', fillColor: [248, 248, 248], halign: 'right' } },
      ])
    }

    if (tableBody.length > 0) {
      autoTable(doc, {
        startY: yPos,
        head: [['№', 'Наименование', 'Ед.', 'Кол-во', 'Цена, ₽', 'Сумма, ₽']],
        body: tableBody,
        theme: 'grid',
        styles: {
          font: fontName,
          fontSize: 8,
          cellPadding: 2,
          lineWidth: 0.1,
          lineColor: [200, 200, 200],
        },
        headStyles: {
          fillColor: [60, 60, 60],
          textColor: 255,
          fontStyle: 'bold',
          halign: 'center',
          fontSize: 9,
        },
        columnStyles: {
          0: { cellWidth: 10, halign: 'center' },
          1: { cellWidth: 70 },
          2: { cellWidth: 15, halign: 'center' },
          3: { cellWidth: 20, halign: 'right' },
          4: { cellWidth: 25, halign: 'right' },
          5: { cellWidth: 30, halign: 'right' },
        },
        margin: { left: marginLeft, right: marginRight },
      })

      yPos = (doc as any).lastAutoTable.finalY + 5
    }

    // Итоговая сумма
    autoTable(doc, {
      startY: yPos,
      body: [[
        { content: 'ИТОГО:', styles: { fontStyle: 'bold', fontSize: 12, halign: 'right' } },
        { content: `${data.estimate.total.toFixed(2)} ₽`, styles: { fontStyle: 'bold', fontSize: 12, halign: 'right' } },
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

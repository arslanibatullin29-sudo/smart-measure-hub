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

// Загружаем шрифт как base64
async function loadFont(path: string): Promise<string> {
  const response = await fetch(path)
  if (!response.ok) throw new Error(`Font not found: ${path}`)
  const buffer = await response.arrayBuffer()
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
}

export class PDFGenerator {
  static async generate(data: PDFData): Promise<jsPDF> {
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    })
    
    // Загружаем и регистрируем шрифты с кириллицей (обычный и жирный)
    const [regularFont, boldFont] = await Promise.all([
      loadFont('/fonts/Roboto-Regular.ttf'),
      loadFont('/fonts/Roboto-Bold.ttf')
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
    doc.setFont(fontName, 'normal')
    doc.text('СМЕТА', pageWidth / 2, yPos, { align: 'center' })
    yPos += 10

    // Дата
    const currentDate = new Date()
    const formattedDate = `${String(currentDate.getDate()).padStart(2, '0')}.${String(currentDate.getMonth() + 1).padStart(2, '0')}.${currentDate.getFullYear()}`
    doc.setFontSize(11)
    doc.text(`от ${formattedDate}`, pageWidth / 2, yPos, { align: 'center' })
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
      head: [[{ content: 'Параметры помещения', colSpan: 3 }]],
      body: [[
        `Площадь: ${data.project.area.toFixed(2)} м²`,
        `Периметр: ${data.project.perimeter.toFixed(2)} м`,
        `Углов: ${data.project.points.length}`,
      ]],
      theme: 'grid',
      styles: {
        font: fontName,
        fontSize: 10,
        cellPadding: 4,
        halign: 'center',
      },
      headStyles: {
        fillColor: [70, 70, 70],
        textColor: [255, 255, 255],
        font: fontName,
        fontSize: 11,
        halign: 'center',
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
          fontSize: 9,
          cellPadding: 3,
          lineWidth: 0.1,
          lineColor: [180, 180, 180],
        },
        headStyles: {
          fillColor: [50, 50, 50],
          textColor: [255, 255, 255],
          font: fontName,
          halign: 'center',
          fontSize: 10,
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

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
  const response = await fetch('/fonts/Roboto-Regular.ttf')
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
    const doc = new jsPDF()
    
    // Загружаем и регистрируем шрифт с кириллицей
    try {
      const fontBase64 = await loadRobotoFont()
      doc.addFileToVFS('Roboto-Regular.ttf', fontBase64)
      doc.addFont('Roboto-Regular.ttf', 'Roboto', 'normal')
      doc.setFont('Roboto')
    } catch (error) {
      console.error('Ошибка загрузки шрифта:', error)
      // Fallback to default font
      doc.setFont('helvetica')
    }
    
    let yPos = 20

    // Заголовок
    doc.setFontSize(18)
    doc.text('СМЕТА НА ВЫПОЛНЕНИЕ РАБОТ', 105, yPos, { align: 'center' })
    yPos += 15

    // Информация о клиенте
    autoTable(doc, {
      startY: yPos,
      head: [['Информация о клиенте']],
      body: [
        [`ФИО: ${data.customer.fullName}`],
        ...(data.customer.address ? [[`Адрес: ${data.customer.address}`]] : []),
        ...(data.customer.phone ? [[`Телефон: ${data.customer.phone}`]] : []),
        ...(data.customer.comment ? [[`Комментарий: ${data.customer.comment}`]] : []),
      ],
      theme: 'plain',
      styles: {
        font: 'Roboto',
        fontSize: 11,
        cellPadding: 2,
      },
      headStyles: {
        fontStyle: 'bold',
        fontSize: 12,
      },
    })

    yPos = (doc as any).lastAutoTable.finalY + 10

    // Информация о помещении
    autoTable(doc, {
      startY: yPos,
      head: [['Информация о помещении']],
      body: [
        [`Площадь: ${data.project.area.toFixed(2)} м²`],
        [`Периметр: ${data.project.perimeter.toFixed(2)} м`],
        [`Количество углов: ${data.project.points.length}`],
        [`Количество элементов: ${data.project.elementCount}`],
      ],
      theme: 'plain',
      styles: {
        font: 'Roboto',
        fontSize: 11,
        cellPadding: 2,
      },
      headStyles: {
        fontStyle: 'bold',
        fontSize: 12,
      },
    })

    yPos = (doc as any).lastAutoTable.finalY + 10

    // Таблица сметы - только материалы
    const tableBody: any[] = []

    for (const item of data.estimate.items) {
      // Материалы
      for (const material of item.materials) {
        tableBody.push([
          material.materialName,
          material.materialUnit,
          { content: material.materialQuantity.toFixed(2), styles: { halign: 'right' } },
          { content: material.materialPrice.toFixed(2), styles: { halign: 'right' } },
          { content: material.materialTotal.toFixed(2), styles: { halign: 'right' } },
        ])
      }
    }

    if (tableBody.length > 0) {
      autoTable(doc, {
        startY: yPos,
        head: [['Наименование', 'Ед.изм', 'Кол-во', 'Цена', 'Сумма']],
        body: tableBody,
        theme: 'striped',
        styles: {
          font: 'Roboto',
          fontSize: 9,
          cellPadding: 3,
        },
        headStyles: {
          fillColor: [66, 66, 66],
          textColor: 255,
          fontStyle: 'bold',
          halign: 'center',
        },
        columnStyles: {
          0: { cellWidth: 70 },
          1: { cellWidth: 25, halign: 'center' },
          2: { cellWidth: 25, halign: 'right' },
          3: { cellWidth: 30, halign: 'right' },
          4: { cellWidth: 35, halign: 'right' },
        },
      })

      yPos = (doc as any).lastAutoTable.finalY + 10
    }

    // Итоговая сумма
    autoTable(doc, {
      startY: yPos,
      body: [[
        { content: 'ИТОГО:', styles: { fontStyle: 'bold', fontSize: 14 } },
        { content: `${data.estimate.total.toFixed(2)} руб.`, styles: { fontStyle: 'bold', fontSize: 14, halign: 'right' } },
      ]],
      theme: 'plain',
      styles: {
        font: 'Roboto',
        cellPadding: 5,
      },
      columnStyles: {
        0: { cellWidth: 140 },
        1: { cellWidth: 45 },
      },
    })

    yPos = (doc as any).lastAutoTable.finalY + 10

    // Название организации и дата
    if (data.organizationName) {
      autoTable(doc, {
        startY: yPos,
        body: [[data.organizationName]],
        theme: 'plain',
        styles: {
          font: 'Roboto',
          fontSize: 10,
          halign: 'center',
        },
      })
      yPos = (doc as any).lastAutoTable.finalY + 5
    }

    autoTable(doc, {
      startY: yPos,
      body: [[`Дата создания: ${new Date().toLocaleDateString('ru-RU')}`]],
      theme: 'plain',
      styles: {
        font: 'Roboto',
        fontSize: 10,
      },
    })

    return doc
  }

  static savePDF(doc: jsPDF, filename: string = 'estimate.pdf'): void {
    doc.save(filename)
  }

  static getPDFBlob(doc: jsPDF): Blob {
    return doc.output('blob')
  }
}

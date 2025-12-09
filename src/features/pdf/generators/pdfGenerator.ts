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

// AutoTable handles Cyrillic via internal text encoding

export class PDFGenerator {
  static generate(data: PDFData): jsPDF {
    const doc = new jsPDF()
    
    // Используем Helvetica - стандартный шрифт, который работает с Unicode через autoTable
    doc.setFont('helvetica')
    
    let yPos = 20

    // Заголовок (используем транслитерацию для text())
    doc.setFontSize(18)
    doc.text('SMETA NA VYPOLNENIE RABOT', 105, yPos, { align: 'center' })
    yPos += 15

    // Информация о клиенте через autoTable для поддержки кириллицы
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
        font: 'helvetica',
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
        font: 'helvetica',
        fontSize: 11,
        cellPadding: 2,
      },
      headStyles: {
        fontStyle: 'bold',
        fontSize: 12,
      },
    })

    yPos = (doc as any).lastAutoTable.finalY + 10

    // Таблица сметы
    const tableBody: any[] = []

    for (const item of data.estimate.items) {
      // Строка работы (жирная)
      tableBody.push([
        { content: item.workName, styles: { fontStyle: 'bold' } },
        { content: item.workUnit, styles: { fontStyle: 'bold' } },
        { content: item.workQuantity.toFixed(2), styles: { fontStyle: 'bold', halign: 'right' } },
        { content: item.workPrice.toFixed(2), styles: { fontStyle: 'bold', halign: 'right' } },
        { content: item.workTotal.toFixed(2), styles: { fontStyle: 'bold', halign: 'right' } },
      ])

      // Материалы для работы
      for (const material of item.materials) {
        tableBody.push([
          { content: `  — ${material.materialName}`, styles: { textColor: [100, 100, 100] } },
          material.materialUnit,
          { content: material.materialQuantity.toFixed(2), styles: { halign: 'right' } },
          { content: material.materialPrice.toFixed(2), styles: { halign: 'right' } },
          { content: material.materialTotal.toFixed(2), styles: { halign: 'right' } },
        ])
      }

      // Итого по работе
      tableBody.push([
        { content: '', colSpan: 4 },
        { content: `Итого: ${item.workTotalWithMaterials.toFixed(2)}`, styles: { fontStyle: 'bold', halign: 'right' } },
      ])
    }

    autoTable(doc, {
      startY: yPos,
      head: [['Наименование', 'Ед.изм', 'Кол-во', 'Цена', 'Сумма']],
      body: tableBody,
      theme: 'striped',
      styles: {
        font: 'helvetica',
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

    // Итоговая сумма
    autoTable(doc, {
      startY: yPos,
      body: [[
        { content: 'ИТОГО:', styles: { fontStyle: 'bold', fontSize: 14 } },
        { content: `${data.estimate.total.toFixed(2)} руб.`, styles: { fontStyle: 'bold', fontSize: 14, halign: 'right' } },
      ]],
      theme: 'plain',
      styles: {
        font: 'helvetica',
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
          font: 'helvetica',
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
        font: 'helvetica',
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

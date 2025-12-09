import jsPDF from 'jspdf'
import { Customer } from '@/features/customers/models/Customer'
import { Project } from '@/features/projects/models/Project'
import { EstimateResult } from '@/features/projects/estimate/calculators/estimateCalculator'

interface PDFData {
  customer: Customer
  project: Project
  estimate: EstimateResult
  organizationName?: string
}

export class PDFGenerator {
  static generate(data: PDFData): jsPDF {
    const doc = new jsPDF()
    let yPos = 20

    // Заголовок
    doc.setFontSize(18)
    doc.text('Смета на выполнение работ', 105, yPos, { align: 'center' })
    yPos += 15

    // Информация о клиенте
    doc.setFontSize(14)
    doc.text('Информация о клиенте:', 20, yPos)
    yPos += 8

    doc.setFontSize(12)
    doc.text(`ФИО: ${data.customer.fullName}`, 20, yPos)
    yPos += 6
    if (data.customer.address) {
      doc.text(`Адрес: ${data.customer.address}`, 20, yPos)
      yPos += 6
    }
    if (data.customer.phone) {
      doc.text(`Телефон: ${data.customer.phone}`, 20, yPos)
      yPos += 6
    }
    if (data.customer.comment) {
      doc.text(`Комментарий: ${data.customer.comment}`, 20, yPos)
      yPos += 6
    }
    yPos += 5

    // Информация о комнате
    doc.setFontSize(14)
    doc.text('Информация о помещении:', 20, yPos)
    yPos += 8

    doc.setFontSize(12)
    doc.text(`Площадь: ${data.project.area.toFixed(2)} м²`, 20, yPos)
    yPos += 6
    doc.text(`Периметр: ${data.project.perimeter.toFixed(2)} м`, 20, yPos)
    yPos += 6
    doc.text(`Количество углов: ${data.project.points.length}`, 20, yPos)
    yPos += 6
    doc.text(`Количество элементов (светильники и др.): ${data.project.elementCount}`, 20, yPos)
    yPos += 10

    // Таблица сметы
    doc.setFontSize(14)
    doc.text('Смета:', 20, yPos)
    yPos += 8

    // Заголовки таблицы
    doc.setFontSize(10)
    doc.setFont('helvetica', 'bold')
    const colWidths = [80, 20, 20, 25, 30]
    const headers = ['Наименование', 'Ед.изм', 'Кол-во', 'Цена', 'Сумма']
    let xPos = 20

    headers.forEach((header, i) => {
      doc.text(header || '', xPos, yPos)
      xPos += colWidths[i]
    })
    yPos += 6

    doc.setFont('helvetica', 'normal')
    doc.setDrawColor(200, 200, 200)
    doc.line(20, yPos - 2, 195, yPos - 2)

    // Данные сметы
    for (const item of data.estimate.items) {
      // Работа
      if (yPos > 270) {
        doc.addPage()
        yPos = 20
      }

      xPos = 20
      doc.setFont('helvetica', 'bold')
      doc.text(item.workName || '', xPos, yPos)
      yPos += 6

      // Количество и цена работы
      xPos = 20 + colWidths[0]
      doc.setFont('helvetica', 'normal')
      doc.text(item.workUnit || '', xPos, yPos)
      xPos += colWidths[1]
      doc.text(item.workQuantity.toFixed(2), xPos, yPos)
      xPos += colWidths[2]
      doc.text(item.workPrice.toFixed(2), xPos, yPos)
      xPos += colWidths[3]
      doc.text(item.workTotal.toFixed(2), xPos, yPos)
      yPos += 5

      // Материалы для работы
      for (const material of item.materials) {
        if (yPos > 270) {
          doc.addPage()
          yPos = 20
        }

        xPos = 30
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(9)
        doc.text(`  - ${material.materialName || ''}`, xPos, yPos)
        xPos = 20 + colWidths[0]
        doc.text(material.materialUnit || '', xPos, yPos)
        xPos += colWidths[1]
        doc.text(material.materialQuantity.toFixed(2), xPos, yPos)
        xPos += colWidths[2]
        doc.text(material.materialPrice.toFixed(2), xPos, yPos)
        xPos += colWidths[3]
        doc.text(material.materialTotal.toFixed(2), xPos, yPos)
        yPos += 5
      }

      // Итоговая стоимость работы
      if (yPos > 270) {
        doc.addPage()
        yPos = 20
      }

      xPos = 20 + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3]
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(10)
      doc.text(`Итого по работе: ${item.workTotalWithMaterials.toFixed(2)}`, xPos - 30, yPos)
      yPos += 8

      doc.setDrawColor(200, 200, 200)
      doc.line(20, yPos - 2, 195, yPos - 2)
      yPos += 5
    }

    // Итоговая стоимость
    if (yPos > 250) {
      doc.addPage()
      yPos = 20
    }

    yPos += 10
    doc.setFontSize(14)
    doc.setFont('helvetica', 'bold')
    doc.text(`ИТОГО: ${data.estimate.total.toFixed(2)} руб.`, 20, yPos)

    // Название организации (если указано)
    if (data.organizationName) {
      yPos += 15
      doc.setFontSize(10)
      doc.setFont('helvetica', 'normal')
      doc.text(data.organizationName, 105, yPos, { align: 'center' })
    }

    // Дата
    yPos += 10
    doc.setFontSize(10)
    doc.text(`Дата создания: ${new Date().toLocaleDateString('ru-RU')}`, 20, yPos)

    return doc
  }

  static savePDF(doc: jsPDF, filename: string = 'estimate.pdf'): void {
    doc.save(filename)
  }

  static getPDFBlob(doc: jsPDF): Blob {
    return doc.output('blob')
  }
}


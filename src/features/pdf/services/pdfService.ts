import { PDFGenerator } from '../generators/pdfGenerator'
import { Customer } from '@/features/customers/models/Customer'
import { Project } from '@/features/projects/models/Project'
import { EstimateResult } from '@/features/projects/estimate/calculators/estimateCalculator'
import { db } from '@/services/storage/indexedDB'

export const pdfService = {
  async generateAndSave(
    customer: Customer,
    project: Project,
    estimate: EstimateResult,
    organizationName?: string
  ): Promise<Blob> {
    const doc = PDFGenerator.generate({
      customer,
      project,
      estimate,
      organizationName,
    })

    const blob = PDFGenerator.getPDFBlob(doc)

    // Сохраняем в IndexedDB
    if (project.id && customer.id) {
      await db.pdfDocuments.add({
        projectId: String(project.id),
        userId: project.userId,
        blob,
        createdAt: new Date().toISOString(),
      })
    }

    return blob
  },

  async downloadPDF(
    customer: Customer,
    project: Project,
    estimate: EstimateResult,
    organizationName?: string
  ): Promise<void> {
    const doc = PDFGenerator.generate({
      customer,
      project,
      estimate,
      organizationName,
    })

    const filename = `Смета_${customer.fullName}_${new Date().toISOString().split('T')[0]}.pdf`
    PDFGenerator.savePDF(doc, filename)
  },
}


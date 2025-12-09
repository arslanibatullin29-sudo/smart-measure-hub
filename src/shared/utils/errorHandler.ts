import { toast } from 'sonner'

export function handleError(error: any, context: string, userMessage?: string) {
  const errorDetails = {
    message: error?.message,
    code: error?.code,
    details: error?.details,
    hint: error?.hint
  }
  console.error(`${context}:`, errorDetails, error)
  
  const displayMessage = userMessage || 
    error?.message || 
    (error?.code ? `Ошибка ${error.code}` : 'Неизвестная ошибка')
  
  toast.error(displayMessage)
}

export function handleSuccess(message: string) {
  toast.success(message)
}

export function handleInfo(message: string) {
  toast.info(message)
}

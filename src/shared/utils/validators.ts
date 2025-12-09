export const validators = {
  isNotEmpty: (value: string): boolean => {
    return value !== undefined && value !== null && value.trim() !== ''
  },
  
  isPositiveNumber: (value: any): boolean => {
    if (value === '' || value === undefined || value === null) return true // Пустые значения разрешены
    const num = parseFloat(value)
    return !isNaN(num) && num >= 0
  },
  
  isValidNumber: (value: any): boolean => {
    if (value === '' || value === undefined || value === null) return true
    return !isNaN(parseFloat(value))
  }
}

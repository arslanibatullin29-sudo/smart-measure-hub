import { cn } from '@/lib/utils'

interface CalculationTypeSelectProps {
  value: 'byArea' | 'byPerimeter' | 'byCount' | string
  onChange: (value: 'byArea' | 'byPerimeter' | 'byCount') => void
  className?: string
}

export function CalculationTypeSelect({ value, onChange, className }: CalculationTypeSelectProps) {
  // Если className уже содержит стили границ, не добавляем дефолтные
  const hasCustomBorder = className?.includes('border-') || className?.includes('rounded-')
  const defaultClasses = hasCustomBorder
    ? 'flex h-9 w-full px-2 py-1 text-sm'
    : 'flex h-9 w-full rounded-md border border-input bg-background px-2 py-1 text-sm hover:border-primary/30 focus:border-primary focus-visible:ring-1 focus-visible:ring-primary focus:outline-none'
  
  return (
    <select
      value={value || 'byArea'}
      onChange={(e) => onChange(e.target.value as 'byArea' | 'byPerimeter' | 'byCount')}
      className={cn(defaultClasses, className)}
    >
      <option value="byArea">По площади</option>
      <option value="byPerimeter">По периметру</option>
      <option value="byCount">По количеству</option>
    </select>
  )
}

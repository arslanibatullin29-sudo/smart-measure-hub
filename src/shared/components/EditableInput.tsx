import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { ComponentProps } from 'react'

interface EditableInputProps extends Omit<ComponentProps<typeof Input>, 'className'> {
  className?: string
  editableClassName?: string
}

export function EditableInput({ className, editableClassName, ...props }: EditableInputProps) {
  // Если className уже содержит стили границ, не добавляем дефолтные
  const hasCustomBorder = className?.includes('border-') || className?.includes('rounded-')
  const defaultEditableClasses = hasCustomBorder 
    ? '' 
    : 'border border-transparent hover:border-primary/30 focus:border-primary focus-visible:ring-1 focus-visible:ring-primary bg-background'
  
  return (
    <Input
      {...props}
      className={cn(defaultEditableClasses, editableClassName, className)}
    />
  )
}

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'

interface UnitSelectProps {
  value: string
  onChange: (value: string) => void
  className?: string
}

export function UnitSelect({ value, onChange, className }: UnitSelectProps) {
  return (
    <Select value={value || 'шт'} onValueChange={onChange}>
      <SelectTrigger className={cn('w-full', className)}>
        <SelectValue placeholder="Ед.изм" />
      </SelectTrigger>
      <SelectContent className="bg-background border">
        <SelectItem value="шт">шт</SelectItem>
        <SelectItem value="м">м</SelectItem>
        <SelectItem value="см">см</SelectItem>
      </SelectContent>
    </Select>
  )
}

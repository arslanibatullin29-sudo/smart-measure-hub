import { useState, useEffect, useRef } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Check, X } from 'lucide-react'

interface DiagonalLengthInputProps {
  currentLength: number // в метрах
  diagonalIndex: number
  onSubmit: (newLength: number, diagonalIndex: number) => void
  onCancel: () => void
  position: { x: number; y: number }
}

export function DiagonalLengthInput({ 
  currentLength, 
  diagonalIndex,
  onSubmit, 
  onCancel, 
  position 
}: DiagonalLengthInputProps) {
  const [value, setValue] = useState(currentLength.toFixed(2))
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
    inputRef.current?.select()
  }, [])

  const handleSubmit = () => {
    const newLength = parseFloat(value)
    if (!isNaN(newLength) && newLength > 0) {
      onSubmit(newLength, diagonalIndex)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSubmit()
    } else if (e.key === 'Escape') {
      onCancel()
    }
  }

  return (
    <div 
      className="absolute z-50 flex items-center gap-1 bg-background border-2 border-warning rounded-lg shadow-lg p-1.5 animate-scale-in"
      style={{ 
        left: position.x, 
        top: position.y,
        transform: 'translate(-50%, -50%)'
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <Input
        ref={inputRef}
        type="number"
        step="0.01"
        min="0.01"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        className="w-20 h-8 text-sm text-center"
        placeholder="м"
      />
      <span className="text-xs text-muted-foreground">м</span>
      <Button 
        size="sm" 
        variant="ghost" 
        className="h-8 w-8 p-0 touch-manipulation"
        onClick={handleSubmit}
      >
        <Check className="w-4 h-4 text-success" />
      </Button>
      <Button 
        size="sm" 
        variant="ghost" 
        className="h-8 w-8 p-0 touch-manipulation"
        onClick={onCancel}
      >
        <X className="w-4 h-4 text-destructive" />
      </Button>
    </div>
  )
}

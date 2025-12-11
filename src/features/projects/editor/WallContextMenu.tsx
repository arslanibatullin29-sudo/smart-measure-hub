import { Button } from '@/components/ui/button'
import { Ruler, Plus, X } from 'lucide-react'

interface WallContextMenuProps {
  position: { x: number; y: number }
  onSetSize: () => void
  onAddPoint: () => void
  onClose: () => void
}

export function WallContextMenu({ position, onSetSize, onAddPoint, onClose }: WallContextMenuProps) {
  return (
    <div
      className="absolute z-50 bg-popover border border-border rounded-lg shadow-lg p-1 flex flex-col gap-1 min-w-[140px]"
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
        transform: 'translate(-50%, -50%)'
      }}
    >
      <Button
        variant="ghost"
        size="sm"
        className="justify-start h-10 px-3 touch-manipulation"
        onClick={onSetSize}
      >
        <Ruler className="w-4 h-4 mr-2" />
        Задать размер
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className="justify-start h-10 px-3 touch-manipulation"
        onClick={onAddPoint}
      >
        <Plus className="w-4 h-4 mr-2" />
        Добавить точку
      </Button>
      <div className="border-t border-border my-1" />
      <Button
        variant="ghost"
        size="sm"
        className="justify-start h-10 px-3 text-muted-foreground touch-manipulation"
        onClick={onClose}
      >
        <X className="w-4 h-4 mr-2" />
        Отмена
      </Button>
    </div>
  )
}

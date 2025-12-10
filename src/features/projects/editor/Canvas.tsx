import { useRef, useState, useEffect, useCallback } from 'react'
import { calculateArea, calculatePerimeter } from '@/core/utils/geometry'
import { Button } from '@/components/ui/button'
import { Undo2, Trash2, Check, MousePointer, ZoomIn, ZoomOut, Maximize2 } from 'lucide-react'

interface Point {
  x: number
  y: number
}

interface CanvasProps {
  points: Point[]
  onPointsChange: (points: Point[]) => void
  onAreaChange?: (area: number) => void
  onPerimeterChange?: (perimeter: number) => void
  width?: number
  height?: number
  scale?: number // пикселей на см (1 пиксель = 1 см по умолчанию)
}

function Canvas({ 
  points, 
  onPointsChange, 
  onAreaChange, 
  onPerimeterChange,
  width,
  height,
  scale = 1 // 1 пиксель = 1 см (стандартный масштаб для комнат)
}: CanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  // Увеличиваем размер canvas для больших помещений (20x15 метров = 2000x1500 пикселей)
  const [canvasSize, setCanvasSize] = useState({ 
    width: width || 2000, 
    height: height || 1500 
  })
  const [zoom, setZoom] = useState(1) // Уровень зума
  const [pan, setPan] = useState({ x: 0, y: 0 }) // Смещение для pan
  const [isPanning, setIsPanning] = useState(false)
  const [lastPanPoint, setLastPanPoint] = useState<Point | null>(null)
  const [touchDistance, setTouchDistance] = useState<number | null>(null)
  const [touchStartPos, setTouchStartPos] = useState<Point | null>(null) // For tap detection on mobile
  const [touchStartTime, setTouchStartTime] = useState<number>(0) // For tap timing on mobile

  // Адаптивный размер canvas - используем фиксированный большой размер для больших помещений
  useEffect(() => {
    // Canvas имеет фиксированный размер для работы с большими помещениями
    // Реальный размер отображается через CSS, а логический размер canvas остается большим
    if (width && height) {
      setCanvasSize({ width, height })
    }
    // Не обновляем размер при изменении окна - canvas должен быть большим для точности
  }, [width, height])
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [hoveredPoint, setHoveredPoint] = useState<number | null>(null)
  const [draggedPoint, setDraggedPoint] = useState<number | null>(null)

  // Функция для получения реального значения цвета из CSS переменной
  const getCSSColor = useCallback((varName: string): string => {
    if (typeof window === 'undefined') return 'hsl(220, 60%, 45%)'
    const root = document.documentElement
    const value = getComputedStyle(root).getPropertyValue(varName).trim()
    if (!value) return 'hsl(220, 60%, 45%)'
    // Преобразуем "220 60% 45%" в "hsl(220, 60%, 45%)"
    return `hsl(${value})`
  }, [])

  const drawCanvas = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Clear canvas
    ctx.clearRect(0, 0, canvasSize.width, canvasSize.height)

    // Draw grid с шагом 1 см (10 пикселей при scale=1) для видимости
    // Точная привязка будет к 0.1 см (1 пиксель) при добавлении точек
    ctx.strokeStyle = getCSSColor('--canvas-grid')
    ctx.lineWidth = 0.5
    
    // Применяем трансформацию для zoom и pan
    ctx.save()
    ctx.translate(pan.x, pan.y)
    ctx.scale(zoom, zoom)
    
    // Сетка с шагом 10 пикселей (1 см) для видимости
    const gridSize = 10 // 10 пикселей = 1 см при scale=1
    
    // Вычисляем видимую область с учетом zoom и pan
    // pan уже в логических координатах canvas
    // Видимая область в логических координатах: от -pan/zoom до (canvasSize - pan)/zoom
    const visibleStartX = -pan.x / zoom
    const visibleEndX = (canvasSize.width - pan.x) / zoom
    const visibleStartY = -pan.y / zoom
    const visibleEndY = (canvasSize.height - pan.y) / zoom
    
    // Рисуем сетку на весь canvas, но только видимую часть для производительности
    const startX = Math.max(0, Math.floor(visibleStartX / gridSize) * gridSize)
    const endX = Math.min(canvasSize.width, Math.ceil(visibleEndX / gridSize) * gridSize)
    const startY = Math.max(0, Math.floor(visibleStartY / gridSize) * gridSize)
    const endY = Math.min(canvasSize.height, Math.ceil(visibleEndY / gridSize) * gridSize)
    
    // Рисуем только видимую часть сетки для производительности
    for (let x = startX; x <= endX; x += gridSize) {
      ctx.beginPath()
      ctx.moveTo(x, 0)
      ctx.lineTo(x, canvasSize.height)
      ctx.stroke()
    }
    
    for (let y = startY; y <= endY; y += gridSize) {
      ctx.beginPath()
      ctx.moveTo(0, y)
      ctx.lineTo(canvasSize.width, y)
      ctx.stroke()
    }
    
    // Дополнительно рисуем более тонкую сетку с шагом 1 пиксель (0.1 см) при большом зуме
    if (zoom >= 2) {
      ctx.strokeStyle = getCSSColor('--canvas-grid')
      ctx.globalAlpha = 0.3
      ctx.lineWidth = 0.3
      const fineGridSize = 1 // 1 пиксель = 0.1 см
      
      for (let x = startX; x <= endX; x += fineGridSize) {
        if (x % gridSize !== 0) { // Пропускаем линии основной сетки
          ctx.beginPath()
          ctx.moveTo(x, 0)
          ctx.lineTo(x, canvasSize.height)
          ctx.stroke()
        }
      }
      
      for (let y = startY; y <= endY; y += fineGridSize) {
        if (y % gridSize !== 0) { // Пропускаем линии основной сетки
          ctx.beginPath()
          ctx.moveTo(0, y)
          ctx.lineTo(canvasSize.width, y)
          ctx.stroke()
        }
      }
      ctx.globalAlpha = 1
    }

    if (points.length === 0) {
      ctx.restore()
      return
    }

    // Draw filled polygon
    if (points.length >= 3) {
      ctx.beginPath()
      ctx.moveTo(points[0].x, points[0].y)
      points.slice(1).forEach((point) => {
        ctx.lineTo(point.x, point.y)
      })
      ctx.closePath()
      ctx.fillStyle = 'hsla(220, 60%, 35%, 0.15)'
      ctx.fill()
    }

    // Draw lines (толщина линии должна масштабироваться обратно пропорционально zoom)
    ctx.strokeStyle = getCSSColor('--canvas-line')
    ctx.lineWidth = 2 / zoom
    ctx.beginPath()
    ctx.moveTo(points[0].x, points[0].y)
    points.slice(1).forEach((point) => {
      ctx.lineTo(point.x, point.y)
    })
    if (points.length >= 3) {
      ctx.closePath()
    }
    ctx.stroke()

    // Draw edge lengths with better visibility
    ctx.font = 'bold 13px Inter, sans-serif'
    
    for (let i = 0; i < points.length; i++) {
      const next = (i + 1) % points.length
      if (next === 0 && points.length < 3) continue
      
      const p1 = points[i]
      const p2 = points[next]
      const midX = (p1.x + p2.x) / 2
      const midY = (p1.y + p2.y) / 2
      // Длина в пикселях (1 пиксель = 1 см при scale=1)
      const lengthInPixels = Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2))
      // Конвертируем в метры: пиксели / scale / 100
      const lengthInMeters = lengthInPixels / scale / 100
      // Форматируем: если меньше 1 метра, показываем в см, иначе в метрах
      const lengthText = lengthInMeters >= 1 
        ? `${lengthInMeters.toFixed(2)} м`
        : `${(lengthInMeters * 100).toFixed(0)} см`
      
      // Measure text width for better background
      ctx.font = 'bold 13px Inter, sans-serif'
      const textMetrics = ctx.measureText(lengthText)
      const textWidth = textMetrics.width
      const textHeight = 18
      const padding = 8
      
      ctx.save()
      
      // Draw background with border for better visibility
      ctx.fillStyle = getCSSColor('--background')
      ctx.strokeStyle = getCSSColor('--canvas-line')
      ctx.lineWidth = 2 / zoom
      ctx.fillRect(
        midX - textWidth / 2 - padding, 
        midY - textHeight / 2 - padding / 2, 
        textWidth + padding * 2, 
        textHeight + padding
      )
      ctx.strokeRect(
        midX - textWidth / 2 - padding, 
        midY - textHeight / 2 - padding / 2, 
        textWidth + padding * 2, 
        textHeight + padding
      )
      
      // Draw text
      ctx.fillStyle = getCSSColor('--canvas-line')
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(lengthText, midX, midY)
      
      ctx.restore()
    }

    // Draw points with improved visibility
    points.forEach((point, index) => {
      const isHovered = hoveredPoint === index
      const isDragged = draggedPoint === index
      const pointRadius = isDragged ? 12 : isHovered ? 11 : 9 // Увеличен размер точек
      
      ctx.save()
      
      // Внешнее кольцо для лучшей видимости
      if (isHovered || isDragged) {
        const pointColor = getCSSColor('--canvas-point')
        // Преобразуем hsl в hsla для прозрачности
        const pointColorWithAlpha = pointColor.replace('hsl(', 'hsla(').replace(')', `, ${isDragged ? 0.2 : 0.15})`)
        ctx.beginPath()
        ctx.arc(point.x, point.y, pointRadius + 4, 0, Math.PI * 2)
        ctx.fillStyle = pointColorWithAlpha
        ctx.fill()
      }
      
      // Тень для глубины
      ctx.shadowColor = 'hsla(0, 0%, 0%, 0.3)'
      ctx.shadowBlur = isDragged ? 8 : isHovered ? 6 : 4
      ctx.shadowOffsetX = 0
      ctx.shadowOffsetY = 2
      
      // Основной круг точки
      ctx.beginPath()
      ctx.arc(point.x, point.y, pointRadius, 0, Math.PI * 2)
      
      // Градиент для лучшего визуального эффекта
      const gradient = ctx.createRadialGradient(
        point.x - pointRadius * 0.3, 
        point.y - pointRadius * 0.3, 
        0,
        point.x, 
        point.y, 
        pointRadius
      )
      
      const pointColor = getCSSColor('--canvas-point')
      const lineColor = getCSSColor('--canvas-line')
      
      if (isDragged) {
        gradient.addColorStop(0, pointColor)
        gradient.addColorStop(0.7, pointColor)
        gradient.addColorStop(1, lineColor)
        ctx.fillStyle = gradient
      } else if (isHovered) {
        gradient.addColorStop(0, pointColor)
        gradient.addColorStop(0.6, pointColor)
        gradient.addColorStop(1, lineColor)
        ctx.fillStyle = gradient
      } else {
        ctx.fillStyle = lineColor
      }
      
      ctx.fill()
      
      // Белая обводка для контраста
      ctx.strokeStyle = getCSSColor('--background')
      ctx.lineWidth = isDragged ? 3 : isHovered ? 2.5 : 2
      ctx.stroke()
      
      ctx.restore()

      // Номер точки с улучшенной видимостью
      ctx.save()
      ctx.font = isDragged || isHovered 
        ? 'bold 12px Inter, sans-serif' 
        : 'bold 11px Inter, sans-serif'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      
      // Тень для текста
      ctx.shadowColor = 'hsla(0, 0%, 0%, 0.5)'
      ctx.shadowBlur = 2
      ctx.shadowOffsetX = 0
      ctx.shadowOffsetY = 1
      
      ctx.fillStyle = getCSSColor('--background')
      ctx.fillText(`${index + 1}`, point.x, point.y)
      ctx.restore()
    })
    
    ctx.restore() // Восстанавливаем трансформацию
  }, [points, canvasSize.width, canvasSize.height, scale, hoveredPoint, draggedPoint, zoom, pan, getCSSColor])

  useEffect(() => {
    drawCanvas()
  }, [drawCanvas])

  useEffect(() => {
    if (points.length >= 3) {
      // Конвертируем координаты из пикселей в метры
      // scale: пикселей на см (по умолчанию 1 пиксель = 1 см)
      // Формула Shoelace возвращает площадь в квадратных пикселях
      // 1 пиксель = 1 см (при scale=1), значит 1 пиксель² = 1 см²
      // 1 см² = 0.0001 м², значит площадь в м² = площадь в пикселях² / 10000
      const areaInPixels = calculateArea(points)
      const perimeterInPixels = calculatePerimeter(points)
      
      // Конвертация в метры
      // Площадь: пиксели² → см² → м²
      // При scale=1: 1 пиксель = 1 см, значит 1 пиксель² = 1 см² = 0.0001 м²
      // Площадь в м² = площадь в пикселях² / (scale²) / 10000
      const areaInSquareMeters = areaInPixels / (scale * scale) / 10000
      
      // Периметр: пиксели → см → м
      // При scale=1: 1 пиксель = 1 см = 0.01 м
      // Периметр в м = периметр в пикселях / scale / 100
      const perimeterInMeters = perimeterInPixels / scale / 100
      
      onAreaChange?.(areaInSquareMeters)
      onPerimeterChange?.(perimeterInMeters)
    }
  }, [points, scale, onAreaChange, onPerimeterChange])

  const getCanvasCoords = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>): Point => {
    const canvas = canvasRef.current
    if (!canvas) return { x: 0, y: 0 }

    const rect = canvas.getBoundingClientRect()
    const clientX = 'touches' in e ? e.touches[0]?.clientX || 0 : e.clientX
    const clientY = 'touches' in e ? e.touches[0]?.clientY || 0 : e.clientY
    
    // Масштаб между логическим размером canvas и отображаемым размером
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    
    // Координаты относительно видимого canvas
    const viewX = clientX - rect.left
    const viewY = clientY - rect.top
    
    // Конвертируем в логические координаты canvas с учетом CSS масштабирования
    const logicalX = viewX * scaleX
    const logicalY = viewY * scaleY
    
    // Применяем обратную трансформацию zoom и pan
    // pan уже в логических координатах canvas
    const x = (logicalX - pan.x) / zoom
    const y = (logicalY - pan.y) / zoom
    
    return { x, y }
  }
  
  const getTouchDistance = (touch1: React.Touch, touch2: React.Touch): number => {
    const dx = touch2.clientX - touch1.clientX
    const dy = touch2.clientY - touch1.clientY
    return Math.sqrt(dx * dx + dy * dy)
  }
  
  const getTouchCenter = (touch1: React.Touch, touch2: React.Touch): Point => {
    const canvas = canvasRef.current
    if (!canvas) return { x: 0, y: 0 }
    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    
    const viewX = (touch1.clientX + touch2.clientX) / 2 - rect.left
    const viewY = (touch1.clientY + touch2.clientY) / 2 - rect.top
    
    return {
      x: viewX * scaleX,
      y: viewY * scaleY,
    }
  }

  const findPointAtPosition = (pos: Point): number | null => {
    // Адаптивный порог с учетом zoom - при большом зуме нужен больший порог в реальных координатах
    const baseThreshold = 20 / zoom // Базовый порог в пикселях, адаптированный к zoom
    const threshold = Math.max(baseThreshold, 15) // Минимум 15 пикселей для удобства
    for (let i = 0; i < points.length; i++) {
      const dx = points[i].x - pos.x
      const dy = points[i].y - pos.y
      if (Math.sqrt(dx * dx + dy * dy) < threshold) {
        return i
      }
    }
    return null
  }

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    // Проверяем, не нажата ли средняя кнопка мыши или пробел для pan
    if (e.button === 1 || e.ctrlKey || e.metaKey) {
      setIsPanning(true)
      // Сохраняем координаты в экранных координатах для расчета дельты
      setLastPanPoint({ x: e.clientX, y: e.clientY })
      return
    }
    
    const pos = getCanvasCoords(e)
    
    // Привязка к сетке с шагом 0.1 см (1 пиксель) для точности
    const snapToGrid = (value: number) => Math.round(value)
    const snappedPos = {
      x: snapToGrid(pos.x),
      y: snapToGrid(pos.y)
    }
    
    const pointIndex = findPointAtPosition(snappedPos)

    if (pointIndex !== null) {
      // Двойной клик для удаления точки
      if (e.detail === 2) {
        const newPoints = points.filter((_, index) => index !== pointIndex)
        onPointsChange(newPoints)
      } else {
        setDraggedPoint(pointIndex)
      }
    } else {
      onPointsChange([...points, snappedPos])
    }
  }
  
  const handleTouchStart = (e: React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault()
    e.stopPropagation()
    
    if (e.touches.length === 2) {
      // Два пальца - начало pinch-to-zoom
      const distance = getTouchDistance(e.touches[0], e.touches[1])
      setTouchDistance(distance)
      const center = getTouchCenter(e.touches[0], e.touches[1])
      setLastPanPoint(center)
      setTouchStartPos(null) // Cancel tap detection
      setTouchStartTime(0)
    } else if (e.touches.length === 1) {
      const pos = getCanvasCoords(e)
      const pointIndex = findPointAtPosition(pos)
      const touch = e.touches[0]
      
      // Save touch start position and time for tap detection
      setTouchStartPos({ x: touch.clientX, y: touch.clientY })
      setTouchStartTime(Date.now())
      
      if (pointIndex !== null) {
        setDraggedPoint(pointIndex)
        setTouchStartPos(null) // Cancel tap when dragging point
      } else {
        // Prepare for potential pan (will start if finger moves)
        setLastPanPoint({ x: touch.clientX, y: touch.clientY })
      }
    }
  }
  
  const handleContextMenu = (e: React.MouseEvent<HTMLCanvasElement>) => {
    e.preventDefault()
    const pos = getCanvasCoords(e)
    const pointIndex = findPointAtPosition(pos)
    
    if (pointIndex !== null && points.length > 0) {
      const newPoints = points.filter((_, index) => index !== pointIndex)
      onPointsChange(newPoints)
    }
  }

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (isPanning && lastPanPoint) {
      // Pan в логических координатах canvas
      const canvas = canvasRef.current
      if (canvas) {
        const rect = canvas.getBoundingClientRect()
        const scaleX = canvas.width / rect.width
        const scaleY = canvas.height / rect.height
        
        const currentViewX = e.clientX - rect.left
        const currentViewY = e.clientY - rect.top
        const lastViewX = lastPanPoint.x - rect.left
        const lastViewY = lastPanPoint.y - rect.top
        
        const deltaX = (currentViewX - lastViewX) * scaleX
        const deltaY = (currentViewY - lastViewY) * scaleY
        
        setPan(prev => ({ x: prev.x + deltaX, y: prev.y + deltaY }))
      }
      setLastPanPoint({ x: e.clientX, y: e.clientY })
      return
    }
    
    const pos = getCanvasCoords(e)

    if (draggedPoint !== null) {
      // Привязка к сетке при перетаскивании
      const snapToGrid = (value: number) => Math.round(value)
      const snappedPos = {
        x: snapToGrid(pos.x),
        y: snapToGrid(pos.y)
      }
      const newPoints = [...points]
      newPoints[draggedPoint] = snappedPos
      onPointsChange(newPoints)
    } else {
      const foundPoint = findPointAtPosition(pos)
      setHoveredPoint(foundPoint)
      // Изменяем курсор при наведении на точку
      if (canvasRef.current) {
        canvasRef.current.style.cursor = foundPoint !== null ? 'grab' : 'crosshair'
      }
    }
  }
  
  const handleTouchMove = (e: React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault()
    
    if (e.touches.length === 2 && touchDistance !== null && lastPanPoint) {
      // Pinch-to-zoom
      const newDistance = getTouchDistance(e.touches[0], e.touches[1])
      const scaleChange = newDistance / touchDistance
      const newZoom = Math.max(0.1, Math.min(5, zoom * scaleChange))
      
      const center = getTouchCenter(e.touches[0], e.touches[1])
      const zoomFactor = newZoom / zoom
      
      setPan(prev => ({
        x: center.x - (center.x - prev.x) * zoomFactor,
        y: center.y - (center.y - prev.y) * zoomFactor,
      }))
      
      setZoom(newZoom)
      setTouchDistance(newDistance)
      setLastPanPoint(center)
    } else if (e.touches.length === 1 && lastPanPoint) {
      const touch = e.touches[0]
      
      // Check if finger moved enough to start panning (threshold 10px)
      if (touchStartPos) {
        const dx = touch.clientX - touchStartPos.x
        const dy = touch.clientY - touchStartPos.y
        const moved = Math.sqrt(dx * dx + dy * dy)
        if (moved > 10) {
          setIsPanning(true)
          setTouchStartPos(null) // Cancel tap - this is a pan/drag
        }
      }
      
      if (isPanning) {
        // Pan одним пальцем в логических координатах
        const canvas = canvasRef.current
        if (canvas) {
          const rect = canvas.getBoundingClientRect()
          const scaleX = canvas.width / rect.width
          const scaleY = canvas.height / rect.height
          
          const currentViewX = touch.clientX - rect.left
          const currentViewY = touch.clientY - rect.top
          const lastViewX = lastPanPoint.x - rect.left
          const lastViewY = lastPanPoint.y - rect.top
          
          const deltaX = (currentViewX - lastViewX) * scaleX
          const deltaY = (currentViewY - lastViewY) * scaleY
          
          setPan(prev => ({ x: prev.x + deltaX, y: prev.y + deltaY }))
        }
        setLastPanPoint({ x: touch.clientX, y: touch.clientY })
      }
    } else if (e.touches.length === 1 && draggedPoint !== null) {
      // Перемещение точки с привязкой к сетке
      const pos = getCanvasCoords(e)
      const snapToGrid = (value: number) => Math.round(value)
      const snappedPos = {
        x: snapToGrid(pos.x),
        y: snapToGrid(pos.y)
      }
      const newPoints = [...points]
      newPoints[draggedPoint] = snappedPos
      onPointsChange(newPoints)
    }
  }

  const handleMouseUp = () => {
    setIsPanning(false)
    setLastPanPoint(null)
    if (draggedPoint !== null) {
      setDraggedPoint(null)
      if (canvasRef.current) {
        canvasRef.current.style.cursor = 'crosshair'
      }
    }
  }
  
  const handleTouchEnd = (e: React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault()
    e.stopPropagation()
    
    if (e.touches.length === 0) {
      const tapDuration = Date.now() - touchStartTime
      const isTap = tapDuration < 300 // Tap should be less than 300ms
      
      // If touchStartPos is set, we weren't panning/dragging, and it was a quick tap - add point
      if (touchStartPos && !isPanning && draggedPoint === null && isTap) {
        // Get canvas coordinates from the last touch position
        const canvas = canvasRef.current
        if (canvas) {
          const rect = canvas.getBoundingClientRect()
          const scaleX = canvas.width / rect.width
          const scaleY = canvas.height / rect.height
          
          const viewX = touchStartPos.x - rect.left
          const viewY = touchStartPos.y - rect.top
          const logicalX = viewX * scaleX
          const logicalY = viewY * scaleY
          
          const x = (logicalX - pan.x) / zoom
          const y = (logicalY - pan.y) / zoom
          
          // Snap to grid
          const snappedPos = {
            x: Math.round(x),
            y: Math.round(y)
          }
          
          // Only add if not clicking on existing point and within canvas bounds
          if (snappedPos.x >= 0 && snappedPos.y >= 0 && 
              snappedPos.x <= canvasSize.width && snappedPos.y <= canvasSize.height) {
            const existingPoint = findPointAtPosition(snappedPos)
            if (existingPoint === null) {
              // Haptic feedback for mobile
              if (navigator.vibrate) {
                navigator.vibrate(10)
              }
              onPointsChange([...points, snappedPos])
            }
          }
        }
      }
      
      setIsPanning(false)
      setTouchDistance(null)
      setLastPanPoint(null)
      setTouchStartPos(null)
      setTouchStartTime(0)
      if (draggedPoint !== null) {
        setDraggedPoint(null)
      }
    } else if (e.touches.length === 1) {
      // Переключаемся на pan одним пальцем
      setIsPanning(true)
      const touch = e.touches[0]
      setLastPanPoint({ x: touch.clientX, y: touch.clientY })
      setTouchDistance(null)
      setTouchStartPos(null)
      setTouchStartTime(0)
    }
  }
  
  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault()
    const delta = e.deltaY > 0 ? 0.9 : 1.1
    const newZoom = Math.max(0.1, Math.min(5, zoom * delta))
    
    const canvas = canvasRef.current
    const rect = canvas?.getBoundingClientRect()
    if (canvas && rect) {
      const scaleX = canvas.width / rect.width
      const scaleY = canvas.height / rect.height
      
      const viewX = e.clientX - rect.left
      const viewY = e.clientY - rect.top
      const logicalX = viewX * scaleX
      const logicalY = viewY * scaleY
      
      const zoomFactor = newZoom / zoom
      setPan(prev => ({
        x: logicalX - (logicalX - prev.x) * zoomFactor,
        y: logicalY - (logicalY - prev.y) * zoomFactor,
      }))
    }
    
    setZoom(newZoom)
  }
  
  const handleZoomIn = () => {
    const newZoom = Math.min(5, zoom * 1.2)
    setZoom(newZoom)
  }
  
  const handleZoomOut = () => {
    const newZoom = Math.max(0.1, zoom / 1.2)
    setZoom(newZoom)
  }
  
  const handleResetZoom = () => {
    setZoom(1)
    setPan({ x: 0, y: 0 })
  }

  const handleUndo = () => {
    if (points.length > 0) {
      onPointsChange(points.slice(0, -1))
    }
  }

  const handleClear = () => {
    onPointsChange([])
  }

  // Вычисляем площадь и периметр с учетом масштаба для отображения
  const area = points.length >= 3 
    ? calculateArea(points) / (scale * scale) / 10000 
    : 0
  const perimeter = points.length >= 2 
    ? calculatePerimeter(points) / scale / 100 
    : 0

  return (
    <div className="flex flex-col gap-2 sm:gap-4">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-2">
        <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={handleUndo}
            disabled={points.length === 0}
            className="h-10 sm:h-9 px-3 sm:px-2 touch-manipulation"
          >
            <Undo2 className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
            <span className="hidden sm:inline ml-1.5">Отменить</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleClear}
            disabled={points.length === 0}
            className="h-10 sm:h-9 px-3 sm:px-2 touch-manipulation"
          >
            <Trash2 className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
            <span className="hidden sm:inline ml-1.5">Очистить</span>
          </Button>
          
          {/* Zoom controls */}
          <div className="flex items-center gap-0.5 sm:gap-1 border rounded-md p-0.5 sm:p-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleZoomOut}
              className="h-10 w-10 sm:h-8 sm:w-8 p-0 touch-manipulation"
              title="Уменьшить"
            >
              <ZoomOut className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
            </Button>
            <div className="px-1.5 sm:px-2 text-xs font-mono min-w-[2.5rem] sm:min-w-[3rem] text-center">
              {Math.round(zoom * 100)}%
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleZoomIn}
              className="h-10 w-10 sm:h-8 sm:w-8 p-0 touch-manipulation"
              title="Увеличить"
            >
              <ZoomIn className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleResetZoom}
              className="h-10 w-10 sm:h-8 sm:w-8 p-0 touch-manipulation"
              title="Сбросить масштаб"
            >
              <Maximize2 className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
            </Button>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-4 text-xs sm:text-sm flex-wrap">
          <div className="flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-1.5 bg-muted rounded-lg">
            <span className="text-muted-foreground text-xs sm:text-sm">Площадь:</span>
            <span className="font-mono font-semibold text-xs sm:text-sm">{area.toFixed(2)} м²</span>
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-1.5 bg-muted rounded-lg">
            <span className="text-muted-foreground text-xs sm:text-sm">Периметр:</span>
            <span className="font-mono font-semibold text-xs sm:text-sm">{perimeter.toFixed(2)} м.п.</span>
          </div>
        </div>
      </div>

      {/* Canvas */}
      <div 
        ref={containerRef}
        className="relative rounded-lg sm:rounded-xl overflow-hidden border border-border shadow-md bg-[hsl(var(--canvas-bg))] w-full"
        style={{ maxHeight: '60vh', minHeight: '300px' }}
      >
        <canvas
          ref={canvasRef}
          width={canvasSize.width}
          height={canvasSize.height}
          className="cursor-crosshair block touch-none"
          style={{ 
            width: '100%', 
            height: 'auto',
            maxWidth: '100%',
            display: 'block'
          }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onContextMenu={handleContextMenu}
          onWheel={handleWheel}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        />
        
        {/* Hint overlay */}
        {points.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="flex flex-col items-center gap-2 text-muted-foreground animate-fade-in">
              <MousePointer className="w-8 h-8" />
              <p className="text-sm">Кликните для добавления точек плана</p>
            </div>
          </div>
        )}
      </div>

      {/* Points info */}
      {points.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 text-xs sm:text-sm text-muted-foreground">
          <Check className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-success flex-shrink-0" />
          <span>Точек: {points.length}</span>
          {points.length >= 3 && (
            <span className="text-success">• Замкнут</span>
          )}
          <span className="text-xs opacity-70 hidden sm:inline">
            • Двойной клик или ПКМ по точке для удаления
          </span>
          <span className="text-xs opacity-70 hidden sm:inline">
            • Колесо мыши или два пальца для зума • Ctrl+перетаскивание для перемещения
          </span>
          <span className="text-xs opacity-70 sm:hidden">
            • Два пальца для зума • Один палец для перемещения
          </span>
        </div>
      )}
    </div>
  )
}

export default Canvas

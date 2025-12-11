import { useRef, useState, useEffect, useCallback } from 'react'
import { calculateArea, calculatePerimeter } from '@/core/utils/geometry'
import { 
  findNearestWallIndex, 
  lineLength, 
  resizeWall, 
  getRoomDiagonals, 
  resizeDiagonal,
  addPointOnWall,
  distanceToLine,
  wouldCauseIntersection
} from '@/core/utils/canvasGeometry'
import { Button } from '@/components/ui/button'
import { Undo2, Trash2, Check, MousePointer, ZoomIn, ZoomOut, Maximize2 } from 'lucide-react'
import { WallLengthInput } from './WallLengthInput'
import { DiagonalLengthInput } from './DiagonalLengthInput'
import { WallContextMenu } from './WallContextMenu'
import { toast } from 'sonner'

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
  scale?: number
}

// Logical world size - large enough for rooms up to 100m (100m = 10000cm = 10000px at scale=1)
// Using 30000x30000 to allow for very large spaces with margins
const WORLD_SIZE = 30000

function Canvas({ 
  points, 
  onPointsChange, 
  onAreaChange, 
  onPerimeterChange,
  width,
  height,
  scale = 1
}: CanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  // Display canvas size (matches container for sharp rendering)
  const [canvasSize, setCanvasSize] = useState({ 
    width: width || 800, 
    height: height || 600 
  })
  const [zoom, setZoom] = useState(0.5) // Start at reasonable zoom level
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [isPanning, setIsPanning] = useState(false)
  const [lastPanPoint, setLastPanPoint] = useState<Point | null>(null)
  const [touchDistance, setTouchDistance] = useState<number | null>(null)
  const [touchStartPos, setTouchStartPos] = useState<Point | null>(null)
  const [touchStartTime, setTouchStartTime] = useState<number>(0)
  
  // Wall/Diagonal editing states
  const [selectedWall, setSelectedWall] = useState<number | null>(null)
  const [selectedDiagonal, setSelectedDiagonal] = useState<number | null>(null)
  const [showDiagonals, setShowDiagonals] = useState(true)
  
  // Context menu for wall
  const [wallMenuData, setWallMenuData] = useState<{
    wallIndex: number
    clickPosition: Point
    screenPosition: { x: number; y: number }
  } | null>(null)

  // Update canvas internal size to match container - prevents stretching
  useEffect(() => {
    const updateCanvasSize = () => {
      const canvas = canvasRef.current
      const container = containerRef.current
      if (canvas && container) {
        const rect = container.getBoundingClientRect()
        // Use device pixel ratio for sharp rendering
        const dpr = window.devicePixelRatio || 1
        const newWidth = Math.floor(rect.width * dpr)
        const newHeight = Math.floor(rect.height * dpr)
        
        // Update internal canvas size to match container exactly
        if (canvas.width !== newWidth || canvas.height !== newHeight) {
          setCanvasSize({ width: newWidth, height: newHeight })
        }
        
        // Display size matches container
        canvas.style.width = `${rect.width}px`
        canvas.style.height = `${rect.height}px`
      }
    }

    updateCanvasSize()
    window.addEventListener('resize', updateCanvasSize)
    return () => window.removeEventListener('resize', updateCanvasSize)
  }, [])

  // Set initial view - center the drawing area
  useEffect(() => {
    if (canvasSize.width > 100 && canvasSize.height > 100 && points.length === 0) {
      // Center the view on a reasonable starting point (5m from origin = 500px)
      const centerWorld = 500
      const initialZoom = 0.5
      setPan({
        x: canvasSize.width / 2 - centerWorld * initialZoom,
        y: canvasSize.height / 2 - centerWorld * initialZoom
      })
      setZoom(initialZoom)
    }
  }, [canvasSize.width, canvasSize.height])
  
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [hoveredPoint, setHoveredPoint] = useState<number | null>(null)
  const [draggedPoint, setDraggedPoint] = useState<number | null>(null)

  // Clamp to logical world coordinates (not canvas display size)
  const clampToCanvas = useCallback((pos: Point): Point => {
    return {
      x: Math.max(0, Math.min(WORLD_SIZE, pos.x)),
      y: Math.max(0, Math.min(WORLD_SIZE, pos.y))
    }
  }, [])

  const getCSSColor = useCallback((varName: string): string => {
    if (typeof window === 'undefined') return 'hsl(220, 60%, 45%)'
    const root = document.documentElement
    const value = getComputedStyle(root).getPropertyValue(varName).trim()
    if (!value) return 'hsl(220, 60%, 45%)'
    return `hsl(${value})`
  }, [])

  const drawCanvas = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.clearRect(0, 0, canvasSize.width, canvasSize.height)

    ctx.strokeStyle = getCSSColor('--canvas-grid')
    ctx.lineWidth = 0.5
    
    ctx.save()
    ctx.translate(pan.x, pan.y)
    ctx.scale(zoom, zoom)
    
    // Grid size: 10px = 10cm at scale=1, larger grid at 100px intervals
    const gridSize = 100 // 1 meter grid
    const fineGridSize = 10 // 10cm fine grid
    
    // Calculate visible area in world coordinates
    const visibleStartX = -pan.x / zoom
    const visibleEndX = (canvasSize.width - pan.x) / zoom
    const visibleStartY = -pan.y / zoom
    const visibleEndY = (canvasSize.height - pan.y) / zoom
    
    // Draw fine grid (10cm)
    ctx.globalAlpha = 0.3
    ctx.lineWidth = 0.5 / zoom
    const fineStartX = Math.max(0, Math.floor(visibleStartX / fineGridSize) * fineGridSize)
    const fineEndX = Math.min(WORLD_SIZE, Math.ceil(visibleEndX / fineGridSize) * fineGridSize)
    const fineStartY = Math.max(0, Math.floor(visibleStartY / fineGridSize) * fineGridSize)
    const fineEndY = Math.min(WORLD_SIZE, Math.ceil(visibleEndY / fineGridSize) * fineGridSize)
    
    for (let x = fineStartX; x <= fineEndX; x += fineGridSize) {
      if (x % gridSize !== 0) { // Skip lines that will be drawn as main grid
        ctx.beginPath()
        ctx.moveTo(x, Math.max(0, visibleStartY))
        ctx.lineTo(x, Math.min(WORLD_SIZE, visibleEndY))
        ctx.stroke()
      }
    }
    
    for (let y = fineStartY; y <= fineEndY; y += fineGridSize) {
      if (y % gridSize !== 0) {
        ctx.beginPath()
        ctx.moveTo(Math.max(0, visibleStartX), y)
        ctx.lineTo(Math.min(WORLD_SIZE, visibleEndX), y)
        ctx.stroke()
      }
    }
    
    // Draw main grid (1 meter)
    ctx.globalAlpha = 0.6
    ctx.lineWidth = 1 / zoom
    const startX = Math.max(0, Math.floor(visibleStartX / gridSize) * gridSize)
    const endX = Math.min(WORLD_SIZE, Math.ceil(visibleEndX / gridSize) * gridSize)
    const startY = Math.max(0, Math.floor(visibleStartY / gridSize) * gridSize)
    const endY = Math.min(WORLD_SIZE, Math.ceil(visibleEndY / gridSize) * gridSize)
    
    for (let x = startX; x <= endX; x += gridSize) {
      ctx.beginPath()
      ctx.moveTo(x, Math.max(0, visibleStartY))
      ctx.lineTo(x, Math.min(WORLD_SIZE, visibleEndY))
      ctx.stroke()
    }
    
    for (let y = startY; y <= endY; y += gridSize) {
      ctx.beginPath()
      ctx.moveTo(Math.max(0, visibleStartX), y)
      ctx.lineTo(Math.min(WORLD_SIZE, visibleEndX), y)
      ctx.stroke()
    }
    
    ctx.globalAlpha = 1
    

    if (points.length === 0) {
      ctx.restore()
      return
    }

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

    // Adaptive sizing based on zoom - keep visual size constant on screen
    // Larger base sizes for better mobile visibility
    const adaptiveScale = 1 / zoom
    const baseFontSize = 18 * adaptiveScale
    const basePadding = 10 * adaptiveScale
    const baseTextHeight = 24 * adaptiveScale
    
    for (let i = 0; i < points.length; i++) {
      const next = (i + 1) % points.length
      if (next === 0 && points.length < 3) continue
      
      const p1 = points[i]
      const p2 = points[next]
      const midX = (p1.x + p2.x) / 2
      const midY = (p1.y + p2.y) / 2
      const lengthInPixels = Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2))
      const lengthInMeters = lengthInPixels / scale / 100
      const lengthText = lengthInMeters >= 1 
        ? `${lengthInMeters.toFixed(2)} м`
        : `${(lengthInMeters * 100).toFixed(0)} см`
      
      ctx.font = `bold ${baseFontSize}px Inter, sans-serif`
      const textMetrics = ctx.measureText(lengthText)
      const textWidth = textMetrics.width
      
      ctx.save()
      
      ctx.fillStyle = getCSSColor('--background')
      ctx.strokeStyle = getCSSColor('--canvas-line')
      ctx.lineWidth = 2.5 * adaptiveScale
      ctx.fillRect(
        midX - textWidth / 2 - basePadding, 
        midY - baseTextHeight / 2 - basePadding / 2, 
        textWidth + basePadding * 2, 
        baseTextHeight + basePadding
      )
      ctx.strokeRect(
        midX - textWidth / 2 - basePadding, 
        midY - baseTextHeight / 2 - basePadding / 2, 
        textWidth + basePadding * 2, 
        baseTextHeight + basePadding
      )
      
      ctx.fillStyle = getCSSColor('--canvas-line')
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(lengthText, midX, midY)
      
      ctx.restore()
    }

    // Adaptive point sizing based on zoom - larger for mobile
    const basePointRadius = 14 * adaptiveScale
    const pointNumberFontSize = 14 * adaptiveScale
    
    points.forEach((point, index) => {
      const isHovered = hoveredPoint === index
      const isDragged = draggedPoint === index
      const pointRadius = isDragged ? basePointRadius * 1.33 : isHovered ? basePointRadius * 1.22 : basePointRadius
      
      ctx.save()
      
      if (isHovered || isDragged) {
        const pointColor = getCSSColor('--canvas-point')
        const pointColorWithAlpha = pointColor.replace('hsl(', 'hsla(').replace(')', `, ${isDragged ? 0.2 : 0.15})`)
        ctx.beginPath()
        ctx.arc(point.x, point.y, pointRadius + 4 * adaptiveScale, 0, Math.PI * 2)
        ctx.fillStyle = pointColorWithAlpha
        ctx.fill()
      }
      
      ctx.shadowColor = 'hsla(0, 0%, 0%, 0.3)'
      ctx.shadowBlur = (isDragged ? 8 : isHovered ? 6 : 4) * adaptiveScale
      ctx.shadowOffsetX = 0
      ctx.shadowOffsetY = 2 * adaptiveScale
      
      ctx.beginPath()
      ctx.arc(point.x, point.y, pointRadius, 0, Math.PI * 2)
      
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
      
      ctx.strokeStyle = getCSSColor('--background')
      ctx.lineWidth = (isDragged ? 3 : isHovered ? 2.5 : 2) * adaptiveScale
      ctx.stroke()
      
      ctx.restore()

      ctx.save()
      const numberFontSize = isDragged || isHovered 
        ? pointNumberFontSize * 1.09 
        : pointNumberFontSize
      ctx.font = `bold ${numberFontSize}px Inter, sans-serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      
      ctx.shadowColor = 'hsla(0, 0%, 0%, 0.5)'
      ctx.shadowBlur = 2 * adaptiveScale
      ctx.shadowOffsetX = 0
      ctx.shadowOffsetY = 1 * adaptiveScale
      
      ctx.fillStyle = getCSSColor('--background')
      ctx.fillText(`${index + 1}`, point.x, point.y)
      ctx.restore()
    })

    if (showDiagonals && points.length >= 4) {
      const diagonals = getRoomDiagonals(points)
      const diagFontSize = 16 * adaptiveScale
      const diagTextHeight = 22 * adaptiveScale
      const diagPadding = 8 * adaptiveScale
      
      diagonals.forEach((diagonal, index) => {
        const p1 = points[diagonal.start]
        const p2 = points[diagonal.end]
        
        ctx.beginPath()
        ctx.setLineDash([8 * adaptiveScale, 4 * adaptiveScale])
        ctx.strokeStyle = selectedDiagonal === index ? 'hsl(45, 90%, 50%)' : 'hsla(45, 80%, 50%, 0.6)'
        ctx.lineWidth = (selectedDiagonal === index ? 3 : 2) * adaptiveScale
        ctx.moveTo(p1.x, p1.y)
        ctx.lineTo(p2.x, p2.y)
        ctx.stroke()
        ctx.setLineDash([])
        
        const midX = (p1.x + p2.x) / 2
        const midY = (p1.y + p2.y) / 2
        const lengthInPixels = lineLength(p1, p2)
        const lengthInMeters = lengthInPixels / scale / 100
        const lengthText = `${lengthInMeters.toFixed(2)} м`
        
        ctx.font = `bold ${diagFontSize}px Inter, sans-serif`
        const textMetrics = ctx.measureText(lengthText)
        const textWidth = textMetrics.width
        
        ctx.save()
        ctx.fillStyle = 'hsl(45, 80%, 95%)'
        ctx.strokeStyle = 'hsl(45, 80%, 50%)'
        ctx.lineWidth = 1.5 * adaptiveScale
        ctx.fillRect(
          midX - textWidth / 2 - diagPadding, 
          midY - diagTextHeight / 2 - diagPadding / 2, 
          textWidth + diagPadding * 2, 
          diagTextHeight + diagPadding
        )
        ctx.strokeRect(
          midX - textWidth / 2 - diagPadding, 
          midY - diagTextHeight / 2 - diagPadding / 2, 
          textWidth + diagPadding * 2, 
          diagTextHeight + diagPadding
        )
        
        ctx.fillStyle = 'hsl(45, 80%, 30%)'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(lengthText, midX, midY)
        ctx.restore()
      })
    }
    
    ctx.restore()
  }, [points, canvasSize.width, canvasSize.height, scale, hoveredPoint, draggedPoint, zoom, pan, getCSSColor, showDiagonals, selectedDiagonal])

  useEffect(() => {
    drawCanvas()
  }, [drawCanvas])

  useEffect(() => {
    if (points.length >= 3) {
      const areaInPixels = calculateArea(points)
      const perimeterInPixels = calculatePerimeter(points)
      
      const areaInSquareMeters = areaInPixels / (scale * scale) / 10000
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
    
    // Use uniform scale to prevent distortion
    const scale = canvas.width / rect.width
    
    const viewX = clientX - rect.left
    const viewY = clientY - rect.top
    
    const logicalX = viewX * scale
    const logicalY = viewY * scale
    
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
    // Use uniform scale to prevent distortion
    const scale = canvas.width / rect.width
    
    const viewX = (touch1.clientX + touch2.clientX) / 2 - rect.left
    const viewY = (touch1.clientY + touch2.clientY) / 2 - rect.top
    
    return {
      x: viewX * scale,
      y: viewY * scale,
    }
  }

  const findPointAtPosition = (pos: Point): number | null => {
    const baseThreshold = 20 / zoom
    const threshold = Math.max(baseThreshold, 15)
    for (let i = 0; i < points.length; i++) {
      const dx = points[i].x - pos.x
      const dy = points[i].y - pos.y
      if (Math.sqrt(dx * dx + dy * dy) < threshold) {
        return i
      }
    }
    return null
  }

  const getScreenPosition = (canvasPos: Point): { x: number; y: number } => {
    const canvas = canvasRef.current
    if (!canvas) return { x: 0, y: 0 }
    
    const canvasRect = canvas.getBoundingClientRect()
    // Use uniform scale to prevent distortion
    const scale = canvasRect.width / canvas.width
    
    const screenX = (canvasPos.x * zoom + pan.x) * scale
    const screenY = (canvasPos.y * zoom + pan.y) * scale
    
    return { x: screenX, y: screenY }
  }

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    // Close context menu if open
    if (wallMenuData) {
      setWallMenuData(null)
      return
    }
    
    if (e.button === 1 || e.ctrlKey || e.metaKey) {
      setIsPanning(true)
      setLastPanPoint({ x: e.clientX, y: e.clientY })
      return
    }
    
    const pos = getCanvasCoords(e)
    
    const snapToGrid = (value: number) => Math.round(value)
    const snappedPos = clampToCanvas({
      x: snapToGrid(pos.x),
      y: snapToGrid(pos.y)
    })
    
    const pointIndex = findPointAtPosition(snappedPos)

    if (pointIndex !== null) {
      if (e.detail === 2) {
        const newPoints = points.filter((_, index) => index !== pointIndex)
        onPointsChange(newPoints)
      } else {
        setDraggedPoint(pointIndex)
      }
      setSelectedWall(null)
      setSelectedDiagonal(null)
      return
    }
    
    // Check click on diagonal
    if (showDiagonals && points.length >= 4) {
      const diagonals = getRoomDiagonals(points)
      const threshold = 20 / zoom
      
      for (let i = 0; i < diagonals.length; i++) {
        const d = diagonals[i]
        const dist = distanceToLine(snappedPos, points[d.start], points[d.end])
        if (dist < threshold) {
          setSelectedDiagonal(i)
          setSelectedWall(null)
          return
        }
      }
    }
    
    // Check click on wall - show context menu
    if (points.length >= 2) {
      const wallIndex = findNearestWallIndex(snappedPos, points, 20 / zoom)
      if (wallIndex !== null) {
        const nextIndex = (wallIndex + 1) % points.length
        const p1 = points[wallIndex]
        const p2 = points[nextIndex]
        const midPoint = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 }
        
        setWallMenuData({
          wallIndex,
          clickPosition: snappedPos,
          screenPosition: getScreenPosition(midPoint)
        })
        return
      }
    }
    
    // Add new point - check for intersection
    setSelectedWall(null)
    setSelectedDiagonal(null)
    
    const newPoints = [...points, snappedPos]
    if (!wouldCauseIntersection(newPoints, points.length, snappedPos)) {
      onPointsChange(newPoints)
    } else {
      toast.error('Нельзя добавить точку: стены будут пересекаться')
    }
  }

  const handleWallMenuSetSize = () => {
    if (wallMenuData) {
      setSelectedWall(wallMenuData.wallIndex)
      setWallMenuData(null)
    }
  }

  const handleWallMenuAddPoint = () => {
    if (wallMenuData) {
      const newPoints = addPointOnWall(points, wallMenuData.wallIndex, wallMenuData.clickPosition)
      // Check if adding this point would cause intersections
      if (wouldCauseIntersection(newPoints, wallMenuData.wallIndex + 1, newPoints[wallMenuData.wallIndex + 1])) {
        toast.error('Нельзя добавить точку: стены будут пересекаться')
        setWallMenuData(null)
        return
      }
      onPointsChange(newPoints)
      if (navigator.vibrate) navigator.vibrate(10)
      setWallMenuData(null)
    }
  }
  
  const handleTouchStart = (e: React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault()
    e.stopPropagation()
    
    // Close context menu on any touch
    if (wallMenuData) {
      setWallMenuData(null)
      return
    }
    
    if (e.touches.length === 2) {
      const distance = getTouchDistance(e.touches[0], e.touches[1])
      setTouchDistance(distance)
      const center = getTouchCenter(e.touches[0], e.touches[1])
      setLastPanPoint(center)
      setTouchStartPos(null)
      setTouchStartTime(0)
    } else if (e.touches.length === 1) {
      const pos = getCanvasCoords(e)
      const pointIndex = findPointAtPosition(pos)
      const touch = e.touches[0]
      
      setTouchStartPos({ x: touch.clientX, y: touch.clientY })
      setTouchStartTime(Date.now())
      
      if (pointIndex !== null) {
        setDraggedPoint(pointIndex)
        setTouchStartPos(null)
      } else {
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
      const canvas = canvasRef.current
      if (canvas) {
        const rect = canvas.getBoundingClientRect()
        // Use uniform scale
        const displayScale = canvas.width / rect.width
        
        const currentViewX = e.clientX - rect.left
        const currentViewY = e.clientY - rect.top
        const lastViewX = lastPanPoint.x - rect.left
        const lastViewY = lastPanPoint.y - rect.top
        
        const deltaX = (currentViewX - lastViewX) * displayScale
        const deltaY = (currentViewY - lastViewY) * displayScale
        
        setPan(prev => ({ x: prev.x + deltaX, y: prev.y + deltaY }))
      }
      setLastPanPoint({ x: e.clientX, y: e.clientY })
      return
    }
    
    const pos = getCanvasCoords(e)

    if (draggedPoint !== null) {
      const snapToGrid = (value: number) => Math.round(value)
      // Ограничиваем точку в пределах canvas
      const snappedPos = clampToCanvas({
        x: snapToGrid(pos.x),
        y: snapToGrid(pos.y)
      })
      
      // Проверяем, не приведёт ли перемещение к пересечению стен
      if (wouldCauseIntersection(points, draggedPoint, snappedPos)) {
        return // Не перемещаем точку если будет пересечение
      }
      
      const newPoints = [...points]
      newPoints[draggedPoint] = snappedPos
      onPointsChange(newPoints)
    } else {
      const foundPoint = findPointAtPosition(pos)
      setHoveredPoint(foundPoint)
      if (canvasRef.current) {
        canvasRef.current.style.cursor = foundPoint !== null ? 'grab' : 'crosshair'
      }
    }
  }
  
  const handleTouchMove = (e: React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault()
    
    if (e.touches.length === 2 && touchDistance !== null && lastPanPoint) {
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
      
      if (touchStartPos) {
        const dx = touch.clientX - touchStartPos.x
        const dy = touch.clientY - touchStartPos.y
        const moved = Math.sqrt(dx * dx + dy * dy)
        if (moved > 10) {
          setIsPanning(true)
          setTouchStartPos(null)
        }
      }
      
      if (isPanning) {
        const canvas = canvasRef.current
        if (canvas) {
          const rect = canvas.getBoundingClientRect()
          // Use uniform scale
          const displayScale = canvas.width / rect.width
          
          const currentViewX = touch.clientX - rect.left
          const currentViewY = touch.clientY - rect.top
          const lastViewX = lastPanPoint.x - rect.left
          const lastViewY = lastPanPoint.y - rect.top
          
          const deltaX = (currentViewX - lastViewX) * displayScale
          const deltaY = (currentViewY - lastViewY) * displayScale
          
          setPan(prev => ({ x: prev.x + deltaX, y: prev.y + deltaY }))
        }
        setLastPanPoint({ x: touch.clientX, y: touch.clientY })
      }
    } else if (e.touches.length === 1 && draggedPoint !== null) {
      const pos = getCanvasCoords(e)
      const snapToGrid = (value: number) => Math.round(value)
      // Ограничиваем точку в пределах canvas
      const snappedPos = clampToCanvas({
        x: snapToGrid(pos.x),
        y: snapToGrid(pos.y)
      })
      
      // Проверяем, не приведёт ли перемещение к пересечению стен
      if (wouldCauseIntersection(points, draggedPoint, snappedPos)) {
        return // Не перемещаем точку если будет пересечение
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
      const isTap = tapDuration < 300
      
      if (touchStartPos && !isPanning && draggedPoint === null && isTap) {
        const canvas = canvasRef.current
        if (canvas) {
          const rect = canvas.getBoundingClientRect()
          // Use uniform scale
          const displayScale = canvas.width / rect.width
          
          const viewX = touchStartPos.x - rect.left
          const viewY = touchStartPos.y - rect.top
          const logicalX = viewX * displayScale
          const logicalY = viewY * displayScale
          
          const x = (logicalX - pan.x) / zoom
          const y = (logicalY - pan.y) / zoom
          
          const snappedPos = clampToCanvas({
            x: Math.round(x),
            y: Math.round(y)
          })
          
          // Use WORLD_SIZE for bounds check, not display canvas size
          if (snappedPos.x >= 0 && snappedPos.y >= 0 && 
              snappedPos.x <= WORLD_SIZE && snappedPos.y <= WORLD_SIZE) {
            
            // Check if tapped on existing point
            const existingPoint = findPointAtPosition(snappedPos)
            if (existingPoint !== null) {
              return // Don't add point if tapped on existing one
            }
            
            // Check if tapped on diagonal - show diagonal input
            if (showDiagonals && points.length >= 4) {
              const diagonals = getRoomDiagonals(points)
              const threshold = 35 // Larger threshold for touch
              
              for (let i = 0; i < diagonals.length; i++) {
                const d = diagonals[i]
                const dist = distanceToLine(snappedPos, points[d.start], points[d.end])
                if (dist < threshold) {
                  setSelectedDiagonal(i)
                  setSelectedWall(null)
                  if (navigator.vibrate) navigator.vibrate(10)
                  return
                }
              }
            }
            
            // Check if tapped on wall - show context menu
            if (points.length >= 2) {
              const wallIndex = findNearestWallIndex(snappedPos, points, 30)
              if (wallIndex !== null) {
                const nextIndex = (wallIndex + 1) % points.length
                const p1 = points[wallIndex]
                const p2 = points[nextIndex]
                const midPoint = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 }
                
                setWallMenuData({
                  wallIndex,
                  clickPosition: snappedPos,
                  screenPosition: getScreenPosition(midPoint)
                })
                return
              }
            }
            
            // Add new point - check for intersection
            if (!wouldCauseIntersection([...points, snappedPos], points.length, snappedPos)) {
              if (navigator.vibrate) {
                navigator.vibrate(10)
              }
              onPointsChange([...points, snappedPos])
            } else {
              if (navigator.vibrate) navigator.vibrate([50, 50, 50])
              toast.error('Нельзя добавить точку: стены будут пересекаться')
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
      // Use uniform scale
      const displayScale = canvas.width / rect.width
      
      const viewX = e.clientX - rect.left
      const viewY = e.clientY - rect.top
      const logicalX = viewX * displayScale
      const logicalY = viewY * displayScale
      
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
    if (points.length > 0) {
      // Fit to content - calculate bounds of all points
      const minX = Math.min(...points.map(p => p.x))
      const maxX = Math.max(...points.map(p => p.x))
      const minY = Math.min(...points.map(p => p.y))
      const maxY = Math.max(...points.map(p => p.y))
      
      const contentWidth = maxX - minX + 200 // Add padding
      const contentHeight = maxY - minY + 200
      
      const scaleX = canvasSize.width / contentWidth
      const scaleY = canvasSize.height / contentHeight
      const newZoom = Math.min(scaleX, scaleY, 2) // Max zoom 2x
      
      const centerX = (minX + maxX) / 2
      const centerY = (minY + maxY) / 2
      
      setPan({
        x: canvasSize.width / 2 - centerX * newZoom,
        y: canvasSize.height / 2 - centerY * newZoom
      })
      setZoom(newZoom)
    } else {
      // Default view - show area around origin suitable for typical rooms
      setZoom(0.5)
      setPan({ x: 50, y: 50 })
    }
  }

  const handleUndo = () => {
    if (points.length > 0) {
      onPointsChange(points.slice(0, -1))
    }
  }

  const handleClear = () => {
    onPointsChange([])
    setSelectedWall(null)
    setSelectedDiagonal(null)
    setWallMenuData(null)
  }

  const handleWallLengthChange = (newLengthMeters: number) => {
    if (selectedWall === null) return
    const newPoints = resizeWall(points, selectedWall, newLengthMeters, scale)
    onPointsChange(newPoints)
    setSelectedWall(null)
    if (navigator.vibrate) navigator.vibrate(10)
  }

  const handleDiagonalLengthChange = (newLengthMeters: number, diagonalIndex: number) => {
    const newPoints = resizeDiagonal(points, diagonalIndex, newLengthMeters, scale)
    onPointsChange(newPoints)
    setSelectedDiagonal(null)
    if (navigator.vibrate) navigator.vibrate(10)
  }

  const getSelectedWallData = () => {
    if (selectedWall === null || points.length < 2) return null
    const nextIndex = (selectedWall + 1) % points.length
    const p1 = points[selectedWall]
    const p2 = points[nextIndex]
    const lengthPixels = lineLength(p1, p2)
    const lengthMeters = lengthPixels / scale / 100
    const midPoint = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 }
    return { lengthMeters, position: getScreenPosition(midPoint) }
  }

  const getSelectedDiagonalData = () => {
    if (selectedDiagonal === null || points.length < 4) return null
    const diagonals = getRoomDiagonals(points)
    if (selectedDiagonal >= diagonals.length) return null
    const d = diagonals[selectedDiagonal]
    const p1 = points[d.start]
    const p2 = points[d.end]
    const lengthPixels = lineLength(p1, p2)
    const lengthMeters = lengthPixels / scale / 100
    const midPoint = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 }
    return { lengthMeters, position: getScreenPosition(midPoint) }
  }

  const wallData = getSelectedWallData()
  const diagonalData = getSelectedDiagonalData()

  const area = points.length >= 3 
    ? calculateArea(points) / (scale * scale) / 10000 
    : 0
  const perimeter = points.length >= 2 
    ? calculatePerimeter(points) / scale / 100 
    : 0

  return (
    <div className="flex flex-col h-full w-full min-h-0 overflow-hidden">
      {/* Fullscreen canvas container for mobile */}
      <div 
        ref={containerRef}
        className="relative flex-1 min-h-0 w-full h-full overflow-hidden bg-[hsl(var(--canvas-bg))] sm:rounded-xl sm:border sm:border-border sm:shadow-md"
      >
        <canvas
          ref={canvasRef}
          width={canvasSize.width}
          height={canvasSize.height}
          className="cursor-crosshair block touch-none w-full h-full"
          style={{ 
            display: 'block',
            width: '100%',
            height: '100%'
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
        
        {/* Overlay toolbar for mobile - top left */}
        <div className="absolute top-2 left-2 flex gap-1 sm:hidden">
          <Button
            variant="secondary"
            size="icon"
            onClick={handleUndo}
            disabled={points.length === 0}
            className="h-10 w-10 bg-background/90 backdrop-blur-sm shadow-md touch-manipulation"
          >
            <Undo2 className="w-4 h-4" />
          </Button>
          <Button
            variant="secondary"
            size="icon"
            onClick={handleClear}
            disabled={points.length === 0}
            className="h-10 w-10 bg-background/90 backdrop-blur-sm shadow-md touch-manipulation"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
        
        {/* Overlay zoom controls for mobile - top right */}
        <div className="absolute top-2 right-2 flex flex-col gap-1 sm:hidden">
          <Button
            variant="secondary"
            size="icon"
            onClick={handleZoomIn}
            className="h-10 w-10 bg-background/90 backdrop-blur-sm shadow-md touch-manipulation"
          >
            <ZoomIn className="w-4 h-4" />
          </Button>
          <Button
            variant="secondary"
            size="icon"
            onClick={handleZoomOut}
            className="h-10 w-10 bg-background/90 backdrop-blur-sm shadow-md touch-manipulation"
          >
            <ZoomOut className="w-4 h-4" />
          </Button>
          <Button
            variant="secondary"
            size="icon"
            onClick={handleResetZoom}
            className="h-10 w-10 bg-background/90 backdrop-blur-sm shadow-md touch-manipulation"
          >
            <Maximize2 className="w-4 h-4" />
          </Button>
        </div>
        
        {/* Overlay stats for mobile - bottom */}
        <div className="absolute bottom-2 left-2 right-2 flex justify-center gap-2 sm:hidden">
          <div className="flex items-center gap-1.5 px-3 py-2 bg-background/90 backdrop-blur-sm rounded-lg shadow-md">
            <span className="text-muted-foreground text-xs">S:</span>
            <span className="font-mono font-semibold text-sm">{area.toFixed(2)} м²</span>
          </div>
          <div className="flex items-center gap-1.5 px-3 py-2 bg-background/90 backdrop-blur-sm rounded-lg shadow-md">
            <span className="text-muted-foreground text-xs">P:</span>
            <span className="font-mono font-semibold text-sm">{perimeter.toFixed(2)} м</span>
          </div>
          {points.length >= 4 && (
            <Button
              variant={showDiagonals ? 'default' : 'secondary'}
              size="sm"
              onClick={() => setShowDiagonals(!showDiagonals)}
              className="h-9 px-3 bg-background/90 backdrop-blur-sm shadow-md touch-manipulation"
            >
              <span className="text-sm">⟍</span>
            </Button>
          )}
        </div>
        
        {/* Wall length input */}
        {wallData && (
          <WallLengthInput
            currentLength={wallData.lengthMeters}
            position={wallData.position}
            onSubmit={handleWallLengthChange}
            onCancel={() => setSelectedWall(null)}
          />
        )}
        
        {/* Diagonal length input */}
        {diagonalData && selectedDiagonal !== null && (
          <DiagonalLengthInput
            currentLength={diagonalData.lengthMeters}
            diagonalIndex={selectedDiagonal}
            position={diagonalData.position}
            onSubmit={handleDiagonalLengthChange}
            onCancel={() => setSelectedDiagonal(null)}
          />
        )}
        
        {/* Wall context menu */}
        {wallMenuData && (
          <WallContextMenu
            position={wallMenuData.screenPosition}
            onSetSize={handleWallMenuSetSize}
            onAddPoint={handleWallMenuAddPoint}
            onClose={() => setWallMenuData(null)}
          />
        )}
        
        {/* Hint overlay */}
        {points.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="flex flex-col items-center gap-2 text-muted-foreground animate-fade-in">
              <MousePointer className="w-8 h-8" />
              <p className="text-sm text-center px-4">Кликните для добавления точек плана</p>
            </div>
          </div>
        )}
      </div>

      {/* Desktop toolbar - hidden on mobile */}
      <div className="hidden sm:flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mt-4 shrink-0">
        <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={handleUndo}
            disabled={points.length === 0}
            className="h-9 px-2"
          >
            <Undo2 className="w-3.5 h-3.5" />
            <span className="ml-1.5">Отменить</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleClear}
            disabled={points.length === 0}
            className="h-9 px-2"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span className="ml-1.5">Очистить</span>
          </Button>
          
          {/* Zoom controls */}
          <div className="flex items-center gap-1 border rounded-md p-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleZoomOut}
              className="h-8 w-8 p-0"
              title="Уменьшить"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </Button>
            <div className="px-2 text-xs font-mono min-w-[3rem] text-center">
              {Math.round(zoom * 100)}%
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleZoomIn}
              className="h-8 w-8 p-0"
              title="Увеличить"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleResetZoom}
              className="h-8 w-8 p-0"
              title="Сбросить масштаб"
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </Button>
          </div>
          
          {/* Diagonal toggle */}
          {points.length >= 4 && (
            <Button
              variant={showDiagonals ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setShowDiagonals(!showDiagonals)}
              className="h-8 px-3"
              title="Показать диагонали"
            >
              <span className="text-sm">⟍</span>
              <span className="ml-1">Диагонали</span>
            </Button>
          )}
        </div>

        <div className="flex items-center gap-4 text-sm flex-wrap">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-muted rounded-lg">
            <span className="text-muted-foreground">Площадь:</span>
            <span className="font-mono font-semibold">{area.toFixed(2)} м²</span>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 bg-muted rounded-lg">
            <span className="text-muted-foreground">Периметр:</span>
            <span className="font-mono font-semibold">{perimeter.toFixed(2)} м.п.</span>
          </div>
        </div>
      </div>

      {/* Points info */}
      {points.length > 0 && (
        <div className="hidden sm:flex flex-wrap items-center gap-2 text-sm text-muted-foreground mt-2">
          <Check className="w-4 h-4 text-success flex-shrink-0" />
          <span>Точек: {points.length}</span>
          {points.length >= 3 && (
            <span className="text-success">• Замкнут</span>
          )}
          <span className="text-xs opacity-70">
            • Клик на стену: меню действий
          </span>
        </div>
      )}
    </div>
  )
}

export default Canvas

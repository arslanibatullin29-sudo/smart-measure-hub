import { useRef, useState, useEffect, useCallback } from 'react'
import { calculateArea, calculatePerimeter } from '@/core/utils/geometry'
import { 
  findNearestWallIndex, 
  lineLength, 
  resizeWall, 
  getRoomDiagonals, 
  resizeDiagonal,
  addPointOnWall,
  distanceToLine
} from '@/core/utils/canvasGeometry'
import { Button } from '@/components/ui/button'
import { Undo2, Trash2, Check, MousePointer, ZoomIn, ZoomOut, Maximize2 } from 'lucide-react'
import { WallLengthInput } from './WallLengthInput'
import { DiagonalLengthInput } from './DiagonalLengthInput'
import { WallContextMenu } from './WallContextMenu'

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
  const [canvasSize, setCanvasSize] = useState({ 
    width: width || 2000, 
    height: height || 1500 
  })
  const [zoom, setZoom] = useState(1)
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

  useEffect(() => {
    if (width && height) {
      setCanvasSize({ width, height })
    }
  }, [width, height])
  
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [hoveredPoint, setHoveredPoint] = useState<number | null>(null)
  const [draggedPoint, setDraggedPoint] = useState<number | null>(null)

  // Ограничение координат в пределах canvas
  const clampToCanvas = useCallback((pos: Point): Point => {
    return {
      x: Math.max(0, Math.min(canvasSize.width, pos.x)),
      y: Math.max(0, Math.min(canvasSize.height, pos.y))
    }
  }, [canvasSize.width, canvasSize.height])

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
    
    const gridSize = 10
    
    const visibleStartX = -pan.x / zoom
    const visibleEndX = (canvasSize.width - pan.x) / zoom
    const visibleStartY = -pan.y / zoom
    const visibleEndY = (canvasSize.height - pan.y) / zoom
    
    const startX = Math.max(0, Math.floor(visibleStartX / gridSize) * gridSize)
    const endX = Math.min(canvasSize.width, Math.ceil(visibleEndX / gridSize) * gridSize)
    const startY = Math.max(0, Math.floor(visibleStartY / gridSize) * gridSize)
    const endY = Math.min(canvasSize.height, Math.ceil(visibleEndY / gridSize) * gridSize)
    
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
    
    if (zoom >= 2) {
      ctx.strokeStyle = getCSSColor('--canvas-grid')
      ctx.globalAlpha = 0.3
      ctx.lineWidth = 0.3
      const fineGridSize = 1
      
      for (let x = startX; x <= endX; x += fineGridSize) {
        if (x % gridSize !== 0) {
          ctx.beginPath()
          ctx.moveTo(x, 0)
          ctx.lineTo(x, canvasSize.height)
          ctx.stroke()
        }
      }
      
      for (let y = startY; y <= endY; y += fineGridSize) {
        if (y % gridSize !== 0) {
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

    ctx.font = 'bold 13px Inter, sans-serif'
    
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
      
      ctx.font = 'bold 13px Inter, sans-serif'
      const textMetrics = ctx.measureText(lengthText)
      const textWidth = textMetrics.width
      const textHeight = 18
      const padding = 8
      
      ctx.save()
      
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
      
      ctx.fillStyle = getCSSColor('--canvas-line')
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(lengthText, midX, midY)
      
      ctx.restore()
    }

    points.forEach((point, index) => {
      const isHovered = hoveredPoint === index
      const isDragged = draggedPoint === index
      const pointRadius = isDragged ? 12 : isHovered ? 11 : 9
      
      ctx.save()
      
      if (isHovered || isDragged) {
        const pointColor = getCSSColor('--canvas-point')
        const pointColorWithAlpha = pointColor.replace('hsl(', 'hsla(').replace(')', `, ${isDragged ? 0.2 : 0.15})`)
        ctx.beginPath()
        ctx.arc(point.x, point.y, pointRadius + 4, 0, Math.PI * 2)
        ctx.fillStyle = pointColorWithAlpha
        ctx.fill()
      }
      
      ctx.shadowColor = 'hsla(0, 0%, 0%, 0.3)'
      ctx.shadowBlur = isDragged ? 8 : isHovered ? 6 : 4
      ctx.shadowOffsetX = 0
      ctx.shadowOffsetY = 2
      
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
      ctx.lineWidth = isDragged ? 3 : isHovered ? 2.5 : 2
      ctx.stroke()
      
      ctx.restore()

      ctx.save()
      ctx.font = isDragged || isHovered 
        ? 'bold 12px Inter, sans-serif' 
        : 'bold 11px Inter, sans-serif'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      
      ctx.shadowColor = 'hsla(0, 0%, 0%, 0.5)'
      ctx.shadowBlur = 2
      ctx.shadowOffsetX = 0
      ctx.shadowOffsetY = 1
      
      ctx.fillStyle = getCSSColor('--background')
      ctx.fillText(`${index + 1}`, point.x, point.y)
      ctx.restore()
    })

    if (showDiagonals && points.length >= 4) {
      const diagonals = getRoomDiagonals(points)
      
      diagonals.forEach((diagonal, index) => {
        const p1 = points[diagonal.start]
        const p2 = points[diagonal.end]
        
        ctx.beginPath()
        ctx.setLineDash([8, 4])
        ctx.strokeStyle = selectedDiagonal === index ? 'hsl(45, 90%, 50%)' : 'hsla(45, 80%, 50%, 0.6)'
        ctx.lineWidth = selectedDiagonal === index ? 3 / zoom : 2 / zoom
        ctx.moveTo(p1.x, p1.y)
        ctx.lineTo(p2.x, p2.y)
        ctx.stroke()
        ctx.setLineDash([])
        
        const midX = (p1.x + p2.x) / 2
        const midY = (p1.y + p2.y) / 2
        const lengthInPixels = lineLength(p1, p2)
        const lengthInMeters = lengthInPixels / scale / 100
        const lengthText = `${lengthInMeters.toFixed(2)} м`
        
        ctx.font = 'bold 12px Inter, sans-serif'
        const textMetrics = ctx.measureText(lengthText)
        const textWidth = textMetrics.width
        const textHeight = 16
        const padding = 6
        
        ctx.save()
        ctx.fillStyle = 'hsl(45, 80%, 95%)'
        ctx.strokeStyle = 'hsl(45, 80%, 50%)'
        ctx.lineWidth = 1.5 / zoom
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
    
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    
    const viewX = clientX - rect.left
    const viewY = clientY - rect.top
    
    const logicalX = viewX * scaleX
    const logicalY = viewY * scaleY
    
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
    
    const scaleX = canvasRect.width / canvas.width
    const scaleY = canvasRect.height / canvas.height
    
    const screenX = (canvasPos.x * zoom + pan.x) * scaleX
    const screenY = (canvasPos.y * zoom + pan.y) * scaleY
    
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
    
    // Add new point
    setSelectedWall(null)
    setSelectedDiagonal(null)
    onPointsChange([...points, snappedPos])
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
      const snapToGrid = (value: number) => Math.round(value)
      // Ограничиваем точку в пределах canvas
      const snappedPos = clampToCanvas({
        x: snapToGrid(pos.x),
        y: snapToGrid(pos.y)
      })
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
      const pos = getCanvasCoords(e)
      const snapToGrid = (value: number) => Math.round(value)
      // Ограничиваем точку в пределах canvas
      const snappedPos = clampToCanvas({
        x: snapToGrid(pos.x),
        y: snapToGrid(pos.y)
      })
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
          const scaleX = canvas.width / rect.width
          const scaleY = canvas.height / rect.height
          
          const viewX = touchStartPos.x - rect.left
          const viewY = touchStartPos.y - rect.top
          const logicalX = viewX * scaleX
          const logicalY = viewY * scaleY
          
          const x = (logicalX - pan.x) / zoom
          const y = (logicalY - pan.y) / zoom
          
          const snappedPos = clampToCanvas({
            x: Math.round(x),
            y: Math.round(y)
          })
          
          if (snappedPos.x >= 0 && snappedPos.y >= 0 && 
              snappedPos.x <= canvasSize.width && snappedPos.y <= canvasSize.height) {
            
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
            
            const existingPoint = findPointAtPosition(snappedPos)
            if (existingPoint === null) {
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
    <div className="flex flex-col h-full">
      {/* Fullscreen canvas container for mobile */}
      <div 
        ref={containerRef}
        className="relative flex-1 overflow-hidden bg-[hsl(var(--canvas-bg))] sm:rounded-xl sm:border sm:border-border sm:shadow-md"
        style={{ minHeight: '50vh' }}
      >
        <canvas
          ref={canvasRef}
          width={canvasSize.width}
          height={canvasSize.height}
          className="cursor-crosshair block touch-none w-full h-full"
          style={{ 
            objectFit: 'contain'
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
      <div className="hidden sm:flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mt-4">
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

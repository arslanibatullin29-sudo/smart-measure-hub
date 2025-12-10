interface Point {
  x: number
  y: number
}

// Найти ближайшую точку на отрезке линии
export function findClosestPointOnLine(
  point: Point,
  lineStart: Point,
  lineEnd: Point
): Point {
  const dx = lineEnd.x - lineStart.x
  const dy = lineEnd.y - lineStart.y
  const lengthSquared = dx * dx + dy * dy

  if (lengthSquared === 0) return lineStart

  const t = Math.max(0, Math.min(1, 
    ((point.x - lineStart.x) * dx + (point.y - lineStart.y) * dy) / lengthSquared
  ))

  return {
    x: lineStart.x + t * dx,
    y: lineStart.y + t * dy
  }
}

// Расстояние от точки до линии
export function distanceToLine(
  point: Point,
  lineStart: Point,
  lineEnd: Point
): number {
  const closest = findClosestPointOnLine(point, lineStart, lineEnd)
  const dx = point.x - closest.x
  const dy = point.y - closest.y
  return Math.sqrt(dx * dx + dy * dy)
}

// Найти индекс ближайшей линии (стены)
export function findNearestWallIndex(
  point: Point,
  points: Point[],
  threshold: number = 15
): number | null {
  if (points.length < 2) return null

  let minDistance = Infinity
  let nearestIndex: number | null = null

  for (let i = 0; i < points.length; i++) {
    const next = (i + 1) % points.length
    if (next === 0 && points.length < 3) continue // Не замыкаем если меньше 3 точек

    const distance = distanceToLine(point, points[i], points[next])
    if (distance < threshold && distance < minDistance) {
      minDistance = distance
      nearestIndex = i
    }
  }

  return nearestIndex
}

// Длина линии в пикселях
export function lineLength(p1: Point, p2: Point): number {
  const dx = p2.x - p1.x
  const dy = p2.y - p1.y
  return Math.sqrt(dx * dx + dy * dy)
}

// Изменить длину стены, двигая конечную точку
export function resizeWall(
  points: Point[],
  wallIndex: number,
  newLengthMeters: number,
  scale: number = 1
): Point[] {
  const newPoints = [...points]
  const startIndex = wallIndex
  const endIndex = (wallIndex + 1) % points.length

  const start = points[startIndex]
  const end = points[endIndex]

  // Направление от начала к концу
  const dx = end.x - start.x
  const dy = end.y - start.y
  const currentLength = Math.sqrt(dx * dx + dy * dy)

  if (currentLength === 0) return points

  // Нормализуем направление
  const nx = dx / currentLength
  const ny = dy / currentLength

  // Новая длина в пикселях (метры * 100 * scale)
  const newLengthPixels = newLengthMeters * 100 * scale

  // Новая позиция конечной точки
  newPoints[endIndex] = {
    x: Math.round(start.x + nx * newLengthPixels),
    y: Math.round(start.y + ny * newLengthPixels)
  }

  return newPoints
}

// Получить диагонали комнаты (для 4+ точек)
export function getRoomDiagonals(points: Point[]): Array<{ start: number; end: number }> {
  if (points.length < 4) return []

  const diagonals: Array<{ start: number; end: number }> = []
  const n = points.length

  // Для 4 точек - две диагонали: 0-2 и 1-3
  // Для N точек - диагонали между противоположными вершинами
  if (n === 4) {
    diagonals.push({ start: 0, end: 2 })
    diagonals.push({ start: 1, end: 3 })
  } else if (n > 4) {
    // Для многоугольников берём диагонали через центр
    const halfN = Math.floor(n / 2)
    for (let i = 0; i < halfN; i++) {
      diagonals.push({ start: i, end: i + halfN })
    }
  }

  return diagonals
}

// Изменить длину диагонали, пересчитав форму комнаты
// Для простоты - перемещаем конечную точку диагонали
export function resizeDiagonal(
  points: Point[],
  diagonalIndex: number,
  newLengthMeters: number,
  scale: number = 1
): Point[] {
  const diagonals = getRoomDiagonals(points)
  if (diagonalIndex >= diagonals.length) return points

  const diagonal = diagonals[diagonalIndex]
  const newPoints = [...points]

  const start = points[diagonal.start]
  const end = points[diagonal.end]

  // Направление диагонали
  const dx = end.x - start.x
  const dy = end.y - start.y
  const currentLength = Math.sqrt(dx * dx + dy * dy)

  if (currentLength === 0) return points

  // Нормализуем
  const nx = dx / currentLength
  const ny = dy / currentLength

  // Новая длина в пикселях
  const newLengthPixels = newLengthMeters * 100 * scale

  // Перемещаем конечную точку
  newPoints[diagonal.end] = {
    x: Math.round(start.x + nx * newLengthPixels),
    y: Math.round(start.y + ny * newLengthPixels)
  }

  return newPoints
}

// Добавить точку на стену (между двумя существующими)
export function addPointOnWall(
  points: Point[],
  wallIndex: number,
  clickPosition: Point
): Point[] {
  const newPoints = [...points]
  const insertIndex = wallIndex + 1
  
  // Находим ближайшую точку на линии стены
  const nextIndex = (wallIndex + 1) % points.length
  const closestPoint = findClosestPointOnLine(
    clickPosition,
    points[wallIndex],
    points[nextIndex]
  )

  // Вставляем точку с привязкой к сетке
  const snappedPoint = {
    x: Math.round(closestPoint.x),
    y: Math.round(closestPoint.y)
  }

  newPoints.splice(insertIndex, 0, snappedPoint)
  return newPoints
}

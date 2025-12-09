// Shoelace Formula для расчёта площади многоугольника
export function calculateArea(points: Array<{ x: number; y: number }>): number {
  if (points.length < 3) return 0

  let area = 0
  for (let i = 0; i < points.length; i++) {
    const j = (i + 1) % points.length
    area += points[i].x * points[j].y
    area -= points[j].x * points[i].y
  }
  return Math.abs(area / 2)
}

// Расчёт периметра многоугольника
export function calculatePerimeter(points: Array<{ x: number; y: number }>): number {
  if (points.length < 2) return 0

  let perimeter = 0
  for (let i = 0; i < points.length; i++) {
    const j = (i + 1) % points.length
    const dx = points[j].x - points[i].x
    const dy = points[j].y - points[i].y
    perimeter += Math.sqrt(dx * dx + dy * dy)
  }
  return perimeter
}

// Расстояние между двумя точками
export function distance(p1: { x: number; y: number }, p2: { x: number; y: number }): number {
  const dx = p2.x - p1.x
  const dy = p2.y - p1.y
  return Math.sqrt(dx * dx + dy * dy)
}

// Найти ближайшую точку на ребре
export function findClosestPointOnEdge(
  point: { x: number; y: number },
  edgeStart: { x: number; y: number },
  edgeEnd: { x: number; y: number }
): { x: number; y: number } | null {
  const dx = edgeEnd.x - edgeStart.x
  const dy = edgeEnd.y - edgeStart.y
  const lengthSquared = dx * dx + dy * dy

  if (lengthSquared === 0) return null

  const t = Math.max(0, Math.min(1, ((point.x - edgeStart.x) * dx + (point.y - edgeStart.y) * dy) / lengthSquared))
  return {
    x: edgeStart.x + t * dx,
    y: edgeStart.y + t * dy,
  }
}

// Проверка, находится ли точка близко к ребру
export function isPointNearEdge(
  point: { x: number; y: number },
  edgeStart: { x: number; y: number },
  edgeEnd: { x: number; y: number },
  threshold: number = 10
): boolean {
  const closest = findClosestPointOnEdge(point, edgeStart, edgeEnd)
  if (!closest) return false
  return distance(point, closest) < threshold
}

// Привязка к сетке
export function snapToGrid(value: number, gridSize: number): number {
  return Math.round(value / gridSize) * gridSize
}


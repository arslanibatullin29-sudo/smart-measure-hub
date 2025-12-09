import { describe, it, expect } from 'vitest'
import { calculateArea, calculatePerimeter, distance } from './geometry'

describe('Geometry utilities', () => {
  describe('calculateArea', () => {
    it('should calculate area of a rectangle', () => {
      const points = [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
        { x: 100, y: 50 },
        { x: 0, y: 50 },
      ]
      const area = calculateArea(points)
      expect(area).toBe(5000) // 100 * 50 = 5000
    })

    it('should calculate area of a triangle', () => {
      const points = [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
        { x: 50, y: 50 },
      ]
      const area = calculateArea(points)
      expect(area).toBe(2500) // (100 * 50) / 2 = 2500
    })

    it('should return 0 for less than 3 points', () => {
      expect(calculateArea([])).toBe(0)
      expect(calculateArea([{ x: 0, y: 0 }])).toBe(0)
      expect(calculateArea([{ x: 0, y: 0 }, { x: 100, y: 0 }])).toBe(0)
    })
  })

  describe('calculatePerimeter', () => {
    it('should calculate perimeter of a rectangle', () => {
      const points = [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
        { x: 100, y: 50 },
        { x: 0, y: 50 },
      ]
      const perimeter = calculatePerimeter(points)
      expect(perimeter).toBe(300) // 100 + 50 + 100 + 50 = 300
    })

    it('should calculate perimeter of a triangle', () => {
      const points = [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
        { x: 50, y: 50 },
      ]
      const perimeter = calculatePerimeter(points)
      // √(100² + 0²) + √(50² + 50²) + √(50² + 50²)
      // = 100 + 70.71 + 70.71 ≈ 241.42
      expect(perimeter).toBeCloseTo(241.42, 1)
    })

    it('should return 0 for less than 2 points', () => {
      expect(calculatePerimeter([])).toBe(0)
      expect(calculatePerimeter([{ x: 0, y: 0 }])).toBe(0)
    })
  })

  describe('distance', () => {
    it('should calculate distance between two points', () => {
      const p1 = { x: 0, y: 0 }
      const p2 = { x: 3, y: 4 }
      const dist = distance(p1, p2)
      expect(dist).toBe(5) // √(3² + 4²) = 5
    })

    it('should return 0 for same points', () => {
      const p1 = { x: 10, y: 20 }
      const p2 = { x: 10, y: 20 }
      expect(distance(p1, p2)).toBe(0)
    })
  })
})


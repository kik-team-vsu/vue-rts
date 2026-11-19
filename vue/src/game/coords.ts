import type { Point } from './types'

export const projection = new DOMMatrix([1, 0.5, -1, 0.5, 0, 0])
const inverseProjection = projection.inverse()

export const toWorldPoint = (point: Point): Point => inverseProjection.transformPoint(point)

export function clampToMap(point: Point, map: { width: number; height: number }): Point {
  return {
    x: Math.max(-map.width / 2, Math.min(map.width / 2, point.x)),
    y: Math.max(-map.height / 2, Math.min(map.height / 2, point.y)),
  }
}

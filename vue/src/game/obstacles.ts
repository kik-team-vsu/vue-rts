import { OBJECT_TYPES } from './config'
import { ISO_SCALE } from './coords'
import { isAreaFree, isSweepFree, squareFootprint } from './spatial'
import type { CollisionOptions } from './spatial'
import { isTerrainPassable } from './terrain'
import type { Point, StaticObject, TerrainType, Unit } from './types'

export interface NavigationOptions extends CollisionOptions {
  units?: readonly Unit[]
}

// Область, где высокий объект закрывает юнита в изометрии
const isHidden = (point: Point, objects: readonly StaticObject[], margin: number): boolean =>
  objects.some((o) => {
    const type = OBJECT_TYPES[o.type]
    if (!type.wallHeight) {
      return false
    }
    const halfWidth = type.width / 2 + margin
    const halfHeight = type.height / 2 + margin
    const x = point.x - o.position.x
    const y = point.y - o.position.y
    const hidden = (type.wallHeight + (type.roofHeight ?? 0)) / ISO_SCALE
    const tMin = Math.max(0, -halfWidth - x, -halfHeight - y)
    const tMax = Math.min(hidden, halfWidth - x, halfHeight - y)
    return tMin < tMax
  })

// Навигация учитывает основание объекта и зону визуального перекрытия
export const isBlocked = (
  point: Point, objects: readonly StaticObject[], margin: number, options: NavigationOptions = {},
): boolean => !isAreaFree({ objects, units: options.units ?? [] }, squareFootprint(point, margin), options) ||
  isHidden(point, objects, margin)

export const isSegmentFree = (
  from: Point, to: Point, objects: readonly StaticObject[], margin: number, options: NavigationOptions = {},
): boolean => {
  if (!isSweepFree({ objects, units: options.units ?? [] }, squareFootprint(from, margin), to, options)) return false
  // Из визуальной зоны разрешён выход; физическое наложение проверено выше.
  // Для визуальной зоны достаточно шага 5 мировых пикселей.
  const count = Math.ceil(Math.hypot(to.x - from.x, to.y - from.y) / 5)
  let leaving = isHidden(from, objects, margin)
  for (let i = 1; i <= count; i++) {
    const t = i / count
    const hidden = isHidden({ x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t }, objects, margin)
    if (hidden && !leaving) return false
    if (!hidden) leaving = false
  }
  return true
}

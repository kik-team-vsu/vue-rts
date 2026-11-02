import { OBJECT_TYPES } from './config'
import { ISO_SCALE } from './coords'
import { isAreaFree, isSweepFree, squareFootprint } from './spatial'
import type { CollisionOptions } from './spatial'
import { isFootprintTerrainPassable } from './terrain'
import type { Point, StaticObject, TerrainType, Unit } from './types'

export interface NavigationOptions extends CollisionOptions {
  units?: readonly Unit[]
  terrain?: TerrainType | 'both' // где ходит юнит, undefined - по суше и воде
}

const isTerrainFree = (point: Point, margin: number, terrain?: TerrainType | 'both'): boolean =>
  isFootprintTerrainPassable(squareFootprint(point, margin), terrain)

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

// Навигация учитывает основание объекта, тип местности юнита и зону визуального перекрытия
export const isBlocked = (
  point: Point, objects: readonly StaticObject[], margin: number, options: NavigationOptions = {},
): boolean => !isAreaFree({ objects, units: options.units ?? [] }, squareFootprint(point, margin), options) ||
  isHidden(point, objects, margin) ||
  !isTerrainFree(point, margin, options.terrain)

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
    const point = { x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t }
    if (!isTerrainFree(point, margin, options.terrain)) return false
    const hidden = isHidden(point, objects, margin)
    if (hidden && !leaving) return false
    if (!hidden) leaving = false
  }
  return true
}

import { OBJECT_TYPES } from './config'
import { ISO_SCALE } from './coords'
import { isTerrainPassable } from './terrain'
import type { Point, StaticObject, TerrainType } from './types'

// Можно ли юниту стоять в точке: не на непроходимой для него местности
// и не в зоне, скрытой за стенами здания (чтобы не прятался за здания)
export const isBlocked = (point: Point, objects: StaticObject[], margin: number, terrain?: TerrainType | 'both'): boolean =>
  !isTerrainPassable(point, terrain) ||
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

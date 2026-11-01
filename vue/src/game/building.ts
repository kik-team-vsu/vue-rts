import { MAP, OBJECT_TYPES } from './config'
import { isAreaFree, isInsideMap, overlaps, staticFootprint } from './spatial'
import type { CollisionWorld, Footprint } from './spatial'
import type { BuildingType, Point, TerrainZone } from './types'

interface BuildingWorld extends CollisionWorld {
  terrainZones: readonly TerrainZone[]
}

export interface BuildingPlacement {
  position: Point
  valid: boolean
  reason: string
}

export const getBuildingType = (id: string): BuildingType | null => {
  const type = OBJECT_TYPES[id]
  return type && 'size' in type ? type : null
}

// Проверяем всю площадь: центр может быть на суше, а край — над водой
export const isBuildingTerrainFree = (world: BuildingWorld, area: Footprint): boolean =>
  world.terrainZones.every((zone) => zone.type === 'sand' || !overlaps(area, {
    position: { x: zone.x + zone.width / 2, y: zone.y + zone.height / 2 },
    halfWidth: zone.width / 2,
    halfHeight: zone.height / 2,
  }))

// Курсор задаёт верхнюю левую клетку; в сторе хранится центр основания
export const getBuildingPlacement = (
  world: BuildingWorld, typeId: string, point: Point,
): BuildingPlacement | null => {
  const type = getBuildingType(typeId)
  if (!type || !point || !Number.isFinite(point.x) || !Number.isFinite(point.y)) return null
  const col = Math.floor((point.x + MAP.width / 2) / MAP.cell)
  const row = Math.floor((point.y + MAP.height / 2) / MAP.cell)
  const position = {
    x: -MAP.width / 2 + (col + type.size / 2) * MAP.cell,
    y: -MAP.height / 2 + (row + type.size / 2) * MAP.cell,
  }
  const area = staticFootprint({ id: 0, type: typeId, group: 0, position })
  let reason = ''
  if (!isInsideMap(area)) {
    reason = 'За пределами карты'
  } else if (!isBuildingTerrainFree(world, area)) {
    reason = 'Неподходящая местность'
  } else if (!isAreaFree(world, area)) {
    reason = 'Место занято'
  }
  return { position, valid: reason === '', reason }
}

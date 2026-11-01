import { TERRAIN_ZONES } from './config'
import type { Point, TerrainType } from './types'

// Местность в точке: тип зоны, в которую точка попала, иначе суша.
export const terrainAt = (point: Point): TerrainType => {
  const zone = TERRAIN_ZONES.find((zone) =>
    point.x >= zone.x && point.x <= zone.x + zone.width &&
    point.y >= zone.y && point.y <= zone.y + zone.height)
  return zone?.type ?? 'land'
}

// Может ли юнит с такой местностью terrain стоять в точке;
// 'both' и undefined ходят по суше и воде, горы непроходимы для всех
export const isTerrainPassable = (point: Point, terrain?: TerrainType | 'both'): boolean => {
  const at = terrainAt(point)
  if (terrain === undefined || terrain === 'both') {
    return at !== 'mountain'
  }
  return at === terrain
}

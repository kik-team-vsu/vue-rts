import { TERRAIN_ZONES } from './config'
import type { Point, TerrainType } from './types'

// Местность в точке: вода, если точка попала в зону воды, иначе суша.
export const terrainAt = (point: Point): TerrainType => {
  const inWater = TERRAIN_ZONES.some((zone) =>
    point.x >= zone.x && point.x <= zone.x + zone.width &&
    point.y >= zone.y && point.y <= zone.y + zone.height)
  return inWater ? 'water' : 'land'
}

// Может ли юнит с такой местностью terrain стоять в точке;
// 'both' и undefined проходят везде
export const isTerrainPassable = (point: Point, terrain?: TerrainType | 'both'): boolean =>
  terrain === undefined || terrain === 'both' || terrainAt(point) === terrain

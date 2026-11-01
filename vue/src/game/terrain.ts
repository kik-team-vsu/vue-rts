import { TERRAIN_ZONES } from './config'
import type { Point, TerrainType } from './types'

// Местность в точке: озеро и река - это вода, песок и всё вне зон - суша.
export const terrainAt = (point: Point): TerrainType => {
  const zone = TERRAIN_ZONES.find((zone) =>
    point.x >= zone.x && point.x <= zone.x + zone.width &&
    point.y >= zone.y && point.y <= zone.y + zone.height)
  if (!zone || zone.type === 'sand') {
    return 'land'
  }
  return zone.type === 'mountain' ? 'mountain' : 'water'
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

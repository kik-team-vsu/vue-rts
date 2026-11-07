import type { Footprint } from './spatial'
import type { Point, TerrainType, TerrainZone } from './types'

// Насколько углы проверки основания сдвинуты внутрь, чтобы касание края не считалось выходом
const TERRAIN_INSET = 4

// Вода и горы решают проходимость; песок - только оформление берега, для юнитов это суша.
// Список зон сценария не меняется в пределах партии, поэтому фильтр считаем один раз на массив.
const solidCache = new WeakMap<readonly TerrainZone[], TerrainZone[]>()
const solidZones = (zones: readonly TerrainZone[]): TerrainZone[] => {
  let solid = solidCache.get(zones)
  if (!solid) {
    solid = zones.filter((zone) => zone.type !== 'sand')
    solidCache.set(zones, solid)
  }
  return solid
}

// Местность в точке: озеро и река - это вода, горы - горы, всё остальное (в том числе песок) - суша
export const terrainAt = (point: Point, zones: readonly TerrainZone[]): TerrainType => {
  const zone = solidZones(zones).find((zone) =>
    point.x >= zone.x && point.x <= zone.x + zone.width &&
    point.y >= zone.y && point.y <= zone.y + zone.height)
  if (!zone) {
    return 'land'
  }
  return zone.type === 'mountain' ? 'mountain' : 'water'
}

// Может ли юнит с такой местностью terrain стоять в точке;
// 'both' и undefined ходят по суше и воде, горы непроходимы для всех
export const isTerrainPassable = (point: Point, zones: readonly TerrainZone[], terrain?: TerrainType | 'both'): boolean => {
  const at = terrainAt(point, zones)
  if (at === 'mountain') {
    return false
  }
  return terrain === undefined || terrain === 'both' || at === terrain
}

// Основание целиком: центр, середины сторон и углы, чуть уменьшенные внутрь.
// Юнит или здание не должны заходить основанием на чужую местность, даже если центр ещё на своей.
export const isFootprintTerrainPassable = (area: Footprint, zones: readonly TerrainZone[], terrain?: TerrainType | 'both'): boolean => {
  const dx = Math.max(0, area.halfWidth - TERRAIN_INSET)
  const dy = Math.max(0, area.halfHeight - TERRAIN_INSET)
  const offsets = [[0, 0], [-dx, 0], [dx, 0], [0, -dy], [0, dy], [-dx, -dy], [dx, -dy], [-dx, dy], [dx, dy]]
  return offsets.every(([ox, oy]) =>
    isTerrainPassable({ x: area.position.x + ox, y: area.position.y + oy }, zones, terrain))
}

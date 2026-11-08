import { OBJECT_TYPES } from './config'
import { staticFootprint } from './spatial'
import type { Footprint } from './spatial'
import type { Point, StaticObject, TerrainType, TerrainZone } from './types'

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

// Прямоугольники мостов (passable-объектов): их настил делает воду проходимой для сухопутных юнитов.
// Кэш по массиву объектов: он заменяется целиком при загрузке сценария и удалении объекта
const bridgeCache = new WeakMap<readonly StaticObject[], Footprint[]>()
export const bridgesOf = (objects: readonly StaticObject[]): Footprint[] => {
  let bridges = bridgeCache.get(objects)
  if (!bridges) {
    bridges = objects.filter((object) => OBJECT_TYPES[object.type]?.passable).map(staticFootprint)
    bridgeCache.set(objects, bridges)
  }
  return bridges
}

// Точка на настиле моста
const isOnBridgeXY = (x: number, y: number, bridges: readonly Footprint[]): boolean =>
  bridges.some((area) =>
    Math.abs(x - area.position.x) <= area.halfWidth &&
    Math.abs(y - area.position.y) <= area.halfHeight)

// Местность в точке: озеро и река - это вода, горы - горы, всё остальное (в том числе песок) - суша.
// solid - уже отфильтрованный список без песка; работа с координатами без объекта Point
// экономит аллокации: проверка отрезка делает такие шаги каждые 5 px
const solidZoneAt = (x: number, y: number, solid: readonly TerrainZone[]): TerrainZone | undefined =>
  solid.find((zone) => x >= zone.x && x <= zone.x + zone.width && y >= zone.y && y <= zone.y + zone.height)

// класс местности зоны: реки и озёра - вода, горы - горы, вне зон - суша
const terrainClassOf = (zone: TerrainZone | undefined): TerrainType =>
  !zone ? 'land' : zone.type === 'mountain' ? 'mountain' : 'water'

export const terrainAt = (point: Point, zones: readonly TerrainZone[]): TerrainType => {
  const zone = solidZoneAt(point.x, point.y, solidZones(zones))
  if (!zone) {
    return 'land'
  }
  return zone.type === 'mountain' ? 'mountain' : 'water'
}

// Может ли юнит с такой местностью terrain стоять в точке;
// 'both' и undefined ходят по суше и воде, горы непроходимы для всех.
// Мост не меняет местность: вода под ним остаётся водой для судов,
// но по настилу проходит и сухопутный юнит
export const isTerrainPassable = (
  point: Point, zones: readonly TerrainZone[], terrain?: TerrainType | 'both', bridges: readonly Footprint[] = [],
): boolean => {
  const zone = solidZoneAt(point.x, point.y, solidZones(zones))
  if (zone?.type === 'mountain') {
    return false
  }
  return terrain === undefined || terrain === 'both' || terrainClassOf(zone) === terrain ||
    isOnBridgeXY(point.x, point.y, bridges)
}

// Твёрдые зоны, пересекающие прямоугольник: для проверки отрезка достаточно их,
// порядок сохраняем - поиск зоны по подсписку даёт тот же результат
export const solidZonesInBox = (
  zones: readonly TerrainZone[], x0: number, y0: number, x1: number, y1: number,
): TerrainZone[] =>
  solidZones(zones).filter((zone) =>
    zone.x <= x1 && zone.x + zone.width >= x0 && zone.y <= y1 && zone.y + zone.height >= y0)

// Основание целиком: центр, середины сторон и углы, чуть уменьшенные внутрь.
// Юнит или здание не должны заходить основанием на чужую местность, даже если центр ещё на своей
export const isFootprintTerrainPassable = (
  area: Footprint, zones: readonly TerrainZone[], terrain?: TerrainType | 'both', bridges: readonly Footprint[] = [],
): boolean => {
  const solid = solidZones(zones)
  const dx = Math.max(0, area.halfWidth - TERRAIN_INSET)
  const dy = Math.max(0, area.halfHeight - TERRAIN_INSET)
  const { x, y } = area.position
  for (let i = -1; i <= 1; i++) {
    for (let j = -1; j <= 1; j++) {
      const zone = solidZoneAt(x + i * dx, y + j * dy, solid)
      if (zone?.type === 'mountain') return false
      if (!(terrain === undefined || terrain === 'both' || terrainClassOf(zone) === terrain ||
        isOnBridgeXY(x + i * dx, y + j * dy, bridges))) return false
    }
  }
  return true
}

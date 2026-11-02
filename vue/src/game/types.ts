export interface Point {
  x: number
  y: number
}

// тип местности; горы непроходимы для всех юнитов
export type TerrainType = 'land' | 'water' | 'mountain'

// тип зоны на карте: озеро и река (оба - вода для юнитов), песок (проходимая суша) или горы
export type TerrainZoneType = 'lake' | 'river' | 'sand' | 'mountain'

// прямоугольная зона местности в мировых координатах, x и y - левый верхний угол
export interface TerrainZone {
  type: TerrainZoneType
  x: number
  y: number
  width: number
  height: number
}

export interface ObjectType {
  name: string
  width: number
  height: number
  color: string
  wallHeight?: number
  roofHeight?: number
  roofColor?: string
  roofType?: 'pyramid' | 'battlements'
  branchColor?: string   // цвет веток (если применим)
}

// Здание: квадрат size × size клеток
export interface BuildingType extends ObjectType {
  size: number // сторона квадрата в клетках сетки
  maxHp: number
}

export interface UnitType extends ObjectType {
  speedPxPerSecond: number
  maxHp: number
  strength: number // урон за один удар
  attackSpeed: number // ударов в секунду
  terrain?: TerrainType | 'both' // где юнит может ходить, по умолчанию 'both' - везде
}

// Любой игровой объект
export interface GameObject {
  id: number
  type: string
  position: Point
  group: number // 0 - нейтральный объект (например, дерево), 1, 2, 3... - группы игроков
}

// Статичный объект на карте
export interface StaticObject extends GameObject {
  type: string // из OBJECT_TYPES
  hp?: number // только у зданий
}

// Движущийся объект (юнит)
export interface Unit extends GameObject {
  type: string // из UNIT_TYPES
  hp: number
  target: Point | null // целевая точка при перемещении, null у стоящего объекта
  path?: Point[] | null // точки пути в обход препятствий, последняя совпадает с target
  blockedFor?: number // время ожидания до повторного поиска пути, секунды
}

// Событие сценария: в момент at (секунды) юнит идёт в точку target
export interface ScenarioEvent {
  at: number
  unitId: number
  target: Point
}

// Сценарий: расстановка на старте и события по времени
export interface Scenario {
  id: string
  name: string
  objects: StaticObject[]
  units: Unit[]
  events: ScenarioEvent[]
}

// Кнопка в панели команд
export interface Command {
  id: string
  label: string
  action: string // название action в сторе
}

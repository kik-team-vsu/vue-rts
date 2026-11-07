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
  shape?: 'human' | 'boat' | 'warship' // как рисовать юнит, по умолчанию 'human' - человечек
  footprint?: number // сторона квадрата столкновений; по умолчанию width (у длинных кораблей уже спрайта)
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
  // Маршрут, проложенный событием move (стор events): куда юнит идёт сейчас, null у стоящего.
  // Сам приказ хранится в событии, здесь только состояние движения
  target: Point | null
  path?: Point[] | null // точки пути в обход препятствий, последняя совпадает с target
  blockedFor?: number // время ожидания до повторного поиска пути, секунды
  targetId?: number | null // цель атаки (id юнита), null - обычное движение
  isAttacking?: boolean // true, пока юнит в режиме атаки
  facing?: number // куда смотрит нос (лицо), радианы в мировых координатах: 0 - +x, PI/2 - +y
}

// Событие - действие объекта: «идти в точку», «атаковать цель» (П10) и т.д.
// Игрок и сценарии создают события, а игровой цикл каждый кадр применяет активные события к элементам карты.
export type GameEventType = 'move' | 'attack'

// active - выполняется сейчас; waiting - ждёт завершения предыдущего события в цепочке (П12)
export type GameEventStatus = 'active' | 'waiting'

export interface GameEvent {
  id: number
  type: GameEventType
  actorId: number // кто выполняет: id юнита
  target: Point | null // точка назначения (move, attack - куда идти)
  targetId: number | null // объект-цель (attack)
  status: GameEventStatus
  started: boolean // маршрут уже проложен (move, attack)
  nextId: number | null // событие, которое начнётся после этого (П12)
}

// Событие сценария: в момент at (секунды) юнит идёт в точку target
export interface ScenarioEvent {
  at: number
  unitId: number
  target: Point
}

// Сценарий: расстановка на старте, зоны местности и события по времени
export interface Scenario {
  id: string
  name: string
  objects: StaticObject[]
  units: Unit[]
  terrain: TerrainZone[] // реки, озёра, горы и песок этого сценария; [] - чистая суша
  events: ScenarioEvent[]
}

// Кнопка в панели команд
export interface Command {
  id: string
  label: string
  action: string // название action в сторе
}

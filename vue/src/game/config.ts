import type { BuildingType, Command, ObjectType, StaticObject, TerrainZone, Unit, UnitType } from './types'

// размер карты и cell - размер ячейики сетки в пикселях
export const MAP = { width: 3000, height: 3000, cell: 50 }

// ширина песчаного берега: узкая полоса вдоль каждого водоёма
export const SAND_WIDTH = 22

// водоёмы карты: озеро и две реки. У реки течение вдоль длинной стороны зоны:
// узкая и высокая зона получит плитку с вертикальным течением.
// Водоёмы держим в стороне от центральной игровой зоны: там спавны армий и бой.
// Зона в мировых координатах, x и y - левый верхний угол
const WATER_ZONES: TerrainZone[] = [
  { type: 'river', x: -1500, y: 1000, width: 1200, height: 200 },
  { type: 'river', x: -1450, y: -1450, width: 200, height: 2900 },
  { type: 'lake', x: 600, y: -700, width: 500, height: 450 },
]

// Песчаная подложка: прямоугольник водоёма плюс узкая полоса по каждой стороне.
// Подложка рисуется под водой, поэтому песок виден ровно по краям водоёма.
// Края обрезаем по карте: за её пределами зоны были бы видны мимо ромба.
const shoreOf = (water: TerrainZone, width: number): TerrainZone => {
  const left = Math.max(-MAP.width / 2, water.x - width)
  const top = Math.max(-MAP.height / 2, water.y - width)
  const right = Math.min(MAP.width / 2, water.x + water.width + width)
  const bottom = Math.min(MAP.height / 2, water.y + water.height + width)
  return { type: 'sand', x: left, y: top, width: right - left, height: bottom - top }
}

// зоны местности: песок - проходимый берег, озеро и реки - вода, горы - непроходимы, всё вне зон - суша.
// Порядок - порядок отрисовки: сначала песок, вода и горы закрывают его середину.
export const TERRAIN_ZONES: TerrainZone[] = [
  ...WATER_ZONES.map((water) => shoreOf(water, SAND_WIDTH)),
  ...WATER_ZONES,
  { type: 'mountain', x: 900, y: -1450, width: 500, height: 500 },
]

// edgePx - зона у края экрана, где камера начинает двигаться
export const CAMERA = { speedPxPerSecond: 500, edgePx: 80 }

// размер в пикселях по размеру в клетках
const cells = (count: number) => count * MAP.cell

export const OBJECT_TYPES: Record<string, ObjectType | BuildingType> = {
  house: { name: 'Дом', width: cells(2), height: cells(2), color: '#a16207', wallHeight: 50, roofHeight: 40, roofColor: '#b91c1c', size: 2, maxHp: 200 },
  tree: { name: 'Дерево', width: 10, height: 10, color: '#7c4a1e', wallHeight: 80, branchColor: '#16a34a' },
  castle: { name: 'Замок', width: cells(4), height: cells(4), color: '#6b7280', wallHeight: 110, roofHeight: 18, roofType: 'battlements', size: 4, maxHp: 500 },
}

export const UNIT_TYPES: Record<string, UnitType> = {
  worker: { name: 'Рабочий', width: 24, height: 40, color: '#0000ff', speedPxPerSecond: 80, maxHp: 50, strength: 5, attackSpeed: 1, terrain: 'land' },
  warrior: { name: 'Воин', width: 32, height: 52, color: '#ff0000', speedPxPerSecond: 150, maxHp: 100, strength: 15, attackSpeed: 1.5, terrain: 'land' },
  boat: { name: 'Лодка', width: 40, height: 24, color: '#d97706', speedPxPerSecond: 100, maxHp: 80, strength: 0, attackSpeed: 0, terrain: 'water' },
}

// цвета групп
const GROUP_PALETTE = ['#2563eb', '#dc2626', '#9333ea', '#ea580c', '#0891b2', '#db2777']

// цвет группы; у нейтральных (группа 0) цвета нет, берём чёрный
export const groupColor = (group: number) => {
  if (group <= 0) {
    return '#000'
  }
  return GROUP_PALETTE[(group - 1) % GROUP_PALETTE.length]
}

// группа игрока, остальные группы - враги
export const PLAYER_GROUP = 1

// group: 0 - нейтральные, 1 и 2 - разные группы; hp здания равен maxHp его типа
export const START_OBJECTS: StaticObject[] = [
  { id: 1, type: 'house', group: 1, hp: 200, position: { x: -800, y: 100 } },
  { id: 2, type: 'house', group: 2, hp: 200, position: { x: 350, y: 550 } },
  { id: 3, type: 'tree', group: 0, position: { x: 150, y: -300 } },
  { id: 4, type: 'tree', group: 0, position: { x: -550, y: 250 } },
  { id: 5, type: 'tree', group: 0, position: { x: 550, y: -150 } },
  { id: 6, type: 'castle', group: 1, hp: 500, position: { x: -900, y: -200 } },
  { id: 14, type: 'castle', group: 2, hp: 500, position: { x: 600, y: 300 } },
]

export const START_UNITS: Unit[] = [
  { id: 7, type: 'worker', group: 1, hp: UNIT_TYPES.worker.maxHp, position: { x: -650, y: 0 }, target: null },
  { id: 8, type: 'worker', group: 2, hp: UNIT_TYPES.worker.maxHp, position: { x: 60, y: 40 }, target: null },
  { id: 9, type: 'warrior', group: 1, hp: UNIT_TYPES.warrior.maxHp, position: { x: -600, y: 120 }, target: null },
  { id: 10, type: 'warrior', group: 1, hp: UNIT_TYPES.warrior.maxHp, position: { x: -650, y: -150 }, target: null },
  { id: 11, type: 'warrior', group: 2, hp: UNIT_TYPES.warrior.maxHp, position: { x: 100, y: 100 }, target: null },
  { id: 12, type: 'warrior', group: 2, hp: UNIT_TYPES.warrior.maxHp, position: { x: 200, y: 300 }, target: null },
  { id: 13, type: 'boat', group: 1, hp: UNIT_TYPES.boat.maxHp, position: { x: 850, y: -475 }, target: null },
]

// кнопки панели, action вызывается из стора
export const COMMANDS: Record<string, Command> = {
  destroy: { id: 'destroy', label: 'Самоуничтожение', action: 'game/destroySelectedUnits' },
}

import type { ObjectType, StaticObject, Unit, UnitType } from './types'

// размер карты и cell - размер ячейики сетки в пикселях
export const MAP = { width: 3000, height: 3000, cell: 50 }

// edgePx - зона у края экрана, где камера начинает двигаться
export const CAMERA = { speedPxPerSecond: 500, edgePx: 80 }

export const OBJECT_TYPES: Record<string, ObjectType> = {
  house: { name: 'Дом', width: 100, height: 70, color: '#a16207', wallHeight: 50, roofHeight: 40, roofColor: '#b91c1c' },
  tree: { name: 'Дерево', width: 10, height: 10, color: '#7c4a1e', wallHeight: 80, branchColor: '#16a34a' },
  castle: { name: 'Замок', width: 200, height: 160, color: '#6b7280', wallHeight: 110, roofHeight: 18, roofType: 'battlements' },
}

export const UNIT_TYPES: Record<string, UnitType> = {
  worker: { name: 'Рабочий', width: 24, height: 40, color: '#0000ff', speedPxPerSecond: 80 },
  warrior: { name: 'Воин', width: 32, height: 52, color: '#ff0000', speedPxPerSecond: 150 },
}

export const START_OBJECTS: StaticObject[] = [
  { id: 1, type: 'house', position: { x: -200, y: -150 } },
  { id: 2, type: 'house', position: { x: 350, y: 250 } },
  { id: 3, type: 'tree', position: { x: 150, y: -300 } },
  { id: 4, type: 'tree', position: { x: -350, y: 250 } },
  { id: 5, type: 'tree', position: { x: 550, y: -150 } },
  { id: 6, type: 'castle', position: { x: -550, y: -200 } },
]

export const START_UNITS: Unit[] = [
  { id: 7, type: 'worker', position: { x: 0, y: 0 }, target: null },
  { id: 8, type: 'worker', position: { x: 60, y: 40 }, target: null },
  { id: 9, type: 'warrior', position: { x: -100, y: 120 }, target: null },
  { id: 10, type: 'warrior', position: { x: -150, y: 80 }, target: null },
  { id: 11, type: 'warrior', position: { x: 100, y: 100 }, target: null },
]

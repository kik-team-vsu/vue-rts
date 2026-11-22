import type { ObjectType, StaticObject, Unit, UnitType } from './types'

// размер карты и cell - размер ячейики сетки в пикселях
export const MAP = { width: 3000, height: 2000, cell: 50 }

export const GROUPS = [1, 2]

// edgePx - зона у края экрана, где камера начинает двигаться
export const CAMERA = {
  speedPxPerSecond: 500,
  edgePx: 50,
  minZoom: 0.5,
  maxZoom: 3,
}

export const OBJECT_TYPES: Record<string, ObjectType> = {
  house: { name: 'Дом', width: 100, height: 70, color: '#a16207', spawnTypes: ['worker'] },
  tree: { name: 'Дерево', width: 30, height: 80, color: '#00ff00' },
  castle: { name: 'Замок', width: 200, height: 160, color: '#6b7280', spawnTypes: ['warrior'] },
}

export const UNIT_TYPES: Record<string, UnitType> = {
  worker: { name: 'Рабочий', width: 24, height: 24, color: '#0000ff', speedPxPerSecond: 80 },
  warrior: { name: 'Воин', width: 32, height: 32, color: '#ff0000', speedPxPerSecond: 150 },
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
  { id: 7, type: 'worker', position: { x: 0, y: 0 } },
  { id: 8, type: 'worker', position: { x: 60, y: 40 } },
  { id: 9, type: 'warrior', position: { x: -100, y: 120 } },
  { id: 10, type: 'warrior', position: { x: -150, y: 80 } },
  { id: 11, type: 'warrior', position: { x: 100, y: 100 } },
]

export interface Point {
  x: number
  y: number
}

export interface ObjectType {
  name: string
  width: number
  height: number
  color: string
  image?: string //для текстур
}

export interface BuildingType extends ObjectType {
  size: number // сторона квадрата в клетках сетки
  maxHp: number
}

export interface UnitType extends ObjectType {
  speedPxPerSecond: number
  maxHp: number
  strength: number // урон за один удар
  attackSpeed: number //считается в количестве ударов в секунду
}

// любой игровой объект
export interface GameObject extends Point {
  id: number
  type: string
  group: number // 0 - нейтральный объект (например, дерево), 1, 2, 3... - группы игроков
}

// статичный объект на карте
export interface StaticObject extends GameObject {
  type: string // из OBJECT_TYPES
  hp?: number // только для зданий
}

// движущийся объект (юнит)
export interface Unit extends GameObject {
  type: string // из UNIT_TYPES
  hp: number
  target: Point | null // целевая точка при перемещении, null у стоящего объекта
}

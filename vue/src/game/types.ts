export interface Point {
  x: number
  y: number
}

export interface ObjectType {
  name: string
  width: number
  height: number
  color: string
  spawnTypes?: string[]
}

export interface UnitType extends ObjectType {
  speedPxPerSecond: number
  terrain: Terrain
}

// любой игровой объект
export interface GameObject {
  id: number
  type: string
  position: Point
  groupId?: number
}

// статичный объект на карте
export interface StaticObject extends GameObject {
  type: string // из OBJECT_TYPES
}

// движущийся объект (юнит)
export interface Unit extends GameObject {
  groupId: number
}

export interface MoveCommand {
  type: 'move'
  target: Point
}

export type Terrain = 'land' | 'water'

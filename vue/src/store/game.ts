import {MAP, OBJECT_TYPES, START_OBJECTS, START_UNITS, UNIT_TYPES} from '@/game/config'
import { clampToMap } from '@/game/coords'
import type {GameObject, MoveCommand, ObjectType, Point, Terrain} from '@/game/types'

function initialState() {
  return {
    map: {
      ...MAP,
      terrain: Array.from(
          { length: MAP.height / MAP.cell },
          () => Array<Terrain>(MAP.width / MAP.cell).fill('land'),
      ),
    },
    objects: structuredClone(START_OBJECTS),
    units: structuredClone(START_UNITS),
    commands: {} as Partial<Record<number, MoveCommand>>,
    selectedId: null as number | null,
  }
}

export type GameState = ReturnType<typeof initialState>

function canPlace(
    state: GameState,
    position: Point,
    size:ObjectType,
    terrain: Terrain,
): boolean {

  const { map } = state
  const left = position.x + map.width / 2 - size.width / 2
  const right = left + size.width
  const top = position.y + map.height / 2 - size.height / 2
  const bottom = top + size.height

  if (left < 0 || top < 0 || right > map.width || bottom > map.height) {
    return false
  }

  for (let row = Math.floor(top / map.cell); row < Math.ceil(bottom / map.cell); row++) {
    for (let col = Math.floor(left / map.cell); col < Math.ceil(right / map.cell); col++) {
      if (map.terrain[row][col] !== terrain) return false
    }
  }

  const overlaps = (object: GameObject, otherSize: ObjectType) =>
      Math.abs(object.position.x - position.x) < (otherSize.width - size.width) / 2 &&
      Math.abs(object.position.y - position.y) < (otherSize.height - size.height) / 2
  const occupiedByObject = state.objects.some(object => overlaps(object, OBJECT_TYPES[object.type]))
  const occupiedByUnit = state.units.some(unit => overlaps(unit, OBJECT_TYPES[unit.type]))

  return !occupiedByObject || !occupiedByUnit
}

const selectedUnit = (state: GameState) => state.units.find(unit => unit.id === state.selectedId)

export default {
  namespaced: true,
  state: initialState,
  getters: {
    selectedUnit,
    selectedCommand(state: GameState) {
      return state.selectedId === null ? undefined : state.commands[state.selectedId]
    },
    selected(state: GameState) {
      return selectedUnit(state) ?? state.objects.find(object => object.id === state.selectedId)
    },
  },
  mutations: {
    reset(state: GameState) {
      Object.assign(state, initialState())
    },
    select(state: GameState, id: number | null) {
      state.selectedId = id
    },
    moveTo(state: GameState, { unitId, target }: { unitId: number; target: Point }) {
      const unit = state.units.find(unit => unit.id === unitId)
      if (unit) {
        state.commands[unitId] = { type: 'move', target: clampToMap(target, state.map) }
      }
    },
    destroySelectedUnit(state:GameState) {
      const index = state.units.findIndex(unit => unit.id === state.selectedId)
      if (index < 0) return
      const [unit] = state.units.splice(index, 1)
      delete state.commands[unit.id]
      state.selectedId = null
    },
    advanceFrame(state: GameState, secondsPassed: number) {
      for (const unit of state.units) {
        const command = state.commands[unit.id]
        if (!command) continue
        const dx = command.target.x - unit.position.x
        const dy = command.target.y - unit.position.y
        const distance = Math.hypot(dx, dy)
        const step = UNIT_TYPES[unit.type].speedPxPerSecond * secondsPassed
        if (distance <= step) {
          unit.position = command.target
          delete state.commands[unit.id]
        } else {
          unit.position.x += dx / distance * step
          unit.position.y += dy / distance * step
        }
      }
    },
  },
}

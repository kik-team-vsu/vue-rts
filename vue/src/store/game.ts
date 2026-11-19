import { MAP, START_OBJECTS, START_UNITS, UNIT_TYPES } from '@/game/config'
import { clampToMap } from '@/game/coords'
import type { Point } from '@/game/types'

function initialState() {
  return {
    map: { ...MAP },
    objects: structuredClone(START_OBJECTS),
    units: structuredClone(START_UNITS),
    selectedId: null as number | null,
  }
}

export type GameState = ReturnType<typeof initialState>

const selectedUnit = (state: GameState) => state.units.find(unit => unit.id === state.selectedId)

export default {
  namespaced: true,
  state: initialState,
  getters: {
    selectedUnit,
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
      if (unit) unit.target = clampToMap(target, state.map)
    },
    advanceFrame(state: GameState, secondsPassed: number) {
      for (const unit of state.units) {
        if (!unit.target) continue
        const dx = unit.target.x - unit.position.x
        const dy = unit.target.y - unit.position.y
        const distance = Math.hypot(dx, dy)
        const step = UNIT_TYPES[unit.type].speedPxPerSecond * secondsPassed
        if (distance <= step) {
          unit.position = unit.target
          unit.target = null
        } else {
          unit.position.x += dx / distance * step
          unit.position.y += dy / distance * step
        }
      }
    },
  },
}

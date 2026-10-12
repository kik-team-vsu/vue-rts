import { MAP, START_OBJECTS, START_UNITS, UNIT_TYPES } from '@/game/config'

const MUTATIONS = {
  SET_SELECTED_ID: 'SET_SELECTED_ID',
  SET_UNIT_TARGET: 'SET_UNIT_TARGET',
  MOVE_UNITS: 'MOVE_UNITS',
}

// состояние игры: что стоит на карте и что выбрано
export default {
  namespaced: true,
  state () {
    return {
      objects: structuredClone(START_OBJECTS),
      units: structuredClone(START_UNITS),
      selectedId: null,
    }
  },
  getters: {
    getObjects: (state) => state.objects,
    getUnits: (state) => state.units,
    getSelectedId: (state) => state.selectedId,
    getSelected: (state) =>
      state.objects.find((o) => o.id === state.selectedId) ??
      state.units.find((u) => u.id === state.selectedId) ??
      null,
    getSelectedUnit: (state) => state.units.find((u) => u.id === state.selectedId) ?? null,
  },
  mutations: {
    [MUTATIONS.SET_SELECTED_ID]: (state, id) => {
      state.selectedId = id
    },
    [MUTATIONS.SET_UNIT_TARGET]: (state, { id, target }) => {
      const unit = state.units.find((u) => u.id === id)
      if (unit) {
        unit.target = target
      }
    },
    [MUTATIONS.MOVE_UNITS]: (state, secondsPassed) => {
      for (const u of state.units) {
        if (u.target) {
          const dx = u.target.x - u.position.x
          const dy = u.target.y - u.position.y
          const dist = Math.hypot(dx, dy)
          const step = UNIT_TYPES[u.type].speedPxPerSecond * secondsPassed

          if (dist <= step) {
            u.position = u.target
            u.target = null
          } else {
            u.position.x += (dx / dist) * step
            u.position.y += (dy / dist) * step
          }
        }
      }
    },
  },
  actions: {
    select: (store, id) => {
      store.commit(MUTATIONS.SET_SELECTED_ID, id)
    },
    moveSelected: (store, point) => {
      const unit = store.getters.getSelectedUnit
      if (!unit) {
        return
      }
      store.commit(MUTATIONS.SET_UNIT_TARGET, {
        id: unit.id,
        target: {
          x: Math.max(-MAP.width / 2, Math.min(MAP.width / 2, point.x)),
          y: Math.max(-MAP.height / 2, Math.min(MAP.height / 2, point.y)),
        },
      })
    },
    moveUnits: (store, secondsPassed) => {
      if (store.state.units.some((u) => u.target)) {
        store.commit(MUTATIONS.MOVE_UNITS, secondsPassed)
      }
    },
  },
}

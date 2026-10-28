import { PLAYER_GROUP, START_OBJECTS, START_UNITS, UNIT_TYPES } from '@/game/config'
import { SCENARIOS } from '@/game/scenarios'
import { clampToMap } from '@/game/coords'
import { isBlocked } from '@/game/obstacles'

const MUTATIONS = {
  SET_SELECTED_IDS: 'SET_SELECTED_IDS',
  SET_UNIT_TARGET: 'SET_UNIT_TARGET',
  MOVE_UNITS: 'MOVE_UNITS',
  REMOVE_OBJECT: 'REMOVE_OBJECT',
  SET_PAUSED: 'SET_PAUSED',
  LOAD_SCENARIO: 'LOAD_SCENARIO',
  OPEN_MENU: 'OPEN_MENU',
  RUN_SCENARIO_EVENTS: 'RUN_SCENARIO_EVENTS',
}

const MIN_SLIDE = 0.01
const FORMATION_STEP = 40

// состояние игры: что стоит на карте и что выбрано
export default {
  namespaced: true,
  state () {
    return {
      objects: structuredClone(START_OBJECTS),
      units: structuredClone(START_UNITS),
      selectedIds: [],
      started: false, // false - показываем меню
      paused: false,
      scenarioTime: 0,
      pendingEvents: [],
      scenarioId: SCENARIOS[0].id,
    }
  },
  getters: {
    getObjects: (state) => state.objects,
    getUnits: (state) => state.units,
    getSelectedIds: (state) => state.selectedIds,
    getSelected: (state) => {
      if (state.selectedIds.length !== 1) {
        return null
      }
      const id = state.selectedIds[0]
      return state.objects.find((o) => o.id === id) ?? state.units.find((u) => u.id === id) ?? null
    },
    getStarted: (state) => state.started,
    // игра идёт, если сценарий выбран и игра не закончена
    isRunning: (state, getters) => state.started && !getters.isGameOver,
    // выбранные юниты игрока (чужими командовать нельзя)
    getOwnSelectedUnits: (state) => state.units.filter((u) => state.selectedIds.includes(u.id) && u.group === PLAYER_GROUP),
    getPaused: (state) => state.paused,
    getScenarioId: (state) => state.scenarioId,
    // группы у которых остались юниты или здания, группа 0 не считается
    getAliveGroups: (state) => {
      const groups = [...state.units, ...state.objects].map((o) => o.group).filter((group) => group > 0)
      return [...new Set(groups)]
    },
    // конец игры, когда осталась одна группа
    getWinner: (state, getters) => (getters.getAliveGroups.length === 1 ? getters.getAliveGroups[0] : null),
    isGameOver: (state, getters) => state.started && getters.getAliveGroups.length <= 1,
    getSelectedUnits: (state) => state.units.filter((u) => state.selectedIds.includes(u.id)),
  },
  mutations: {
    [MUTATIONS.SET_SELECTED_IDS]: (state, ids) => {
      state.selectedIds = ids
    },
    [MUTATIONS.SET_UNIT_TARGET]: (state, { id, target }) => {
      const unit = state.units.find((u) => u.id === id)
      if (unit) {
        unit.target = target
      }
    },
    // удаляем объект по id и убираем из выбора
    [MUTATIONS.REMOVE_OBJECT]: (state, id) => {
      state.units = state.units.filter((u) => u.id !== id)
      state.objects = state.objects.filter((o) => o.id !== id)
      state.selectedIds = state.selectedIds.filter((selectedId) => selectedId !== id)
    },
    [MUTATIONS.SET_PAUSED]: (state, paused) => {
      state.paused = paused
    },
    [MUTATIONS.LOAD_SCENARIO]: (state, scenario) => {
      state.objects = structuredClone(scenario.objects)
      state.units = structuredClone(scenario.units)
      state.selectedIds = []
      state.paused = false
      state.started = true
      state.scenarioTime = 0
      state.pendingEvents = structuredClone(scenario.events)
      state.scenarioId = scenario.id
    },
    [MUTATIONS.OPEN_MENU]: (state) => {
      state.started = false
      state.paused = false
      state.selectedIds = []
    },
    // двигаем время сценария и запускаем события
    [MUTATIONS.RUN_SCENARIO_EVENTS]: (state, secondsPassed) => {
      state.scenarioTime += secondsPassed
      const due = state.pendingEvents.filter((e) => e.at <= state.scenarioTime)
      due.forEach((e) => {
        const unit = state.units.find((u) => u.id === e.unitId)
        if (unit) {
          unit.target = e.target
        }
      })
      state.pendingEvents = state.pendingEvents.filter((e) => e.at > state.scenarioTime)
    },
    [MUTATIONS.MOVE_UNITS]: (state, secondsPassed) => {
      for (const u of state.units) {
        if (u.target) {
          const dx = u.target.x - u.position.x
          const dy = u.target.y - u.position.y
          const dist = Math.hypot(dx, dy)
          const step = UNIT_TYPES[u.type].speedPxPerSecond * secondsPassed

          const next = dist <= step
            ? u.target
            : { x: u.position.x + (dx / dist) * step, y: u.position.y + (dy / dist) * step }

          const margin = UNIT_TYPES[u.type].width / 2
          const blocked = (point) => isBlocked(point, state.objects, margin)

          if (!blocked(next) || blocked(u.position)) {
            u.position = next
            if (next === u.target) {
              u.target = null
            }
          } else {
            const slides = []
            if (Math.abs(dx) > MIN_SLIDE) {
              slides.push({ x: u.position.x + Math.sign(dx) * Math.min(step, Math.abs(dx)), y: u.position.y })
            }
            if (Math.abs(dy) > MIN_SLIDE) {
              slides.push({ x: u.position.x, y: u.position.y + Math.sign(dy) * Math.min(step, Math.abs(dy)) })
            }
            const slide = slides.find((point) => !blocked(point))
            if (slide) {
              u.position = slide
            } else {
              u.target = null
            }
          }
        }
      }
    },
  },
  actions: {
    select: (store, id) => {
      if (!store.getters.isRunning) {
        return
      }
      store.commit(MUTATIONS.SET_SELECTED_IDS, id === null ? [] : [id])
    },
    selectMany: (store, ids) => {
      if (!store.getters.isRunning) {
        return
      }
      store.commit(MUTATIONS.SET_SELECTED_IDS, ids)
    },
    // shift + клик: юнит добавляется к выбору или убирается из него
    toggleSelect: (store, id) => {
      if (!store.getters.isRunning) {
        return
      }
      const ids = store.getters.getSelectedUnits.map((u) => u.id)
      store.commit(MUTATIONS.SET_SELECTED_IDS, ids.includes(id) ? ids.filter((i) => i !== id) : [...ids, id])
    },
    // shift + рамка: новые юниты добавляются к уже выбранным
    addToSelection: (store, ids) => {
      if (!store.getters.isRunning) {
        return
      }
      const selected = store.getters.getSelectedUnits.map((u) => u.id)
      store.commit(MUTATIONS.SET_SELECTED_IDS, [...selected, ...ids.filter((id) => !selected.includes(id))])
    },
    moveSelected: (store, point) => {
      if (!store.getters.isRunning) {
        return
      }
      const units = store.getters.getSelectedUnits
      const columns = Math.ceil(Math.sqrt(units.length))
      const rows = Math.ceil(units.length / columns)
      units.forEach((unit, index) => {
        const column = index % columns
        const row = Math.floor(index / columns)
        store.commit(MUTATIONS.SET_UNIT_TARGET, {
          id: unit.id,
          target: clampToMap({
            x: point.x + (column - (columns - 1) / 2) * FORMATION_STEP,
            y: point.y + (row - (rows - 1) / 2) * FORMATION_STEP,
          }),
        })
      })
    },
    // уничтожить объект по id
    destroyObject: (store, id) => {
      store.commit(MUTATIONS.REMOVE_OBJECT, id)
    },
    // удаляем объекты у которых hp <= 0
    removeDead: (store) => {
      if (!store.getters.isRunning || store.state.paused) {
        return
      }
      const dead = [...store.state.units, ...store.state.objects].filter((o) => o.hp !== undefined && o.hp <= 0)
      dead.forEach((o) => store.dispatch('destroyObject', o.id))
    },
    // самоуничтожение выбранных юнитов игрока
    destroySelectedUnits: (store) => {
      if (!store.getters.isRunning) {
        return
      }
      store.getters.getOwnSelectedUnits.forEach((unit) => store.dispatch('destroyObject', unit.id))
    },
    // пауза: нажали - стоим, ещё раз - продолжаем
    togglePause: (store) => {
      store.commit(MUTATIONS.SET_PAUSED, !store.state.paused)
    },
    // запустить сценарий по id
    loadScenario: (store, id) => {
      const scenario = SCENARIOS.find((s) => s.id === id)
      if (scenario) {
        store.commit(MUTATIONS.LOAD_SCENARIO, scenario)
      }
    },
    openMenu: (store) => {
      store.commit(MUTATIONS.OPEN_MENU)
    },
    // события сценария (на паузе и в меню не идут)
    runScenarioEvents: (store, secondsPassed) => {
      if (store.state.started && !store.state.paused && !store.getters.isGameOver) {
        store.commit(MUTATIONS.RUN_SCENARIO_EVENTS, secondsPassed)
      }
    },
    moveUnits: (store, secondsPassed) => {
      if (!store.state.started || store.state.paused || store.getters.isGameOver) {
        return
      }
      if (store.state.units.some((u) => u.target)) {
        store.commit(MUTATIONS.MOVE_UNITS, secondsPassed)
      }
    },
  },
}

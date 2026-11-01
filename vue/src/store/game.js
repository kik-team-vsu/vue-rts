import { OBJECT_TYPES, PLAYER_GROUP, START_OBJECTS, START_UNITS, TERRAIN_ZONES, UNIT_TYPES } from '@/game/config'
import { SCENARIOS } from '@/game/scenarios'
import { advanceUnits, clampUnitTarget, orderUnit } from '@/game/movement'
import { isAreaFree, staticFootprint, unitFootprint } from '@/game/spatial'
import { getBuildingPlacement, getBuildingType, isBuildingTerrainFree } from '@/game/building'

const MUTATIONS = {
  SET_SELECTED_IDS: 'SET_SELECTED_IDS',
  SET_UNIT_TARGET: 'SET_UNIT_TARGET',
  MOVE_UNITS: 'MOVE_UNITS',
  REMOVE_OBJECT: 'REMOVE_OBJECT',
  SET_PAUSED: 'SET_PAUSED',
  LOAD_SCENARIO: 'LOAD_SCENARIO',
  OPEN_MENU: 'OPEN_MENU',
  RUN_SCENARIO_EVENTS: 'RUN_SCENARIO_EVENTS',
  ADD_OBJECT: 'ADD_OBJECT',
  SET_BUILDING_TYPE: 'SET_BUILDING_TYPE',
}

const FORMATION_STEP = 40
const nextId = (objects, units) => Math.max(0, ...objects.map((object) => object.id), ...units.map((unit) => unit.id)) + 1

const canAddObject = (state, { kind, object }) => {
  if (!object || !Number.isSafeInteger(object.id) || object.id <= 0 ||
    !Number.isInteger(object.group) || object.group < 0) return false
  // ID общий для юнитов и статичных объектов
  if ([...state.objects, ...state.units].some((item) => item.id === object.id)) return false
  if (kind === 'unit' && Object.hasOwn(UNIT_TYPES, object.type)) {
    return Number.isFinite(object.hp) && object.hp > 0 && isAreaFree(state, unitFootprint(object))
  }
  if (kind === 'static' && Object.hasOwn(OBJECT_TYPES, object.type)) {
    const type = OBJECT_TYPES[object.type]
    return (!('maxHp' in type) || (Number.isFinite(object.hp) && object.hp > 0)) &&
      (!('size' in type) || isBuildingTerrainFree(state, staticFootprint(object))) &&
      isAreaFree(state, staticFootprint(object))
  }
  return false
}

// Состояние игры: что стоит на карте и что выбрано
export default {
  namespaced: true,
  state () {
    return {
      objects: structuredClone(START_OBJECTS),
      units: structuredClone(START_UNITS),
      terrainZones: structuredClone(TERRAIN_ZONES),
      nextObjectId: nextId(START_OBJECTS, START_UNITS),
      buildingType: null,
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
    getBuildingType: (state) => state.buildingType,
    getSelectedIds: (state) => state.selectedIds,
    getSelected: (state) => {
      if (state.selectedIds.length !== 1) {
        return null
      }
      const id = state.selectedIds[0]
      return state.objects.find((o) => o.id === id) ?? state.units.find((u) => u.id === id) ?? null
    },
    getStarted: (state) => state.started,
    // Игра идёт, если сценарий выбран и игра не закончена
    isRunning: (state, getters) => state.started && !getters.isGameOver,
    // Выбранные юниты игрока (группа PLAYER_GROUP)
    getOwnSelectedUnits: (state) => state.units.filter((u) => state.selectedIds.includes(u.id) && u.group === PLAYER_GROUP),
    getPaused: (state) => state.paused,
    getScenarioId: (state) => state.scenarioId,
    // Группы у которых остались юниты или здания, группа 0 не считается
    getAliveGroups: (state) => {
      const groups = [...state.units, ...state.objects].map((o) => o.group).filter((group) => group > 0)
      return [...new Set(groups)]
    },
    // Конец игры, когда осталась одна группа
    getWinner: (state, getters) => (getters.getAliveGroups.length === 1 ? getters.getAliveGroups[0] : null),
    isGameOver: (state, getters) => state.started && getters.getAliveGroups.length <= 1,
    getSelectedUnits: (state) => state.units.filter((u) => state.selectedIds.includes(u.id)),
  },
  mutations: {
    [MUTATIONS.SET_SELECTED_IDS]: (state, ids) => {
      state.selectedIds = ids
    },
    [MUTATIONS.SET_UNIT_TARGET]: (state, { id, target, reserved = [] }) => {
      const unit = state.units.find((u) => u.id === id)
      if (unit) {
        orderUnit(state, unit, target, reserved)
      }
    },
    // Удаляем объект по id и убираем из выбора
    [MUTATIONS.REMOVE_OBJECT]: (state, id) => {
      state.units = state.units.filter((u) => u.id !== id)
      state.objects = state.objects.filter((o) => o.id !== id)
      state.selectedIds = state.selectedIds.filter((selectedId) => selectedId !== id)
    },
    // Повторная проверка при добавлении: после превью место мог занять юнит
    [MUTATIONS.ADD_OBJECT]: (state, payload) => {
      if (!canAddObject(state, payload)) return
      // Отделяем позицию от запроса, в том числе реактивного объекта Vue
      const object = { ...payload.object, position: { ...payload.object.position } }
      if (payload.kind === 'unit') {
        object.target = null
        object.path = null
        object.blockedFor = 0
        state.units.push(object)
      } else {
        state.objects.push(object)
      }
      state.nextObjectId = Math.max(state.nextObjectId, object.id + 1)
    },
    [MUTATIONS.SET_BUILDING_TYPE]: (state, type) => {
      state.buildingType = type
    },
    [MUTATIONS.SET_PAUSED]: (state, paused) => {
      state.paused = paused
      if (paused) state.buildingType = null
    },
    [MUTATIONS.LOAD_SCENARIO]: (state, scenario) => {
      state.objects = structuredClone(scenario.objects)
      state.units = structuredClone(scenario.units)
      state.terrainZones = structuredClone(TERRAIN_ZONES)
      state.nextObjectId = nextId(scenario.objects, scenario.units)
      state.buildingType = null
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
      state.buildingType = null
    },
    // Двигаем время сценария и запускаем события
    [MUTATIONS.RUN_SCENARIO_EVENTS]: (state, secondsPassed) => {
      state.scenarioTime += secondsPassed
      const due = state.pendingEvents.filter((e) => e.at <= state.scenarioTime)
      due.forEach((e) => {
        const unit = state.units.find((u) => u.id === e.unitId)
        if (unit) {
          orderUnit(state, unit, e.target)
        }
      })
      state.pendingEvents = state.pendingEvents.filter((e) => e.at > state.scenarioTime)
    },
    [MUTATIONS.MOVE_UNITS]: (state, secondsPassed) => {
      advanceUnits(state, secondsPassed)
    },
  },
  actions: {
    startBuilding: (store, type) => {
      if (!store.getters.isRunning || store.state.paused || !getBuildingType(type)) return false
      store.commit(MUTATIONS.SET_BUILDING_TYPE, type)
      return true
    },
    cancelBuilding: (store) => {
      store.commit(MUTATIONS.SET_BUILDING_TYPE, null)
    },
    placeBuilding: (store, point) => {
      const typeId = store.state.buildingType
      if (!store.getters.isRunning || store.state.paused || !typeId) return false
      // Проверяем актуальный мир повторно: под превью мог зайти юнит
      const placement = getBuildingPlacement(store.state, typeId, point)
      if (!placement?.valid) return false
      const type = getBuildingType(typeId)
      store.commit(MUTATIONS.ADD_OBJECT, {
        kind: 'static',
        object: {
          id: store.state.nextObjectId,
          type: typeId,
          position: placement.position,
          group: PLAYER_GROUP,
          hp: type.maxHp,
        },
      })
      store.commit(MUTATIONS.SET_BUILDING_TYPE, null)
      return true
    },
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
    // Shift + клик: юнит добавляется к выбору или убирается из него
    toggleSelect: (store, id) => {
      if (!store.getters.isRunning) {
        return
      }
      const ids = store.getters.getSelectedUnits.map((u) => u.id)
      store.commit(MUTATIONS.SET_SELECTED_IDS, ids.includes(id) ? ids.filter((i) => i !== id) : [...ids, id])
    },
    // Shift + рамка: новые юниты добавляются к уже выбранным
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
      if (!units.length) return
      const columns = Math.ceil(Math.sqrt(units.length))
      const rows = Math.ceil(units.length / columns)
      const spacing = Math.max(FORMATION_STEP, ...units.map((unit) => UNIT_TYPES[unit.type].width + 8))
      // В пределах приказа каждое место назначается только одному юниту
      const reserved = []
      units.forEach((unit, index) => {
        const column = index % columns
        const row = Math.floor(index / columns)
        store.commit(MUTATIONS.SET_UNIT_TARGET, {
          id: unit.id,
          target: clampUnitTarget(unit, {
            x: point.x + (column - (columns - 1) / 2) * spacing,
            y: point.y + (row - (rows - 1) / 2) * spacing,
          }),
          reserved,
        })
        if (unit.target) reserved.push({ ...unitFootprint(unit), position: unit.target })
      })
    },
    // Возвращает true при добавлении и false при отказе
    addObject: (store, payload) => {
      if (!store.getters.isRunning || store.state.paused || !payload || !canAddObject(store.state, payload)) return false
      store.commit(MUTATIONS.ADD_OBJECT, payload)
      return true
    },
    // Уничтожить объект по id
    destroyObject: (store, id) => {
      store.commit(MUTATIONS.REMOVE_OBJECT, id)
      if (!store.getters.isRunning) store.commit(MUTATIONS.SET_BUILDING_TYPE, null)
    },
    // Удаляем объекты у которых hp <= 0
    removeDead: (store) => {
      if (!store.getters.isRunning || store.state.paused) {
        return
      }
      const dead = [...store.state.units, ...store.state.objects].filter((o) => o.hp !== undefined && o.hp <= 0)
      dead.forEach((o) => store.dispatch('destroyObject', o.id))
    },
    // Самоуничтожение выбранных юнитов
    destroySelectedUnits: (store) => {
      if (!store.getters.isRunning) {
        return
      }
      store.getters.getSelectedUnits.forEach((unit) => store.dispatch('destroyObject', unit.id))
    },
    // Пауза: нажали - стоим, ещё раз - продолжаем
    togglePause: (store) => {
      store.commit(MUTATIONS.SET_PAUSED, !store.state.paused)
    },
    // Запустить сценарий по id
    loadScenario: (store, id) => {
      const scenario = SCENARIOS.find((s) => s.id === id)
      if (scenario) {
        store.commit(MUTATIONS.LOAD_SCENARIO, scenario)
      }
    },
    openMenu: (store) => {
      store.commit(MUTATIONS.OPEN_MENU)
    },
    // События сценария (на паузе и в меню не идут)
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

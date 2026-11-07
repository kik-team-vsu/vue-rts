import START_UNITS, { OBJECT_TYPES, PLAYER_GROUP, START_OBJECTS, UNIT_TYPES } from '@/game/config'
import { SCENARIOS } from '@/game/scenarios'
import { advanceUnits, clampUnitTarget, orderUnit } from '@/game/movement'
import { isAreaFree, staticFootprint, unitFootprint } from '@/game/spatial'
import { isFootprintTerrainPassable } from '@/game/terrain'

// новая постройка ставится только на сушу, новый юнит - только на свою местность
const fitsTerrain = (state, kind, object, area) =>
  isFootprintTerrainPassable(area, state.terrainZones, kind === 'unit' ? UNIT_TYPES[object.type].terrain : 'land')

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
  APPLY_DAMAGE: 'APPLY_DAMAGE',
  STOP_UNIT: 'STOP_UNIT',
  STOP_ATTACK: 'STOP_ATTACK',
}

const FORMATION_STEP = 40
const ATTACK_RANGE = 50 // минимальная дальность атаки между центрами юнитов
const CLICK_RADIUS = 20 // радиус поиска юнита под правым кликом

// Дальность атаки пары юнитов: корпуса не дают сблизиться центрам ближе
// полусуммы ширин, а путь заканчивается на центре свободной клетки (клетка 50).
// Поэтому у пар шире базы дальность - контакт корпусов плюс клетка запаса,
// иначе корабли останавливаются на контакте, не добрав до дальности атаки
const attackRange = (unit, target) => {
  const contact = (UNIT_TYPES[unit.type].width + UNIT_TYPES[target.type].width) / 2
  return contact <= ATTACK_RANGE ? ATTACK_RANGE : contact + ATTACK_RANGE
}

const canAddObject = (state, { kind, object }) => {
  if (!object || !Number.isSafeInteger(object.id) || object.id <= 0 ||
    !Number.isInteger(object.group) || object.group < 0) return false
  // ID общий для юнитов и статичных объектов
  if ([...state.objects, ...state.units].some((item) => item.id === object.id)) return false
  if (kind === 'unit' && Object.hasOwn(UNIT_TYPES, object.type)) {
    return Number.isFinite(object.hp) && object.hp > 0 && isAreaFree(state, unitFootprint(object)) &&
      fitsTerrain(state, kind, object, unitFootprint(object))
  }
  if (kind === 'static' && Object.hasOwn(OBJECT_TYPES, object.type)) {
    const type = OBJECT_TYPES[object.type]
    return (!('maxHp' in type) || (Number.isFinite(object.hp) && object.hp > 0)) &&
      isAreaFree(state, staticFootprint(object)) && fitsTerrain(state, kind, object, staticFootprint(object))
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
      // до старта в меню показываем карту первого сценария - базового
      terrainZones: structuredClone(SCENARIOS[0].terrain),
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
    // Приказ юниту: точка движения (со слотом строя) и, для атаки, цель ударов;
    // обычное движение передаётся без targetId и сбрасывает режим атаки
    [MUTATIONS.SET_UNIT_TARGET]: (state, { id, target, targetId, isAttacking, reserved = [] }) => {
      const unit = state.units.find((u) => u.id === id)
      if (unit) {
        orderUnit(state, unit, target, reserved)
        unit.targetId = targetId ?? null
        unit.isAttacking = isAttacking ?? false
      }
    },
    // Наносим урон юниту-цели; мёртвых убирает removeDead
    [MUTATIONS.APPLY_DAMAGE]: (state, { targetId, damage }) => {
      const target = state.units.find((u) => u.id === targetId)
      if (target) {
        target.hp -= damage
      }
    },
    // Снимаем приказ движения, режим атаки сохраняем (юнит в радиусе атаки)
    [MUTATIONS.STOP_UNIT]: (state, id) => {
      const unit = state.units.find((u) => u.id === id)
      if (unit) {
        unit.target = null
        unit.path = null
      }
    },
    // Выходим из режима атаки: цель умерла или отменена другим приказом
    [MUTATIONS.STOP_ATTACK]: (state, id) => {
      const unit = state.units.find((u) => u.id === id)
      if (unit) {
        unit.isAttacking = false
        unit.targetId = null
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
      state.terrainZones = structuredClone(scenario.terrain)
    },
    [MUTATIONS.OPEN_MENU]: (state) => {
      state.started = false
      state.paused = false
      state.selectedIds = []
    },
    // Двигаем время сценария и запускаем события
    [MUTATIONS.RUN_SCENARIO_EVENTS]: (state, secondsPassed) => {
      state.scenarioTime += secondsPassed
      const due = state.pendingEvents.filter((e) => e.at <= state.scenarioTime)
      due.forEach((e) => {
        const unit = state.units.find((u) => u.id === e.unitId)
        if (unit) {
          orderUnit(state, unit, e.target)
          // сценарный приказ движения отменяет атаку
          unit.targetId = null
          unit.isAttacking = false
        }
      })
      state.pendingEvents = state.pendingEvents.filter((e) => e.at > state.scenarioTime)
    },
    [MUTATIONS.MOVE_UNITS]: (state, secondsPassed) => {
      advanceUnits(state, secondsPassed)
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
    // Shift + клик: юнит добавляется к выбору или убирается из него
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
      if (!units.length) return
      const columns = Math.ceil(Math.sqrt(units.length))
      const rows = Math.ceil(units.length / columns)
      const spacing = Math.max(FORMATION_STEP, ...units.map((unit) => UNIT_TYPES[unit.type].width + 8))
      // В пределах приказа каждое место назначается только одному юниту
      const reserved = []
      // Юнит под курсором ищется один раз до цикла; клик по чужому юниту - приказ атаки
      const clickedUnit = store.state.units.find((u) =>
        Math.abs(u.position.x - point.x) < CLICK_RADIUS && Math.abs(u.position.y - point.y) < CLICK_RADIUS)

      units.forEach((unit, index) => {
        if (clickedUnit && clickedUnit.group !== unit.group) {
          store.dispatch('attackUnit', { attackerId: unit.id, targetId: clickedUnit.id })
          return
        }
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
    },
    // Приказ атаки: сближение через обычный поиск пути, урон идёт в moveUnits
    attackUnit: (store, { attackerId, targetId }) => {
      const attacker = store.state.units.find((u) => u.id === attackerId)
      const target = store.state.units.find((u) => u.id === targetId)
      if (attacker && target) {
        store.commit(MUTATIONS.SET_UNIT_TARGET, {
          id: attackerId,
          target: { ...target.position },
          targetId,
          isAttacking: true,
        })
      }
    },
    // удаляем объекты у которых hp <= 0
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
    // Движение юнитов и логика атаки
    moveUnits: (store, secondsPassed) => {
      if (!store.state.started || store.state.paused || store.getters.isGameOver) {
        return
      }

      // 1. Атака не зависит от приказов на движение: догоняем цель, в радиусе стоим и бьём
      store.state.units.forEach((unit) => {
        if (!unit.isAttacking || !unit.targetId) return
        const target = store.state.units.find((u) => u.id === unit.targetId)
        if (!target) {
          // Цель умерла или исчезла - выходим из режима атаки
          store.commit(MUTATIONS.STOP_ATTACK, unit.id)
          return
        }
        const distance = Math.hypot(unit.position.x - target.position.x, unit.position.y - target.position.y)
        if (distance <= attackRange(unit, target)) {
          // В радиусе атаки стоим и бьём, приказ движения больше не нужен
          if (unit.target) store.commit(MUTATIONS.STOP_UNIT, unit.id)
          const stats = UNIT_TYPES[unit.type]
          store.commit(MUTATIONS.APPLY_DAMAGE, {
            targetId: target.id,
            damage: stats.strength * stats.attackSpeed * secondsPassed,
          })
          return
        }
        // Цель жива, но отошла от точки приказа дальше дальности атаки - догоняем по текущей позиции
        const goal = unit.target
        if (!goal || Math.hypot(target.position.x - goal.x, target.position.y - goal.y) > ATTACK_RANGE) {
          store.commit(MUTATIONS.SET_UNIT_TARGET, {
            id: unit.id,
            target: { ...target.position },
            targetId: target.id,
            isAttacking: true,
          })
        }
      })

      // 2. Движение (только если есть цель)
      if (store.state.units.some((u) => u.target)) {
        store.commit(MUTATIONS.MOVE_UNITS, secondsPassed)
      }
    },
  },
}
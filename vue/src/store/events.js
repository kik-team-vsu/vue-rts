import { UNIT_TYPES } from '@/game/config'
import { clampUnitTarget } from '@/game/movement'
import { unitFootprint } from '@/game/spatial'

// Хранилище текущих событий (формат - GameEvent в game/types.ts).
// Игрок и сценарии только создают события, а применяет их к элементам карты игровой цикл (engine/tick):
// событие move при старте прокладывает юниту маршрут (A* из game/pathfinding), а когда юнит дошёл - завершается.

const MUTATIONS = {
  ADD: 'ADD',
  REMOVE: 'REMOVE',
  REMOVE_BY_ACTOR: 'REMOVE_BY_ACTOR',
  CLEAR: 'CLEAR',
  SET_STARTED: 'SET_STARTED',
  SET_STATUS: 'SET_STATUS',
  SET_NEXT: 'SET_NEXT',
  SET_TARGET: 'SET_TARGET',
}

export const EVENT_STATUS = {
  ACTIVE: 'active',
  WAITING: 'waiting',
}

// расстояние между юнитами в строю
const FORMATION_STEP = 40

// Точки для группы юнитов вокруг point: квадратный строй, чтобы юниты не сбивались в одну точку
const formationTargets = (units, point) => {
  const columns = Math.ceil(Math.sqrt(units.length))
  const rows = Math.ceil(units.length / columns)
  const spacing = Math.max(FORMATION_STEP, ...units.map((unit) => UNIT_TYPES[unit.type].width + 8))
  return units.map((unit, index) => {
    const column = index % columns
    const row = Math.floor(index / columns)
    return clampUnitTarget(unit, {
      x: point.x + (column - (columns - 1) / 2) * spacing,
      y: point.y + (row - (rows - 1) / 2) * spacing,
    })
  })
}

export default {
  namespaced: true,
  state () {
    return {
      list: [],
      nextId: 1,
    }
  },
  getters: {
    getAll: (state) => state.list,
    // события, которые выполняются сейчас
    getActive: (state) => state.list.filter((e) => e.status === EVENT_STATUS.ACTIVE),
    // что объект делает сейчас (или null)
    getCurrent: (state) => (actorId) =>
      state.list.find((e) => e.actorId === actorId && e.status === EVENT_STATUS.ACTIVE) ?? null,
    // все события объекта по порядку выполнения: от текущего по ссылкам nextId
    getByActor: (state) => (actorId) => {
      const events = state.list.filter((e) => e.actorId === actorId)
      const result = []
      let event = events.find((e) => !events.some((other) => other.nextId === e.id))
      while (event) {
        result.push(event)
        event = events.find((e) => e.id === result[result.length - 1].nextId)
      }
      return result
    },
  },
  mutations: {
    [MUTATIONS.ADD]: (state, event) => {
      state.list.push({ ...event, id: state.nextId })
      state.nextId++
    },
    [MUTATIONS.REMOVE]: (state, id) => {
      state.list = state.list.filter((e) => e.id !== id)
    },
    [MUTATIONS.REMOVE_BY_ACTOR]: (state, actorId) => {
      state.list = state.list.filter((e) => e.actorId !== actorId)
    },
    [MUTATIONS.CLEAR]: (state) => {
      state.list = []
    },
    [MUTATIONS.SET_STATUS]: (state, { id, status }) => {
      const event = state.list.find((e) => e.id === id)
      if (event) {
        event.status = status
      }
    },
    [MUTATIONS.SET_NEXT]: (state, { id, nextId }) => {
      const event = state.list.find((e) => e.id === id)
      if (event) {
        event.nextId = nextId
      }
    },
    // новая точка назначения: маршрут к ней проложится заново при старте события
    [MUTATIONS.SET_TARGET]: (state, { id, target }) => {
      const event = state.list.find((e) => e.id === id)
      if (event) {
        event.target = target
        event.started = false
      }
    },
    [MUTATIONS.SET_STARTED]: (state, id) => {
      const event = state.list.find((e) => e.id === id)
      if (event) {
        event.started = true
      }
    },
  },
  actions: {
    // Новое событие объекта.
    // append = false: прежние события объекта отменяются, новое начинается сразу.
    // append = true (Shift): событие встаёт в конец очереди и начнётся, когда завершится предыдущее
    create: ({ state, commit, getters }, { type, actorId, target = null, targetId = null, append = false }) => {
      const id = state.nextId
      if (!append) {
        commit(MUTATIONS.REMOVE_BY_ACTOR, actorId)
      }
      const queue = append ? getters.getByActor(actorId) : []
      const last = queue[queue.length - 1]
      const status = last ? EVENT_STATUS.WAITING : EVENT_STATUS.ACTIVE
      commit(MUTATIONS.ADD, { type, actorId, target, targetId, status, started: false, nextId: null })
      if (last) {
        commit(MUTATIONS.SET_NEXT, { id: last.id, nextId: id })
      }
      return id
    },
    // Приказ «идти в точку» группе юнитов (ПКМ игрока или событие сценария): каждому своя точка в строю.
    // append - добавить точку в конец очереди (Shift + ПКМ)
    orderMove: ({ dispatch, rootGetters }, { actorIds, point, append = false }) => {
      if (!rootGetters['game/isRunning'] || !Number.isFinite(point?.x) || !Number.isFinite(point?.y)) {
        return
      }
      const units = actorIds.map((id) => rootGetters['world/getById'](id)).filter((unit) => unit && unit.type in UNIT_TYPES)
      if (!units.length) {
        return
      }
      const targets = formationTargets(units, point)
      units.forEach((unit, index) => {
        dispatch('create', { type: 'move', actorId: unit.id, target: targets[index], append })
      })
      dispatch('startPending')
    },
    // Перенести точку последнего приказа move группы (ведение за курсором при зажатой ПКМ).
    // Очередь не трогаем: меняется только последняя точка. Юнит без приказов получает новый приказ
    retargetMove: ({ getters, commit, dispatch, rootGetters }, { actorIds, point }) => {
      if (!rootGetters['game/isRunning'] || !Number.isFinite(point?.x) || !Number.isFinite(point?.y)) {
        return
      }
      const units = actorIds.map((id) => rootGetters['world/getById'](id)).filter((unit) => unit && unit.type in UNIT_TYPES)
      const targets = formationTargets(units, point)
      units.forEach((unit, index) => {
        const queue = getters.getByActor(unit.id)
        const last = queue[queue.length - 1]
        if (last?.type === 'move') {
          commit(MUTATIONS.SET_TARGET, { id: last.id, target: targets[index] })
        } else {
          dispatch('create', { type: 'move', actorId: unit.id, target: targets[index], append: true })
        }
      })
      dispatch('startPending')
    },
    // Запустить новые активные события move: проложить маршрут.
    // Юниты, начавшие движение в одном кадре, не получают одно и то же место назначения (reserved)
    startPending: ({ getters, commit, rootGetters }) => {
      const reserved = []
      for (const event of getters.getActive.filter((e) => e.type === 'move' && !e.started)) {
        commit('world/SET_UNIT_TARGET', { id: event.actorId, target: event.target, reserved }, { root: true })
        commit(MUTATIONS.SET_STARTED, event.id)
        const unit = rootGetters['world/getById'](event.actorId)
        if (unit?.target) {
          reserved.push({ ...unitFootprint(unit), position: unit.target })
        }
      }
    },
    // Каждый кадр после движения: событие move выполнено, если юнит дошёл или пути нет; юнит пропал - событие тоже.
    // Следующее по очереди событие сразу получает маршрут, юнит идёт дальше без остановки
    finishArrived: ({ getters, dispatch, rootGetters }) => {
      let finished = false
      for (const event of getters.getActive.filter((e) => e.type === 'move' && e.started)) {
        const unit = rootGetters['world/getById'](event.actorId)
        if (!unit || !unit.target) {
          dispatch('complete', event.id)
          finished = true
        }
      }
      if (finished) {
        dispatch('startPending')
      }
    },
    // событие выполнено: удаляем его и запускаем следующее по цепочке
    complete: ({ state, commit }, id) => {
      const event = state.list.find((e) => e.id === id)
      if (!event) {
        return
      }
      commit(MUTATIONS.REMOVE, id)
      if (event.nextId !== null) {
        commit(MUTATIONS.SET_STATUS, { id: event.nextId, status: EVENT_STATUS.ACTIVE })
      }
    },
    // отменить все события объекта (объект уничтожен)
    cancelActor: ({ commit }, actorId) => {
      commit(MUTATIONS.REMOVE_BY_ACTOR, actorId)
    },
    // сбросить все события (новый сценарий, выход в меню)
    clear: ({ commit }) => {
      commit(MUTATIONS.CLEAR)
    },
  },
}

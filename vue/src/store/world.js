import START_UNITS, {OBJECT_TYPES, START_OBJECTS, UNIT_TYPES} from '@/game/config'
import {SCENARIOS} from '@/game/scenarios'
import {advanceUnits, orderUnit} from '@/game/movement'
//import {isAreaFree, staticFootprint, unitFootprint} from '@/game/spatial'
import {isFootprintTerrainPassable} from '@/game/terrain'
import {findNearestFreePosition, isAreaFree, staticFootprint, unitFootprint} from '@/game/spatial'

// Хранилище всех элементов карты: статичные объекты (здания, деревья), юниты и зоны местности.
// Состояние модуля - это CollisionWorld

const MUTATIONS = {
    LOAD: 'LOAD',
    ADD_OBJECT: 'ADD_OBJECT',
    REMOVE_OBJECT: 'REMOVE_OBJECT',
    SET_UNIT_TARGET: 'SET_UNIT_TARGET',
    MOVE_UNITS: 'MOVE_UNITS',
    APPLY_DAMAGE: 'APPLY_DAMAGE',
    STOP_UNIT: 'STOP_UNIT',
    STOP_ATTACK: 'STOP_ATTACK',
    START_PRODUCTION: 'START_PRODUCTION',
    TICK_PRODUCTION: 'TICK_PRODUCTION',
    REMOVE_PRODUCTION: 'REMOVE_PRODUCTION',
}

// новая постройка ставится только на сушу, новый юнит - только на свою местность
const fitsTerrain = (state, kind, object, area) =>
    isFootprintTerrainPassable(area, state.terrainZones, kind === 'unit' ? UNIT_TYPES[object.type].terrain : 'land')

const canAddObject = (state, {kind, object}) => {
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

// можно ли сейчас менять мир: сценарий идёт и не на паузе
const isActive = (rootState, rootGetters) => rootGetters['game/isRunning'] && !rootState.game.paused

// Юнит, готовый появиться из здания: объект юнита и ближайшая свободная позиция рядом.
// null - если свободного места нет, спавн повторится в следующем кадре
const makeSpawnedUnit = (state, building, unitType) => {
    const unitStats = UNIT_TYPES[unitType]
    const unit = {
        // ID общий для юнитов и зданий: берём следующий после самого большого
        id: Math.max(0, ...[...state.objects, ...state.units].map((o) => o.id)) + 1,
        type: unitType,
        group: building.group,
        hp: unitStats.maxHp,
        position: building.position,
        target: null,
    }
    // ищем от центра здания: первое свободное место окажется вплотную к нему
    const position = findNearestFreePosition(state, unitFootprint(unit), {
        accept: (point) => fitsTerrain(state, 'unit', unit, unitFootprint({...unit, position: point})),
    })
    return position ? {...unit, position} : null
}

export default {
    namespaced: true,
    state() {
        return {
            objects: structuredClone(START_OBJECTS),
            units: structuredClone(START_UNITS),
            // до старта в меню показываем карту первого сценария - базового
            terrainZones: structuredClone(SCENARIOS[0].terrain),
            // задания производства юнитов в зданиях (ProductionJob): у здания не бывает двух сразу
            production: [],
        }
    },
    getters: {
        getObjects: (state) => state.objects,
        getUnits: (state) => state.units,
        getTerrainZones: (state) => state.terrainZones,
        getAll: (state) => [...state.objects, ...state.units],
        // объект или юнит по id, null если такого нет
        getById: (state) => (id) => state.objects.find((o) => o.id === id) ?? state.units.find((u) => u.id === id) ?? null,
        // группы, у которых остались юниты или здания; группа 0 не считается
        getAliveGroups: (state, getters) => [...new Set(getters.getAll.map((o) => o.group).filter((group) => group > 0))],
        // задание производства здания по его id, null - здание ничего не создаёт
        getProductionByBuilding: (state) => (buildingId) =>
            state.production.find((job) => job.buildingId === buildingId) ?? null,
    },
    mutations: {
        // расстановка и местность сценария
        [MUTATIONS.LOAD]: (state, scenario) => {
            state.objects = structuredClone(scenario.objects)
            state.units = structuredClone(scenario.units)
            state.terrainZones = structuredClone(scenario.terrain)
            state.production = []
        },
        // Повторная проверка при добавлении: после превью место мог занять юнит
        [MUTATIONS.ADD_OBJECT]: (state, payload) => {
            if (!canAddObject(state, payload)) return
            // Отделяем позицию от запроса, в том числе реактивного объекта Vue
            const object = {...payload.object, position: {...payload.object.position}}
            if (payload.kind === 'unit') {
                object.target = null
                object.path = null
                object.blockedFor = 0
                state.units.push(object)
            } else {
                state.objects.push(object)
            }
        },
        [MUTATIONS.REMOVE_OBJECT]: (state, id) => {
            state.units = state.units.filter((u) => u.id !== id)
            state.objects = state.objects.filter((o) => o.id !== id)
        },
        // проложить юниту маршрут к точке (вызывает стор событий при старте события move или attack);
        // атака передаёт targetId и isAttacking, обычное движение их сбрасывает
        [MUTATIONS.SET_UNIT_TARGET]: (state, {id, target, targetId, isAttacking, reserved = []}) => {
            const unit = state.units.find((u) => u.id === id)
            if (unit) {
                orderUnit(state, unit, target, reserved)
                unit.targetId = targetId ?? null
                unit.isAttacking = isAttacking ?? false
            }
        },
        [MUTATIONS.MOVE_UNITS]: (state, secondsPassed) => {
            advanceUnits(state, secondsPassed)
        },
        // Наносим урон юниту-цели; мёртвых убирает removeDead
        [MUTATIONS.APPLY_DAMAGE]: (state, {targetId, damage}) => {
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
        // Здание начинает создавать юнита; одно задание на здание
        [MUTATIONS.START_PRODUCTION]: (state, job) => {
            if (state.production.some((item) => item.buildingId === job.buildingId)) return
            state.production.push({...job})
        },
        // Время производства идёт вперёд (вызывается только когда мир активен)
        [MUTATIONS.TICK_PRODUCTION]: (state, secondsPassed) => {
            state.production.forEach((job) => {
                job.elapsed += secondsPassed
            })
        },
        // Задание снято: юнит создан или здание исчезло
        [MUTATIONS.REMOVE_PRODUCTION]: (state, buildingId) => {
            state.production = state.production.filter((job) => job.buildingId !== buildingId)
        },
    },
    actions: {
        // расставить объекты и местность сценария
        load: ({commit}, scenario) => {
            commit(MUTATIONS.LOAD, scenario)
        },
        // Возвращает true при добавлении и false при отказе (для спавна и стройки)
        addObject: ({state, commit, rootState, rootGetters}, payload) => {
            if (!isActive(rootState, rootGetters) || !payload || !canAddObject(state, payload)) return false
            commit(MUTATIONS.ADD_OBJECT, payload)
            return true
        },
        // Спавн: выбранное здание начинает создавать юнита типа unitType.
        // Юнит появится рядом со зданием через UNIT_TYPES[unitType].buildSeconds секунд -
        // до этого на здании и кнопке растёт полоса прогресса (updateProduction)
        spawnUnit: ({state, commit, rootGetters}, unitType) => {
            const building = rootGetters['selection/getSelected']
            if (!building || !Object.hasOwn(OBJECT_TYPES, building.type) || !Object.hasOwn(UNIT_TYPES, unitType)) {
                return false
            }
            const spawns = OBJECT_TYPES[building.type].spawns ?? []
            // одно задание на здание: пока идёт производство, новое не начнём
            if (!spawns.includes(unitType) || state.production.some((job) => job.buildingId === building.id)) {
                return false
            }
            commit(MUTATIONS.START_PRODUCTION, {
                buildingId: building.id,
                unitType,
                elapsed: 0,
                duration: UNIT_TYPES[unitType].buildSeconds,
            })
            return true
        },
        // Производство (каждый кадр из engine/tick): время заданий идёт вперёд,
        // готовые создают юнита на ближайшем свободном месте у здания.
        // Здание погибло - задание пропадает; место занято - ждём и пробуем в следующем кадре
        updateProduction: ({state, commit, dispatch, rootState, rootGetters}, secondsPassed) => {
            if (!isActive(rootState, rootGetters)) {
                return
            }
            commit(MUTATIONS.TICK_PRODUCTION, secondsPassed)
            state.production
                .filter((job) => job.elapsed >= job.duration)
                .forEach((job) => {
                    const building = state.objects.find((o) => o.id === job.buildingId)
                    const unit = building && makeSpawnedUnit(state, building, job.unitType)
                    if (!building || (unit && dispatch('addObject', {kind: 'unit', object: unit}))) {
                        commit(MUTATIONS.REMOVE_PRODUCTION, job.buildingId)
                    }
                })
        },
        // Уничтожить объект по id: он пропадает с карты, из выбора, вместе со своими событиями и производством
        destroyObject: ({commit, dispatch}, id) => {
            commit(MUTATIONS.REMOVE_OBJECT, id)
            commit(MUTATIONS.REMOVE_PRODUCTION, id)
            dispatch('selection/deselect', id, {root: true})
            dispatch('events/cancelActor', id, {root: true})
        },
        // Самоуничтожение выбранных юнитов
        destroySelectedUnits: ({dispatch, rootGetters}) => {
            if (!rootGetters['game/isRunning']) {
                return
            }
            rootGetters['selection/getSelectedUnits'].forEach((unit) => dispatch('destroyObject', unit.id))
        },
        // Удаляем объекты у которых hp <= 0
        removeDead: ({state, dispatch, rootState, rootGetters}) => {
            if (!isActive(rootState, rootGetters)) {
                return
            }
            const dead = [...state.units, ...state.objects].filter((o) => o.hp !== undefined && o.hp <= 0)
            dead.forEach((o) => dispatch('destroyObject', o.id))
        },
        moveUnits: ({state, commit, rootState, rootGetters}, secondsPassed) => {
            if (!isActive(rootState, rootGetters)) {
                return
            }
            if (state.units.some((u) => u.target)) {
                commit(MUTATIONS.MOVE_UNITS, secondsPassed)
            }
        },
    },
}

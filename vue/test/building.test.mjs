import assert from 'node:assert/strict'
import { after, test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'
import { createStore } from 'vuex'

const server = await createServer({
  configFile: false,
  root: fileURLToPath(new URL('../', import.meta.url)),
  cacheDir: fileURLToPath(new URL('../node_modules/.vite-test-building', import.meta.url)),
  resolve: { alias: { '@': fileURLToPath(new URL('../src', import.meta.url)) } },
  server: { middlewareMode: true, hmr: false, ws: false },
  optimizeDeps: { noDiscovery: true, include: [] },
  appType: 'custom',
  logLevel: 'error',
})
after(() => server.close())
const { getBuildingPlacement } = await server.ssrLoadModule('/src/game/building.ts')
const { OBJECT_TYPES, PLAYER_GROUP } = await server.ssrLoadModule('/src/game/config.ts')
const { default: game } = await server.ssrLoadModule('/src/store/game.js')
const emptyWorld = (terrainZones = []) => ({ units: [], objects: [], terrainZones })
const makeStore = (terrainZones = []) => createStore({
  strict: true,
  modules: { game: { ...game, state: () => ({ ...game.state(), started: true, terrainZones }) } },
})
const build = async (store, type = 'tower', point = { x: 1000, y: 1000 }) => {
  assert.equal(await store.dispatch('game/startBuilding', type), true)
  assert.equal(await store.dispatch('game/placeBuilding', point), true)
  return store.state.game.objects.at(-1)
}

test('1x1, 2x2 and 4x4 bases snap by their upper-left cell, including negative coordinates', () => {
  for (const [type, center] of [['tower', 25], ['house', 50], ['castle', 100]]) {
    const placement = getBuildingPlacement(emptyWorld(), type, { x: 0, y: 0 })
    assert.equal(placement.valid, true)
    assert.deepEqual(placement.position, { x: center, y: center })
  }
  const negative = getBuildingPlacement(emptyWorld(), 'tower', { x: -0.1, y: -0.1 })
  assert.deepEqual(negative.position, { x: -25, y: -25 })
})

test('the full base must fit the map; an invalid position is not clamped inside', () => {
  assert.equal(getBuildingPlacement(emptyWorld(), 'castle', { x: 1300, y: 1300 }).valid, true)
  assert.equal(getBuildingPlacement(emptyWorld(), 'castle', { x: -1500, y: -1500 }).valid, true)
  const invalid = getBuildingPlacement(emptyWorld(), 'castle', { x: 1350, y: 1350 })
  assert.equal(invalid.valid, false)
  assert.equal(invalid.reason, 'За пределами карты')
  assert.deepEqual(invalid.position, { x: 1450, y: 1450 })
  assert.equal(getBuildingPlacement(emptyWorld(), 'tree', { x: 0, y: 0 }), null)
  assert.equal(getBuildingPlacement(emptyWorld(), 'tower', { x: NaN, y: 0 }), null)
})

test('a small patch of lake, river or mountain under the edge blocks the whole building', () => {
  for (const type of ['lake', 'river', 'mountain']) {
    const world = emptyWorld([{ type, x: 45, y: 0, width: 5, height: 50 }])
    const placement = getBuildingPlacement(world, 'tower', { x: 0, y: 0 })
    assert.equal(placement.valid, false)
    assert.equal(placement.reason, 'Неподходящая местность')
  }
  assert.equal(getBuildingPlacement(emptyWorld([
    { type: 'sand', x: 0, y: 0, width: 50, height: 50 },
  ]), 'tower', { x: 0, y: 0 }).valid, true)
  assert.equal(getBuildingPlacement(emptyWorld([
    { type: 'lake', x: 50, y: 0, width: 50, height: 50 },
  ]), 'tower', { x: 0, y: 0 }).valid, true)
})

test('units, trees and buildings block placement', () => {
  const point = { x: 0, y: 0 }
  for (const type of ['tree', 'house', 'castle']) {
    const world = emptyWorld()
    world.objects.push({ id: 1, type, position: { x: 25, y: 25 }, group: 1 })
    assert.equal(getBuildingPlacement(world, 'tower', point).valid, false)
  }
  const world = emptyWorld()
  world.units.push({ id: 1, type: 'worker', position: { x: 25, y: 25 }, group: 1, hp: 50, target: null })
  assert.equal(getBuildingPlacement(world, 'tower', point).valid, false)
})

test('confirmation rechecks a formerly green preview and keeps invalid placement active', async () => {
  const store = makeStore()
  const point = { x: 1000, y: 1000 }
  assert.equal(getBuildingPlacement(store.state.game, 'tower', point).valid, true)
  await store.dispatch('game/startBuilding', 'tower')
  await store.dispatch('game/addObject', {
    kind: 'unit',
    object: { id: 100, type: 'worker', group: 1, hp: 50, target: null, position: { x: 1025, y: 1025 } },
  })
  const before = store.state.game.objects.length
  assert.equal(await store.dispatch('game/placeBuilding', point), false)
  assert.equal(store.state.game.objects.length, before)
  assert.equal(store.state.game.buildingType, 'tower')
  await store.dispatch('game/destroyObject', 100)
  assert.equal(await store.dispatch('game/placeBuilding', point), true)
  assert.equal(store.state.game.objects.at(-1).id, 101)
  assert.equal(store.state.game.buildingType, null)
})

test('new buildings have full HP and player group; deleting the last ID does not reuse it', async () => {
  const store = makeStore()
  const first = await build(store)
  const firstId = first.id
  assert.equal(first.group, PLAYER_GROUP)
  assert.equal(first.hp, OBJECT_TYPES.tower.maxHp)
  assert.deepEqual({ ...first.position }, { x: 1025, y: 1025 })
  await store.dispatch('game/destroyObject', firstId)
  const second = await build(store, 'house')
  assert.equal(second.id, firstId + 1)
  assert.equal(second.hp, OBJECT_TYPES.house.maxHp)
  const third = await build(store, 'castle', { x: 500, y: 1000 })
  assert.equal(third.hp, OBJECT_TYPES.castle.maxHp)
  const ids = [...store.state.game.objects, ...store.state.game.units].map((object) => object.id)
  assert.equal(new Set(ids).size, ids.length)
})

test('double confirmation creates one building and direct add cannot bypass water validation', async () => {
  const store = makeStore()
  await store.dispatch('game/startBuilding', 'tower')
  const point = { x: 1000, y: 1000 }
  const before = store.state.game.objects.length
  const results = await Promise.all([
    store.dispatch('game/placeBuilding', point), store.dispatch('game/placeBuilding', point),
  ])
  assert.deepEqual(results, [true, false])
  assert.equal(store.state.game.objects.length, before + 1)
  const waterStore = makeStore([{ type: 'lake', x: 1000, y: 1000, width: 50, height: 50 }])
  assert.equal(await waterStore.dispatch('game/addObject', {
    kind: 'static', object: { id: 100, type: 'tower', hp: 150, group: 1, position: { x: 1025, y: 1025 } },
  }), false)
})

test('cancel, pause, menu, restart and game over reset the building mode', async () => {
  const store = makeStore()
  assert.equal(await store.dispatch('game/startBuilding', 'tree'), false)
  await store.dispatch('game/startBuilding', 'tower')
  await store.dispatch('game/cancelBuilding')
  assert.equal(store.state.game.buildingType, null)
  assert.equal(await store.dispatch('game/placeBuilding', { x: 1000, y: 1000 }), false)
  await store.dispatch('game/startBuilding', 'tower')
  await store.dispatch('game/togglePause')
  assert.equal(store.state.game.buildingType, null)
  assert.equal(await store.dispatch('game/startBuilding', 'tower'), false)
  await store.dispatch('game/togglePause')
  await store.dispatch('game/startBuilding', 'house')
  await store.dispatch('game/openMenu')
  assert.equal(store.state.game.buildingType, null)
  assert.equal(await store.dispatch('game/startBuilding', 'tower'), false)
  await store.dispatch('game/loadScenario', 'base')
  await store.dispatch('game/startBuilding', 'castle')
  await store.dispatch('game/loadScenario', 'base')
  assert.equal(store.state.game.buildingType, null)
  await store.dispatch('game/startBuilding', 'tower')
  for (const id of [8, 11, 2]) await store.dispatch('game/destroyObject', id)
  assert.equal(store.getters['game/isGameOver'], true)
  assert.equal(store.state.game.buildingType, null)
})

import { isBlocked, isSegmentFree } from './obstacles'
import type { NavigationOptions } from './obstacles'
import {
  cellToPoint, COLS, componentAt, nearestReachableCell, navigationGrid, pointToCell, ROWS, withDynamicBlockers,
} from './navigation'
import { COLLISION_EPSILON, findNearestFreePosition, SEARCH_STEP, squareFootprint, unitFootprint } from './spatial'
import type { Point, StaticObject } from './types'

const STEP = SEARCH_STEP
const distance = (a: Point, b: Point) => Math.hypot(b.x - a.x, b.y - a.y)

interface PathOptions extends NavigationOptions {
  allowPartial?: boolean // разрешить остановку в ближайшем достижимом узле
}

interface PathNode {
  cell: number
  cost: number // пройденное расстояние
  priority: number // пройденное расстояние + оценка до цели
}

// Двоичная куча: ближайший кандидат A* извлекается за O(log n)
class PathQueue {
  private items: PathNode[] = []

  get length() { return this.items.length }

  push(item: PathNode) {
    let index = this.items.length
    this.items.push(item)
    while (index > 0) {
      const parent = Math.floor((index - 1) / 2)
      if (this.items[parent].priority <= item.priority) break
      this.items[index] = this.items[parent]
      index = parent
    }
    this.items[index] = item
  }

  pop() {
    const first = this.items[0]
    const last = this.items.pop()!
    if (this.items.length) {
      let index = 0
      while (index * 2 + 1 < this.items.length) {
        let child = index * 2 + 1
        if (child + 1 < this.items.length && this.items[child + 1].priority < this.items[child].priority) child++
        if (last.priority <= this.items[child].priority) break
        this.items[index] = this.items[child]
        index = child
      }
      this.items[index] = last
    }
    return first
  }
}

// Убираем промежуточные точки, если участок можно пройти напрямую
const smoothPath = (from: Point, points: Point[], free: (a: Point, b: Point) => boolean): Point[] => {
  const result: Point[] = []
  let anchor = from
  let index = 0
  while (index < points.length) {
    let next = index
    while (next + 1 < points.length && free(anchor, points[next + 1])) next++
    result.push(points[next])
    anchor = points[next]
    index = next + 1
  }
  return result
}

// A* по сетке 25 px. Статика заранее разложена в маски (navigation.ts):
// точная проверка отрезка нужна только у самых препятствий
export const findPath = (
  from: Point, to: Point, objects: readonly StaticObject[], margin: number, options: PathOptions = {},
): Point[] => {
  const free = (a: Point, b: Point) => isSegmentFree(a, b, objects, margin, options)
  if (!free(from, from)) return []

  const blockers = [
    ...(options.units ?? []).filter((unit) => unit.id !== options.ignoreId).map(unitFootprint),
    ...(options.reserved ?? []),
  ]
  const grid = withDynamicBlockers(navigationGrid(objects, margin, options.terrain, options.terrainZones), blockers, margin)
  const { blocked, hidden, near } = grid

  // Старт между узлами соединяем с сеткой только свободными отрезками
  const seeds: number[] = []
  const startCell = pointToCell(from)
  const startCol = startCell % COLS
  const startRow = Math.floor(startCell / COLS)
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (startCol + dx < 0 || startCol + dx >= COLS || startRow + dy < 0 || startRow + dy >= ROWS) continue
      const cell = (startRow + dy) * COLS + startCol + dx
      if (!blocked[cell] && free(from, cellToPoint(cell))) seeds.push(cell)
    }
  }
  // Старт в зоне перекрытия выходит наружу, компоненты для него не определены
  const startComponents = new Set(seeds.map((cell) => grid.component[cell]))
  const knownStart = seeds.length > 0 && !startComponents.has(-1)

  // Занятую цель заменяем ближайшей свободной точкой
  let goal = findNearestFreePosition(
    { objects, units: options.units ?? [] }, squareFootprint(to, margin),
    { ...options, accept: (point) => !isBlocked(point, objects, margin, options) },
  )
  // Цель в другой компоненте недостижима: не обходим всю карту, а сразу решаем,
  // отказать в приказе или остановиться у ближайшей достижимой клетки к цели
  if (knownStart && (!goal || !startComponents.has(componentAt(grid, goal)))) {
    if (options.allowPartial === false) return []
    const cell = nearestReachableCell(grid, pointToCell(goal ?? to), startComponents)
    goal = cell === -1 ? null : cellToPoint(cell)
  }
  if (!goal || distance(from, goal) < COLLISION_EPSILON) return []
  if (free(from, goal)) return [goal]

  const cost = new Float64Array(COLS * ROWS).fill(Infinity)
  const parent = new Int32Array(COLS * ROWS).fill(-1)
  const closed = new Uint8Array(COLS * ROWS)
  const open = new PathQueue()
  for (const cell of seeds) {
    const point = cellToPoint(cell)
    cost[cell] = distance(from, point)
    open.push({ cell, cost: cost[cell], priority: cost[cell] + distance(point, goal) })
  }

  let best = -1
  let bestDistance = distance(from, goal)
  let reached = false
  while (open.length) {
    const entry = open.pop()
    const cell = entry.cell
    // Более короткий путь мог добавить новую запись того же узла
    if (closed[cell] || entry.cost !== cost[cell]) continue
    closed[cell] = 1
    const point = cellToPoint(cell)
    const remaining = distance(point, goal)
    if (remaining < bestDistance) {
      best = cell
      bestDistance = remaining
    }
    if (remaining <= STEP * Math.SQRT2 && free(point, goal)) {
      best = cell
      reached = true
      break
    }
    const col = cell % COLS
    const row = (cell - col) / COLS
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if ((!dx && !dy) || col + dx < 0 || col + dx >= COLS || row + dy < 0 || row + dy >= ROWS) continue
        const next = cell + dy * COLS + dx
        // В зону перекрытия можно только выйти из неё, но не войти снаружи
        if (closed[next] || blocked[next] || (hidden[next] && !hidden[cell])) continue
        const nextCost = cost[cell] + (dx && dy ? STEP * Math.SQRT2 : STEP)
        if (nextCost >= cost[next]) continue
        const nextPoint = cellToPoint(next)
        // Вдали от препятствий ребро свободно по построению маски
        if ((near[cell] || near[next]) && !free(point, nextPoint)) continue
        cost[next] = nextCost
        parent[next] = cell
        open.push({ cell: next, cost: nextCost, priority: nextCost + distance(nextPoint, goal) })
      }
    }
  }

  // Для недостижимой цели возвращаем частичный путь, только если он разрешён
  if (best === -1 || (!reached && options.allowPartial === false)) return []
  const points: Point[] = []
  for (let cell = best; cell !== -1; cell = parent[cell]) points.push(cellToPoint(cell))
  points.reverse()
  if (reached) points.push(goal)
  return smoothPath(from, points, free).filter((point) => distance(from, point) > COLLISION_EPSILON)
}

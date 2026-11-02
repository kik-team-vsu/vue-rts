import { MAP } from './config'
import { isBlocked, isSegmentFree } from './obstacles'
import { COLLISION_EPSILON, findNearestFreePosition, SEARCH_STEP, squareFootprint } from './spatial'
import type { NavigationOptions } from './obstacles'
import type { Point, StaticObject } from './types'

const STEP = SEARCH_STEP
const COLS = Math.floor(MAP.width / STEP) + 1
const ROWS = Math.floor(MAP.height / STEP) + 1
const distance = (a: Point, b: Point) => Math.hypot(b.x - a.x, b.y - a.y)

interface PathOptions extends NavigationOptions {
  allowPartial?: boolean // разрешить остановку в ближайшем достижимом узле
}

// Узел сетки хранится числом: row * COLS + col
const cellToPoint = (cell: number): Point => ({
  x: -MAP.width / 2 + (cell % COLS) * STEP,
  y: -MAP.height / 2 + Math.floor(cell / COLS) * STEP,
})

const neighbors = (cell: number): number[] => {
  const col = cell % COLS
  const row = Math.floor(cell / COLS)
  const result = []
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if ((dx || dy) && col + dx >= 0 && col + dx < COLS && row + dy >= 0 && row + dy < ROWS) {
        result.push(cell + dy * COLS + dx)
      }
    }
  }
  return result
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

// A* по сетке 25 px использует ту же проверку отрезков, что движение
export const findPath = (
  from: Point, to: Point, objects: readonly StaticObject[], margin: number, options: PathOptions = {},
): Point[] => {
  const free = (a: Point, b: Point) => isSegmentFree(a, b, objects, margin, options)
  if (!free(from, from)) return []
  // Занятую цель заменяем ближайшей свободной точкой
  const goal = findNearestFreePosition(
    { objects, units: options.units ?? [] }, squareFootprint(to, margin),
    { ...options, accept: (point) => !isBlocked(point, objects, margin, options) },
  )
  if (!goal || distance(from, goal) < COLLISION_EPSILON) return []
  if (free(from, goal)) return [goal]

  const cost = new Float64Array(COLS * ROWS).fill(Infinity)
  const parent = new Int32Array(COLS * ROWS).fill(-1)
  const closed = new Uint8Array(COLS * ROWS)
  const open = new PathQueue()

  // Старт между узлами соединяем с сеткой только свободными отрезками
  const col = Math.round((from.x + MAP.width / 2) / STEP)
  const row = Math.round((from.y + MAP.height / 2) / STEP)
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (col + dx < 0 || col + dx >= COLS || row + dy < 0 || row + dy >= ROWS) continue
      const cell = (row + dy) * COLS + col + dx
      const point = cellToPoint(cell)
      if (free(from, point)) {
        cost[cell] = distance(from, point)
        open.push({ cell, cost: cost[cell], priority: cost[cell] + distance(point, goal) })
      }
    }
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
    for (const next of neighbors(cell)) {
      if (closed[next]) continue
      const nextPoint = cellToPoint(next)
      const nextCost = cost[cell] + distance(point, nextPoint)
      if (nextCost >= cost[next] || !free(point, nextPoint)) continue
      cost[next] = nextCost
      parent[next] = cell
      open.push({ cell: next, cost: nextCost, priority: nextCost + distance(nextPoint, goal) })
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

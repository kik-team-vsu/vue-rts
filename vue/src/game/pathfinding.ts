import { MAP } from './config'
import { isBlocked } from './obstacles'
import type { Point, StaticObject } from './types'

// Поиск пути в обход зданий: A* по сетке клеток, потом путь спрямляется.
// Свободна ли точка, решает isBlocked, поэтому зона "за зданием" тоже обходится.

const STEP = 25 // шаг сетки поиска, px
const CHECK_STEP = 5 // шаг проверки отрезка на препятствия, px
const COLS = Math.floor(MAP.width / STEP) + 1
const ROWS = Math.floor(MAP.height / STEP) + 1

// клетка сетки хранится одним числом: row * COLS + col
const cellToPoint = (cell: number): Point => ({
  x: -MAP.width / 2 + (cell % COLS) * STEP,
  y: -MAP.height / 2 + Math.floor(cell / COLS) * STEP,
})

const pointToCell = (point: Point): number => {
  const col = Math.min(COLS - 1, Math.max(0, Math.round((point.x + MAP.width / 2) / STEP)))
  const row = Math.min(ROWS - 1, Math.max(0, Math.round((point.y + MAP.height / 2) / STEP)))
  return row * COLS + col
}

// 8 соседних клеток, включая диагональные
const neighbors = (cell: number): number[] => {
  const col = cell % COLS
  const row = Math.floor(cell / COLS)
  const result = []
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const inside = col + dx >= 0 && col + dx < COLS && row + dy >= 0 && row + dy < ROWS
      if ((dx !== 0 || dy !== 0) && inside) {
        result.push(cell + dy * COLS + dx)
      }
    }
  }
  return result
}

const distance = (a: Point, b: Point) => Math.hypot(b.x - a.x, b.y - a.y)

// можно ли пройти по прямой из a в b; если a уже в запретной зоне, сначала даём из неё выйти
const isSegmentFree = (a: Point, b: Point, objects: StaticObject[], margin: number): boolean => {
  const count = Math.ceil(distance(a, b) / CHECK_STEP)
  let leaving = isBlocked(a, objects, margin)
  for (let i = 1; i <= count; i++) {
    const t = i / count
    const blocked = isBlocked({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }, objects, margin)
    if (blocked && !leaving) {
      return false
    }
    if (!blocked) {
      leaving = false
    }
  }
  return true
}

// спрямляем путь: из каждой точки идём сразу в самую дальнюю, которую видно по прямой
const smoothPath = (from: Point, points: Point[], objects: StaticObject[], margin: number): Point[] => {
  const result: Point[] = []
  let anchor = from
  let i = 0
  while (i < points.length) {
    let j = i
    while (j + 1 < points.length && isSegmentFree(anchor, points[j + 1], objects, margin)) {
      j++
    }
    result.push(points[j])
    anchor = points[j]
    i = j + 1
  }
  return result
}

// цель внутри здания: сдвигаем её по прямой к юниту, пока не выйдет из здания
const freeTarget = (from: Point, to: Point, objects: StaticObject[], margin: number): Point => {
  const count = Math.ceil(distance(from, to) / CHECK_STEP)
  for (let i = 0; i < count; i++) {
    const t = i / count
    const point = { x: to.x + (from.x - to.x) * t, y: to.y + (from.y - to.y) * t }
    if (!isBlocked(point, objects, margin)) {
      return point
    }
  }
  return from
}

// Путь из from в to в обход препятствий: список точек, последняя - куда юнит реально придёт.
// Если to внутри препятствия или до неё не добраться, путь ведёт в ближайшую доступную точку.
// Пустой список - идти некуда.
export const findPath = (from: Point, to: Point, objects: StaticObject[], margin: number): Point[] => {
  const goal = freeTarget(from, to, objects, margin)
  if (isSegmentFree(from, goal, objects, margin)) {
    return goal === from ? [] : [goal]
  }

  // A*: из открытых клеток первой берём ту, через которую путь до цели обещает быть короче.
  // cost - длина пути от старта до клетки, estimate - cost плюс расстояние от клетки до цели,
  // parent - откуда в клетку пришли
  const start = pointToCell(from)
  const cost = new Array(COLS * ROWS).fill(Infinity)
  const estimate = new Array(COLS * ROWS).fill(Infinity)
  const parent = new Array(COLS * ROWS).fill(-1)
  cost[start] = 0
  const open = [start]
  let best = start // достижимая клетка, ближайшая к цели
  let reached = false // из best цель видна по прямой

  while (open.length > 0 && !reached) {
    let k = 0
    for (let j = 1; j < open.length; j++) {
      if (estimate[open[j]] < estimate[open[k]]) {
        k = j
      }
    }
    const cell = open.splice(k, 1)[0]
    const point = cellToPoint(cell)
    if (distance(point, goal) < distance(cellToPoint(best), goal)) {
      best = cell
    }
    if (distance(point, goal) <= STEP && isSegmentFree(point, goal, objects, margin)) {
      best = cell
      reached = true
    }
    // в соседнюю клетку можно шагнуть, если отрезок до неё свободен
    // (так не срезаем угол здания по диагонали и можем выйти из запретной зоны, если стоим в ней)
    for (const next of neighbors(cell)) {
      const nextPoint = cellToPoint(next)
      const nextCost = cost[cell] + distance(point, nextPoint)
      if (nextCost < cost[next] && isSegmentFree(point, nextPoint, objects, margin)) {
        cost[next] = nextCost
        // расстояние до цели чуть завышаем: поиск идёт прямее к цели и открывает меньше клеток
        estimate[next] = nextCost + distance(nextPoint, goal) * 1.1
        parent[next] = cell
        open.push(next)
      }
    }
  }

  // собираем путь от best назад к старту
  const points: Point[] = []
  for (let cell = best; cell !== start; cell = parent[cell]) {
    points.unshift(cellToPoint(cell))
  }
  if (reached) {
    points.push(goal)
  }
  return smoothPath(from, points, objects, margin)
}

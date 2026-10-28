import { makeUnit } from './helpers'
import type { Scenario } from '@/game/types'

// битва: две базы, через 3 секунды воины группы 2 идут вперёд, через 6 - воины группы 1
export const BATTLE: Scenario = {
  id: 'battle',
  name: 'Битва',
  objects: [
    { id: 1, type: 'castle', group: 1, hp: 500, position: { x: -600, y: 0 } },
    { id: 2, type: 'castle', group: 2, hp: 500, position: { x: 600, y: 0 } },
    { id: 3, type: 'tree', group: 0, position: { x: 0, y: -250 } },
    { id: 4, type: 'tree', group: 0, position: { x: 0, y: 250 } },
  ],
  units: [
    makeUnit(5, 'warrior', 1, -350, -60),
    makeUnit(6, 'warrior', 1, -350, 60),
    makeUnit(7, 'worker', 1, -420, 0),
    makeUnit(8, 'warrior', 2, 350, -60),
    makeUnit(9, 'warrior', 2, 350, 60),
    makeUnit(10, 'worker', 2, 420, 0),
  ],
  events: [
    { at: 3, unitId: 8, target: { x: 0, y: -60 } },
    { at: 3, unitId: 9, target: { x: 0, y: 60 } },
    { at: 6, unitId: 5, target: { x: 0, y: -60 } },
    { at: 6, unitId: 6, target: { x: 0, y: 60 } },
  ],
}

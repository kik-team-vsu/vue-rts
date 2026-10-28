import { UNIT_TYPES } from '@/game/config'
import type { Unit } from '@/game/types'

// готовый юнит для сценариев: жизни полные, цели нет
export const makeUnit = (id: number, type: string, group: number, x: number, y: number): Unit => ({
  id,
  type,
  group,
  hp: UNIT_TYPES[type].maxHp,
  position: { x, y },
  target: null,
})

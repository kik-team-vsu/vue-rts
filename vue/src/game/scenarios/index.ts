import { BASE } from './base'
import { BATTLE } from './battle'
import { DUEL } from './duel'
import type { Scenario } from '@/game/types'

// все заготовленные сценарии игры
export const SCENARIOS: Scenario[] = [BASE, DUEL, BATTLE]

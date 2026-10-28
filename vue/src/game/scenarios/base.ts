import { START_OBJECTS, START_UNITS } from '@/game/config'
import type { Scenario } from '@/game/types'

// базовый сценарий из config, без событий
export const BASE: Scenario = {
  id: 'base',
  name: 'Базовый',
  objects: START_OBJECTS,
  units: START_UNITS,
  events: [],
}

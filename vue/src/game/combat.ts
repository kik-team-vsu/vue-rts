import { UNIT_TYPES } from './config'
import type { Unit } from './types'

export const ATTACK_RANGE = 50 // минимальная дальность атаки между центрами юнитов
export const CLICK_RADIUS = 20 // радиус поиска юнита под правым кликом

// Дальность атаки пары юнитов: корпуса не дают сблизиться центрам ближе
// полусуммы ширин, а путь заканчивается на центре свободной клетки (клетка 50).
// Поэтому у пар шире базы дальность - контакт корпусов плюс клетка запаса,
// иначе корабли останавливаются на контакте, не добрав до дальности атаки
export const attackRange = (unit: Unit, target: Unit): number => {
  const contact = (UNIT_TYPES[unit.type].width + UNIT_TYPES[target.type].width) / 2
  return contact <= ATTACK_RANGE ? ATTACK_RANGE : contact + ATTACK_RANGE
}

import { MAP } from './config'
import type { Point } from './types'

// перевод мировых координат в пиксели внутри карты (для left/top)
// (0,0) мира находится в центре карты, поэтому прибавляем половину карты
export const toMapPx = (point: Point): Point => ({
  x: point.x + MAP.width / 2,
  y: point.y + MAP.height / 2,
})

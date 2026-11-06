<template>
  <!-- очереди приказов выбранных юнитов: путь от юнита через все точки очереди и метка в каждой точке -->
  <template v-for="order in orders" :key="order.id">
    <div
        v-for="(style, index) in order.pathStyles"
        :key="index"
        class="path-line"
        :class="{ queued: order.queued }"
        :style="style" />
    <div class="target-mark" :class="{ queued: order.queued }" :style="order.targetStyle" />
  </template>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useStore } from 'vuex'
import { worldToScreen } from '@/game/coords'
import type { GameEvent, Point, Unit } from '@/game/types'

// Приказы выбранных юнитов: только рисует события и маршруты из стора, ничего не меняет
const store = useStore()
const selectedUnits = computed<Unit[]>(() => store.getters['selection/getSelectedUnits'])

// ломаная по точкам мира: отрезки пути и метка в последней точке
const toOrder = (id: number, worldPoints: Point[], queued: boolean) => {
  const points = worldPoints.map(worldToScreen)
  const to = points[points.length - 1]
  return {
    id,
    queued,
    targetStyle: {
      left: to.x + 'px',
      top: to.y + 'px',
    },
    pathStyles: points.slice(1).map((point, index) => {
      const from = points[index]
      const dx = point.x - from.x
      const dy = point.y - from.y
      return {
        left: from.x + 'px',
        top: from.y + 'px',
        width: Math.hypot(dx, dy) + 'px',
        transform: `rotate(${Math.atan2(dy, dx)}rad)`,
      }
    }),
  }
}

const orders = computed(() => {
  const result = []
  for (const unit of selectedUnits.value) {
    const queue: GameEvent[] = store.getters['events/getByActor'](unit.id)
    let from = unit.position
    for (const event of queue) {
      if (event.type !== 'move' || !event.target) {
        continue
      }
      // текущее событие: маршрут в обход препятствий; следующие по очереди - прямо от прошлой точки
      if (event.started && unit.target) {
        result.push(toOrder(event.id, [unit.position, ...(unit.path ?? [unit.target])], false))
        from = unit.target
      } else {
        result.push(toOrder(event.id, [from, event.target], event.status === 'waiting'))
        from = event.target
      }
    }
  }
  return result
})
</script>

<style scoped lang="scss">
.path-line {
  position: absolute;
  height: 0;
  margin-top: -1px;
  border-top: 2px dashed rgba(255, 255, 255, 0.7);
  transform-origin: left center;
  pointer-events: none;
}

.target-mark {
  position: absolute;
  width: 16px;
  height: 8px;
  margin: -4px 0 0 -8px;
  border: 2px solid #fff;
  border-radius: 50%;
  pointer-events: none;
}

// следующие точки очереди бледнее текущей
.queued {
  opacity: 0.5;
}
</style>

<template>
  <!-- линии пути выбранных юнитов -->
  <template v-for="order in orders" :key="order.id">
    <div
        v-for="(style, index) in order.pathStyles"
        :key="index"
        class="path-line"
        :style="style" />
    <div class="target-mark" :style="order.targetStyle" />
  </template>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useStore } from 'vuex'
import { worldToScreen } from '@/game/coords'
import type { Unit } from '@/game/types'

// Приказы выбранных юнитов: только рисует маршрут из стора, ничего не меняет
const store = useStore()
const selectedUnits = computed<Unit[]>(() => store.getters['selection/getSelectedUnits'])

const orders = computed(() => {
  const result = []
  for (const unit of selectedUnits.value) {
    if (unit.target) {
      // ломаная от юнита через точки пути до цели
      const points = [unit.position, ...(unit.path ?? [unit.target])].map(worldToScreen)
      const to = points[points.length - 1]
      result.push({
        id: unit.id,
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
      })
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
</style>

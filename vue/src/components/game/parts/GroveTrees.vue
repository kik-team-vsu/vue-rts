<!-- Компонент для отрисовки рощи деревьев (месторождение леса) -->
<template>
  <div
      v-for="(part, index) in parts"
      :key="'grove' + index"
      :class="part.class"
      :style="part.style" />
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { worldToScreen } from '@/game/coords'
import type { ObjectType } from '@/game/types'

// Лес для добычи ресурса "дерево"
const TRUNK_WIDTH = 10
const TREES = [
  { at: { x: 26, y: -28 }, trunk: 66 },
  { at: { x: -30, y: -16 }, trunk: 58 },
  { at: { x: -2, y: 22 }, trunk: 52 },
]

// ветки ёлки
const BRANCH_ANGLE = 25
const BRANCH_PAIRS = 4

const props = defineProps<{
  type: ObjectType
}>()

const parts = computed(() => {
  const { color, branchColor } = props.type
  const result = []
  for (const tree of TREES) {
    const base = worldToScreen(tree.at)
    result.push({
      class: 'grove-trees__trunk',
      style: {
        left: base.x - TRUNK_WIDTH / 2 + 'px',
        top: base.y - tree.trunk + 'px',
        width: TRUNK_WIDTH + 'px',
        height: tree.trunk + 'px',
        backgroundColor: color,
      },
    })
    for (let i = 0; i < BRANCH_PAIRS; i++) {
      const y = tree.trunk * (0.3 + i * 0.2)
      const length = tree.trunk * 0.35 * (1 - i * 0.2)
      for (const angle of [BRANCH_ANGLE, 180 - BRANCH_ANGLE]) {
        result.push({
          class: 'grove-trees__branch',
          style: {
            left: base.x + 'px',
            top: base.y - y + 'px',
            width: length + 'px',
            backgroundColor: branchColor,
            transform: `rotate(${angle}deg)`,
          },
        })
      }
    }
  }
  return result
})
</script>

<style scoped lang="scss">
@use '@/assets/styles/mixins' as *;

.grove-trees {
  &__trunk,
  &__branch {
    position: absolute;
    border-radius: 3px;
    @include outlined('game-static-object');
  }

  &__branch {
    height: 8px;
    margin-top: -4px;
    transform-origin: 0 50%;
  }
}
</style>

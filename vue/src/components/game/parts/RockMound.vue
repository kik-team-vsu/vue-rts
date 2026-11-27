<!-- Компонент для отрисовки кучи камней (месторождение камня, руды или золота) -->
<template>
  <div
      v-for="(stone, index) in stones"
      :key="'rocks' + index"
      class="rock-mound__body"
      :style="stone" />
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { worldToScreen } from '@/game/coords'
import type { ObjectType } from '@/game/types'

// камни кучи ресурсы
const BOULDERS = [
  { at: { x: 0, y: -14 }, widthPart: 0.95, heightPart: 0.5, brightness: 0.75 },
  { at: { x: -22, y: 16 }, widthPart: 0.55, heightPart: 0.38, brightness: 1 },
  { at: { x: 20, y: 18 }, widthPart: 0.42, heightPart: 0.3, brightness: 0.85 },
]

const props = defineProps<{
  type: ObjectType
}>()

const stones = computed(() => {
  const { width, color } = props.type
  return BOULDERS.map(({ at, widthPart, heightPart, brightness }) => {
    const stoneWidth = width * widthPart
    const stoneHeight = width * heightPart
    const base = worldToScreen(at)
    return {
      left: base.x - stoneWidth / 2 + 'px',
      top: base.y - stoneHeight + 'px',
      width: stoneWidth + 'px',
      height: stoneHeight + 'px',
      backgroundColor: color,
      filter: `brightness(${brightness})`,
    }
  })
})
</script>

<style scoped lang="scss">
@use '@/assets/styles/mixins' as *;

.rock-mound {
  &__body {
    border-radius: 55% 45% 50% 50% / 60% 50% 45% 55%;

    @include face('game-static-object');
  }

  // вкрапления на камнях: у руды - голубые, у золота - жёлтые
  .game-static-object--ore &__body {
    background-image:
      radial-gradient(circle at 30% 32%, #7dd3fc 0 4px, transparent 5px),
      radial-gradient(circle at 62% 58%, #38bdf8 0 3px, transparent 4px),
      radial-gradient(circle at 42% 78%, #7dd3fc 0 3px, transparent 4px);
  }

  .game-static-object--gold &__body {
    background-image:
      radial-gradient(circle at 32% 30%, #fde047 0 4px, transparent 5px),
      radial-gradient(circle at 64% 56%, #facc15 0 3px, transparent 4px),
      radial-gradient(circle at 44% 76%, #fbbf24 0 3px, transparent 4px);
  }
}
</style>

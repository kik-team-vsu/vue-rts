<!-- Компонент для отрисоки процесса производства юнита  -->
<template>
  <div class="production-bar" :style="barStyle">
    <div class="production-fill" :style="fillStyle" />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

// полоска производства над зданием: насколько готов юнит, которого здание создаёт сейчас
const props = withDefaults(defineProps<{
  progress: number // готовность 0..1
  offset?: number
  width?: number
}>(), { offset: 0, width: 36 })

const ratio = computed(() => Math.max(0, Math.min(1, props.progress)))

const barStyle = computed(() => ({
  top: -props.offset - 28 + 'px',
  width: props.width + 'px',
}))

const fillStyle = computed(() => ({
  width: ratio.value * 100 + '%',
}))
</script>

<style scoped lang="scss">
@use '@/assets/styles/mixins' as *;

.production-bar {
  position: absolute;
  left: 50%;
  height: 6px;
  box-sizing: border-box;
  border: $outline-width solid $outline-color;
  background: $hp-bar-background;
  transform: translateX(-50%);
}

.production-fill {
  height: 100%;
  background: $action-color;
}
</style>

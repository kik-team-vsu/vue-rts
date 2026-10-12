<template>
  <div
      class="game-object"
      :class="{ selected }"
      :style="style"
      @mousedown.left.stop="() => pushEmit()"/>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { MAP } from '@/game/config'
import type { GameObject, ObjectType } from '@/game/types'

// общий компонент для статичных объектов и юнитов
const props = defineProps<{
  object: GameObject
  type: ObjectType
  selected: boolean
}>()

// событие для родителя (GameField): если на объект кликнули, его надо выбрать
const emit = defineEmits<{ select: [] }>()
const pushEmit = () => emit('select')

// стили, которые зависят от данных объекта (координаты, размер, цвет), поэтому тут, а не в <style>
// пересчитывается, когда объект двигается
const style = computed(() => {
  // (0,0) мира находится в центре карты, поэтому прибавляем половину карты
  return {
    left: props.object.x + MAP.width / 2 - props.type.width / 2 + 'px',
    top: props.object.y + MAP.height / 2 - props.type.height / 2 + 'px',
    width: props.type.width + 'px',
    height: props.type.height + 'px',
    background: props.type.color,
  }
})

</script>

<style scoped lang="scss">
.game-object {
  position: absolute;
  border: 2px solid rgba(0, 0, 0, 1);
  cursor: pointer;
}

.selected {
  border-color: #fff;
}
</style>

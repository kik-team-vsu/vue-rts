<template>
  <div class="info-panel">
    <template v-if="selected">
      <div class="name">{{ typeName }}</div>
      <div>ID: {{ selected.id }}</div>
      <div>Координаты: {{ Math.round(selected.position.x) }}, {{ Math.round(selected.position.y) }}</div>
      <template v-if="unit">
        <div>Скорость: {{ unitSpeed }}</div>
        <div>{{ unitAction }}</div>
      </template>
    </template>
    <template v-else>
      <div>ЛКМ — выбрать</div>
      <div>ПКМ — идти</div>
      <div>Курсор к краю экрана — камера</div>
      <div>Зажать колёсико — двигать камеру</div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useStore } from 'vuex'
import { OBJECT_TYPES, UNIT_TYPES } from '@/game/config'
import type { StaticObject, Unit } from '@/game/types'

const store = useStore()
const selected = computed<Unit | StaticObject | undefined>(() => store.getters['game/selected'])
const unit = computed<Unit | undefined>(() => store.getters['game/selectedUnit'])
const typeName = computed(() => {
  if (unit.value) return UNIT_TYPES[unit.value.type].name
  if (selected.value) return OBJECT_TYPES[selected.value.type].name
})
const unitSpeed = computed(() => unit.value && UNIT_TYPES[unit.value.type].speedPxPerSecond)
const unitAction = computed(() => store.getters['game/selectedCommand'] ? 'Движется' : 'Стоит')
</script>

<style scoped lang="scss">
.info-panel {
  position: absolute;
  left: 30px;
  bottom: 30px;
  min-width: 200px;
  padding: 10px 14px;
  background: rgba(0, 0, 0, 0.7);
  color: #fff;
  border-radius: 6px;
  pointer-events: none;
}

.name {
  font-weight: bold;
}
</style>

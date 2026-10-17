<template>
  <div class="info-panel">
    <template v-if="selected">
      <div class="name">{{ typeName }}</div>
      <div>ID: {{ selected.id }}</div>
      <div>Координаты: {{ Math.round(selected.x) }}, {{ Math.round(selected.y) }}</div>
      <div>{{ groupName }}</div>
      <template v-if="unit && unitType">
        <div>Жизни: {{ unit.hp }} / {{ unitType.maxHp }}</div>
        <div>Сила: {{ unitType.strength }}</div>
        <div>Скорость атаки: {{ unitType.attackSpeed }}</div>
        <div>Скорость: {{ unitSpeed }}</div>
        <div>{{ unitAction }}</div>
      </template>
      <template v-else-if="buildingType">
        <div>Жизни: {{ selected.hp }} / {{ buildingType.maxHp }}</div>
        <div>Размер: {{ buildingType.size }}×{{ buildingType.size }}</div>
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
import { OBJECT_TYPES, UNIT_TYPES } from '@/game/config'
import type { StaticObject, Unit } from '@/game/types'

const props = defineProps<{
  selected: StaticObject | Unit | null
}>()

const unit = computed(() => {
  const selectedObject = props.selected
  if (!selectedObject) {
    return null
  }
  // есть property target есть - значит это юнит
  if ('target' in selectedObject) {
    return selectedObject
  }
  return null
})

// определяем имя объекта для отображения
const typeName = computed(() => {
  if (unit.value) {
    return UNIT_TYPES[unit.value.type].name
  }
  if (props.selected) {
    return OBJECT_TYPES[props.selected.type].name
  }
  return ''
})

// характеристики вида юнита (максимум жизней, сила, скорость атаки)
const unitType = computed(() => {
  if (unit.value) {
    return UNIT_TYPES[unit.value.type]
  }
  return null
})

// характеристики вида здания; у дерева и других объектов без maxHp будет null
const buildingType = computed(() => {
  if (unit.value || !props.selected) {
    return null
  }
  const type = OBJECT_TYPES[props.selected.type]
  if ('maxHp' in type) {
    return type
  }
  return null
})

const groupName = computed(() => {
  if (props.selected && props.selected.group > 0) {
    return 'Группа: ' + props.selected.group
  }
  return 'Нейтральный'
})

const unitSpeed = computed(() => {
  if (unit.value) {
    return UNIT_TYPES[unit.value.type].speedPxPerSecond
  }
})

const unitAction = computed(() => {
  if (unit.value) {
    if (unit.value.target) {
      return 'Движется'
    }
    else {
      return 'Стоит'
    }
  }
})
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

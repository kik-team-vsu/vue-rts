<template>
  <div
      v-if="commands.length > 0"
      class="command-panel"
      @mousedown.stop
      @contextmenu.prevent>
    <button
        v-for="command in commands"
        :key="command.id"
        class="command-panel__button"
        :class="{ 'command-panel__button--spawn': command.action === 'world/spawnUnit' }"
        :disabled="isProducing && command.action === 'world/spawnUnit'"
        @mousedown.prevent
        @click="() => run(command)">
      <span
          v-if="production !== null && production.unitType === command.payload"
          class="command-panel__progress"
          :style="{ width: progressPercent + '%' }" />
      <span class="command-panel__label">{{ buttonLabel(command) }}</span>
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useStore } from 'vuex'
import { COMMANDS, OBJECT_TYPES, UNIT_TYPES } from '@/game/config'
import type { Command, ProductionJob, StaticObject, Unit } from '@/game/types'

// одна панель команд, кнопки зависят от выбора
const store = useStore()
const isRunning = computed<boolean>(() => store.getters['game/isRunning'])
const selectedUnits = computed(() => store.getters['selection/getSelectedUnits'])
const selected = computed<StaticObject | Unit | null>(() => store.getters['selection/getSelected'])

// задание производства выбранного здания (null - здание сейчас ничего не создаёт):
// пока идёт, кнопки спавна заблокированы, на кнопке создаваемого юнита растёт заливка
const production = computed<ProductionJob | null>(() => {
  const building = selected.value
  if (!building) {
    return null
  }
  return store.getters['world/getProductionByBuilding'](building.id)
})
const isProducing = computed(() => production.value !== null)
const progressPercent = computed(() => {
  const job = production.value
  if (!job) {
    return 0
  }
  return Math.floor(Math.min(1, job.elapsed / job.duration) * 100)
})

// подпись кнопки спавна: во время производства добавляем проценты готовности
const buttonLabel = (command: Command) => {
  if (command.action !== 'world/spawnUnit' || !production.value || production.value.unitType !== command.payload) {
    return command.label
  }
  return `${command.label} (${progressPercent.value}%)`
}

// кнопки спавна выбранного здания: по одной на каждый тип юнита из spawns
const spawnCommands = computed<Command[]>(() => {
  const building = selected.value
  if (!building || !(building.type in OBJECT_TYPES)) {
    return []
  }
  const type = OBJECT_TYPES[building.type]
  const spawns = 'spawns' in type ? type.spawns ?? [] : []
  return spawns.map((unitType) => ({
    id: 'spawn-' + unitType,
    label: 'Создать: ' + UNIT_TYPES[unitType].name,
    action: 'world/spawnUnit',
    payload: unitType,
  }))
})

const commands = computed<Command[]>(() => {
  // в меню и после конца игры кнопок нет
  if (!isRunning.value) {
    return []
  }
  if (selectedUnits.value.length > 0) {
    return [COMMANDS.destroy]
  }
  // стройку (задача 20) потом добавим сюда
  return spawnCommands.value
})

const run = (command: Command) => {
  store.dispatch(command.action, command.payload)
}
</script>

<style scoped lang="scss">
@use '@/assets/styles/mixins' as *;

.command-panel {
  position: absolute;
  right: 30px;
  bottom: 30px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 10px 14px;
  background: $panel-background;
  border-radius: $panel-radius;

  &__button {
    position: relative;
    padding: 6px 12px;
    border: 0;
    border-radius: $button-radius;
    background: $danger-color;
    color: $panel-text-color;
    cursor: pointer;

    &:hover {
      background: $danger-color-hover;
    }

    &:disabled {
      cursor: default;
      opacity: 0.8;
    }

    &--spawn {
      background: $action-color;

      &:hover {
        background: $action-color-hover;
      }
    }
  }

  // заливка готовности прямо на кнопке создаваемого юнита
  &__progress {
    position: absolute;
    left: 0;
    top: 0;
    bottom: 0;
    background: rgba(255, 255, 255, 0.35);
    pointer-events: none;
  }

  // подпись над заливкой прогресса
  &__label {
    position: relative;
  }
}
</style>


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
        @mousedown.prevent
        @click="() => run(command)">
      {{ command.label }}
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useStore } from 'vuex'
import { COMMANDS } from '@/game/config'
import type { Command } from '@/game/types'

// одна панель команд, кнопки зависят от выбора
const store = useStore()
const isRunning = computed<boolean>(() => store.getters['game/isRunning'])
const selectedUnits = computed(() => store.getters['selection/getSelectedUnits'])

const commands = computed<Command[]>(() => {
  // в меню и после конца игры кнопок нет
  if (!isRunning.value) {
    return []
  }
  if (selectedUnits.value.length > 0) {
    return [COMMANDS.destroy]
  }
  // здание (спавн, задача 19) и стройку (задача 20) потом добавим сюда
  return []
})

const run = (command: Command) => {
  store.dispatch(command.action)
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
    padding: 6px 12px;
    border: 0;
    border-radius: $button-radius;
    background: $danger-color;
    color: $panel-text-color;
    cursor: pointer;

    &:hover {
      background: $danger-color-hover;
    }
  }
}
</style>

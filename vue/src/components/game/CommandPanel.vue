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

// одна общая панель команд: набор кнопок зависит от того, что выбрано
const store = useStore()
const selectedUnits = computed(() => store.getters['game/getSelectedUnits'])

const commands = computed<Command[]>(() => {
  if (selectedUnits.value.length > 0) {
    return [COMMANDS.destroy]
  }
  // здание (спавн, задача 19) и пустой выбор (стройка, задача 20) добавятся сюда же
  return []
})

const run = (command: Command) => {
  store.dispatch(command.action)
}
</script>

<style scoped lang="scss">
.command-panel {
  position: absolute;
  right: 30px;
  bottom: 30px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 10px 14px;
  background: rgba(0, 0, 0, 0.7);
  border-radius: 6px;

  &__button {
    padding: 6px 12px;
    border: 0;
    border-radius: 4px;
    background: #dc2626;
    color: #fff;
    cursor: pointer;

    &:hover {
      background: #b91c1c;
    }
  }
}
</style>

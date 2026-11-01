<template>
  <div
      v-if="isRunning"
      class="command-panel"
      @mousedown.stop
      @contextmenu.prevent>
    <div class="command-panel__title">Строительство</div>
    <button
        v-for="building in buildings"
        :key="building.id"
        class="command-panel__button command-panel__button--build"
        :aria-pressed="buildingType === building.id"
        :disabled="paused"
        @mousedown.prevent
        @click="() => startBuilding(building.id)">
      {{ building.name }} {{ building.size }}×{{ building.size }}
    </button>
    <template v-if="buildingType">
      <div class="command-panel__hint">ЛКМ — построить<br>ПКМ или Esc — отменить</div>
      <button class="command-panel__button command-panel__button--cancel" @click="cancelBuilding">Отмена</button>
    </template>
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
import { COMMANDS, OBJECT_TYPES } from '@/game/config'
import { getBuildingType } from '@/game/building'
import type { Command } from '@/game/types'

const store = useStore()
const isRunning = computed<boolean>(() => store.getters['game/isRunning'])
const selectedUnits = computed(() => store.getters['game/getSelectedUnits'])
const paused = computed<boolean>(() => store.getters['game/getPaused'])
const buildingType = computed<string | null>(() => store.getters['game/getBuildingType'])
const buildings = Object.keys(OBJECT_TYPES).flatMap((id) => {
  const type = getBuildingType(id)
  return type ? [{ id, name: type.name, size: type.size }] : []
})

const startBuilding = (type: string) => store.dispatch('game/startBuilding', type)
const cancelBuilding = () => store.dispatch('game/cancelBuilding')

const commands = computed<Command[]>(() =>
  isRunning.value && selectedUnits.value.length > 0 ? [COMMANDS.destroy] : [],
)

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

    &--build {
      background: #365314;

      &:hover,
      &[aria-pressed='true'] {
        background: #4d7c0f;
      }
    }

    &--cancel {
      background: #475569;
    }

    &:disabled {
      opacity: 0.5;
      cursor: default;
    }
  }

  &__title {
    color: #fff;
    font-weight: bold;
  }

  &__hint {
    color: #fff;
    font-size: 13px;
  }
}
</style>

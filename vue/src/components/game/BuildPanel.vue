<template>
  <section class="build-panel" aria-labelledby="build-panel-title">
    <h2 id="build-panel-title">Строительство</h2>
    <form v-if="!game.buildPlan" class="build-controls" @submit.prevent="startBuilding">
      <label>Здание
        <select v-model="buildingType">
          <option v-for="[key, type] in buildings" :key="key" :value="key">{{ type.name }}</option>
        </select>
      </label>
      <label>Группа
        <select v-model="groupId">
          <option v-for="group in GROUPS" :key="group" :value="group">{{ group }}</option>
        </select>
      </label>
      <button type="submit">Строить</button>
    </form>
    <template v-else>
      <div>{{ OBJECT_TYPES[game.buildPlan.type].name }} · Группа {{ game.buildPlan.groupId }}</div>
      <div>ЛКМ по карте — выбрать начальную клетку основания.</div>
      <button type="button" @click="store.commit('game/select', null)">Отмена</button>
    </template>
  </section>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useStore } from 'vuex'
import { GROUPS, OBJECT_TYPES } from '@/game/config'
import type { GameState } from '@/store/game'

const store = useStore<{ game: GameState }>()
const game = computed(() => store.state.game)
const buildings = Object.entries(OBJECT_TYPES).filter(([, type]) => type.spawnTypes)
const buildingType = ref(buildings[0][0])
const groupId = ref(GROUPS[0])
const startBuilding = () => store.commit('game/startBuilding', { type: buildingType.value, groupId: groupId.value })
</script>

<style scoped>
h2 {
  font-size: inherit;
  font-weight: bold;
  margin: 0 0 6px;
}

.build-controls {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
}
</style>

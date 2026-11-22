<template>
  <div class="game-page">
    <GameField />
    <BuildPanel class="panel" />
    <InfoPanel class="panel" />
  </div>
</template>

<script setup lang="ts">
import { useStore } from 'vuex'
import GameField from '../game/GameField.vue'
import BuildPanel from '../game/BuildPanel.vue'
import InfoPanel from '../game/InfoPanel.vue'

useStore().commit('game/reset')
</script>

<style scoped>
.game-page {
  --panel-inset: 30px;
  position: fixed;
  inset: 0;
}

.game-page > .panel {
  position: absolute;
  left: var(--panel-inset);
  margin: 0;
  z-index: 1;
  max-width: calc(100% - 2 * var(--panel-inset));
  max-height: calc(50% - var(--panel-inset) - 6px);
  overflow: auto;
  padding: 10px 14px;
  background: rgba(0, 0, 0, 0.7);
  color: #fff;
  border-radius: 6px;
}

.game-page > .build-panel {
  top: var(--panel-inset);
}

.game-page > .info-panel {
  bottom: var(--panel-inset);
}
</style>

<template>
  <div class="game-page">
    <GameField />
    <InfoPanel />
  </div>
</template>

<script setup lang="ts">
import { useStore } from 'vuex'
import GameField from '../game/GameField.vue'
import InfoPanel from '../game/InfoPanel.vue'

useStore().commit('game/reset')
</script>

<style scoped>
.game-page {
  position: fixed;
  inset: 0;
}
</style>

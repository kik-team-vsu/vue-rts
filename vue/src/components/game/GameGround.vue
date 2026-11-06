<template>
  <!-- земля карты: ромб с сеткой клеток -->
  <div class="ground" :style="groundStyle" />

  <!-- зоны местности: тот же поворот и сжатие, что у земли -->
  <div
      v-for="(zone, index) in terrainZones"
      :key="'terrain-' + index"
      class="terrain-zone"
      :class="zoneClass(zone)"
      :style="zoneStyle(zone)" />
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useStore } from 'vuex'
import { MAP } from '@/game/config'
import type { TerrainZone } from '@/game/types'

// Земля и местность сценария: только рисует зоны из стора world
const store = useStore()
const terrainZones = computed<TerrainZone[]>(() => store.getters['world/getTerrainZones'])

const groundStyle = {
  left: -MAP.width / 2 + 'px',
  top: -MAP.height / 2 + 'px',
  width: MAP.width + 'px',
  height: MAP.height + 'px',
  backgroundSize: `${MAP.cell}px ${MAP.cell}px, ${MAP.cell}px ${MAP.cell}px, 256px 256px`,
}

// зона местности в мировых координатах.
// Точка поворота - центр карты (мировой ноль), как у .ground, иначе зона съедет:
// в локальных координатах зоны мировой ноль лежит в (-zone.x, -zone.y)
const zoneStyle = (zone: TerrainZone) => ({
  left: zone.x + 'px',
  top: zone.y + 'px',
  width: zone.width + 'px',
  height: zone.height + 'px',
  transformOrigin: `${-zone.x}px ${-zone.y}px`,
})

// класс зоны: у реки течение вдоль длинной стороны зоны,
// узкая и высокая зона получает плитку с вертикальным течением
const zoneClass = (zone: TerrainZone) =>
  zone.type === 'river' && zone.height > zone.width
    ? 'terrain-zone--river-v'
    : 'terrain-zone--' + zone.type
</script>

<style scoped lang="scss">
@use '@/assets/styles/mixins' as *;

.ground {
  position: absolute;
  background-color: $ground-color;
  background-image:
    linear-gradient(to right, $grid-line-color 1px, transparent 1px),
    linear-gradient(to bottom, $grid-line-color 1px, transparent 1px),
    url('../../assets/grass.svg');

  // ромбовидная карта
  @include iso-flat;
}

.terrain-zone {
  position: absolute;

  // как у .ground: ромбовидная зона в изометрии
  @include iso-flat;

  // озеро: спокойная глубокая вода
  &--lake {
    background-color: $water-color;
    background-image: url('../../assets/lake.svg');
  }

  // река: та же вода, но плитка с полосами течения
  &--river {
    background-color: $water-color;
    background-image: url('../../assets/river.svg');
  }

  // вертикальная река: та же плитка, течение вдоль оси y
  &--river-v {
    background-color: $water-color;
    background-image: url('../../assets/river-vertical.svg');
  }

  // песок: декоративный берег, проходим как суша
  &--sand {
    background-color: $sand-color;
    background-image: url('../../assets/sand.svg');
  }

  // горы: непроходимая скалистая местность с пиками
  &--mountain {
    background-image: url('../../assets/mountain.svg');
  }
}
</style>

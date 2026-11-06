<template>
  <div
      ref="screenView"
      class="screen-view"
      :class="{ 'screen-view--paused': paused }"
      @mousedown.left="(event) => startSelect(event)"
      @mousedown.middle.prevent="(event) => startDrag(event)"
      @contextmenu.prevent="(event) => moveSelected(event)"
      @mousemove="(event) => saveMouse(event)"
      @mouseleave="() => resetMouse()">

    <div class="world" :style="worldStyle">
      <div class="ground" :style="groundStyle" />

      <!-- зоны местности: тот же поворот и сжатие, что у земли -->
      <div
          v-for="(zone, index) in terrainZones"
          :key="'terrain-' + index"
          class="terrain-zone"
          :class="zoneClass(zone)"
          :style="zoneStyle(zone)" />

      <div class="objects-layer">
        <!-- уничтоженный объект не пропадает сразу, а проигрывает анимацию destroy -->
        <TransitionGroup name="destroy">
          <GameStaticObject
              v-for="o in objects"
              :key="o.id"
              :object="o"
              :type="OBJECT_TYPES[o.type]"
              :selected="selectedIds.includes(o.id)"
              @select="select(o.id)"/>
        </TransitionGroup>
      </div>

      <!-- линии пути выбранных юнитов -->
      <template v-for="order in orders" :key="order.id">
        <div
            v-for="(style, index) in order.pathStyles"
            :key="index"
            class="path-line"
            :style="style" />
      </template>

      <TransitionGroup name="destroy">
        <GameUnit
            v-for="u in units"
            :key="u.id"
            :unit="u"
            :type="UNIT_TYPES[u.type]"
            :selected="selectedIds.includes(u.id)"
            @select="(additive) => selectUnit(u.id, additive)"/>
      </TransitionGroup>

      <div
          v-for="order in orders"
          :key="order.id"
          class="target-mark"
          :style="order.targetStyle" />

    </div>

    <div
        v-if="selectionBox"
        class="selection-box"
        :style="selectionBoxStyle" />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useStore } from 'vuex'
import GameStaticObject from './GameStaticObject.vue'
import GameUnit from './GameUnit.vue'
import { CAMERA, MAP, OBJECT_TYPES, UNIT_TYPES } from '@/game/config'
import { screenToWorld, worldToScreen } from '@/game/coords'
import type { Point, StaticObject, TerrainZone, Unit } from '@/game/types'

interface Box {
  left: number
  top: number
  width: number
  height: number
}

// рамка считается рамкой, только если мышь заметно сдвинули, иначе это обычный клик
const MIN_SELECTION_PX = 5

// перетаскивание камеры средней кнопкой мыши
let dragging = false
let dragLast: Point = { x: 0, y: 0 }

// объекты, юниты и выбор хранятся в store
const store = useStore()
const objects = computed<StaticObject[]>(() => store.getters['world/getObjects'])
const units = computed<Unit[]>(() => store.getters['world/getUnits'])
const terrainZones = computed<TerrainZone[]>(() => store.getters['world/getTerrainZones'])
const selectedIds = computed<number[]>(() => store.getters['selection/getSelectedIds'])
const selectedUnits = computed<Unit[]>(() => store.getters['selection/getSelectedUnits'])

const paused = computed<boolean>(() => store.getters['game/getPaused'])
const isRunning = computed<boolean>(() => store.getters['game/isRunning'])
const screenView = ref<HTMLElement | null>(null)
// камера живёт в сторе camera, игровой цикл - в сторе engine
const camera = computed<Point>(() => store.getters['camera/getPosition'])
// положение курсора внутри окна игры
const mouse = { x: 0, y: 0 }

// выделение рамкой юнитов
let selectStart: Point | null = null
// рамку начали с зажатым shift: найденные юниты добавляются к уже выбранным
let selectAdditive = false
const selectionBox = ref<Box | null>(null)

const worldStyle = computed(() => ({
  transform: `translate(${-camera.value.x}px, ${-camera.value.y}px)`,
}))

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

const orders = computed(() => {
  const result = []
  for (const unit of selectedUnits.value) {
    if (unit.target) {
      // ломаная от юнита через точки пути до цели
      const points = [unit.position, ...(unit.path ?? [unit.target])].map(worldToScreen)
      const to = points[points.length - 1]
      result.push({
        id: unit.id,
        targetStyle: {
          left: to.x + 'px',
          top: to.y + 'px',
        },
        pathStyles: points.slice(1).map((point, index) => {
          const from = points[index]
          const dx = point.x - from.x
          const dy = point.y - from.y
          return {
            left: from.x + 'px',
            top: from.y + 'px',
            width: Math.hypot(dx, dy) + 'px',
            transform: `rotate(${Math.atan2(dy, dx)}rad)`,
          }
        }),
      })
    }
  }
  return result
})

const selectionBoxStyle = computed(() => {
  const box = selectionBox.value
  if (!box) {
    return {}
  }
  return {
    left: box.left + 'px',
    top: box.top + 'px',
    width: box.width + 'px',
    height: box.height + 'px',
  }
})

const toWorld = (e: MouseEvent): Point => {
  const rect = screenView.value!.getBoundingClientRect()
  return screenToWorld({
    x: e.clientX - rect.left - rect.width / 2 + camera.value.x,
    y: e.clientY - rect.top - rect.height / 2 + camera.value.y,
  })
}

// курсор у края экрана двигает камеру: сообщаем стору направление, сдвиг считает игровой цикл
const updateEdgeScroll = () => {
  const view = screenView.value
  if (!view || dragging) {
    store.dispatch('camera/setEdgeScroll', { x: 0, y: 0 })
    return
  }
  const direction = (position: number, size: number) => {
    if (position < CAMERA.edgePx) {
      return -1
    }
    if (position > size - CAMERA.edgePx) {
      return 1
    }
    return 0
  }
  store.dispatch('camera/setEdgeScroll', {
    x: direction(mouse.x, view.clientWidth),
    y: direction(mouse.y, view.clientHeight),
  })
}

const saveMouse = (e: MouseEvent) => {
  // окно ввода на странице и его размер
  const rect = screenView.value!.getBoundingClientRect()
  mouse.x = e.clientX - rect.left
  mouse.y = e.clientY - rect.top
  updateEdgeScroll()
  updateSelectionBox()
}

const resetMouse = () => {
  store.dispatch('camera/setEdgeScroll', { x: 0, y: 0 })
}

// ПКМ: приказ выбранным юнитам идти в точку - создаётся событие move
const moveSelected = (e: MouseEvent) => {
  store.dispatch('events/orderMove', {
    actorIds: selectedUnits.value.map((u) => u.id),
    point: toWorld(e),
  })
}

const select = (id: number | null) => {
  store.dispatch('selection/select', id)
}

const selectUnit = (id: number, additive: boolean) => {
  if (additive) {
    store.dispatch('selection/toggleSelect', id)
  }
  else {
    select(id)
  }
}

const getSelectionBox = (start: Point): Box => ({
  left: Math.min(start.x, mouse.x),
  top: Math.min(start.y, mouse.y),
  width: Math.abs(mouse.x - start.x),
  height: Math.abs(mouse.y - start.y),
})

// рамка считается рамкой, только если мышь заметно сдвинули, иначе это обычный клик
const isBigEnough = (box: Box) => box.width > MIN_SELECTION_PX || box.height > MIN_SELECTION_PX

// левая кнопка на пустом месте: начинаем тянуть рамку (клик по объекту сюда не доходит, там stop)
const startSelect = (e: MouseEvent) => {
  // в меню и после конца игры рамку не рисуем
  if (!isRunning.value) {
    return
  }
  saveMouse(e)
  selectStart = { x: mouse.x, y: mouse.y }
  selectAdditive = e.shiftKey
}

// рамка на экране обновляется при движении мыши
const updateSelectionBox = () => {
  if (!selectStart) {
    return
  }
  const box = getSelectionBox(selectStart)
  selectionBox.value = isBigEnough(box) ? box : null
}

const finishSelect = () => {
  if (!selectStart || !screenView.value) {
    return
  }
  const box = getSelectionBox(selectStart)
  selectStart = null
  selectionBox.value = null

  if (!isBigEnough(box)) {
    // клик с shift по пустому месту не сбрасывает выбор
    if (!selectAdditive) {
      select(null)
    }
    return
  }
  const width = screenView.value.clientWidth
  const height = screenView.value.clientHeight
  const ids = units.value
    .filter((u) => {
      const point = worldToScreen(u.position)
      const x = point.x - camera.value.x + width / 2
      const y = point.y - camera.value.y + height / 2 - UNIT_TYPES[u.type].height / 2
      return x >= box.left && x <= box.left + box.width && y >= box.top && y <= box.top + box.height
    })
    .map((u) => u.id)
  store.dispatch(selectAdditive ? 'selection/addToSelection' : 'selection/selectMany', ids)
}

const startDrag = (e: MouseEvent) => {
  dragging = true
  dragLast = { x: e.clientX, y: e.clientY }
  updateEdgeScroll()
}

const onWindowMouseMove = (e: MouseEvent) => {
  if (!dragging) {
    return
  }
  store.dispatch('camera/moveBy', { x: dragLast.x - e.clientX, y: dragLast.y - e.clientY })
  dragLast = { x: e.clientX, y: e.clientY }
}

const onWindowMouseUp = (e: MouseEvent) => {
  if (e.button === 0) {
    finishSelect()
  }
  if (e.button === 1) {
    dragging = false
  }
}

// компонент появился на странице - запускаем игровой цикл
onMounted(() => {
  store.dispatch('engine/start')
  window.addEventListener('mousemove', onWindowMouseMove)
  window.addEventListener('mouseup', onWindowMouseUp)
})

// если ушли со страницы игры - останавливаем цикл
onUnmounted(() => {
  store.dispatch('engine/stop')
  store.dispatch('camera/setEdgeScroll', { x: 0, y: 0 })
  window.removeEventListener('mousemove', onWindowMouseMove)
  window.removeEventListener('mouseup', onWindowMouseUp)
})
</script>

<style scoped lang="scss">
.screen-view {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
  background: #1a1a1a;
  user-select: none;
}

.screen-view--paused :deep(*) {
  // на паузе анимация стоит
  animation-play-state: paused !important;
}

.world {
  position: absolute;
  left: 50%;
  top: 50%;
  width: 0;
  height: 0;
}

.ground {
  position: absolute;
  // ромбовидная карта: поворот на 45 градусов и сжатие по вертикали на 0.5
  transform: scaleY(0.5) rotate(45deg);
  background-color: #4a7c3a;
  background-image:
      linear-gradient(to right, rgba(0, 0, 0, 0.2) 1px, transparent 1px),
      linear-gradient(to bottom, rgba(0, 0, 0, 0.2) 1px, transparent 1px),
      url('../../assets/grass.svg');
}

.objects-layer {
  position: absolute;
  z-index: 0;
}

.terrain-zone {
  position: absolute;
  // как у .ground: ромбовидная зона в изометрии
  transform: scaleY(0.5) rotate(45deg);

  // озеро: спокойная глубокая вода
  &--lake {
    background-color: #2563eb;
    background-image: url('../../assets/lake.svg');
  }

  // река: та же вода, но плитка с полосами течения
  &--river {
    background-color: #2563eb;
    background-image: url('../../assets/river.svg');
  }

  // вертикальная река: та же плитка, течение вдоль оси y
  &--river-v {
    background-color: #2563eb;
    background-image: url('../../assets/river-vertical.svg');
  }

  // песок: декоративный берег, проходим как суша
  &--sand {
    background-color: #cfb684;
    background-image: url('../../assets/sand.svg');
  }

  // горы: непроходимая скалистая местность с пиками
  &--mountain {
    background-image: url('../../assets/mountain.svg');
  }
}

// уничтожение: объект сжимается к основанию и исчезает
.destroy-leave-active {
  animation: destroy 0.4s ease-in forwards;
  transform-origin: bottom center;
  pointer-events: none;
}

@keyframes destroy {
  30% {
    transform: scale(1.15);
    filter: brightness(2);
  }
  100% {
    transform: scale(0, 0.2);
    opacity: 0;
  }
}

.path-line {
  position: absolute;
  height: 0;
  margin-top: -1px;
  border-top: 2px dashed rgba(255, 255, 255, 0.7);
  transform-origin: left center;
  pointer-events: none;
}

.selection-box {
  position: absolute;
  border: 1px solid #fff;
  background: rgba(255, 255, 255, 0.15);
  pointer-events: none;
}

.target-mark {
  position: absolute;
  width: 16px;
  height: 8px;
  margin: -4px 0 0 -8px;
  border: 2px solid #fff;
  border-radius: 50%;
  pointer-events: none;
}
</style>

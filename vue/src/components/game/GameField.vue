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
      <GameGround />

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

      <!-- приказы выбранных юнитов: путь и точка назначения -->
      <UnitOrders />

      <!-- кто кого атакует: линия от атакующего к текущей позиции цели -->
      <div
          v-for="attack in attacks"
          :key="'attack-line-' + attack.id"
          class="attack-line"
          :style="attack.lineStyle" />

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
          v-for="attack in attacks"
          :key="'attack-mark-' + attack.id"
          class="attack-mark"
          :style="attack.markStyle" />
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
import GameGround from './GameGround.vue'
import GameStaticObject from './GameStaticObject.vue'
import GameUnit from './GameUnit.vue'
import UnitOrders from './UnitOrders.vue'
import { CAMERA, OBJECT_TYPES, UNIT_TYPES } from '@/game/config'
import { screenToWorld, worldToScreen } from '@/game/coords'
import type { Point, StaticObject, Unit } from '@/game/types'

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

// Окно игры: принимает ввод мыши и передаёт его в стор (выбор, приказы, камера).
// Игровой логики здесь нет: элементы карты, события и камера живут в сторе, а рисуют их дочерние компоненты.
// Объекты и юниты передаются пропсами: уничтоженный объект ещё проигрывает анимацию destroy со своими последними данными
const store = useStore()
const objects = computed<StaticObject[]>(() => store.getters['world/getObjects'])
const units = computed<Unit[]>(() => store.getters['world/getUnits'])
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


// кто кого атакует: линия от атакующего к цели и кольцо на цели.
// Цели может уже не быть - тогда атакующий скоро выйдет из режима атаки
const attacks = computed(() => {
  const result = []
  for (const unit of units.value) {
    if (!unit.isAttacking || unit.targetId == null) continue
    const target = units.value.find((u) => u.id === unit.targetId)
    if (!target) continue
    const from = worldToScreen(unit.position)
    const to = worldToScreen(target.position)
    const dx = to.x - from.x
    const dy = to.y - from.y
    result.push({
      id: unit.id,
      lineStyle: {
        left: from.x + 'px',
        top: from.y + 'px',
        width: Math.hypot(dx, dy) + 'px',
        transform: `rotate(${Math.atan2(dy, dx)}rad)`,
      },
      markStyle: {
        left: to.x + 'px',
        top: to.y + 'px',
      },
    })
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

// ПКМ: приказ выбранным юнитам - идти к точке строем или атаковать чужого юнита под курсором
const moveSelected = (e: MouseEvent) => {
  store.dispatch('events/orderByClick', {
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

.objects-layer {
  position: absolute;
  z-index: 0;
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

// атака: сплошная красная линия пульсирует, пока идёт бой
.attack-line {
  position: absolute;
  height: 0;
  margin-top: -1px;
  border-top: 2px solid rgba(220, 38, 38, 0.85);
  transform-origin: left center;
  pointer-events: none;
  animation: attack-pulse 1s ease-in-out infinite;
}

@keyframes attack-pulse {
  0%,
  100% {
    opacity: 0.9;
  }

  50% {
    opacity: 0.4;
  }
}

.selection-box {
  position: absolute;
  border: 1px solid #fff;
  background: rgba(255, 255, 255, 0.15);
  pointer-events: none;
}

// кольцо на цели атаки: тот же эллипс в плоскости карты, что и target-mark
.attack-mark {
  position: absolute;
  width: 16px;
  height: 8px;
  margin: -4px 0 0 -8px;
  border: 2px solid rgba(220, 38, 38, 0.9);
  border-radius: 50%;
  pointer-events: none;
}
</style>

<template>
  <div
      ref="screenView"
      class="screen-view"
      @mousedown.left="select(null)"
      @mousedown.middle.prevent="(event) => startDrag(event)"
      @contextmenu.prevent="(event) => moveSelected(event)"
      @mousemove="(event) => saveMouse(event)"
      @mouseleave="() => resetMouse()">

    <div class="world" :style="worldStyle">
      <div class="world-origin">
        <GameObject
            v-for="o in game.objects"
            :key="o.id"
            :object="o"
            :type="OBJECT_TYPES[o.type]"
            :selected="o.id === game.selectedId"
            @select="select(o.id)"/>

        <GameObject
            v-for="u in game.units"
            :key="u.id"
            :object="u"
            :type="UNIT_TYPES[u.type]"
            :selected="u.id === game.selectedId"
            @select="select(u.id)"/>

        <div
            v-if="command"
            class="target-mark"
            :style="{ left: command.target.x + 'px', top: command.target.y + 'px' }" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, reactive, ref } from 'vue'
import { useStore } from 'vuex'
import type { GameState } from '@/store/game'
import GameObject from './GameObject.vue'
import { CAMERA, OBJECT_TYPES, UNIT_TYPES } from '@/game/config'
import { clampToMap, projection, toWorldPoint } from '@/game/coords'
import type { MoveCommand, Point, Unit } from '@/game/types'

// перетаскивание камеры средней кнопкой мыши
// dragLast - позиция мыши, до которой камера уже сдвинута, dragCurrent - последняя позиция мыши
// не reactive: сдвиг применяется в игровом цикле (dragCamera), а не на каждое событие мыши
let dragging = false
let dragLast: Point = { x: 0, y: 0 }
let dragCurrent: Point = { x: 0, y: 0 }

const store = useStore<{ game: GameState }>()
const game = computed(() => store.state.game)
const selectedUnit = computed<Unit | undefined>(() => store.getters['game/selectedUnit'])
const select = (id: number | null) => store.commit('game/select', id)
const screenView = ref<HTMLElement | null>(null)
const camera = reactive({ x: 0, y: 0 })
const mouse = { x: 0, y: 0, inside: false }
// стили карты: размер, шаг сетки и сдвиг под камеру
// translate ставит точку camera в центр экрана: если камера едет вправо, то карта уезжает влево
const worldStyle = computed(() => ({
  width: game.value.map.width + 'px',
  height: game.value.map.height + 'px',
  backgroundSize: game.value.map.cell + 'px ' + game.value.map.cell + 'px',
  transform: `translate(calc(-50% - ${camera.x}px), calc(-50% - ${camera.y}px)) ${projection}`,
}))

const command = computed<MoveCommand | undefined>(() => store.getters['game/selectedCommand'])

const toWorld = (e: MouseEvent): Point => {
  const rect = screenView.value!.getBoundingClientRect()
  return toWorldPoint({
    x: e.clientX - rect.left - rect.width / 2 + camera.x,
    y: e.clientY - rect.top - rect.height / 2 + camera.y,
  })
}

const saveMouse = (e: MouseEvent) => {
  // окно ввода на странице и его размер
  const rect = screenView.value!.getBoundingClientRect()
  mouse.x = e.clientX - rect.left
  mouse.y = e.clientY - rect.top
  mouse.inside = true
}

const resetMouse = () => {
  mouse.inside = false
}

const moveSelected = (e: MouseEvent) => {
  if (!selectedUnit.value) {
    return
  }
  const point = toWorld(e)
  store.commit('game/moveTo', { unitId: selectedUnit.value.id, target: point })
}

const clampCamera = () => {
  const center = clampToMap(toWorldPoint(camera), game.value.map)
  const projected = projection.transformPoint(center)
  camera.x = projected.x
  camera.y = projected.y
}

const startDrag = (e: MouseEvent) => {
  dragging = true
  dragLast = { x: e.clientX, y: e.clientY }
  dragCurrent = dragLast
}

const onWindowMouseMove = (e: MouseEvent) => {
  if (!dragging) {
    return
  }
  dragCurrent = { x: e.clientX, y: e.clientY }
}

const onWindowMouseUp = (e: MouseEvent) => {
  if (e.button === 1) {
    // применяем сдвиг, накопленный после последнего кадра
    dragCamera()
    dragging = false
  }
}

const dragCamera = () => {
  if (!dragging) {
    return
  }
  camera.x -= dragCurrent.x - dragLast.x
  camera.y -= dragCurrent.y - dragLast.y
  dragLast = dragCurrent
  clampCamera()
}

const moveCamera = (secondsPassed: number) => {
  if (!screenView.value || !mouse.inside || dragging) {
    return
  }

  const width = screenView.value.clientWidth
  const height = screenView.value.clientHeight
  const step = CAMERA.speedPxPerSecond * secondsPassed

  if (mouse.x < CAMERA.edgePx) {
    camera.x -= step
  }
  if (mouse.x > width - CAMERA.edgePx) {
    camera.x += step
  }
  if (mouse.y < CAMERA.edgePx) {
    camera.y -= step
  }
  if (mouse.y > height - CAMERA.edgePx) {
    camera.y += step
  }

  clampCamera()
}

let frameId = 0
let lastTime = 0

const MILLIS_IN_SECOND = 1000
const MAX_FRAME_SECONDS = 0.1

const tick = (time: number) => {
  const secondsPassed = Math.min((time - lastTime) / MILLIS_IN_SECOND, MAX_FRAME_SECONDS)
  lastTime = time

  dragCamera()
  moveCamera(secondsPassed)
  store.commit('game/advanceFrame', secondsPassed)

  frameId = requestAnimationFrame(tick)
}

// компонент появился на странице - запускаем игровой цикл
onMounted(() => {
  lastTime = performance.now()
  frameId = requestAnimationFrame(tick)
  window.addEventListener('mousemove', onWindowMouseMove)
  window.addEventListener('mouseup', onWindowMouseUp)
})

// если ушли со страницы игры - останавливаем цикл
onUnmounted(() => {
  cancelAnimationFrame(frameId)
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

.world {
  position: absolute;
  left: 50%;
  top: 50%;
  background-color: #4a7c3a;
  background-image:
    linear-gradient(to right, rgba(0, 0, 0, 0.2) 1px, transparent 1px),
    linear-gradient(to bottom, rgba(0, 0, 0, 0.2) 1px, transparent 1px);
}

.world-origin {
  position: absolute;
  left: 50%;
  top: 50%;
}

.target-mark {
  position: absolute;
  width: 16px;
  height: 16px;
  margin: -8px 0 0 -8px;
  border: 2px solid #fff;
  border-radius: 50%;
  pointer-events: none;
}
</style>

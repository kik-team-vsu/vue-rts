<template>
  <div
      class="game-unit"
      :class="[`shape-${shape}`, { selected, walking }]"
      :style="style"
      @mousedown.left.stop="(event) => pushEmit(event)">
    <!-- плавающие суда стоят прямо в воде: у них нет тени на воде -->
    <div v-if="shape === 'human'" class="shadow" />

    <!-- пеший юнит: человечек из css-фигур, стоит ногами в точке position -->
    <template v-if="shape === 'human'">
      <div class="leg left" />
      <div class="leg right" />
      <div class="body" :style="{ backgroundColor: type.color }" />
      <div class="arm left" />
      <div class="arm right" />
      <div class="head" :style="{ backgroundColor: type.color }" />
    </template>

    <!--
      лодка и корабль: корпус нарисован сверху (нос вдоль локальной оси x)
      и спроецирован в изометрию той же worldToScreen, что и земля.
      Курс хранится в мировых радианах (unit.facing), поэтому кадров на 4 стороны нет:
      корпус плавно поворачивается по направлению движения
    -->
    <div v-else class="vessel" :style="anchorStyle">
      <svg class="deck" :viewBox="viewBox" :width="vesselSize" :height="vesselSize" :style="deckStyle">
        <!-- борт под палубой: тот же силуэт, сдвинутый вниз по экрану -->
        <polygon :points="hullPoints('keel')" :fill="keelColor" />

        <!-- корпус и палуба -->
        <polygon :points="hullPoints('hull')" :fill="type.color" />
        <polygon :points="hullPoints('deck')" :fill="deckColor" />

        <!-- лодка: планшири носа и кормы, банки гребцов и румпель -->
        <g v-if="shape === 'boat'">
          <line
              v-for="(bench, index) in benches"
              :key="'bench' + index"
              :x1="bench.x1" :y1="bench.y1" :x2="bench.x2" :y2="bench.y2"
              stroke="#a56a2a" stroke-width="3" stroke-linecap="round" />
          <line
              :x1="tiller.x1" :y1="tiller.y1" :x2="tiller.x2" :y2="tiller.y2"
              stroke="#5b3614" stroke-width="3" stroke-linecap="round" />
        </g>

        <!-- корабль: стволы, две башни главного калибра, мостик и основание трубы -->
        <g v-else>
          <line
              v-for="(barrel, index) in barrels"
              :key="'barrel' + index"
              :x1="barrel.x1" :y1="barrel.y1" :x2="barrel.x2" :y2="barrel.y2"
              stroke="#374151" stroke-width="4" stroke-linecap="round" />
          <circle
              v-for="(turret, index) in turrets"
              :key="'turret' + index"
              :cx="turret.x" :cy="turret.y" :r="turret.r"
              fill="#9ca3af" stroke="#1f2937" stroke-width="2" />
          <polygon :points="hullPoints('bridge')" fill="#9ca3af" stroke="#1f2937" stroke-width="2" />
          <ellipse :cx="funnelAnchor.x" :cy="funnelAnchor.y" rx="8" ry="5.5" fill="#374151" stroke="#1f2937" stroke-width="2" />
        </g>

        <!-- контур корпуса: у выбранного судна белый -->
        <polygon :points="hullPoints('hull')" fill="none"
                 :stroke="selected ? '#fff' : 'rgba(0, 0, 0, 0.55)'"
                 :stroke-width="selected ? 2 : 1.5" />
      </svg>

      <!-- вертикальные части стоят в проекции своей точки палубы, но не наклоняются -->
      <div class="upright" :style="uprightStyle">
        <template v-if="shape === 'warship'">
          <div class="smoke" :class="{ moving: walking }" />
          <div class="stack" />
        </template>
        <template v-else>
          <div class="flag" :style="{ backgroundColor: groupColor(unit.group) }" />
          <div class="mast" />
        </template>
      </div>
    </div>

    <HpBar :hp="unit.hp" :max-hp="type.maxHp" :group="unit.group" :width="barWidth" />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import HpBar from './HpBar.vue'
import { groupColor } from '@/game/config'
import { depthZIndex, worldToScreen } from '@/game/coords'
import type { Point, Unit, UnitType } from '@/game/types'

// Юнит: у пеших - человечек, у водных - лодка или корабль; точка position - центр на воде.
// Компонент только рисует: данные юнита приходят из стора world через GameField и не меняются здесь
const props = defineProps<{
  unit: Unit
  type: UnitType
  selected: boolean
}>()

// Событие для родителя (GameField): если на юнита кликнули, его надо выбрать
// С зажатым shift юнит добавляется к выбору или убирается из него
const emit = defineEmits<{ select: [additive: boolean] }>()
const pushEmit = (event: MouseEvent) => emit('select', event.shiftKey)

// Ожидание свободного пути сохраняет цель, но не включает анимацию ходьбы
const walking = computed(() => !!props.unit.target && !!props.unit.path?.length && !props.unit.blockedFor)

// Как рисовать юнит: по умолчанию человечек, у лодок и кораблей - свой силуэт
const shape = computed(() => props.type.shape ?? 'human')

// Полоска жизней у больших кораблей шире, у пехоты остаётся прежней
const barWidth = computed(() => Math.round(Math.min(84, Math.max(36, props.type.width * 0.6))))

// Курс судна в мировых радианах: 0 - нос в +x мира. Стоящее судно сохраняет последний курс
const facing = computed(() => props.unit.facing ?? Math.PI / 4)

// Корпус в плане: длина от кормы до носа и ширина в борт, в мировых пикселях
const boatDims = { length: 84, beam: 34 }
const warshipDims = { length: 150, beam: 46 }
const dims = computed(() => (shape.value === 'warship' ? warshipDims : boatDims))

// Проекция точки корпуса (x - доля длины вдоль носа, y - доля полуширины) в пиксели от центра
const project = (local: Point): Point => {
  const { length, beam } = dims.value
  const cos = Math.cos(facing.value)
  const sin = Math.sin(facing.value)
  const world = {
    x: props.unit.position.x + local.x * length * cos - local.y * beam * sin,
    y: props.unit.position.y + local.x * length * sin + local.y * beam * cos,
  }
  const point = worldToScreen(world)
  const center = worldToScreen(props.unit.position)
  return { x: point.x - center.x, y: point.y - center.y }
}

// Размер svg с запасом: корпус поворачивается вокруг центра, след уходит назад
const vesselSize = computed(() => Math.round(dims.value.length * 2.2 + dims.value.beam))
const viewBox = computed(() => `${-vesselSize.value / 2} ${-vesselSize.value / 2} ${vesselSize.value} ${vesselSize.value}`)

// Якорь в центре рамки юнита: корпус нарисован вокруг точки position
// и остаётся внутри кликабельной рамки (иначе svg уходил ниже и ловил клики соседей)
const anchorStyle = {
  position: 'absolute' as const,
  left: '50%',
  top: '50%',
}

// svg центрируется на якоре: его центр - точка на воде
const deckStyle = computed(() => ({
  position: 'absolute' as const,
  left: '0',
  top: '0',
  transform: 'translate(-50%, -50%)',
}))

// Экранные точки контура: набор пар долей корпуса -> svg points
const outline = (points: [number, number][], shiftY = 0) =>
  points.map(([x, y]) => {
    const p = project({ x, y })
    return `${p.x.toFixed(1)},${(p.y + shiftY).toFixed(1)}`
  }).join(' ')

// Доли корпуса: 0.5 по длине - нос, 0.5 по полуширине - борт
const HULL: [number, number][] = [[0.5, 0], [0.44, -0.42], [0, -0.5], [-0.44, -0.42], [-0.5, 0], [-0.44, 0.42], [0, 0.5], [0.44, 0.42]]
const DECK: [number, number][] = [[0.44, 0], [0.38, -0.34], [0, -0.4], [-0.38, -0.34], [-0.42, 0], [-0.38, 0.34], [0, 0.4], [0.38, 0.34]]

const hullPoints = (part: 'hull' | 'keel' | 'deck' | 'bridge') => {
  switch (part) {
    case 'hull':
      return outline(HULL)
    case 'keel':
      // тот же силуэт ниже по экрану: между палубой и водой виден борт
      return outline(HULL, 7)
    case 'deck':
      return outline(DECK)
    default:
      // мостик корабля: прямоугольник поперёк палубы ближе к носу
      return outline([[0.08, -0.22], [0.2, -0.22], [0.2, 0.22], [0.08, 0.22]])
  }
}

// Банки и румпель лодки в экранных координатах
const segment = (from: Point, to: Point) => {
  const a = project(from)
  const b = project(to)
  return { x1: a.x, y1: a.y, x2: b.x, y2: b.y }
}

const benches = computed(() => [
  segment({ x: 0.16, y: -0.3 }, { x: 0.16, y: 0.3 }),
  segment({ x: -0.06, y: -0.3 }, { x: -0.06, y: 0.3 }),
])

const tiller = computed(() => segment({ x: -0.3, y: 0.12 }, { x: -0.44, y: 0.32 }))

// Башни корабля и стволы в нос
const turrets = computed(() => [0.3, -0.14].map((x) => {
  const p = project({ x, y: 0 })
  return { x: p.x, y: p.y, r: 9 }
}))

const barrels = computed(() => [0.3, -0.14].flatMap((x) => [-0.07, 0.07].map((y) =>
  segment({ x, y }, { x: x + 0.1, y }))))

// Основание трубы: по этой точке ставим вертикальную трубу
const funnelAnchor = computed(() => project({ x: 0.02, y: 0 }))

// Вертикальная часть встаёт в точку палубы (координаты от якоря, ось y вверх отрицательная)
const uprightStyle = computed(() => ({
  position: 'absolute' as const,
  left: funnelAnchor.value.x + 'px',
  bottom: -funnelAnchor.value.y + 'px',
}))

const deckColor = computed(() => (shape.value === 'warship' ? '#6b7280' : '#8b5a2b'))
const keelColor = 'rgba(20, 20, 20, 0.6)'

const style = computed(() => {
  const point = worldToScreen(props.unit.position)
  // пеший стоит ногами в точке position, поэтому рамка поднята на всю высоту;
  // у судна position - центр корпуса на воде, рамка центрируется на нём
  const top = shape.value === 'human' ? point.y - props.type.height : point.y - props.type.height / 2
  return {
    left: point.x - props.type.width / 2 + 'px',
    top: top + 'px',
    width: props.type.width + 'px',
    height: props.type.height + 'px',
    zIndex: depthZIndex(point),
  }
})
</script>

<style scoped lang="scss">
.game-unit {
  position: absolute;
  cursor: pointer;
}

.shadow {
  position: absolute;
  left: 0;
  bottom: 0;
  width: 100%;
  aspect-ratio: 2 / 1;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.3);
  transform: translateY(50%);
}

.leg {
  position: absolute;
  bottom: 0;
  width: 4px;
  height: 32%;
  border-radius: 2px;
  background: #000;
  transform-origin: top center;

  &.left {
    left: 25%;
    --step-a: 25deg;
    --step-b: -25deg;
  }

  &.right {
    right: 25%;
    --step-a: -25deg;
    --step-b: 25deg;
  }

  .selected > & {
    background: #fff;
  }
}

// Руки вращаются вокруг плеч
.arm {
  position: absolute;
  top: 34%;
  width: 4px;
  height: 34%;
  border-radius: 2px;
  background: #000;
  transform-origin: top center;

  &.left {
    left: 0;
    transform: rotate(25deg);
    --step-a: 5deg;
    --step-b: 50deg;
  }

  &.right {
    right: 0;
    transform: rotate(-25deg);
    --step-a: -50deg;
    --step-b: -5deg;
  }

  .selected > & {
    background: #fff;
  }
}

// Ходьба из двух кадров
.walking > .leg,
.walking > .arm {
  animation: walk 0.4s steps(1) infinite;
}

@keyframes walk {
  0% {
    transform: rotate(var(--step-a));
  }

  50% {
    transform: rotate(var(--step-b));
  }
}

.body,
.head {
  position: absolute;
  box-sizing: border-box;
  border: 2px solid rgba(0, 0, 0, 1);
  border-radius: 50%;
  background-image: radial-gradient(
    circle at 35% 28%,
    rgba(255, 255, 255, 0.6) 0%,
    rgba(255, 255, 255, 0) 40%,
    rgba(0, 0, 0, 0.4) 100%
  );

  .selected > & {
    border-color: #fff;
  }
}

.body {
  left: 0;
  top: 26%;
  width: 100%;
  height: 50%;
}

.head {
  left: 22%;
  top: 0;
  width: 56%;
  aspect-ratio: 1;
}

// Судно: корпус лежит в плоскости воды, качается на ходу.
// Рисунок прозрачен для мыши: клики ловит рамка юнита, иначе большой svg
// перехватывал бы нажатия у соседних юнитов
.vessel {
  pointer-events: none;

  .deck {
    overflow: visible;
  }
}

.shape-boat.walking .deck,
.shape-warship.walking .deck {
  animation: bob 2.2s ease-in-out infinite;
}

@keyframes bob {
  0%,
  100% {
    transform: translate(-50%, -50%) translateY(0) rotate(-0.6deg);
  }

  50% {
    transform: translate(-50%, -50%) translateY(-2px) rotate(0.6deg);
  }
}

// Мачта лодки: вертикальная стойка с флагом цвета группы
.mast {
  width: 2px;
  height: 34px;
  margin-left: -1px;
  background: #3f2a14;
}

.flag {
  position: absolute;
  left: 1px;
  bottom: 34px;
  width: 14px;
  height: 10px;
  clip-path: polygon(0 0, 100% 0, 60% 50%, 100% 100%, 0 100%);
  box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.5);
}

// Труба корабля: вертикальный цилиндр и дым над ним
.stack {
  width: 12px;
  height: 30px;
  margin-left: -6px;
  border: 1px solid rgba(0, 0, 0, 0.6);
  border-top: 4px solid #111827;
  border-radius: 3px 3px 0 0;
  background: linear-gradient(to right, #374151, #9ca3af, #374151);
}

.smoke {
  position: absolute;
  left: 4px;
  bottom: 30px;
  width: 26px;
  height: 16px;
  border-radius: 50%;
  background: radial-gradient(closest-side, rgba(220, 220, 220, 0.75), rgba(220, 220, 220, 0));
  opacity: 0.45;

  &.moving {
    animation: drift 2.4s ease-out infinite;
  }
}

@keyframes drift {
  0% {
    transform: translateX(0) scale(1);
    opacity: 0.8;
  }

  100% {
    transform: translateX(14px) scale(1.8);
    opacity: 0;
  }
}
</style>

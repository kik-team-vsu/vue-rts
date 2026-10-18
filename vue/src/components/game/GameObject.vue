<template>
  <div
      class="game-object"
      :class="{ selected, walking, box: faces, figure: !faces }"
      :style="style"
      @mousedown.left.stop="() => pushEmit()">
    <!-- здание или дерево: две ближние к камере стены и верх, затем скаты крыши и ветки, если они есть у типа -->
    <template v-if="faces">
      <div class="face wall" :style="faces.leftWall" />
      <div class="face wall dark" :style="faces.rightWall" />
      <div class="face top" :style="faces.top" />
      <div
          v-for="(tooth, index) in battlements"
          :key="'tooth' + index"
          class="face wall"
          :class="{ dark: tooth.dark }"
          :style="tooth.style" />
      <div
          v-for="(part, index) in roofParts"
          :key="'roof' + index"
          :class="part.class"
          :style="part.style" />
      <div
          v-for="(branch, index) in branches"
          :key="'branch' + index"
          class="branch"
          :style="branch" />
    </template>
    <template v-else>
      <div class="shadow" />
      <div class="leg left" />
      <div class="leg right" />
      <div class="body" :style="{ backgroundColor: type.color }" />
      <div class="arm left" />
      <div class="arm right" />
      <div class="head" :style="{ backgroundColor: type.color }" />
    </template>
    <div v-if="hpRatio !== null" class="hp-bar" :style="hpBarStyle">
      <div class="hp-fill" :style="hpFillStyle" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { GROUP_COLORS, MAP } from '@/game/config'
import { ISO_SCALE, worldToScreen } from '@/game/coords'
import type { GameObject, ObjectType, Point } from '@/game/types'

// общий компонент для статичных объектов и юнитоd
const props = defineProps<{
  object: GameObject
  type: ObjectType
  selected: boolean
}>()

// событие для родителя (GameField): если на объект кликнули, его надо выбрать
const emit = defineEmits<{ select: [] }>()
const pushEmit = () => emit('select')

// юнит идёт, пока у него есть цель: тогда включается анимация рук и ног
const walking = computed(() => 'target' in props.object && props.object.target !== null)

const hp = computed(() => (props.object as { hp?: number }).hp)
const maxHp = computed(() => (props.type as { maxHp?: number }).maxHp)

const hpRatio = computed(() => {
  if (hp.value === undefined || maxHp.value === undefined) {
    return null
  }
  return Math.max(0, Math.min(1, hp.value / maxHp.value))
})

const hpBarStyle = computed(() => {
  const { wallHeight = 0, roofHeight = 0 } = props.type
  return {
    top: -(wallHeight + roofHeight) - 14 + 'px',
    borderColor: GROUP_COLORS[props.object.group] ?? '#000',
  }
})

const hpFillStyle = computed(() => {
  const ratio = hpRatio.value ?? 0
  let color = '#ef4444'
  if (ratio > 0.6) {
    color = '#22c55e'
  }
  else if (ratio > 0.3) {
    color = '#eab308'
  }
  return { width: ratio * 100 + '%', backgroundColor: color }
})

const style = computed(() => {
  const point = worldToScreen(props.object.position)
  const zIndex = Math.round(point.y) + MAP.width + MAP.height

  if (props.type.wallHeight) {
    return {
      left: point.x + 'px',
      top: point.y + 'px',
      zIndex,
    }
  }
  return {
    left: point.x - props.type.width / 2 + 'px',
    top: point.y - props.type.height + 'px',
    width: props.type.width + 'px',
    height: props.type.height + 'px',
    zIndex,
  }
})

const faces = computed(() => {
  const { width, height, color, wallHeight } = props.type
  if (!wallHeight) {
    return null
  }
  const left = worldToScreen({ x: -width / 2, y: height / 2 })
  const front = worldToScreen({ x: width / 2, y: height / 2 })
  // matrix наклоняет стену вдоль стороны основания: по горизонтали как у земли, вертикаль остаётся вертикалью
  return {
    // стена вдоль оси x мира: от левого угла вправо-вниз к ближнему
    leftWall: {
      left: left.x + 'px',
      top: left.y - wallHeight + 'px',
      width: width + 'px',
      height: wallHeight + 'px',
      backgroundColor: color,
      transform: `matrix(${ISO_SCALE}, ${ISO_SCALE / 2}, 0, 1, 0, 0)`,
    },
    // стена вдоль оси y мира: от ближнего угла вправо-вверх
    rightWall: {
      left: front.x + 'px',
      top: front.y - wallHeight + 'px',
      width: height + 'px',
      height: wallHeight + 'px',
      backgroundColor: color,
      transform: `matrix(${ISO_SCALE}, ${-ISO_SCALE / 2}, 0, 1, 0, 0)`,
    },
    // верх - основание, поднятое на высоту стен
    top: {
      left: -width / 2 + 'px',
      top: -height / 2 - wallHeight + 'px',
      width: width + 'px',
      height: height + 'px',
      backgroundColor: color,
    },
  }
})

const polygon = (points: Point[], color: string, brightness: number) => {
  const left = Math.min(...points.map((p) => p.x))
  const top = Math.min(...points.map((p) => p.y))
  return {
    left: left + 'px',
    top: top + 'px',
    width: Math.max(...points.map((p) => p.x)) - left + 'px',
    height: Math.max(...points.map((p) => p.y)) - top + 'px',
    backgroundColor: color,
    filter: `brightness(${brightness})`,
    clipPath: `polygon(${points.map((p) => `${p.x - left}px ${p.y - top}px`).join(', ')})`,
  }
}

// ребро крыши
const edge = (from: Point, to: Point) => {
  const dx = to.x - from.x
  const dy = to.y - from.y
  return {
    left: from.x + 'px',
    top: from.y + 'px',
    width: Math.hypot(dx, dy) + 'px',
    transform: `rotate(${Math.atan2(dy, dx)}rad)`,
  }
}

// крыша-пирамида
const roofParts = computed(() => {
  const { width, height, color, wallHeight, roofHeight, roofColor, roofType } = props.type
  if (!wallHeight || !roofHeight || roofType === 'battlements') {
    return []
  }
  const corner = (x: number, y: number): Point => {
    const point = worldToScreen({ x, y })
    return { x: point.x, y: point.y - wallHeight }
  }
  const back = corner(-width / 2, -height / 2)
  const left = corner(-width / 2, height / 2)
  const right = corner(width / 2, -height / 2)
  const front = corner(width / 2, height / 2)
  const peak = { x: 0, y: -wallHeight - roofHeight }
  const fill = roofColor ?? color
  const slopes = (...styles: object[]) => styles.map((style) => ({ class: 'slope', style }))
  const edges = (...styles: object[]) => styles.map((style) => ({ class: 'edge', style }))
  return [
    ...slopes(polygon([back, left, peak], fill, 0.8), polygon([back, right, peak], fill, 0.6)),
    ...edges(edge(back, left), edge(back, right), edge(back, peak)),
    ...slopes(polygon([left, front, peak], fill, 1), polygon([front, right, peak], fill, 0.7)),
    ...edges(edge(left, peak), edge(front, peak), edge(right, peak)),
  ]
})

// примерный размер зубца и промежутка между зубцами в единицах мира
const TOOTH_SIZE = 20

// зубцы по краям стен (крыша замка)
const battlements = computed(() => {
  const { width, height, color, wallHeight, roofHeight, roofColor, roofType } = props.type
  if (!wallHeight || !roofHeight || roofType !== 'battlements') {
    return []
  }
  const fill = roofColor ?? color
  const row = (alongX: boolean, fixed: number) => {
    const length = alongX ? width : height
    const count = Math.max(2, Math.round((length / TOOTH_SIZE + 1) / 2))
    const size = length / (2 * count - 1)
    return Array.from({ length: count }, (_, index) => {
      const offset = index * 2 * size
      // как и стены в faces: вдоль x идём от левого края вправо, вдоль y - от ближнего края вдаль
      const start = alongX
        ? worldToScreen({ x: -width / 2 + offset, y: fixed })
        : worldToScreen({ x: fixed, y: height / 2 - offset })
      return {
        dark: !alongX,
        style: {
          left: start.x + 'px',
          top: start.y - wallHeight - roofHeight + 'px',
          width: size + 'px',
          height: roofHeight + 'px',
          backgroundColor: fill,
          transform: `matrix(${ISO_SCALE}, ${((alongX ? 1 : -1) * ISO_SCALE) / 2}, 0, 1, 0, 0)`,
        },
      }
    })
  }
  return [
    ...row(true, -height / 2),
    ...row(false, -width / 2),
    ...row(true, height / 2),
    ...row(false, width / 2),
  ]
})

const BRANCH_PAIRS = 4
// угол наклона веток вниз от горизонтали
const BRANCH_ANGLE = 25

// ветки ёлки: пары палок от оси ствола в обе стороны, чем выше, тем короче
const branches = computed(() => {
  const { wallHeight, branchColor } = props.type
  if (!wallHeight || !branchColor) {
    return []
  }
  const result = []
  for (let i = 0; i < BRANCH_PAIRS; i++) {
    const y = wallHeight * (0.3 + i * 0.2)
    const length = wallHeight * 0.35 * (1 - i * 0.2)
    for (const angle of [BRANCH_ANGLE, 180 - BRANCH_ANGLE]) {
      result.push({
        top: -y + 'px',
        width: length + 'px',
        backgroundColor: branchColor,
        transform: `rotate(${angle}deg)`,
      })
    }
  }
  return result
})

</script>

<style scoped lang="scss">
.game-object {
  position: absolute;
  border: 2px solid rgba(0, 0, 0, 1);
  cursor: pointer;
}

.selected {
  border-color: #fff;
}

.box {
  width: 0;
  height: 0;
  border: none;
}

.figure {
  border: none;
}

.hp-bar {
  position: absolute;
  left: 50%;
  width: 36px;
  height: 6px;
  box-sizing: border-box;
  border: 2px solid #000;
  background: rgba(0, 0, 0, 0.6);
  transform: translateX(-50%);
}

.hp-fill {
  height: 100%;
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

// руки юнитлов = палки от плеч
.arm {
  position: absolute;
  top: 34%;
  width: 4px;
  height: 34%;
  border-radius: 2px;
  background: #000;
  transform-origin: top center;

  // руки машут
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

// ходьба из двух кадров
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

.face {
  position: absolute;
  box-sizing: border-box;
  border: 2px solid rgba(0, 0, 0, 1);

  .selected > & {
    border-color: #fff;
  }
}

.wall {
  transform-origin: 0 0;
  background-image: linear-gradient(rgba(0, 0, 0, 0.25), rgba(0, 0, 0, 0.25));

  &.dark {
    background-image: linear-gradient(rgba(0, 0, 0, 0.45), rgba(0, 0, 0, 0.45));
  }
}

// та же изометрия для ромбовидности
.top {
  transform: scaleY(0.5) rotate(45deg);
}

// скат крыши
.slope {
  position: absolute;
}

.edge {
  position: absolute;
  height: 0;
  margin-top: -1px;
  border-top: 2px solid rgba(0, 0, 0, 1);
  transform-origin: 0 50%;

  .selected > & {
    border-color: #fff;
  }
}

.branch {
  position: absolute;
  left: 0;
  height: 4px;
  margin-top: -2px;
  border-radius: 2px;
  transform-origin: 0 50%;
}
</style>

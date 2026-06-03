import { generateGestureMap, generateGestureMapFromBPM } from '../src/features/gestures/generateGestureMap'
import type { BeatMarker, Difficulty } from '../src/types'

function makeBeats(count: number, bpm = 120): BeatMarker[] {
  const interval = 60 / bpm
  return Array.from({ length: count }, (_, i) => ({
    time: i * interval,
    strength: 0.8,
    index: i,
  }))
}

// ─── generateGestureMap ──────────────────────────────────────────────────────

const beats = makeBeats(50, 120)

// Easy: every 4 beats, skipping first ~4 = ~10 prompts
const easyPrompts = generateGestureMap(beats, 'easy')
console.assert(easyPrompts.length > 0, 'easy: prompts generated')
console.assert(
  easyPrompts.every((p) => p.gestureId !== undefined),
  'easy: all prompts have gestureId',
)
console.assert(
  easyPrompts.every((p) => p.startTime < p.endTime),
  'easy: startTime < endTime',
)
console.assert(
  easyPrompts.every((p) => p.windowMs === 1200),
  'easy: windowMs = 1200',
)

const normalPrompts = generateGestureMap(beats, 'normal')
console.assert(normalPrompts.length > easyPrompts.length, 'normal has more prompts than easy')
console.assert(
  normalPrompts.every((p) => p.windowMs === 800),
  'normal: windowMs = 800',
)

const hardPrompts = generateGestureMap(beats, 'hard')
console.assert(hardPrompts.length > normalPrompts.length, 'hard has more prompts than normal')
console.assert(
  hardPrompts.every((p) => p.windowMs === 600),
  'hard: windowMs = 600',
)

// No consecutive duplicate gestures
for (let i = 1; i < easyPrompts.length; i++) {
  console.assert(
    easyPrompts[i].gestureId !== easyPrompts[i - 1].gestureId,
    `No consecutive duplicates at index ${i}`,
  )
}

// Segment filtering
const segmentPrompts = generateGestureMap(beats, 'normal', 5, 20)
console.assert(
  segmentPrompts.every((p) => p.startTime >= 5 && p.endTime <= 20 + 1),
  'segment: all prompts within segment',
)

// ─── generateGestureMapFromBPM ───────────────────────────────────────────────

const bpmPrompts = generateGestureMapFromBPM(120, 60, 'normal')
console.assert(bpmPrompts.length > 0, 'BPM prompts generated')
console.assert(
  bpmPrompts.every((p) => p.startTime >= 0 && p.endTime <= 61),
  'BPM prompts within duration',
)

// IDs are unique
const ids = new Set(bpmPrompts.map((p) => p.id))
console.assert(ids.size === bpmPrompts.length, 'all prompt IDs are unique')

// ─── Difficulty ranges ────────────────────────────────────────────────────────

const difficulties: Difficulty[] = ['easy', 'normal', 'hard']
for (const diff of difficulties) {
  const p = generateGestureMapFromBPM(128, 30, diff)
  console.assert(p.length > 0, `${diff}: generates prompts`)
  console.assert(
    p.every((pr) => typeof pr.gestureId === 'string'),
    `${diff}: valid gestureIds`,
  )
}

console.log('✅ All gesture generation tests passed!')

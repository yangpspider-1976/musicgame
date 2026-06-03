import type { BeatMarker, Difficulty, GestureId, GesturePrompt } from '../../types'

const EASY_GESTURES: GestureId[] = [
  'LEFT_HAND_UP',
  'RIGHT_HAND_UP',
  'BOTH_HANDS_UP',
  'SIDE_LEAN_LEFT',
  'SIDE_LEAN_RIGHT',
]

const NORMAL_GESTURES: GestureId[] = [
  ...EASY_GESTURES,
  'LEFT_PUNCH',
  'RIGHT_PUNCH',
  'FREEZE_POSE',
]

const HARD_GESTURES: GestureId[] = [
  ...NORMAL_GESTURES,
  'HANDS_CROSS',
  'HEART_POSE',
]

const GESTURE_POOL: Record<Difficulty, GestureId[]> = {
  easy: EASY_GESTURES,
  normal: NORMAL_GESTURES,
  hard: HARD_GESTURES,
}

// Beat interval multipliers per difficulty (skip every N beats)
const BEAT_SKIP: Record<Difficulty, number> = {
  easy: 4,    // every 4 beats
  normal: 2,  // every 2 beats
  hard: 1,    // every beat
}

// Window multipliers per difficulty (ms)
const WINDOW_MS: Record<Difficulty, number> = {
  easy: 1200,
  normal: 800,
  hard: 600,
}

let idCounter = 0
function genId() {
  return `prompt_${Date.now()}_${idCounter++}`
}

/**
 * Generate gesture prompts from a beat grid.
 */
export function generateGestureMap(
  beats: BeatMarker[],
  difficulty: Difficulty,
  segmentStart = 0,
  segmentEnd = Infinity,
): GesturePrompt[] {
  const pool = GESTURE_POOL[difficulty]
  const skip = BEAT_SKIP[difficulty]
  const windowMs = WINDOW_MS[difficulty]
  const prompts: GesturePrompt[] = []

  const segmentBeats = beats.filter(
    (b) => b.time >= segmentStart && b.time <= segmentEnd,
  )

  // Give lead-in time (skip first 4 beats for countdown)
  const startIdx = Math.min(4, Math.floor(segmentBeats.length * 0.1))

  let gestureIdx = 0
  for (let i = startIdx; i < segmentBeats.length; i++) {
    if ((i - startIdx) % skip !== 0) continue

    const beat = segmentBeats[i]
    const nextBeat = segmentBeats[i + skip] ?? segmentBeats[i + 1]
    const endTime = nextBeat ? nextBeat.time : beat.time + windowMs / 1000

    // Avoid repeating the same gesture twice in a row
    let gesture: GestureId
    do {
      gesture = pool[gestureIdx % pool.length]
      gestureIdx++
    } while (
      prompts.length > 0 &&
      prompts[prompts.length - 1].gestureId === gesture &&
      pool.length > 1
    )

    prompts.push({
      id: genId(),
      gestureId: gesture,
      beatIndex: beat.index,
      startTime: beat.time,
      endTime,
      windowMs,
    })
  }

  return prompts
}

/**
 * Generate gesture prompts from a BPM value and duration (for YouTube mode).
 */
export function generateGestureMapFromBPM(
  bpm: number,
  duration: number,
  difficulty: Difficulty,
  segmentStart = 0,
  segmentEnd?: number,
): GesturePrompt[] {
  const end = segmentEnd ?? duration
  const beatInterval = 60 / bpm
  const beats: BeatMarker[] = []
  let t = segmentStart
  let idx = 0
  while (t <= end) {
    beats.push({ time: t, strength: 0.8, index: idx++ })
    t += beatInterval
  }
  return generateGestureMap(beats, difficulty, segmentStart, end)
}

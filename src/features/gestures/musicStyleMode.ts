import type { BeatMarker, Difficulty, GestureId, GesturePrompt } from '../../types'
import type { MusicStyleProfile } from '../../types'

// Gesture pools per style
const STYLE_GESTURES: Record<MusicStyleProfile, GestureId[]> = {
  KPOP: ['HEART_POSE', 'BOTH_HANDS_UP', 'RIGHT_HAND_UP', 'LEFT_HAND_UP', 'HANDS_CROSS'],
  HIPHOP: ['LEFT_PUNCH', 'RIGHT_PUNCH', 'BOTH_HANDS_UP', 'SIDE_LEAN_LEFT', 'SIDE_LEAN_RIGHT'],
  EDM: ['BOTH_HANDS_UP', 'LEFT_HAND_UP', 'RIGHT_HAND_UP', 'SIDE_LEAN_LEFT', 'SIDE_LEAN_RIGHT'],
  BALLAD: ['FREEZE_POSE', 'SIDE_LEAN_LEFT', 'SIDE_LEAN_RIGHT', 'LEFT_HAND_UP', 'RIGHT_HAND_UP'],
  FREESTYLE: ['LEFT_HAND_UP', 'RIGHT_HAND_UP', 'BOTH_HANDS_UP', 'LEFT_PUNCH', 'RIGHT_PUNCH', 'HANDS_CROSS', 'HEART_POSE', 'SIDE_LEAN_LEFT', 'SIDE_LEAN_RIGHT', 'FREEZE_POSE'],
}

const WINDOW_MS: Record<Difficulty, number> = {
  easy: 1200,
  normal: 800,
  hard: 600,
}

const BEAT_SKIP: Record<Difficulty, number> = {
  easy: 4,
  normal: 2,
  hard: 1,
}

let idCounter = 0
function genId() {
  return `style_prompt_${Date.now()}_${idCounter++}`
}

export interface GestureGenerationResult {
  prompts: GesturePrompt[]
  style: MusicStyleProfile
}

export function generateFromStyle(
  style: MusicStyleProfile,
  beats: BeatMarker[],
  difficulty: Difficulty,
  segStart = 0,
  segEnd = Infinity,
): GestureGenerationResult {
  const pool = STYLE_GESTURES[style]
  const skip = BEAT_SKIP[difficulty]
  const windowMs = WINDOW_MS[difficulty]
  const prompts: GesturePrompt[] = []

  const segmentBeats = beats.filter((b) => b.time >= segStart && b.time <= segEnd)
  const startIdx = Math.min(4, Math.floor(segmentBeats.length * 0.1))

  let gestureIdx = 0
  for (let i = startIdx; i < segmentBeats.length; i++) {
    if ((i - startIdx) % skip !== 0) continue

    const beat = segmentBeats[i]
    const nextBeat = segmentBeats[i + skip] ?? segmentBeats[i + 1]
    const endTime = nextBeat ? nextBeat.time : beat.time + windowMs / 1000

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

  return { prompts, style }
}

export function generateFromStyleBPM(
  style: MusicStyleProfile,
  bpm: number,
  duration: number,
  difficulty: Difficulty,
  segStart = 0,
  segEnd?: number,
): GestureGenerationResult {
  const end = segEnd ?? duration
  const beatInterval = 60 / bpm
  const beats: BeatMarker[] = []
  let t = segStart
  let idx = 0
  while (t <= end) {
    beats.push({ time: t, strength: 0.8, index: idx++ })
    t += beatInterval
  }
  return generateFromStyle(style, beats, difficulty, segStart, end)
}

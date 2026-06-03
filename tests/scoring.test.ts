import {
  calculateGestureScore,
  calculateLetterGrade,
  buildSession,
  getTimingGrade,
  getComboMultiplier,
  PERFECT_WINDOW_MS,
  GOOD_WINDOW_MS,
  BASE_SCORE,
} from '../src/features/gameplay/scoring'
import type { GestureResult } from '../src/types'

function makeResult(
  timingGrade: GestureResult['timingGrade'],
  poseAccuracy = 1,
  score = 1000,
): GestureResult {
  return {
    promptId: `p_${Math.random()}`,
    gestureId: 'LEFT_HAND_UP',
    timingGrade,
    timingOffsetMs: 0,
    poseAccuracy,
    score,
  }
}

// ─── getTimingGrade ──────────────────────────────────────────────────────────

console.assert(getTimingGrade(0) === 'PERFECT', 'offset=0 → PERFECT')
console.assert(getTimingGrade(PERFECT_WINDOW_MS) === 'PERFECT', 'exactly on PERFECT boundary')
console.assert(getTimingGrade(PERFECT_WINDOW_MS + 1) === 'GOOD', 'just past PERFECT → GOOD')
console.assert(getTimingGrade(GOOD_WINDOW_MS) === 'GOOD', 'exactly on GOOD boundary')
console.assert(getTimingGrade(GOOD_WINDOW_MS + 1) === 'MISS', 'past GOOD → MISS')
console.assert(getTimingGrade(-PERFECT_WINDOW_MS) === 'PERFECT', 'negative PERFECT')
console.assert(getTimingGrade(-GOOD_WINDOW_MS - 1) === 'MISS', 'negative MISS')

// ─── getComboMultiplier ──────────────────────────────────────────────────────

console.assert(getComboMultiplier(0) === 1.0, 'combo=0 → 1.0')
console.assert(getComboMultiplier(2) === 1.0, 'combo=2 → 1.0')
console.assert(getComboMultiplier(3) === 1.1, 'combo=3 → 1.1')
console.assert(getComboMultiplier(5) === 1.2, 'combo=5 → 1.2')
console.assert(getComboMultiplier(10) === 1.5, 'combo=10 → 1.5')
console.assert(getComboMultiplier(20) === 2.0, 'combo=20 → 2.0')

// ─── calculateGestureScore ───────────────────────────────────────────────────

const perfectScore = calculateGestureScore('PERFECT', 1, 0)
console.assert(perfectScore === BASE_SCORE, `PERFECT score = ${BASE_SCORE}`)

const goodScore = calculateGestureScore('GOOD', 1, 0)
console.assert(goodScore === Math.round(BASE_SCORE * 0.6), `GOOD score = ${Math.round(BASE_SCORE * 0.6)}`)

const missScore = calculateGestureScore('MISS', 1, 0)
console.assert(missScore === 0, 'MISS score = 0')

const comboScore = calculateGestureScore('PERFECT', 1, 10)
console.assert(comboScore === Math.round(BASE_SCORE * 1.5), `combo=10 score = ${Math.round(BASE_SCORE * 1.5)}`)

// ─── calculateLetterGrade ────────────────────────────────────────────────────

const allPerfect = Array(10).fill(null).map(() => makeResult('PERFECT'))
console.assert(calculateLetterGrade(allPerfect) === 'S', 'all perfect → S')

const mostPerfect = [
  ...Array(8).fill(null).map(() => makeResult('PERFECT')),
  ...Array(2).fill(null).map(() => makeResult('GOOD')),
]
console.assert(calculateLetterGrade(mostPerfect) === 'A', 'mostly perfect + some good → A')

const halfGood = Array(10).fill(null).map((_, i) =>
  makeResult(i < 7 ? 'GOOD' : 'MISS'),
)
console.assert(calculateLetterGrade(halfGood) === 'B', '70% good → B')

const allMiss = Array(10).fill(null).map(() => makeResult('MISS'))
console.assert(calculateLetterGrade(allMiss) === 'D', 'all miss → D')

const empty: GestureResult[] = []
console.assert(calculateLetterGrade(empty) === 'D', 'empty → D')

// ─── buildSession ────────────────────────────────────────────────────────────

const results: GestureResult[] = [
  makeResult('PERFECT', 1, 1000),
  makeResult('PERFECT', 1, 1100),
  makeResult('GOOD', 0.8, 600),
  makeResult('MISS', 0, 0),
  makeResult('PERFECT', 1, 1200),
]
const session = buildSession('challenge_1', results)
console.assert(session.challengeId === 'challenge_1', 'session challengeId')
console.assert(session.totalScore === 1000 + 1100 + 600 + 0 + 1200, 'total score')
console.assert(session.maxCombo === 3, `maxCombo: expected 3, got ${session.maxCombo}`)
console.assert(session.grade !== undefined, 'grade assigned')

console.log('✅ All scoring tests passed!')

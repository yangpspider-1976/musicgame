import type { GestureResult, LetterGrade, PlaySession, TimingGrade } from '../../types'

export const BASE_SCORE = 1000
export const PERFECT_WINDOW_MS = 200
export const GOOD_WINDOW_MS = 400

export function getTimingGrade(offsetMs: number): TimingGrade {
  const abs = Math.abs(offsetMs)
  if (abs <= PERFECT_WINDOW_MS) return 'PERFECT'
  if (abs <= GOOD_WINDOW_MS) return 'GOOD'
  return 'MISS'
}

export function getTimingMultiplier(grade: TimingGrade): number {
  switch (grade) {
    case 'PERFECT': return 1.0
    case 'GOOD': return 0.6
    case 'MISS': return 0
  }
}

export function getComboMultiplier(combo: number): number {
  if (combo >= 20) return 2.0
  if (combo >= 10) return 1.5
  if (combo >= 5) return 1.2
  if (combo >= 3) return 1.1
  return 1.0
}

export function calculateGestureScore(
  timingGrade: TimingGrade,
  poseAccuracy: number,
  combo: number,
): number {
  const timingMult = getTimingMultiplier(timingGrade)
  const comboMult = getComboMultiplier(combo)
  return Math.round(BASE_SCORE * timingMult * poseAccuracy * comboMult)
}

export function calculateLetterGrade(
  results: GestureResult[],
): LetterGrade {
  if (results.length === 0) return 'D'

  const perfects = results.filter((r) => r.timingGrade === 'PERFECT').length
  const goods = results.filter((r) => r.timingGrade === 'GOOD').length
  const misses = results.filter((r) => r.timingGrade === 'MISS').length
  const total = results.length

  const hitRate = (perfects + goods) / total
  const perfectRate = perfects / total

  if (perfectRate >= 0.9 && hitRate >= 0.95) return 'S'
  if (perfectRate >= 0.7 && hitRate >= 0.85) return 'A'
  if (hitRate >= 0.7) return 'B'
  if (hitRate >= 0.5) return 'C'
  if (misses < total) return 'D'
  return 'D'
}

export function buildSession(
  challengeId: string,
  results: GestureResult[],
): PlaySession {
  const totalScore = results.reduce((sum, r) => sum + r.score, 0)
  const grade = calculateLetterGrade(results)

  let maxCombo = 0
  let currentCombo = 0
  for (const r of results) {
    if (r.timingGrade !== 'MISS') {
      currentCombo++
      maxCombo = Math.max(maxCombo, currentCombo)
    } else {
      currentCombo = 0
    }
  }

  return {
    id: `session_${Date.now()}`,
    challengeId,
    startedAt: Date.now(),
    endedAt: Date.now(),
    results,
    totalScore,
    maxCombo,
    grade,
  }
}

export function getGradeColor(grade: LetterGrade): string {
  switch (grade) {
    case 'S': return '#f59e0b' // gold
    case 'A': return '#a855f7' // purple
    case 'B': return '#06b6d4' // cyan
    case 'C': return '#22c55e' // green
    case 'D': return '#6b7280' // gray
  }
}

export function getTimingFeedbackText(grade: TimingGrade): string {
  switch (grade) {
    case 'PERFECT': return 'PERFECT!'
    case 'GOOD': return 'GOOD'
    case 'MISS': return 'MISS'
  }
}

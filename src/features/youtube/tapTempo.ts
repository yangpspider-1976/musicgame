import type { TapTempoResult } from '../../types'

const MIN_TAPS = 3
const MAX_TAP_INTERVAL_MS = 3000 // reset if gap > 3s

export class TapTempo {
  private taps: number[] = []
  private lastTapTime: number | null = null

  tap(): TapTempoResult {
    const now = performance.now()

    // Reset if gap is too large
    if (this.lastTapTime !== null && now - this.lastTapTime > MAX_TAP_INTERVAL_MS) {
      this.taps = []
    }

    this.taps.push(now)
    this.lastTapTime = now

    return this.calculate()
  }

  calculate(): TapTempoResult {
    if (this.taps.length < MIN_TAPS) {
      return { bpm: 0, confidence: 0, tapCount: this.taps.length }
    }

    const intervals: number[] = []
    for (let i = 1; i < this.taps.length; i++) {
      intervals.push(this.taps[i] - this.taps[i - 1])
    }

    const avgInterval = intervals.reduce((s, v) => s + v, 0) / intervals.length
    const bpm = Math.round(60_000 / avgInterval)

    // Confidence: based on consistency of intervals
    const variance =
      intervals.reduce((s, v) => s + (v - avgInterval) ** 2, 0) / intervals.length
    const stdDev = Math.sqrt(variance)
    const cv = stdDev / avgInterval // coefficient of variation
    const confidence = Math.max(0, Math.min(1, 1 - cv * 2))

    return { bpm: clampBPM(bpm), confidence, tapCount: this.taps.length }
  }

  reset(): void {
    this.taps = []
    this.lastTapTime = null
  }

  getTapCount(): number {
    return this.taps.length
  }
}

function clampBPM(bpm: number): number {
  // Normalize to 60-180 range
  while (bpm < 60) bpm *= 2
  while (bpm > 180) bpm /= 2
  return Math.round(bpm)
}

export const tapTempo = new TapTempo()

/**
 * Peak detection helpers for beat detection.
 */

export interface Peak {
  index: number
  value: number
}

/**
 * Find local maxima in the energy envelope above a dynamic threshold.
 */
export function findPeaks(
  energy: Float32Array,
  minDistance: number,
  threshold: number,
): Peak[] {
  const peaks: Peak[] = []
  let lastPeakIndex = -minDistance

  for (let i = 1; i < energy.length - 1; i++) {
    if (
      energy[i] > threshold &&
      energy[i] >= energy[i - 1] &&
      energy[i] >= energy[i + 1] &&
      i - lastPeakIndex >= minDistance
    ) {
      peaks.push({ index: i, value: energy[i] })
      lastPeakIndex = i
    }
  }
  return peaks
}

/**
 * Compute a moving average of an array with given window size.
 */
export function movingAverage(arr: Float32Array, windowSize: number): Float32Array {
  const result = new Float32Array(arr.length)
  const half = Math.floor(windowSize / 2)
  for (let i = 0; i < arr.length; i++) {
    let sum = 0
    let count = 0
    for (let j = Math.max(0, i - half); j <= Math.min(arr.length - 1, i + half); j++) {
      sum += arr[j]
      count++
    }
    result[i] = sum / count
  }
  return result
}

/**
 * Compute onset strength envelope from audio samples.
 * Uses HFC (High Frequency Content) approximation on windowed RMS.
 */
export function computeEnergyEnvelope(
  samples: Float32Array,
  sampleRate: number,
  hopSize = 512,
): Float32Array {
  const frameCount = Math.floor((samples.length - hopSize) / hopSize)
  const envelope = new Float32Array(frameCount)

  let prevRms = 0
  for (let f = 0; f < frameCount; f++) {
    const start = f * hopSize
    let sumSq = 0
    for (let i = start; i < start + hopSize && i < samples.length; i++) {
      sumSq += samples[i] * samples[i]
    }
    const rms = Math.sqrt(sumSq / hopSize)
    // Onset strength = positive RMS change (flux)
    const flux = Math.max(0, rms - prevRms)
    envelope[f] = flux
    prevRms = rms
  }
  return envelope
}

/**
 * Estimate BPM from inter-peak intervals.
 * Returns bpm and confidence (0-1).
 */
export function estimateBPMFromPeaks(
  peaks: Peak[],
  hopSize: number,
  sampleRate: number,
): { bpm: number; confidence: number } {
  if (peaks.length < 4) return { bpm: 120, confidence: 0 }

  const intervals: number[] = []
  for (let i = 1; i < peaks.length; i++) {
    const dt = ((peaks[i].index - peaks[i - 1].index) * hopSize) / sampleRate
    if (dt > 0.2 && dt < 2.5) {
      intervals.push(dt)
    }
  }

  if (intervals.length === 0) return { bpm: 120, confidence: 0 }

  // Cluster intervals and find most common
  const bpmCandidates: number[] = intervals.map((iv) => 60 / iv)

  // Try octave alignment (normalize to 60-180 BPM range)
  const normalized = bpmCandidates.map((b) => {
    while (b < 60) b *= 2
    while (b > 180) b /= 2
    return b
  })

  // Histogram with 5-BPM bins
  const bins: Record<number, number> = {}
  for (const b of normalized) {
    const bin = Math.round(b / 5) * 5
    bins[bin] = (bins[bin] ?? 0) + 1
  }

  const bestBin = Object.entries(bins).sort((a, b) => b[1] - a[1])[0]
  const bpm = parseFloat(bestBin[0])
  const confidence = Math.min(1, bestBin[1] / normalized.length)

  return { bpm: Math.round(bpm), confidence }
}

import type { AudioAnalysisResult, BeatMarker } from '../../types'
import {
  computeEnergyEnvelope,
  findPeaks,
  estimateBPMFromPeaks,
  movingAverage,
} from './beatDetection'

const HOP_SIZE = 512

/**
 * Decode an audio file and analyze its rhythm.
 */
export async function analyzeAudio(file: File): Promise<AudioAnalysisResult> {
  const arrayBuffer = await file.arrayBuffer()

  // Use OfflineAudioContext for decoding
  const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)()
  const audioBuffer = await ctx.decodeAudioData(arrayBuffer)
  await ctx.close()

  // Convert to mono
  const mono = toMono(audioBuffer)
  const sampleRate = audioBuffer.sampleRate
  const duration = audioBuffer.duration

  // Compute onset envelope
  const envelope = computeEnergyEnvelope(mono, sampleRate, HOP_SIZE)

  // Smooth envelope
  const smoothed = movingAverage(envelope, 5)

  // Dynamic threshold: mean + 0.5 * std
  const mean = smoothed.reduce((s, v) => s + v, 0) / smoothed.length
  const std = Math.sqrt(
    smoothed.reduce((s, v) => s + (v - mean) ** 2, 0) / smoothed.length,
  )
  const threshold = mean + 0.5 * std

  // Minimum distance between peaks: ~200ms
  const minDistanceFrames = Math.floor((0.2 * sampleRate) / HOP_SIZE)

  const peaks = findPeaks(smoothed, minDistanceFrames, threshold)

  const { bpm, confidence } = estimateBPMFromPeaks(peaks, HOP_SIZE, sampleRate)

  // Generate beat grid from BPM
  const beats = generateBeatGrid(bpm, duration, peaks, HOP_SIZE, sampleRate)

  return { bpm, confidence, beats, duration, sampleRate }
}

/**
 * Analyze audio from an ArrayBuffer (already decoded).
 */
export async function analyzeAudioBuffer(
  arrayBuffer: ArrayBuffer,
): Promise<AudioAnalysisResult> {
  const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)()
  const audioBuffer = await ctx.decodeAudioData(arrayBuffer)
  await ctx.close()

  const mono = toMono(audioBuffer)
  const sampleRate = audioBuffer.sampleRate
  const duration = audioBuffer.duration
  const envelope = computeEnergyEnvelope(mono, sampleRate, HOP_SIZE)
  const smoothed = movingAverage(envelope, 5)
  const mean = smoothed.reduce((s, v) => s + v, 0) / smoothed.length
  const std = Math.sqrt(
    smoothed.reduce((s, v) => s + (v - mean) ** 2, 0) / smoothed.length,
  )
  const threshold = mean + 0.5 * std
  const minDistanceFrames = Math.floor((0.2 * sampleRate) / HOP_SIZE)
  const peaks = findPeaks(smoothed, minDistanceFrames, threshold)
  const { bpm, confidence } = estimateBPMFromPeaks(peaks, HOP_SIZE, sampleRate)
  const beats = generateBeatGrid(bpm, duration, peaks, HOP_SIZE, sampleRate)

  return { bpm, confidence, beats, duration, sampleRate }
}

/**
 * Generate beat grid from a detected BPM, optionally snapping to detected peaks.
 */
export function generateBeatGrid(
  bpm: number,
  duration: number,
  peaks: { index: number; value: number }[],
  hopSize: number,
  sampleRate: number,
): BeatMarker[] {
  const beatInterval = 60 / bpm

  // Find best phase offset using peak timestamps
  const peakTimes = peaks.map((p) => (p.index * hopSize) / sampleRate)

  let bestOffset = 0
  if (peakTimes.length > 0) {
    // Try offsets from 0 to beatInterval in small steps
    let bestScore = -Infinity
    const steps = 20
    for (let s = 0; s < steps; s++) {
      const offset = (s / steps) * beatInterval
      let score = 0
      for (const t of peakTimes) {
        const phase = ((t - offset) % beatInterval + beatInterval) % beatInterval
        const closeness = Math.min(phase, beatInterval - phase)
        score -= closeness
      }
      if (score > bestScore) {
        bestScore = score
        bestOffset = offset
      }
    }
  }

  const beats: BeatMarker[] = []
  let t = bestOffset
  let idx = 0
  while (t <= duration) {
    // Find nearest peak for strength
    let strength = 0.5
    let minDist = Infinity
    for (const p of peaks) {
      const pt = (p.index * hopSize) / sampleRate
      const dist = Math.abs(pt - t)
      if (dist < minDist) {
        minDist = dist
        strength = Math.min(1, p.value * 3)
      }
    }
    // Clamp strength
    if (minDist > beatInterval * 0.5) strength = 0.3

    beats.push({ time: t, strength, index: idx })
    t += beatInterval
    idx++
  }
  return beats
}

/**
 * Mix a multi-channel AudioBuffer down to mono Float32Array.
 */
function toMono(buffer: AudioBuffer): Float32Array {
  const channels = buffer.numberOfChannels
  const length = buffer.length
  const mono = new Float32Array(length)

  for (let c = 0; c < channels; c++) {
    const ch = buffer.getChannelData(c)
    for (let i = 0; i < length; i++) {
      mono[i] += ch[i]
    }
  }
  for (let i = 0; i < length; i++) {
    mono[i] /= channels
  }
  return mono
}

/**
 * Generate a beat grid purely from BPM (for YouTube mode where we only have BPM).
 */
export function generateBeatGridFromBPM(
  bpm: number,
  duration: number,
  startOffset = 0,
): BeatMarker[] {
  const beatInterval = 60 / bpm
  const beats: BeatMarker[] = []
  let t = startOffset
  let idx = 0
  while (t <= duration) {
    beats.push({ time: t, strength: 0.8, index: idx })
    t += beatInterval
    idx++
  }
  return beats
}

import type { PlaySession, Challenge } from '../../types'
import { getGradeColor } from '../gameplay/scoring'

export interface ExportOptions {
  session: PlaySession
  challenge: Challenge
  cameraVideoElement?: HTMLVideoElement
  durationMs?: number
  onProgress?: (progress: number) => void
}

/**
 * Compose a 9:16 vertical result video (720x1280) and return a Blob.
 */
export async function exportShortVideo(options: ExportOptions): Promise<Blob> {
  const { session, challenge, cameraVideoElement, durationMs = 5000, onProgress } = options

  const WIDTH = 720
  const HEIGHT = 1280

  const canvas = document.createElement('canvas')
  canvas.width = WIDTH
  canvas.height = HEIGHT
  const ctx = canvas.getContext('2d')!

  const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
    ? 'video/webm;codecs=vp9'
    : 'video/webm'

  const stream = canvas.captureStream(30)
  const recorder = new MediaRecorder(stream, {
    mimeType,
    videoBitsPerSecond: 3_000_000,
  })
  const chunks: Blob[] = []
  recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data) }

  recorder.start(100)

  const startTime = performance.now()
  let frame = 0

  await new Promise<void>((resolve) => {
    const drawFrame = () => {
      const elapsed = performance.now() - startTime
      const progress = Math.min(elapsed / durationMs, 1)

      drawResultFrame(ctx, {
        width: WIDTH,
        height: HEIGHT,
        session,
        challenge,
        cameraVideoElement,
        progress,
        frameIndex: frame,
      })

      onProgress?.(progress)
      frame++

      if (elapsed < durationMs) {
        requestAnimationFrame(drawFrame)
      } else {
        resolve()
      }
    }
    requestAnimationFrame(drawFrame)
  })

  return new Promise((resolve) => {
    recorder.onstop = () => {
      stream.getTracks().forEach((t) => t.stop())
      const blob = new Blob(chunks, { type: mimeType })
      resolve(blob)
    }
    recorder.stop()
  })
}

interface DrawOptions {
  width: number
  height: number
  session: PlaySession
  challenge: Challenge
  cameraVideoElement?: HTMLVideoElement
  progress: number
  frameIndex: number
}

function drawResultFrame(ctx: CanvasRenderingContext2D, opts: DrawOptions): void {
  const { width, height, session, challenge, cameraVideoElement, progress, frameIndex } = opts

  // Background
  ctx.fillStyle = '#0a0a0f'
  ctx.fillRect(0, 0, width, height)

  // Camera feed (bottom 2/3)
  const cameraY = height * 0.33
  const cameraH = height * 0.67
  if (cameraVideoElement && cameraVideoElement.readyState >= 2) {
    ctx.save()
    // Mirror the camera
    ctx.translate(width, cameraY)
    ctx.scale(-1, 1)
    ctx.drawImage(cameraVideoElement, 0, 0, width, cameraH)
    ctx.restore()

    // Vignette overlay on camera feed
    const gradient = ctx.createLinearGradient(0, cameraY, 0, cameraY + cameraH)
    gradient.addColorStop(0, 'rgba(10,10,15,0.7)')
    gradient.addColorStop(0.2, 'rgba(10,10,15,0)')
    gradient.addColorStop(0.8, 'rgba(10,10,15,0)')
    gradient.addColorStop(1, 'rgba(10,10,15,0.9)')
    ctx.fillStyle = gradient
    ctx.fillRect(0, cameraY, width, cameraH)
  } else {
    // No camera: gradient background
    const bg = ctx.createLinearGradient(0, cameraY, 0, height)
    bg.addColorStop(0, '#0f0f1a')
    bg.addColorStop(1, '#1a1a2e')
    ctx.fillStyle = bg
    ctx.fillRect(0, cameraY, width, cameraH)
  }

  // Top section: score overlay
  const topH = height * 0.33

  // Top gradient
  const topGrad = ctx.createLinearGradient(0, 0, 0, topH)
  topGrad.addColorStop(0, '#0a0a0f')
  topGrad.addColorStop(1, 'rgba(10,10,15,0.8)')
  ctx.fillStyle = topGrad
  ctx.fillRect(0, 0, width, topH)

  // App watermark
  ctx.fillStyle = '#a855f7'
  ctx.font = 'bold 28px system-ui, sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText('🎵 Rhythm Gesture', width / 2, 50)

  // Challenge title
  ctx.fillStyle = '#e2e8f0'
  ctx.font = '24px system-ui, sans-serif'
  ctx.fillText(challenge.title, width / 2, 90)

  // Grade (big, centered)
  const gradeColor = getGradeColor(session.grade)
  const gradePulse = 1 + 0.05 * Math.sin(frameIndex * 0.2)
  ctx.save()
  ctx.translate(width / 2, topH * 0.55)
  ctx.scale(gradePulse, gradePulse)
  ctx.fillStyle = gradeColor
  ctx.font = 'bold 140px system-ui, sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  // Shadow
  ctx.shadowColor = gradeColor
  ctx.shadowBlur = 30
  ctx.fillText(session.grade, 0, 0)
  ctx.restore()

  // Score row
  ctx.shadowBlur = 0
  ctx.fillStyle = '#f8fafc'
  ctx.font = 'bold 52px system-ui, sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'alphabetic'
  ctx.fillText(session.totalScore.toLocaleString(), width / 2, topH * 0.87)

  ctx.fillStyle = '#94a3b8'
  ctx.font = '22px system-ui, sans-serif'
  ctx.fillText('SCORE', width / 2, topH * 0.87 + 28)

  // Stats row at bottom of camera section
  const statsY = height - 100
  ctx.fillStyle = 'rgba(10,10,15,0.7)'
  ctx.fillRect(0, statsY - 10, width, 110)

  const perfects = session.results.filter((r) => r.timingGrade === 'PERFECT').length
  const goods = session.results.filter((r) => r.timingGrade === 'GOOD').length
  const misses = session.results.filter((r) => r.timingGrade === 'MISS').length

  const stats = [
    { label: 'PERFECT', value: perfects, color: '#a855f7' },
    { label: 'GOOD', value: goods, color: '#06b6d4' },
    { label: 'MISS', value: misses, color: '#ef4444' },
    { label: 'COMBO', value: session.maxCombo, color: '#eab308' },
  ]
  const colW = width / stats.length
  stats.forEach((stat, i) => {
    const cx = colW * i + colW / 2
    ctx.fillStyle = stat.color
    ctx.font = 'bold 32px system-ui, sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText(String(stat.value), cx, statsY + 32)
    ctx.fillStyle = '#94a3b8'
    ctx.font = '18px system-ui, sans-serif'
    ctx.fillText(stat.label, cx, statsY + 58)
  })

  // Progress bar (animated)
  ctx.fillStyle = '#1a1a2e'
  ctx.fillRect(0, height - 6, width, 6)
  ctx.fillStyle = '#a855f7'
  ctx.fillRect(0, height - 6, width * progress, 6)

  // Copyright notice
  ctx.fillStyle = 'rgba(148,163,184,0.6)'
  ctx.font = '16px system-ui, sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText('Only share music you own or have permission to use.', width / 2, height - 14)
}

/**
 * Download a blob as a file.
 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
}

import { useEffect, useRef } from 'react'
import { GESTURE_POSES, type PoseLandmarks } from '../features/gestures/gesturePoses'
import { GESTURE_MAP } from '../features/gestures/gestureDefinitions'

interface Props {
  gestureId: string | null
  nextGestureId?: string | null
  detected: boolean
  className?: string
  /** When true, show debug labels (scoringId / displayId / mirrorMode) */
  debug?: boolean
}

const CONNECTIONS: Array<[keyof PoseLandmarks, keyof PoseLandmarks]> = [
  ['leftShoulder',  'rightShoulder'],
  ['leftShoulder',  'leftElbow'],
  ['leftElbow',     'leftWrist'],
  ['rightShoulder', 'rightElbow'],
  ['rightElbow',    'rightWrist'],
  ['leftShoulder',  'leftHip'],
  ['rightShoulder', 'rightHip'],
  ['leftHip',       'rightHip'],
]

/**
 * Mirror map: for a mirrored selfie camera the player sees their left hand
 * on the left of the screen. To make the silhouette match what they see
 * ("left" text = silhouette hand on left), we display the mirrored pose.
 *
 * Scoring uses the ORIGINAL gestureId. Only the display pose is mapped.
 */
const DISPLAY_MIRROR_MAP: Record<string, string> = {
  LEFT_HAND_UP:    'RIGHT_HAND_UP',
  RIGHT_HAND_UP:   'LEFT_HAND_UP',
  LEFT_PUNCH:      'RIGHT_PUNCH',
  RIGHT_PUNCH:     'LEFT_PUNCH',
  SIDE_LEAN_LEFT:  'SIDE_LEAN_RIGHT',
  SIDE_LEAN_RIGHT: 'SIDE_LEAN_LEFT',
}

function drawFigure(
  ctx: CanvasRenderingContext2D,
  pose: PoseLandmarks,
  w: number,
  h: number,
  opts: { color: string; glowColor: string; alpha: number; lineWidth: number; headRadius: number; dotRadius: number; glow: boolean },
) {
  const { color, glowColor, alpha, lineWidth, headRadius, dotRadius, glow } = opts
  ctx.save()
  ctx.globalAlpha = alpha
  if (glow) { ctx.shadowBlur = 18; ctx.shadowColor = glowColor }
  ctx.strokeStyle = color
  ctx.lineWidth = lineWidth
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'

  for (const [a, b] of CONNECTIONS) {
    const pa = pose[a]
    const pb = pose[b]
    ctx.beginPath()
    ctx.moveTo(pa[0] * w, pa[1] * h)
    ctx.lineTo(pb[0] * w, pb[1] * h)
    ctx.stroke()
  }

  const [nx, ny] = pose.nose
  const midShoulderY = (pose.leftShoulder[1] + pose.rightShoulder[1]) / 2
  ctx.beginPath()
  ctx.arc(nx * w, ((ny + midShoulderY) / 2) * h, headRadius, 0, Math.PI * 2)
  ctx.fillStyle = color
  ctx.fill()

  const joints: Array<keyof PoseLandmarks> = [
    'leftShoulder', 'rightShoulder', 'leftElbow', 'rightElbow',
    'leftWrist', 'rightWrist', 'leftHip', 'rightHip',
  ]
  ctx.fillStyle = color
  for (const key of joints) {
    const [x, y] = pose[key]
    ctx.beginPath()
    ctx.arc(x * w, y * h, dotRadius, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.restore()
}

function drawLabel(
  ctx: CanvasRenderingContext2D,
  text: string,
  cx: number,
  y: number,
  font: string,
  color: string,
  shadowColor?: string,
) {
  ctx.save()
  ctx.font = font
  ctx.fillStyle = color
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  if (shadowColor) { ctx.shadowBlur = 12; ctx.shadowColor = shadowColor }
  ctx.fillText(text, cx, y)
  ctx.restore()
}

export function GestureOverlay({ gestureId, nextGestureId, detected, className = '', debug = false }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animRef = useRef<number>(0)
  const phaseRef = useRef(0)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const render = (ts: number) => {
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      const w = canvas.width
      const h = canvas.height
      ctx.clearRect(0, 0, w, h)

      phaseRef.current = (ts / 600) % (Math.PI * 2)
      const pulse = 0.5 + 0.5 * Math.sin(phaseRef.current)

      // NEXT gesture mini-preview (top-right)
      if (nextGestureId) {
        const displayNextId = DISPLAY_MIRROR_MAP[nextGestureId] ?? nextGestureId
        const nextPose = GESTURE_POSES[displayNextId]
        if (nextPose) {
          const previewW = w * 0.22
          const previewH = h * 0.28
          const previewX = w * 0.74
          const previewY = h * 0.02

          ctx.save()
          ctx.translate(previewX, previewY)
          ctx.scale(previewW / w, previewH / h)
          drawFigure(ctx, nextPose, w, h, {
            color: '#94a3b8', glowColor: '#94a3b8', alpha: 0.5,
            lineWidth: 6, headRadius: 18, dotRadius: 8, glow: false,
          })
          ctx.restore()

          const def = GESTURE_MAP[nextGestureId]
          drawLabel(ctx, `NEXT: ${def?.name ?? nextGestureId}`,
            previewX + previewW / 2, previewY + previewH + 14,
            `bold ${Math.max(9, w * 0.022)}px sans-serif`, '#94a3b8')
        }
      }

      // CURRENT gesture
      if (!gestureId) { animRef.current = requestAnimationFrame(render); return }

      const displayId = DISPLAY_MIRROR_MAP[gestureId] ?? gestureId
      const pose = GESTURE_POSES[displayId]
      if (!pose) { animRef.current = requestAnimationFrame(render); return }

      const def = GESTURE_MAP[gestureId]

      if (detected) {
        drawFigure(ctx, pose, w, h, {
          color: '#4ade80', glowColor: '#22c55e', alpha: 0.92,
          lineWidth: Math.max(4, w * 0.008), headRadius: Math.max(12, w * 0.028),
          dotRadius: Math.max(6, w * 0.012), glow: true,
        })
        ctx.save()
        ctx.globalAlpha = 0.9
        ctx.font = `bold ${Math.max(18, w * 0.06)}px sans-serif`
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillStyle = '#4ade80'
        ctx.shadowBlur = 20
        ctx.shadowColor = '#22c55e'
        ctx.fillText('✓', w * 0.5, h * 0.82)
        ctx.restore()
      } else {
        drawFigure(ctx, pose, w, h, {
          color: '#a78bfa', glowColor: '#7c3aed', alpha: 0.55 + pulse * 0.2,
          lineWidth: Math.max(3, w * 0.006), headRadius: Math.max(10, w * 0.024),
          dotRadius: Math.max(5, w * 0.010), glow: true,
        })
      }

      drawLabel(ctx, def?.name ?? gestureId, w * 0.5, h * 0.77,
        `bold ${Math.max(14, w * 0.038)}px sans-serif`,
        detected ? '#4ade80' : '#c4b5fd',
        detected ? '#22c55e' : '#7c3aed')

      // Debug labels
      if (debug && gestureId) {
        const mirrorApplied = gestureId in DISPLAY_MIRROR_MAP
        const lines = [
          `scoring: ${gestureId}`,
          `display: ${displayId}`,
          `mirror: ${mirrorApplied}`,
        ]
        ctx.save()
        ctx.font = `${Math.max(10, w * 0.022)}px monospace`
        ctx.fillStyle = '#facc15'
        ctx.textAlign = 'left'
        ctx.textBaseline = 'top'
        lines.forEach((l, i) => ctx.fillText(l, 8, 8 + i * 18))
        ctx.restore()
      }

      animRef.current = requestAnimationFrame(render)
    }

    animRef.current = requestAnimationFrame(render)
    return () => cancelAnimationFrame(animRef.current)
  }, [gestureId, nextGestureId, detected, debug])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ro = new ResizeObserver(() => {
      canvas.width = canvas.offsetWidth
      canvas.height = canvas.offsetHeight
    })
    ro.observe(canvas)
    canvas.width = canvas.offsetWidth
    canvas.height = canvas.offsetHeight
    return () => ro.disconnect()
  }, [])

  return (
    <canvas
      ref={canvasRef}
      // No CSS mirror — the silhouette is drawn in display space so "left" shows on left.
      // The camera is mirrored separately; the guide intentionally shows direction
      // from the player's perspective (left = their left hand side of screen).
      className={`absolute inset-0 w-full h-full pointer-events-none ${className}`}
    />
  )
}

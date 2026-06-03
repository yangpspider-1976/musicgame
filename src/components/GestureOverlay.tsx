import { useEffect, useRef } from 'react'
import { GESTURE_POSES, type PoseLandmarks } from '../features/gestures/gesturePoses'
import { GESTURE_MAP } from '../features/gestures/gestureDefinitions'

interface Props {
  gestureId: string | null
  nextGestureId?: string | null
  detected: boolean
  /** Canvas width & height match the camera feed container */
  className?: string
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

function drawFigure(
  ctx: CanvasRenderingContext2D,
  pose: PoseLandmarks,
  w: number,
  h: number,
  opts: {
    color: string
    glowColor: string
    alpha: number
    lineWidth: number
    headRadius: number
    dotRadius: number
    glow: boolean
  },
) {
  const { color, glowColor, alpha, lineWidth, headRadius, dotRadius, glow } = opts
  ctx.save()
  ctx.globalAlpha = alpha

  if (glow) {
    ctx.shadowBlur = 18
    ctx.shadowColor = glowColor
  }

  // Connections
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

  // Head circle
  const [nx, ny] = pose.nose
  const midShoulderY = (pose.leftShoulder[1] + pose.rightShoulder[1]) / 2
  const headCenterY = (ny + midShoulderY) / 2
  ctx.beginPath()
  ctx.arc(nx * w, headCenterY * h, headRadius, 0, Math.PI * 2)
  ctx.fillStyle = color
  ctx.fill()

  // Joint dots
  const joints: Array<keyof PoseLandmarks> = [
    'leftShoulder', 'rightShoulder',
    'leftElbow', 'rightElbow',
    'leftWrist', 'rightWrist',
    'leftHip', 'rightHip',
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

export function GestureOverlay({ gestureId, nextGestureId, detected, className = '' }: Props) {
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

      // pulse phase (0 → 2π per second)
      phaseRef.current = (ts / 600) % (Math.PI * 2)
      const pulse = 0.5 + 0.5 * Math.sin(phaseRef.current)

      // --- Draw NEXT gesture (ghost, smaller, top-right corner) ---
      if (nextGestureId && GESTURE_POSES[nextGestureId]) {
        const nextPose = GESTURE_POSES[nextGestureId]
        ctx.save()
        // Scale down & position in top-right corner
        const scale = 0.22
        const offsetX = w * 0.72
        const offsetY = h * 0.02

        ctx.translate(offsetX, offsetY)
        ctx.scale(scale, scale)

        const scaledW = w / scale
        const scaledH = h / scale

        drawFigure(ctx, nextPose, scaledW, scaledH, {
          color: '#94a3b8',
          glowColor: '#94a3b8',
          alpha: 0.45,
          lineWidth: 8,
          headRadius: 22,
          dotRadius: 10,
          glow: false,
        })

        // "NEXT" label
        ctx.restore()
        ctx.save()
        ctx.globalAlpha = 0.6
        ctx.fillStyle = '#94a3b8'
        ctx.font = `bold ${Math.max(10, w * 0.025)}px sans-serif`
        ctx.textAlign = 'center'
        const def = GESTURE_MAP[nextGestureId]
        ctx.fillText(`NEXT: ${def?.name ?? nextGestureId}`, w * 0.83, h * 0.265)
        ctx.restore()
      }

      // --- Draw CURRENT gesture ---
      if (!gestureId || !GESTURE_POSES[gestureId]) {
        animRef.current = requestAnimationFrame(render)
        return
      }

      const pose = GESTURE_POSES[gestureId]
      const def = GESTURE_MAP[gestureId]

      if (detected) {
        // Green glow + solid
        drawFigure(ctx, pose, w, h, {
          color: '#4ade80',
          glowColor: '#22c55e',
          alpha: 0.92,
          lineWidth: Math.max(4, w * 0.008),
          headRadius: Math.max(12, w * 0.028),
          dotRadius: Math.max(6, w * 0.012),
          glow: true,
        })

        // ✓ badge
        ctx.save()
        ctx.globalAlpha = 0.9
        ctx.font = `bold ${Math.max(18, w * 0.06)}px sans-serif`
        ctx.textAlign = 'center'
        ctx.fillStyle = '#4ade80'
        ctx.shadowBlur = 20
        ctx.shadowColor = '#22c55e'
        ctx.fillText('✓', w * 0.5, h * 0.82)
        ctx.restore()
      } else {
        // Pulsing cyan/purple
        const alpha = 0.55 + pulse * 0.2
        drawFigure(ctx, pose, w, h, {
          color: '#a78bfa',
          glowColor: '#7c3aed',
          alpha,
          lineWidth: Math.max(3, w * 0.006),
          headRadius: Math.max(10, w * 0.024),
          dotRadius: Math.max(5, w * 0.010),
          glow: true,
        })
      }

      // Gesture name label at bottom of figure
      const labelY = h * 0.77
      ctx.save()
      ctx.globalAlpha = detected ? 0.95 : 0.7 + pulse * 0.2
      ctx.font = `bold ${Math.max(14, w * 0.038)}px sans-serif`
      ctx.textAlign = 'center'
      ctx.fillStyle = detected ? '#4ade80' : '#c4b5fd'
      ctx.shadowBlur = 12
      ctx.shadowColor = detected ? '#22c55e' : '#7c3aed'
      ctx.fillText(def?.name ?? gestureId, w * 0.5, labelY)
      ctx.restore()

      animRef.current = requestAnimationFrame(render)
    }

    animRef.current = requestAnimationFrame(render)
    return () => cancelAnimationFrame(animRef.current)
  }, [gestureId, nextGestureId, detected])

  // Keep canvas sized to its container
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
      className={`absolute inset-0 w-full h-full pointer-events-none scale-x-[-1] ${className}`}
    />
  )
}

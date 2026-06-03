import { useEffect, useRef } from 'react'
import { GESTURE_POSES, type PoseLandmarks } from '../features/gestures/gesturePoses'
import { GESTURE_MAP } from '../features/gestures/gestureDefinitions'

interface Props {
  gestureId: string | null
  nextGestureId?: string | null
  detected: boolean
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

/**
 * Draw a stick figure.
 * The canvas has CSS scale-x-[-1] applied, so x coordinates are already mirrored.
 * We draw at x * w (raw image coords), CSS flip handles the mirror display.
 * For text we manually unflip inside this function.
 */
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

  // Head
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

/** Draw text that is readable even though the canvas is CSS scale-x-[-1]. */
function drawMirroredText(
  ctx: CanvasRenderingContext2D,
  text: string,
  cx: number,   // center x in canvas coords
  y: number,
  font: string,
  color: string,
  shadowColor?: string,
) {
  ctx.save()
  // Translate to the center point, flip x, then draw centered text
  ctx.translate(cx, y)
  ctx.scale(-1, 1)
  ctx.font = font
  ctx.fillStyle = color
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  if (shadowColor) {
    ctx.shadowBlur = 12
    ctx.shadowColor = shadowColor
  }
  ctx.fillText(text, 0, 0)
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

      phaseRef.current = (ts / 600) % (Math.PI * 2)
      const pulse = 0.5 + 0.5 * Math.sin(phaseRef.current)

      // --- NEXT gesture mini-preview (top-left in canvas = top-right on screen due to CSS flip) ---
      if (nextGestureId && GESTURE_POSES[nextGestureId]) {
        const nextPose = GESTURE_POSES[nextGestureId]
        const previewW = w * 0.22
        const previewH = h * 0.28
        const previewX = w * 0.04   // left side in canvas = right side on screen
        const previewY = h * 0.02

        ctx.save()
        ctx.translate(previewX, previewY)
        ctx.scale(previewW / w, previewH / h)

        drawFigure(ctx, nextPose, w, h, {
          color: '#94a3b8',
          glowColor: '#94a3b8',
          alpha: 0.5,
          lineWidth: 6,
          headRadius: 18,
          dotRadius: 8,
          glow: false,
        })

        ctx.restore()

        const def = GESTURE_MAP[nextGestureId]
        drawMirroredText(
          ctx,
          `NEXT: ${def?.name ?? nextGestureId}`,
          w * 0.15,
          previewY + previewH + 14,
          `bold ${Math.max(9, w * 0.022)}px sans-serif`,
          '#94a3b8',
        )
      }

      // --- CURRENT gesture ---
      if (!gestureId || !GESTURE_POSES[gestureId]) {
        animRef.current = requestAnimationFrame(render)
        return
      }

      const pose = GESTURE_POSES[gestureId]
      const def = GESTURE_MAP[gestureId]

      if (detected) {
        drawFigure(ctx, pose, w, h, {
          color: '#4ade80',
          glowColor: '#22c55e',
          alpha: 0.92,
          lineWidth: Math.max(4, w * 0.008),
          headRadius: Math.max(12, w * 0.028),
          dotRadius: Math.max(6, w * 0.012),
          glow: true,
        })

        // ✓ centered
        ctx.save()
        ctx.globalAlpha = 0.9
        ctx.translate(w * 0.5, h * 0.82)
        ctx.scale(-1, 1)
        ctx.font = `bold ${Math.max(18, w * 0.06)}px sans-serif`
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillStyle = '#4ade80'
        ctx.shadowBlur = 20
        ctx.shadowColor = '#22c55e'
        ctx.fillText('✓', 0, 0)
        ctx.restore()
      } else {
        drawFigure(ctx, pose, w, h, {
          color: '#a78bfa',
          glowColor: '#7c3aed',
          alpha: 0.55 + pulse * 0.2,
          lineWidth: Math.max(3, w * 0.006),
          headRadius: Math.max(10, w * 0.024),
          dotRadius: Math.max(5, w * 0.010),
          glow: true,
        })
      }

      // Gesture name label
      drawMirroredText(
        ctx,
        def?.name ?? gestureId,
        w * 0.5,
        h * 0.77,
        `bold ${Math.max(14, w * 0.038)}px sans-serif`,
        detected ? '#4ade80' : '#c4b5fd',
        detected ? '#22c55e' : '#7c3aed',
      )

      animRef.current = requestAnimationFrame(render)
    }

    animRef.current = requestAnimationFrame(render)
    return () => cancelAnimationFrame(animRef.current)
  }, [gestureId, nextGestureId, detected])

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
      // CSS mirror matches the camera video - pose coords are in image space
      className={`absolute inset-0 w-full h-full pointer-events-none scale-x-[-1] ${className}`}
    />
  )
}

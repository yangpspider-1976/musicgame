import type { PoseFrame, Landmark } from '../../types'

declare global {
  interface Window {
    Pose: new (config: PoseConfig) => PoseInstance
    Camera: new (video: HTMLVideoElement, config: CameraConfig) => CameraInstance
  }
}

interface PoseConfig {
  locateFile: (file: string) => string
}

interface PoseInstance {
  setOptions(options: PoseOptions): void
  onResults(callback: (results: PoseResults) => void): void
  send(input: { image: HTMLVideoElement | HTMLCanvasElement }): Promise<void>
  close(): void
}

interface PoseOptions {
  modelComplexity?: 0 | 1 | 2
  smoothLandmarks?: boolean
  enableSegmentation?: boolean
  smoothSegmentation?: boolean
  minDetectionConfidence?: number
  minTrackingConfidence?: number
}

interface PoseResults {
  poseLandmarks?: MediaPipeLandmark[]
  poseWorldLandmarks?: MediaPipeLandmark[]
  segmentationMask?: ImageBitmap
  image?: HTMLVideoElement | HTMLCanvasElement
}

interface MediaPipeLandmark {
  x: number
  y: number
  z: number
  visibility?: number
}

interface CameraConfig {
  onFrame: () => Promise<void>
  width?: number
  height?: number
  facingMode?: string
}

interface CameraInstance {
  start(): Promise<void>
  stop(): void
}

export type PoseResultCallback = (frame: PoseFrame) => void

export class PoseDetector {
  private pose: PoseInstance | null = null
  private camera: CameraInstance | null = null
  private onFrameCallbacks: PoseResultCallback[] = []
  private frameHistory: PoseFrame[] = []
  private readonly MAX_HISTORY = 30
  private isRunning = false
  private freezeThreshold = 0.05
  private lastLandmarks: Landmark[] | null = null

  constructor() {}

  async initialize(): Promise<void> {
    if (!window.Pose) {
      throw new Error('MediaPipe Pose not loaded. Ensure CDN scripts are included in index.html.')
    }

    this.pose = new window.Pose({
      locateFile: (file: string) =>
        `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`,
    })

    this.pose.setOptions({
      modelComplexity: 1,
      smoothLandmarks: true,
      enableSegmentation: false,
      minDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5,
    })

    this.pose.onResults((results) => {
      this.handleResults(results)
    })
  }

  private handleResults(results: PoseResults): void {
    if (!results.poseLandmarks) return

    const landmarks: Landmark[] = results.poseLandmarks.map((lm) => ({
      x: lm.x,
      y: lm.y,
      z: lm.z,
      visibility: lm.visibility ?? 1,
    }))

    const timestamp = performance.now()
    const frozen = this.checkFrozen(landmarks)

    const frame: PoseFrame = {
      landmarks,
      timestamp,
      frozen,
    }

    this.lastLandmarks = landmarks
    this.frameHistory.push(frame)
    if (this.frameHistory.length > this.MAX_HISTORY) {
      this.frameHistory.shift()
    }

    for (const cb of this.onFrameCallbacks) {
      cb(frame)
    }
  }

  private checkFrozen(landmarks: Landmark[]): boolean {
    if (!this.lastLandmarks || this.frameHistory.length < 5) return false
    const keyIndices = [0, 11, 12, 15, 16, 23, 24]
    let totalMovement = 0
    for (const idx of keyIndices) {
      const cur = landmarks[idx]
      const prev = this.lastLandmarks[idx]
      if (!cur || !prev) continue
      totalMovement += Math.sqrt((cur.x - prev.x) ** 2 + (cur.y - prev.y) ** 2)
    }
    return totalMovement < this.freezeThreshold
  }

  async startCamera(
    videoElement: HTMLVideoElement,
    onFrame?: PoseResultCallback,
  ): Promise<void> {
    if (!this.pose) await this.initialize()
    if (onFrame) this.onFrameCallbacks.push(onFrame)

    if (!window.Camera) {
      // Fallback: use requestAnimationFrame loop with getUserMedia
      await this.startManualCamera(videoElement)
      return
    }

    this.camera = new window.Camera(videoElement, {
      onFrame: async () => {
        if (this.pose && videoElement.readyState >= 2) {
          await this.pose.send({ image: videoElement })
        }
      },
      width: 640,
      height: 480,
      facingMode: 'user',
    })

    await this.camera.start()
    this.isRunning = true
  }

  private async startManualCamera(videoElement: HTMLVideoElement): Promise<void> {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: 640, height: 480 },
      })
      videoElement.srcObject = stream
      await videoElement.play()

      const loop = async () => {
        if (!this.isRunning) return
        if (this.pose && videoElement.readyState >= 2) {
          await this.pose.send({ image: videoElement })
        }
        requestAnimationFrame(loop)
      }

      this.isRunning = true
      requestAnimationFrame(loop)
    } catch (err) {
      console.error('Failed to start camera:', err)
      throw err
    }
  }

  onFrame(callback: PoseResultCallback): () => void {
    this.onFrameCallbacks.push(callback)
    return () => {
      this.onFrameCallbacks = this.onFrameCallbacks.filter((cb) => cb !== callback)
    }
  }

  getFrameHistory(): PoseFrame[] {
    return [...this.frameHistory]
  }

  getLatestFrame(): PoseFrame | null {
    return this.frameHistory[this.frameHistory.length - 1] ?? null
  }

  stop(): void {
    this.isRunning = false
    if (this.camera) {
      this.camera.stop()
      this.camera = null
    }
    if (this.pose) {
      this.pose.close()
      this.pose = null
    }
    this.onFrameCallbacks = []
  }

  setFreezeThreshold(threshold: number): void {
    this.freezeThreshold = threshold
  }

  /**
   * Draw pose skeleton on a canvas.
   */
  static drawSkeleton(
    ctx: CanvasRenderingContext2D,
    frame: PoseFrame,
    options: {
      color?: string
      lineWidth?: number
      dotRadius?: number
      alpha?: number
    } = {},
  ): void {
    const {
      color = '#a855f7',
      lineWidth = 2,
      dotRadius = 4,
      alpha = 0.8,
    } = options

    const { landmarks } = frame
    if (!landmarks || landmarks.length === 0) return

    const connections: [number, number][] = [
      [11, 12], [11, 13], [13, 15], [12, 14], [14, 16],
      [11, 23], [12, 24], [23, 24], [23, 25], [25, 27],
      [24, 26], [26, 28],
    ]

    ctx.save()
    ctx.globalAlpha = alpha
    ctx.strokeStyle = color
    ctx.lineWidth = lineWidth
    ctx.fillStyle = '#06b6d4'

    for (const [a, b] of connections) {
      const la = landmarks[a]
      const lb = landmarks[b]
      if (!la || !lb) continue
      if ((la.visibility ?? 1) < 0.3 || (lb.visibility ?? 1) < 0.3) continue

      ctx.beginPath()
      ctx.moveTo(la.x * ctx.canvas.width, la.y * ctx.canvas.height)
      ctx.lineTo(lb.x * ctx.canvas.width, lb.y * ctx.canvas.height)
      ctx.stroke()
    }

    // Draw dots for key landmarks
    const keyLandmarks = [0, 11, 12, 13, 14, 15, 16, 23, 24]
    for (const idx of keyLandmarks) {
      const lm = landmarks[idx]
      if (!lm || (lm.visibility ?? 1) < 0.3) continue
      ctx.beginPath()
      ctx.arc(lm.x * ctx.canvas.width, lm.y * ctx.canvas.height, dotRadius, 0, Math.PI * 2)
      ctx.fill()
    }

    ctx.restore()
  }
}

export const poseDetector = new PoseDetector()

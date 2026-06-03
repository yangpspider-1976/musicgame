import { useEffect, useRef, useState } from 'react'
import { PoseDetector } from '../features/pose/poseDetector'
import type { PoseFrame } from '../types'

interface Props {
  onReady?: (stream: MediaStream) => void
  onPoseFrame?: (frame: PoseFrame) => void
  showSkeleton?: boolean
  mirrored?: boolean
  className?: string
}

export function CameraPreview({
  onReady,
  onPoseFrame,
  showSkeleton = true,
  mirrored = true,
  className = '',
}: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const detectorRef = useRef<PoseDetector | null>(null)
  const [status, setStatus] = useState<'idle' | 'requesting' | 'active' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    const detector = new PoseDetector()
    detectorRef.current = detector

    const start = async () => {
      setStatus('requesting')
      const video = videoRef.current
      if (!video) return

      try {
        // Try MediaPipe first
        await detector.initialize()
        await detector.startCamera(video, (frame) => {
          if (cancelled) return
          onPoseFrame?.(frame)

          // Draw skeleton on canvas
          if (showSkeleton && canvasRef.current) {
            const canvas = canvasRef.current
            const ctx = canvas.getContext('2d')
            if (ctx) {
              // Match canvas to video size
              canvas.width = video.videoWidth || 640
              canvas.height = video.videoHeight || 480
              ctx.clearRect(0, 0, canvas.width, canvas.height)
              PoseDetector.drawSkeleton(ctx, frame)
            }
          }
        })
        if (!cancelled) {
          setStatus('active')
          if (video.srcObject instanceof MediaStream) {
            onReady?.(video.srcObject)
          }
        }
      } catch (_poseErr) {
        // Fallback: just get camera without pose
        try {
          const stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'user', width: 640, height: 480 },
          })
          if (!cancelled) {
            video.srcObject = stream
            await video.play()
            setStatus('active')
            onReady?.(stream)
          }
        } catch (camErr) {
          if (!cancelled) {
            setErrorMsg(camErr instanceof Error ? camErr.message : 'Camera access denied')
            setStatus('error')
          }
        }
      }
    }

    start()

    return () => {
      cancelled = true
      detector.stop()
    }
  }, [onReady, onPoseFrame, showSkeleton])

  return (
    <div className={`relative overflow-hidden rounded-2xl bg-dark-800 ${className}`}>
      {status === 'requesting' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 z-10">
          <div className="w-10 h-10 border-4 border-neon-purple border-t-transparent rounded-full animate-spin" />
          <p className="text-slate-400 text-sm">Requesting camera...</p>
        </div>
      )}

      {status === 'error' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 z-10 p-4">
          <span className="text-4xl">📷</span>
          <p className="text-red-400 text-sm text-center">{errorMsg ?? 'Camera error'}</p>
        </div>
      )}

      <video
        ref={videoRef}
        className={`w-full h-full object-cover ${mirrored ? 'scale-x-[-1]' : ''}`}
        playsInline
        muted
        autoPlay
        style={{ display: status === 'active' ? 'block' : 'none' }}
      />

      {showSkeleton && (
        <canvas
          ref={canvasRef}
          className={`camera-overlay ${mirrored ? 'scale-x-[-1]' : ''}`}
        />
      )}
    </div>
  )
}

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

  const onReadyRef = useRef(onReady)
  const onPoseFrameRef = useRef(onPoseFrame)
  useEffect(() => { onReadyRef.current = onReady }, [onReady])
  useEffect(() => { onPoseFrameRef.current = onPoseFrame }, [onPoseFrame])

  useEffect(() => {
    let cancelled = false
    const detector = new PoseDetector()
    detectorRef.current = detector

    const start = async () => {
      setStatus('requesting')
      const video = videoRef.current
      if (!video) return

      // First get camera stream so video shows up immediately
      let stream: MediaStream | null = null
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 }, aspectRatio: { ideal: 16 / 9 } },
          audio: false,
        })
        if (cancelled) { stream.getTracks().forEach(t => t.stop()); return }
        video.srcObject = stream
        await video.play()
        if (!cancelled) {
          setStatus('active')
          onReadyRef.current?.(stream)
        }
      } catch (camErr) {
        if (!cancelled) {
          setErrorMsg(camErr instanceof Error ? camErr.message : 'Camera access denied')
          setStatus('error')
        }
        return
      }

      // Then try to layer MediaPipe pose detection on top
      try {
        await detector.initialize()
        if (cancelled) return
        detector.onFrame((frame) => {
          if (cancelled) return
          onPoseFrameRef.current?.(frame)
          if (showSkeleton && canvasRef.current) {
            const canvas = canvasRef.current
            const ctx = canvas.getContext('2d')
            if (ctx) {
              canvas.width = video.videoWidth || 640
              canvas.height = video.videoHeight || 480
              ctx.clearRect(0, 0, canvas.width, canvas.height)
              PoseDetector.drawSkeleton(ctx, frame)
            }
          }
        })
        // Feed video frames to MediaPipe manually
        const loop = async () => {
          if (cancelled) return
          if (video.readyState >= 2) {
            await detector['pose']?.send({ image: video }).catch(() => {})
          }
          requestAnimationFrame(loop)
        }
        detector['isRunning'] = true
        requestAnimationFrame(loop)
      } catch (_poseErr) {
        // Pose detection unavailable; camera-only mode is fine
      }
    }

    start()

    return () => {
      cancelled = true
      detector.stop()
      detectorRef.current = null
    }
  }, [showSkeleton])

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
        className={`w-full h-full object-contain bg-black ${mirrored ? 'scale-x-[-1]' : ''}`}
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

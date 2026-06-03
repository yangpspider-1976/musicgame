import { useEffect, useRef, useState } from 'react'
import { useGameStore } from '../store/gameStore'
import { gameEngine, type GameState } from '../features/gameplay/gameEngine'
import { poseDetector } from '../features/pose/poseDetector'
import { PoseDetector } from '../features/pose/poseDetector'
import { buildSession } from '../features/gameplay/scoring'
import { GameplayHUD } from './GameplayHUD'
import { GestureOverlay } from './GestureOverlay'
import { evaluateGesture } from '../features/gestures/evaluateGesture'
import type { PoseFrame } from '../types'

export function GameplayScreen() {
  const { activeChallenge, syncSettings, setLastSession, setScreen } = useGameStore()
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [gameState, setGameState] = useState<GameState>(gameEngine.getState())
  const [currentDetected, setCurrentDetected] = useState(false)
  const frameHistoryRef = useRef<PoseFrame[]>([])

  // Load and start challenge
  useEffect(() => {
    if (!activeChallenge) {
      setScreen('HOME')
      return
    }

    gameEngine.loadChallenge(activeChallenge, syncSettings)

    const unsub = gameEngine.subscribe((state) => {
      setGameState(state)

      if (state.phase === 'finished') {
        const session = buildSession(activeChallenge.id, state.results)
        setLastSession(session)
        setTimeout(() => setScreen('RESULT'), 500)
      }
    })

    // Start camera + pose
    const startCamera = async () => {
      const video = videoRef.current
      if (!video) return

      try {
        await poseDetector.initialize()
        await poseDetector.startCamera(video, (frame) => {
          frameHistoryRef.current.push(frame)
          if (frameHistoryRef.current.length > 60) frameHistoryRef.current.shift()

          gameEngine.feedPoseFrame(frame)

          // Check current gesture for visual feedback
          const state = gameEngine.getState()
          if (state.activePrompt) {
            const result = evaluateGesture(
              state.activePrompt.gestureId,
              frame,
              frameHistoryRef.current.slice(-10),
            )
            setCurrentDetected(result.detected)
          } else {
            setCurrentDetected(false)
          }

          // Draw skeleton
          if (canvasRef.current && video.videoWidth) {
            const canvas = canvasRef.current
            canvas.width = video.videoWidth
            canvas.height = video.videoHeight
            const ctx = canvas.getContext('2d')
            if (ctx) {
              ctx.clearRect(0, 0, canvas.width, canvas.height)
              PoseDetector.drawSkeleton(ctx, frame, { alpha: 0.7 })
            }
          }
        })
      } catch {
        // Fallback without pose
        try {
          const stream = await navigator.mediaDevices.getUserMedia({
            video: {
              facingMode: 'user',
              width: { ideal: 1280 },
              height: { ideal: 720 },
              aspectRatio: { ideal: 16 / 9 },
            },
          })
          if (video) {
            video.srcObject = stream
            await video.play()
          }
        } catch { /* ignore */ }
      }
    }

    startCamera()
    gameEngine.startCountdown()

    return () => {
      unsub()
      gameEngine.stop()
      poseDetector.stop()
    }
  }, [activeChallenge, syncSettings, setLastSession, setScreen])

  // Audio: create once, play via gameEngine subscription (no React render cycle dependency)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  useEffect(() => {
    if (activeChallenge?.source.type !== 'local_upload') return
    if (!activeChallenge.source.objectUrl) return

    const audio = new Audio()
    audio.src = activeChallenge.source.objectUrl
    audio.preload = 'auto'
    audio.volume = 1.0
    audioRef.current = audio

    let started = false
    const unsub = gameEngine.subscribe((state) => {
      if (state.phase === 'playing' && !started) {
        started = true
        audio.currentTime = activeChallenge.segmentStart ?? 0
        const promise = audio.play()
        if (promise !== undefined) {
          promise.catch(() => {
            // Retry once after short delay (some browsers need this)
            setTimeout(() => {
              audio.play().catch((e) => console.warn('audio play failed:', e))
            }, 100)
          })
        }
      }
      if ((state.phase === 'finished' || state.phase === 'idle') && started) {
        audio.pause()
      }
    })

    return () => {
      unsub()
      audio.pause()
      audio.src = ''
      audioRef.current = null
    }
  }, [activeChallenge])

  const totalPrompts = activeChallenge?.prompts.length ?? 0
  const completedPrompts = gameState.results.length
  const progress = totalPrompts > 0 ? completedPrompts / totalPrompts : 0

  return (
    <div className="screen relative overflow-hidden">
      {/* Camera feed - full background */}
      <div className="absolute inset-0">
        <video
          ref={videoRef}
          className="w-full h-full object-contain scale-x-[-1] bg-black"
          playsInline
          muted
          autoPlay
        />
        <canvas
          ref={canvasRef}
          className="camera-overlay scale-x-[-1]"
        />
        {/* Dark overlay for readability */}
        <div className="absolute inset-0 bg-gradient-to-b from-dark-900/80 via-transparent to-dark-900/90" />
      </div>

      {/* Countdown overlay */}
      {gameState.phase === 'countdown' && gameState.countdown > 0 && (
        <div className="absolute inset-0 flex items-center justify-center z-20">
          <div
            className="text-9xl font-black animate-bounce-in"
            style={{
              color: '#a855f7',
              textShadow: '0 0 40px rgba(168,85,247,0.8)',
            }}
          >
            {gameState.countdown}
          </div>
        </div>
      )}

      {/* Gesture silhouette overlay — on top of camera, below HUD */}
      <GestureOverlay
        gestureId={gameState.activePrompt?.gestureId ?? null}
        nextGestureId={gameState.nextPrompt?.gestureId ?? null}
        detected={currentDetected}
        className="z-10"
      />

      {/* HUD - top */}
      <div className="relative z-20 p-4 pt-safe">
        <GameplayHUD
          score={gameState.score}
          combo={gameState.combo}
          maxCombo={gameState.maxCombo}
          lastTimingGrade={gameState.lastTimingGrade}
          lastGestureId={gameState.lastGestureId}
          progress={progress}
          totalPrompts={totalPrompts}
          completedPrompts={completedPrompts}
        />
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Stop button */}
      <button
        onClick={() => {
          gameEngine.stop()
          setScreen('CHALLENGE_PREVIEW')
        }}
        className="absolute top-4 right-4 z-20 w-8 h-8 bg-dark-800/80 rounded-full
          flex items-center justify-center text-slate-400 text-sm"
      >
        ✕
      </button>
    </div>
  )
}

import { useCallback, useEffect, useRef, useState } from 'react'
import { useGameStore } from '../store/gameStore'
import { gameEngine, type GameState } from '../features/gameplay/gameEngine'
import { poseDetector } from '../features/pose/poseDetector'
import { PoseDetector } from '../features/pose/poseDetector'
import { buildSession } from '../features/gameplay/scoring'
import { LocalAudioController } from '../features/music/musicController'
import { GameplayHUD } from './GameplayHUD'
import { GestureOverlay } from './GestureOverlay'
import { evaluateGesture } from '../features/gestures/evaluateGesture'
import type { PoseFrame } from '../types'

type StartState = 'waiting' | 'loading' | 'starting' | 'running' | 'error'

export function GameplayScreen() {
  const { activeChallenge, syncSettings, setLastSession, setScreen } = useGameStore()
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [gameState, setGameState] = useState<GameState>(gameEngine.getState())
  const [currentDetected, setCurrentDetected] = useState(false)
  const [startState, setStartState] = useState<StartState>('waiting')
  const [audioError, setAudioError] = useState<string | null>(null)
  const frameHistoryRef = useRef<PoseFrame[]>([])
  const controllerRef = useRef<LocalAudioController | null>(null)

  // Setup: load challenge + camera. Do NOT start music yet.
  useEffect(() => {
    if (!activeChallenge) { setScreen('HOME'); return }

    gameEngine.loadChallenge(activeChallenge, syncSettings)

    // Pre-create and pre-load the audio controller (no play yet)
    if (activeChallenge.source.type === 'local_upload' && activeChallenge.source.objectUrl) {
      const ctrl = new LocalAudioController(activeChallenge.source.objectUrl)
      controllerRef.current = ctrl
      gameEngine.setMusicController(ctrl)
      setStartState('loading')
      ctrl.load()
        .then(() => setStartState('waiting'))
        .catch(() => setStartState('waiting')) // allow start even if load event didn't fire
    }

    const unsub = gameEngine.subscribe((state) => {
      setGameState(state)
      if (state.phase === 'playing') setStartState('running')
      if (state.phase === 'finished') {
        const session = buildSession(activeChallenge.id, state.results)
        setLastSession(session)
        setTimeout(() => setScreen('RESULT'), 500)
      }
    })

    // Start camera
    const startCamera = async () => {
      const video = videoRef.current
      if (!video) return
      try {
        await poseDetector.initialize()
        await poseDetector.startCamera(video, (frame) => {
          frameHistoryRef.current.push(frame)
          if (frameHistoryRef.current.length > 60) frameHistoryRef.current.shift()
          gameEngine.feedPoseFrame(frame)
          const state = gameEngine.getState()
          if (state.activePrompt) {
            const result = evaluateGesture(state.activePrompt.gestureId, frame, frameHistoryRef.current.slice(-10))
            setCurrentDetected(result.detected)
          } else {
            setCurrentDetected(false)
          }
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
        try {
          const stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'user', width: { ideal: 720 }, height: { ideal: 1280 }, frameRate: { ideal: 30, max: 30 } },
          })
          if (video) { video.srcObject = stream; await video.play() }
        } catch { /* camera unavailable */ }
      }
    }

    startCamera()

    return () => {
      unsub()
      gameEngine.stop()
      poseDetector.stop()
      controllerRef.current?.destroy()
      controllerRef.current = null
    }
  }, [activeChallenge, syncSettings, setLastSession, setScreen])

  /**
   * handleTapStart — must be called directly from a user tap/click.
   * This is the ONLY place audio.play() is called to satisfy Android Chrome autoplay policy.
   */
  const handleTapStart = useCallback(async () => {
    if (startState === 'running' || startState === 'starting') return
    setAudioError(null)
    setStartState('starting')

    const ctrl = controllerRef.current
    if (ctrl) {
      try {
        // Seek and unmute BEFORE play (required on some Android versions)
        ctrl.seekTo(activeChallenge?.segmentStart ?? 0)
        ctrl.unmute()
        ctrl.setVolume(1.0)
        await ctrl.play()

        if (!ctrl.isPlaying()) {
          throw new Error('Audio did not start. Please tap again.')
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Music could not start.'
        setAudioError(`${msg}\nTap "Start" again and ensure your browser allows sound.`)
        setStartState('waiting')
        return
      }
    }

    // Music is playing (or no music source). Start the countdown.
    gameEngine.startCountdown()
  }, [startState, activeChallenge])

  const totalPrompts = activeChallenge?.prompts.length ?? 0
  const completedPrompts = gameState.results.length
  const progress = totalPrompts > 0 ? completedPrompts / totalPrompts : 0
  const showTapOverlay = startState === 'waiting' || startState === 'loading' || startState === 'error'

  // Debug info (visible in dev)
  const ctrl = controllerRef.current
  const debugInfo = import.meta.env.DEV ? {
    sourceType: activeChallenge?.source.type ?? 'none',
    isPlaying: ctrl?.isPlaying() ?? false,
    currentTime: ctrl?.getCurrentTime().toFixed(2) ?? '-',
    duration: ctrl?.getDuration().toFixed(1) ?? '-',
    isReady: ctrl?.isReady() ?? false,
    startState,
    syncOffsetMs: syncSettings?.offsetMs ?? 0,
  } : null

  return (
    <div className="screen relative overflow-hidden">
      {/* Camera feed */}
      <div className="absolute inset-0">
        <video
          ref={videoRef}
          className="w-full h-full object-contain scale-x-[-1] bg-black"
          playsInline muted autoPlay
        />
        <canvas ref={canvasRef} className="camera-overlay scale-x-[-1]" />
        <div className="absolute inset-0 bg-gradient-to-b from-dark-900/80 via-transparent to-dark-900/90" />
      </div>

      {/* TAP TO START overlay — shown until user taps */}
      {showTapOverlay && (
        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-black/70 gap-6 px-6">
          {audioError ? (
            <div className="card border-red-500/60 text-center space-y-3">
              <p className="text-red-400 text-sm whitespace-pre-line">{audioError}</p>
              <button
                onClick={handleTapStart}
                className="btn-primary w-full py-3 text-base"
              >
                🔊 Try Again
              </button>
            </div>
          ) : (
            <>
              <div className="text-center space-y-2">
                <p className="text-slate-400 text-sm">
                  {startState === 'loading' ? 'Loading audio...' : 'Ready to play'}
                </p>
                <p className="text-slate-500 text-xs">
                  {activeChallenge?.title ?? 'Challenge'}
                </p>
              </div>
              <button
                onClick={handleTapStart}
                disabled={startState === 'loading'}
                className="btn-primary w-48 py-5 text-xl rounded-full shadow-2xl shadow-purple-900/50 disabled:opacity-50"
                style={{ fontSize: '1.4rem' }}
              >
                {startState === 'loading' ? '⏳ Loading...' : '▶ START'}
              </button>
              <p className="text-slate-600 text-xs text-center">
                Tap START to begin music + gameplay
              </p>
            </>
          )}
        </div>
      )}

      {/* Countdown overlay */}
      {gameState.phase === 'countdown' && gameState.countdown > 0 && (
        <div className="absolute inset-0 flex items-center justify-center z-20">
          <div
            className="text-9xl font-black animate-bounce-in"
            style={{ color: '#a855f7', textShadow: '0 0 40px rgba(168,85,247,0.8)' }}
          >
            {gameState.countdown}
          </div>
        </div>
      )}

      {/* Gesture silhouette */}
      <GestureOverlay
        gestureId={gameState.activePrompt?.gestureId ?? null}
        nextGestureId={gameState.nextPrompt?.gestureId ?? null}
        detected={currentDetected}
        className="z-10"
      />

      {/* HUD */}
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

      <div className="flex-1" />

      {/* Dev debug panel */}
      {debugInfo && startState === 'running' && (
        <div className="absolute bottom-16 left-2 z-30 bg-black/70 text-green-400 text-xs font-mono p-2 rounded space-y-0.5 pointer-events-none">
          {Object.entries(debugInfo).map(([k, v]) => (
            <div key={k}>{k}: {String(v)}</div>
          ))}
        </div>
      )}

      {/* Stop button */}
      <button
        onClick={() => { gameEngine.stop(); setScreen('CHALLENGE_PREVIEW') }}
        className="absolute top-4 right-4 z-30 w-8 h-8 bg-dark-800/80 rounded-full flex items-center justify-center text-slate-400 text-sm"
      >
        ✕
      </button>
    </div>
  )
}

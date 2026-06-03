import { useCallback, useEffect, useRef, useState } from 'react'
import { useGameStore } from '../store/gameStore'
import { gameEngine, type GameState } from '../features/gameplay/gameEngine'
import { poseDetector } from '../features/pose/poseDetector'
import { PoseDetector } from '../features/pose/poseDetector'
import { buildSession } from '../features/gameplay/scoring'
import { LocalAudioController } from '../features/music/musicController'
import type { PlayableMusicController } from '../features/music/musicController'
import { YouTubeAudioController } from '../features/music/youtubeController'
import { GameplayRecorder } from '../features/video/recordGameplay'
import { GameplayHUD } from './GameplayHUD'
import { GestureOverlay } from './GestureOverlay'
import { evaluateGesture } from '../features/gestures/evaluateGesture'
import type { PoseFrame, Challenge } from '../types'

type StartState = 'waiting' | 'loading' | 'starting' | 'running' | 'error'

const DEBUG = import.meta.env.DEV || new URLSearchParams(location.search).has('debug')

// ---------------------------------------------------------------------------
// Recording canvas composite draw
// ---------------------------------------------------------------------------

function drawRecordingFrame(
  rc: HTMLCanvasElement,
  video: HTMLVideoElement,
  frame: PoseFrame,
  state: GameState,
  challenge: Challenge,
) {
  const ctx = rc.getContext('2d')
  if (!ctx) return
  const W = rc.width
  const H = rc.height

  // Camera (mirrored to match selfie view)
  ctx.save()
  ctx.translate(W, 0)
  ctx.scale(-1, 1)
  if (video.readyState >= 2 && video.videoWidth > 0) {
    ctx.drawImage(video, 0, 0, W, H)
  } else {
    ctx.fillStyle = '#0a0a0f'
    ctx.fillRect(0, 0, W, H)
  }
  ctx.restore()

  // Skeleton
  if (frame.landmarks.length > 0) {
    PoseDetector.drawSkeleton(ctx, frame, { alpha: 0.6 })
  }

  // Top gradient
  const topGrad = ctx.createLinearGradient(0, 0, 0, H * 0.22)
  topGrad.addColorStop(0, 'rgba(10,10,15,0.85)')
  topGrad.addColorStop(1, 'rgba(10,10,15,0)')
  ctx.fillStyle = topGrad
  ctx.fillRect(0, 0, W, H * 0.22)

  // Bottom gradient
  const botGrad = ctx.createLinearGradient(0, H * 0.78, 0, H)
  botGrad.addColorStop(0, 'rgba(10,10,15,0)')
  botGrad.addColorStop(1, 'rgba(10,10,15,0.85)')
  ctx.fillStyle = botGrad
  ctx.fillRect(0, H * 0.78, W, H * 0.22)

  // Score
  ctx.save()
  ctx.font = `bold ${Math.round(W * 0.1)}px system-ui, sans-serif`
  ctx.fillStyle = '#ffffff'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'top'
  ctx.shadowBlur = 12
  ctx.shadowColor = '#a855f7'
  ctx.fillText(state.score.toLocaleString(), W / 2, W * 0.04)
  ctx.restore()

  // Combo
  if (state.combo > 1) {
    ctx.save()
    ctx.font = `bold ${Math.round(W * 0.055)}px system-ui, sans-serif`
    ctx.fillStyle = '#a855f7'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'top'
    ctx.fillText(`${state.combo}x COMBO`, W / 2, W * 0.16)
    ctx.restore()
  }

  // Active gesture name
  if (state.activePrompt) {
    ctx.save()
    ctx.font = `bold ${Math.round(W * 0.06)}px system-ui, sans-serif`
    ctx.fillStyle = '#c4b5fd'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'bottom'
    ctx.shadowBlur = 12
    ctx.shadowColor = '#7c3aed'
    ctx.fillText(state.activePrompt.gestureId.replace(/_/g, ' '), W / 2, H * 0.88)
    ctx.restore()
  }

  // Progress bar
  const total = challenge.prompts.length
  const done = state.results.length
  const progress = total > 0 ? done / total : 0
  ctx.fillStyle = 'rgba(30,30,50,0.8)'
  ctx.fillRect(0, H - 10, W, 10)
  ctx.fillStyle = '#a855f7'
  ctx.fillRect(0, H - 10, W * progress, 10)
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function GameplayScreen() {
  const {
    activeChallenge,
    syncSettings,
    setLastSession,
    setScreen,
    setRecordedVideoBlob,
  } = useGameStore()

  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const ytContainerRef = useRef<HTMLDivElement>(null)

  const controllerRef = useRef<PlayableMusicController | null>(null)
  const ytControllerRef = useRef<YouTubeAudioController | null>(null)

  // Recording
  const recordingCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const recorderRef = useRef<GameplayRecorder | null>(null)
  const recordingLoopRef = useRef<number>(0)
  const latestFrameRef = useRef<PoseFrame | null>(null)
  const latestGameStateRef = useRef<GameState>(gameEngine.getState())
  const prevPhaseRef = useRef<string>('idle')

  const [gameState, setGameState] = useState<GameState>(gameEngine.getState())
  const [currentDetected, setCurrentDetected] = useState(false)
  const [startState, setStartState] = useState<StartState>('waiting')
  const [audioError, setAudioError] = useState<string | null>(null)
  const [debugTick, setDebugTick] = useState(0)
  const frameHistoryRef = useRef<PoseFrame[]>([])

  // Create offscreen recording canvas once
  useEffect(() => {
    const rc = document.createElement('canvas')
    rc.width = 720
    rc.height = 1280
    recordingCanvasRef.current = rc
  }, [])

  // Audio controller setup (re-runs if challenge changes)
  useEffect(() => {
    if (!activeChallenge) { setScreen('HOME'); return }

    gameEngine.loadChallenge(activeChallenge, syncSettings)

    const source = activeChallenge.source

    if (source.type === 'local_upload' && source.objectUrl) {
      const ctrl = new LocalAudioController(source.objectUrl)
      controllerRef.current = ctrl
      gameEngine.setMusicController(ctrl)
      setStartState('loading')
      ctrl.load()
        .then(() => setStartState('waiting'))
        .catch(() => setStartState('waiting'))
    } else if (source.type === 'youtube_link') {
      const ytCtrl = new YouTubeAudioController(source.videoId)
      ytControllerRef.current = ytCtrl
      controllerRef.current = ytCtrl
      gameEngine.setMusicController(ytCtrl)
      setStartState('loading')
      // Mount after render so container div is in DOM
      const timer = setTimeout(() => {
        if (ytContainerRef.current) {
          ytCtrl.mount(ytContainerRef.current)
            .then(() => setStartState('waiting'))
            .catch((err) => {
              console.error('YouTube player mount failed:', err)
              setStartState('waiting')
            })
        }
      }, 100)
      return () => clearTimeout(timer)
    }
  }, [activeChallenge?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // Game engine subscription + camera
  useEffect(() => {
    if (!activeChallenge) return

    const unsub = gameEngine.subscribe((state) => {
      setGameState(state)
      latestGameStateRef.current = state

      if (state.phase === 'playing' && prevPhaseRef.current !== 'playing') {
        startRecordingNow()
      }

      if (state.phase === 'finished' && prevPhaseRef.current !== 'finished') {
        stopRecordingNow()
        const session = buildSession(activeChallenge.id, state.results)
        setLastSession(session)
        setTimeout(() => setScreen('RESULT'), 800)
      }

      if (state.phase === 'playing') setStartState('running')
      prevPhaseRef.current = state.phase
    })

    const startCamera = async () => {
      const video = videoRef.current
      if (!video) return
      try {
        await poseDetector.initialize()
        await poseDetector.startCamera(video, (frame) => {
          latestFrameRef.current = frame
          frameHistoryRef.current.push(frame)
          if (frameHistoryRef.current.length > 60) frameHistoryRef.current.shift()
          gameEngine.feedPoseFrame(frame)

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
      stopRecordingNow()
      controllerRef.current?.destroy()
      controllerRef.current = null
      ytControllerRef.current = null
    }
  }, [activeChallenge, syncSettings, setLastSession, setScreen]) // eslint-disable-line react-hooks/exhaustive-deps

  // Debug refresh tick
  useEffect(() => {
    if (!DEBUG) return
    const id = setInterval(() => setDebugTick((t) => t + 1), 500)
    return () => clearInterval(id)
  }, [])

  function startRecordingNow() {
    const rc = recordingCanvasRef.current
    if (!rc) return
    if (recorderRef.current?.isRecording()) return
    const recorder = new GameplayRecorder()
    recorderRef.current = recorder
    recorder.start({ canvas: rc })

    const loop = () => {
      const video = videoRef.current
      const frame = latestFrameRef.current
      const state = latestGameStateRef.current
      if (video && frame && activeChallenge && recorderRef.current?.isRecording()) {
        drawRecordingFrame(rc, video, frame, state, activeChallenge)
      }
      recordingLoopRef.current = requestAnimationFrame(loop)
    }
    recordingLoopRef.current = requestAnimationFrame(loop)
  }

  function stopRecordingNow() {
    if (recordingLoopRef.current) {
      cancelAnimationFrame(recordingLoopRef.current)
      recordingLoopRef.current = 0
    }
    const recorder = recorderRef.current
    if (recorder?.isRecording()) {
      recorder.stop()
        .then((blob) => setRecordedVideoBlob(blob))
        .catch(() => setRecordedVideoBlob(null))
    }
    recorderRef.current = null
  }

  const handleTapStart = useCallback(async () => {
    if (startState === 'running' || startState === 'starting') return
    setAudioError(null)
    setStartState('starting')

    const ctrl = controllerRef.current

    if (ctrl) {
      try {
        ctrl.seekTo(activeChallenge?.segmentStart ?? 0)
        ctrl.unmute()
        ctrl.setVolume(1.0)
        await ctrl.play()

        // Wait up to 3s for playback to actually start
        let playing = false
        for (let i = 0; i < 30; i++) {
          await sleep(100)
          if (ctrl.isPlaying()) { playing = true; break }
        }

        if (!playing) {
          const isYT = activeChallenge?.source.type === 'youtube_link'
          throw new Error(
            isYT
              ? 'YouTube did not start. Tap the YouTube player once to unlock it, then tap START again.'
              : 'Audio did not start. Please tap START again and allow sound.',
          )
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Music could not start.'
        setAudioError(msg)
        setStartState('waiting')
        return
      }
    }

    gameEngine.startCountdown()
  }, [startState, activeChallenge])

  const isYouTubeChallenge = activeChallenge?.source.type === 'youtube_link'
  const totalPrompts = activeChallenge?.prompts.length ?? 0
  const completedPrompts = gameState.results.length
  const progress = totalPrompts > 0 ? completedPrompts / totalPrompts : 0
  const showTapOverlay = startState === 'waiting' || startState === 'loading' || startState === 'error'

  const ctrl = controllerRef.current
  const ytCtrl = ytControllerRef.current
  const recorder = recorderRef.current
  const rc = recordingCanvasRef.current
  void debugTick // force refresh
  const debugInfo = DEBUG ? {
    sourceType: activeChallenge?.source.type ?? 'none',
    isPlaying: ctrl?.isPlaying() ?? false,
    currentTime: ctrl?.getCurrentTime().toFixed(2) ?? '-',
    duration: ctrl?.getDuration().toFixed(1) ?? '-',
    isReady: ctrl?.isReady() ?? false,
    ytPlayerState: ytCtrl ? ytCtrl.getPlayerState() : 'n/a',
    startState,
    syncOffsetMs: syncSettings?.offsetMs ?? 0,
    scoringGestureId: gameState.activePrompt?.gestureId ?? '-',
    poseDetected: currentDetected,
    lastJudgement: gameState.lastTimingGrade ?? '-',
    isRecording: recorder?.isRecording() ?? false,
    recCanvas: rc ? `${rc.width}x${rc.height}` : 'none',
    cameraState: videoRef.current?.readyState ?? -1,
    cameraSize: videoRef.current ? `${videoRef.current.videoWidth}x${videoRef.current.videoHeight}` : '-',
    expectedDurSec: activeChallenge
      ? (activeChallenge.segmentEnd - activeChallenge.segmentStart).toFixed(1)
      : '-',
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

      {/* YouTube player container */}
      {isYouTubeChallenge && (
        <div
          ref={ytContainerRef}
          className={`absolute z-40 rounded-xl overflow-hidden bg-black transition-all duration-300 ${
            showTapOverlay
              ? 'bottom-52 left-4 right-4 h-44'
              : 'bottom-20 right-4 w-28 h-16 opacity-60'
          }`}
        />
      )}

      {/* TAP TO START overlay */}
      {showTapOverlay && (
        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-black/75 gap-5 px-6">
          {audioError ? (
            <div className="card border-red-500/60 text-center space-y-3 mx-0 w-full">
              <p className="text-red-400 text-sm leading-relaxed">{audioError}</p>
              <button onClick={handleTapStart} className="btn-primary w-full py-3 text-base">
                🔊 Try Again
              </button>
            </div>
          ) : (
            <>
              <div className="text-center space-y-1">
                <p className="text-slate-200 font-semibold line-clamp-2">
                  {activeChallenge?.title ?? 'Challenge'}
                </p>
                <p className="text-slate-400 text-sm">
                  {startState === 'loading'
                    ? (isYouTubeChallenge ? 'Loading YouTube player…' : 'Loading audio…')
                    : 'Ready to play'}
                </p>
              </div>

              {/* Spacer where YouTube player lives (rendered via ref above) */}
              {isYouTubeChallenge && <div className="h-44 w-full" />}

              {isYouTubeChallenge && startState === 'waiting' && (
                <p className="text-slate-500 text-xs text-center leading-relaxed">
                  You can tap the player above to preview. Then tap START to begin.
                </p>
              )}

              <button
                onClick={handleTapStart}
                disabled={startState === 'loading'}
                className="btn-primary w-48 py-5 text-xl rounded-full shadow-2xl shadow-purple-900/50 disabled:opacity-50"
              >
                {startState === 'loading' ? '⏳ Loading…' : '▶ START'}
              </button>
              <p className="text-slate-600 text-xs text-center">
                Tap START — music &amp; gameplay begin together
              </p>
            </>
          )}
        </div>
      )}

      {/* Countdown */}
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
        debug={DEBUG}
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
        <div className="absolute bottom-16 left-2 z-30 bg-black/80 text-green-400 text-xs font-mono p-2 rounded space-y-0.5 pointer-events-none max-w-[240px]">
          {Object.entries(debugInfo).map(([k, v]) => (
            <div key={k} className="truncate">{k}: {String(v)}</div>
          ))}
        </div>
      )}

      {/* Stop button */}
      <button
        onClick={() => {
          gameEngine.stop()
          stopRecordingNow()
          setScreen('CHALLENGE_PREVIEW')
        }}
        className="absolute top-4 right-4 z-50 w-8 h-8 bg-dark-800/80 rounded-full flex items-center justify-center text-slate-400 text-sm"
      >
        ✕
      </button>
    </div>
  )
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

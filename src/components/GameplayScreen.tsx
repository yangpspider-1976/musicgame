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

const DEBUG = import.meta.env.DEV || (typeof location !== 'undefined' && new URLSearchParams(location.search).has('debug'))

// ---------------------------------------------------------------------------
// Recording canvas composite draw (pure function, no closures over component state)
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
  const W = rc.width, H = rc.height

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

  if (frame.landmarks.length > 0) {
    PoseDetector.drawSkeleton(ctx, frame, { alpha: 0.6 })
  }

  const tg = ctx.createLinearGradient(0, 0, 0, H * 0.22)
  tg.addColorStop(0, 'rgba(10,10,15,0.85)'); tg.addColorStop(1, 'rgba(10,10,15,0)')
  ctx.fillStyle = tg; ctx.fillRect(0, 0, W, H * 0.22)

  const bg = ctx.createLinearGradient(0, H * 0.78, 0, H)
  bg.addColorStop(0, 'rgba(10,10,15,0)'); bg.addColorStop(1, 'rgba(10,10,15,0.85)')
  ctx.fillStyle = bg; ctx.fillRect(0, H * 0.78, W, H * 0.22)

  ctx.font = `bold ${Math.round(W * 0.1)}px system-ui`
  ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'top'
  ctx.shadowBlur = 12; ctx.shadowColor = '#a855f7'
  ctx.fillText(state.score.toLocaleString(), W / 2, W * 0.04)
  ctx.shadowBlur = 0

  if (state.combo > 1) {
    ctx.font = `bold ${Math.round(W * 0.055)}px system-ui`
    ctx.fillStyle = '#a855f7'
    ctx.fillText(`${state.combo}x COMBO`, W / 2, W * 0.16)
  }

  if (state.activePrompt) {
    ctx.font = `bold ${Math.round(W * 0.06)}px system-ui`
    ctx.fillStyle = '#c4b5fd'; ctx.textBaseline = 'bottom'
    ctx.fillText(state.activePrompt.gestureId.replace(/_/g, ' '), W / 2, H * 0.88)
  }

  const done = state.results.length, total = challenge.prompts.length
  const prog = total > 0 ? done / total : 0
  ctx.fillStyle = 'rgba(30,30,50,0.8)'; ctx.fillRect(0, H - 10, W, 10)
  ctx.fillStyle = '#a855f7'; ctx.fillRect(0, H - 10, W * prog, 10)
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export function GameplayScreen() {
  const { activeChallenge, syncSettings, setLastSession, setScreen, setRecordedVideoBlob } = useGameStore()

  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const ytContainerRef = useRef<HTMLDivElement>(null)

  // Refs to current values — safe to read inside rAF loops and subscriptions
  const activeChallengeRef = useRef(activeChallenge)
  useEffect(() => { activeChallengeRef.current = activeChallenge }, [activeChallenge])

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
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [debugTick, setDebugTick] = useState(0)
  const frameHistoryRef = useRef<PoseFrame[]>([])

  // Create offscreen recording canvas once
  useEffect(() => {
    const rc = document.createElement('canvas')
    rc.width = 720; rc.height = 1280
    recordingCanvasRef.current = rc
  }, [])

  // --------------------------------------------------------------------------
  // Stable recording helpers (only use refs → no stale closure)
  // --------------------------------------------------------------------------
  const stopRecordingNow = useCallback(() => {
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
  }, [setRecordedVideoBlob])

  const startRecordingNow = useCallback(() => {
    const rc = recordingCanvasRef.current
    if (!rc || recorderRef.current?.isRecording()) return
    const recorder = new GameplayRecorder()
    recorderRef.current = recorder
    recorder.start({ canvas: rc })

    const loop = () => {
      const video = videoRef.current
      const frame = latestFrameRef.current
      const state = latestGameStateRef.current
      const challenge = activeChallengeRef.current
      if (video && frame && challenge && recorderRef.current?.isRecording()) {
        drawRecordingFrame(rc, video, frame, state, challenge)
      }
      if (recorderRef.current?.isRecording()) {
        recordingLoopRef.current = requestAnimationFrame(loop)
      }
    }
    recordingLoopRef.current = requestAnimationFrame(loop)
  }, []) // no deps — all access via refs

  // --------------------------------------------------------------------------
  // Main setup effect — single effect avoids controller destroy race condition
  // --------------------------------------------------------------------------
  useEffect(() => {
    if (!activeChallenge) { setScreen('HOME'); return }

    // Reset state for fresh game
    setStartState('waiting')
    setAudioError(null)
    setCameraError(null)
    prevPhaseRef.current = 'idle'

    gameEngine.loadChallenge(activeChallenge, syncSettings)

    // --- Audio controller ---
    const source = activeChallenge.source
    let ctrl: PlayableMusicController | null = null

    if (source.type === 'local_upload' && source.objectUrl) {
      const localCtrl = new LocalAudioController(source.objectUrl)
      ctrl = localCtrl
      controllerRef.current = ctrl
      gameEngine.setMusicController(ctrl)
      setStartState('loading')
      localCtrl.load()
        .then(() => setStartState('waiting'))
        .catch(() => setStartState('waiting'))
    } else if (source.type === 'youtube_link') {
      const ytCtrl = new YouTubeAudioController(source.videoId)
      ctrl = ytCtrl
      ytControllerRef.current = ytCtrl
      controllerRef.current = ytCtrl
      gameEngine.setMusicController(ytCtrl)
      setStartState('loading')
      // Mount after this render so ytContainerRef.current is in DOM
      const timer = setTimeout(() => {
        const container = ytContainerRef.current
        if (!container) { setStartState('waiting'); return }
        ytCtrl.mount(container)
          .then(() => setStartState('waiting'))
          .catch((err) => {
            console.error('YouTube player mount failed:', err)
            setStartState('waiting')
          })
      }, 0)
      // Store timer for cleanup
      ;(ctrl as YouTubeAudioController & { _mountTimer?: ReturnType<typeof setTimeout> })._mountTimer = timer
    }

    // --- Game engine subscription ---
    const unsub = gameEngine.subscribe((state) => {
      setGameState(state)
      latestGameStateRef.current = state

      if (state.phase === 'playing' && prevPhaseRef.current !== 'playing') {
        startRecordingNow()
        setStartState('running')
      }

      if (state.phase === 'finished' && prevPhaseRef.current !== 'finished') {
        stopRecordingNow()
        const challenge = activeChallengeRef.current
        if (challenge) {
          const session = buildSession(challenge.id, state.results)
          setLastSession(session)
        }
        setTimeout(() => setScreen('RESULT'), 800)
      }

      prevPhaseRef.current = state.phase
    })

    // --- Camera ---
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

          const st = gameEngine.getState()
          if (st.activePrompt) {
            const result = evaluateGesture(st.activePrompt.gestureId, frame, frameHistoryRef.current.slice(-10))
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
        // MediaPipe failed — fall back to raw camera (no pose detection)
        try {
          const stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'user', width: { ideal: 720 }, height: { ideal: 1280 }, frameRate: { ideal: 30, max: 30 } },
            audio: false,
          })
          if (video) {
            video.srcObject = stream
            await video.play()
          }
        } catch (camErr) {
          const msg = camErr instanceof Error ? camErr.message : 'Camera unavailable'
          setCameraError(msg)
          console.warn('Camera failed:', camErr)
        }
      }
    }

    startCamera()

    // Cleanup
    return () => {
      unsub()
      gameEngine.stop()
      poseDetector.stop()
      stopRecordingNow()

      // Cancel YouTube mount timer if still pending
      const ytCtrl = ctrl as (PlayableMusicController & { _mountTimer?: ReturnType<typeof setTimeout> }) | null
      if (ytCtrl?._mountTimer != null) clearTimeout(ytCtrl._mountTimer)

      ctrl?.destroy()
      controllerRef.current = null
      ytControllerRef.current = null
    }
  // Only re-run if challenge ID or sync offset changes (not entire object reference)
  }, [activeChallenge?.id, syncSettings.offsetMs, startRecordingNow, stopRecordingNow, setLastSession, setScreen]) // eslint-disable-line react-hooks/exhaustive-deps

  // Debug refresh tick
  useEffect(() => {
    if (!DEBUG) return
    const id = setInterval(() => setDebugTick((t) => t + 1), 500)
    return () => clearInterval(id)
  }, [])

  // --------------------------------------------------------------------------
  // handleTapStart — must be called from direct user gesture (autoplay policy)
  // --------------------------------------------------------------------------
  const handleTapStart = useCallback(async () => {
    if (startState === 'running' || startState === 'starting') return
    setAudioError(null)
    setStartState('starting')

    const ctrl = controllerRef.current

    if (ctrl) {
      try {
        ctrl.seekTo(activeChallengeRef.current?.segmentStart ?? 0)
        ctrl.unmute()
        ctrl.setVolume(1.0)
        await ctrl.play()

        // Poll up to 3 s for playback to start
        let playing = false
        for (let i = 0; i < 30; i++) {
          await sleep(100)
          if (ctrl.isPlaying()) { playing = true; break }
        }

        if (!playing) {
          const isYT = activeChallengeRef.current?.source.type === 'youtube_link'
          throw new Error(
            isYT
              ? 'YouTube playback did not start.\nTap the YouTube player once to unlock it, then tap START again.'
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
  }, [startState])

  // --------------------------------------------------------------------------
  // Derived state
  // --------------------------------------------------------------------------
  const isYouTubeChallenge = activeChallenge?.source.type === 'youtube_link'
  const totalPrompts = activeChallenge?.prompts.length ?? 0
  const completedPrompts = gameState.results.length
  const progress = totalPrompts > 0 ? completedPrompts / totalPrompts : 0

  // Overlay shows for everything EXCEPT 'running' (active gameplay)
  const showTapOverlay = startState !== 'running'

  // ---- Debug info ----
  void debugTick
  const ctrl = controllerRef.current
  const ytCtrl = ytControllerRef.current
  const recorder = recorderRef.current
  const rc = recordingCanvasRef.current
  const debugInfo = DEBUG ? {
    startState,
    sourceType: activeChallenge?.source.type ?? 'none',
    youtubeReady: ytCtrl?.isReady() ?? false,
    youtubePlayerState: ytCtrl ? ytCtrl.getPlayerState() : 'n/a',
    musicIsPlaying: ctrl?.isPlaying() ?? false,
    musicCurrentTime: ctrl?.getCurrentTime().toFixed(2) ?? '-',
    musicDuration: ctrl?.getDuration().toFixed(1) ?? '-',
    syncOffsetMs: syncSettings?.offsetMs ?? 0,
    cameraPermission: cameraError ?? 'ok',
    cameraReadyState: videoRef.current?.readyState ?? -1,
    cameraSize: videoRef.current ? `${videoRef.current.videoWidth}x${videoRef.current.videoHeight}` : '-',
    poseDetected: currentDetected,
    lastJudgement: gameState.lastTimingGrade ?? '-',
    scoringGestureId: gameState.activePrompt?.gestureId ?? '-',
    isRecording: recorder?.isRecording() ?? false,
    recordingCanvasReady: rc ? `${rc.width}x${rc.height}` : 'none',
    mediaRecorderState: recorder ? (recorder.isRecording() ? 'recording' : 'stopped') : 'idle',
    expectedDurSec: activeChallenge
      ? (activeChallenge.segmentEnd - activeChallenge.segmentStart).toFixed(1)
      : '-',
    countdownState: gameState.countdown,
    activeGestureId: gameState.activePrompt?.gestureId ?? '-',
    lastError: audioError ?? cameraError ?? '-',
  } : null

  // --------------------------------------------------------------------------
  // Render
  // --------------------------------------------------------------------------
  return (
    <div className="screen relative overflow-hidden">
      {/* Camera feed (always rendered so camera starts immediately) */}
      <div className="absolute inset-0" style={{ zIndex: 0 }}>
        <video
          ref={videoRef}
          className="w-full h-full object-contain scale-x-[-1] bg-black"
          playsInline muted autoPlay
        />
        <canvas ref={canvasRef} className="camera-overlay scale-x-[-1]" />
        <div className="absolute inset-0 bg-gradient-to-b from-dark-900/80 via-transparent to-dark-900/90" />
      </div>

      {/* YouTube player container — always rendered when YT challenge */}
      {isYouTubeChallenge && (
        <div
          ref={ytContainerRef}
          className="absolute rounded-xl overflow-hidden bg-black transition-all duration-300"
          style={{
            zIndex: 35,
            ...(showTapOverlay
              ? { top: 56, right: 16, width: 160, height: 90 }    // small, top-right in overlay
              : { top: 56, right: 16, width: 128, height: 72, opacity: 0.75 }), // small top-right during gameplay
          }}
        />
      )}

      {/* TAP TO START overlay — shows whenever not actively playing */}
      {showTapOverlay && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/75 gap-5 px-6" style={{ zIndex: 30 }}>
          {audioError ? (
            <div className="card border-red-500/60 text-center space-y-3 w-full">
              <p className="text-red-400 text-sm leading-relaxed whitespace-pre-line">{audioError}</p>
              <button onClick={handleTapStart} className="btn-primary w-full py-3 text-base">
                🔊 Try Again
              </button>
            </div>
          ) : cameraError ? (
            <div className="card border-yellow-600/60 text-center space-y-3 w-full">
              <p className="text-yellow-400 text-sm">Camera error: {cameraError}</p>
              <p className="text-slate-500 text-xs">Gameplay can continue without camera.</p>
              <button onClick={handleTapStart} className="btn-primary w-full py-3">
                ▶ Start Anyway
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
                    : startState === 'starting'
                    ? 'Starting playback…'
                    : 'Ready to play'}
                </p>
              </div>

              {isYouTubeChallenge && startState === 'waiting' && (
                <p className="text-slate-500 text-xs text-center leading-relaxed">
                  YouTube player is loading in the top-right corner.
                </p>
              )}

              <button
                onClick={handleTapStart}
                disabled={startState === 'loading' || startState === 'starting'}
                className="btn-primary w-48 py-5 text-xl rounded-full shadow-2xl shadow-purple-900/50 disabled:opacity-50"
              >
                {startState === 'loading' ? '⏳ Loading…'
                  : startState === 'starting' ? '⏳ Starting…'
                  : '▶ START'}
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
        <div className="absolute inset-0 flex items-center justify-center" style={{ zIndex: 20 }}>
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
      <div className="relative p-4 pt-safe" style={{ zIndex: 20 }}>
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

      {/* Dev debug panel — always visible in DEBUG mode */}
      {debugInfo && (
        <div
          className="absolute bottom-16 left-2 bg-black/85 text-green-400 text-xs font-mono p-2 rounded space-y-0.5 pointer-events-none max-w-[260px]"
          style={{ zIndex: 100 }}
        >
          {Object.entries(debugInfo).map(([k, v]) => (
            <div key={k} className="truncate">
              <span className="text-slate-500">{k}:</span> {String(v)}
            </div>
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
        className="absolute top-4 right-4 w-8 h-8 bg-dark-800/80 rounded-full flex items-center justify-center text-slate-400 text-sm"
        style={{ zIndex: 50 }}
      >
        ✕
      </button>
    </div>
  )
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

import type {
  Challenge,
  GestureId,
  GesturePrompt,
  GestureResult,
  PoseFrame,
  SyncSettings,
  TimingGrade,
} from '../../types'
import type { PlayableMusicController } from '../music/musicController'
import { evaluateGesture } from '../gestures/evaluateGesture'
import {
  calculateGestureScore,
  getComboMultiplier,
  getTimingGrade,
} from './scoring'

export type GamePhase = 'idle' | 'countdown' | 'playing' | 'finished'

export interface GameState {
  phase: GamePhase
  currentTime: number
  currentPromptIndex: number
  activePrompt: GesturePrompt | null
  nextPrompt: GesturePrompt | null
  results: GestureResult[]
  score: number
  combo: number
  maxCombo: number
  lastTimingGrade: TimingGrade | null
  lastGestureId: GestureId | null
  countdown: number
  audioError: string | null
}

export type GameStateListener = (state: GameState) => void

export class GameEngine {
  private challenge: Challenge | null = null
  private syncSettings: SyncSettings = { offsetMs: 0 }
  private listeners: GameStateListener[] = []
  private animFrameId: number | null = null
  private startWallTime: number | null = null
  private segmentStartSec = 0
  private musicController: PlayableMusicController | null = null
  private evaluatedPrompts = new Set<string>()
  private frameHistory: PoseFrame[] = []

  private state: GameState = {
    phase: 'idle',
    currentTime: 0,
    currentPromptIndex: 0,
    activePrompt: null,
    nextPrompt: null,
    results: [],
    score: 0,
    combo: 0,
    maxCombo: 0,
    lastTimingGrade: null,
    lastGestureId: null,
    countdown: 3,
    audioError: null,
  }

  subscribe(listener: GameStateListener): () => void {
    this.listeners.push(listener)
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener)
    }
  }

  private emit(): void {
    for (const l of this.listeners) l({ ...this.state })
  }

  setMusicController(controller: PlayableMusicController): void {
    this.musicController = controller
  }

  loadChallenge(challenge: Challenge, sync?: SyncSettings): void {
    this.challenge = challenge
    this.syncSettings = sync ?? { offsetMs: 0 }
    this.segmentStartSec = challenge.segmentStart
    this.reset()
  }

  private reset(): void {
    this.evaluatedPrompts.clear()
    this.frameHistory = []
    this.startWallTime = null
    this.state = {
      phase: 'idle',
      currentTime: 0,
      currentPromptIndex: 0,
      activePrompt: null,
      nextPrompt: null,
      results: [],
      score: 0,
      combo: 0,
      maxCombo: 0,
      lastTimingGrade: null,
      lastGestureId: null,
      countdown: 3,
      audioError: null,
    }
    this.emit()
  }

  /**
   * Called from UI AFTER music has already started playing.
   * Runs the visual countdown then begins the game loop.
   */
  async startCountdown(): Promise<void> {
    this.state.phase = 'countdown'
    this.state.audioError = null
    this.state.countdown = 3
    this.emit()

    for (let i = 3; i > 0; i--) {
      this.state.countdown = i
      this.emit()
      await sleep(1000)
    }
    this.state.countdown = 0
    this.emit()
    await sleep(200)
    this.startPlaying()
  }

  private startPlaying(): void {
    if (!this.challenge) return
    this.state.phase = 'playing'
    this.startWallTime = performance.now()
    this.emit()
    this.tick()
  }

  private tick(): void {
    if (this.state.phase !== 'playing') return

    let currentTime: number
    if (this.musicController && this.musicController.isReady()) {
      // Primary: use actual music playback time
      currentTime = this.musicController.getCurrentTime() + this.syncSettings.offsetMs / 1000
    } else {
      // Fallback: wall clock (no music controller)
      const elapsed = (performance.now() - (this.startWallTime ?? performance.now())) / 1000
      currentTime = this.segmentStartSec + elapsed + this.syncSettings.offsetMs / 1000
    }

    this.state.currentTime = currentTime

    const prompts = this.challenge?.prompts ?? []
    const segEnd = this.challenge?.segmentEnd ?? Infinity

    // Advance past expired prompts
    while (
      this.state.currentPromptIndex < prompts.length - 1 &&
      prompts[this.state.currentPromptIndex].endTime < currentTime
    ) {
      const prompt = prompts[this.state.currentPromptIndex]
      if (!this.evaluatedPrompts.has(prompt.id)) {
        this.recordResult(prompt, 'MISS', 0, 0)
      }
      this.state.currentPromptIndex++
    }

    const activeIdx = this.state.currentPromptIndex
    const activePrompt = prompts[activeIdx] ?? null
    const nextPrompt = prompts[activeIdx + 1] ?? null

    this.state.activePrompt =
      activePrompt &&
      currentTime >= activePrompt.startTime - 0.5 &&
      currentTime <= activePrompt.endTime
        ? activePrompt
        : null

    this.state.nextPrompt = nextPrompt ?? null

    if (currentTime >= segEnd || activeIdx >= prompts.length) {
      this.finish()
      return
    }

    this.emit()
    this.animFrameId = requestAnimationFrame(() => this.tick())
  }

  feedPoseFrame(frame: PoseFrame): void {
    this.frameHistory.push(frame)
    if (this.frameHistory.length > 60) this.frameHistory.shift()

    if (this.state.phase !== 'playing' || !this.state.activePrompt) return

    const prompt = this.state.activePrompt
    if (this.evaluatedPrompts.has(prompt.id)) return

    const prevFrames = this.frameHistory.slice(-10)
    const result = evaluateGesture(prompt.gestureId, frame, prevFrames)

    if (result.detected) {
      const offsetMs = (this.state.currentTime - prompt.startTime) * 1000
      const timingGrade = getTimingGrade(offsetMs)
      this.recordResult(prompt, timingGrade, result.accuracy, offsetMs)
    }
  }

  private recordResult(
    prompt: GesturePrompt,
    timingGrade: TimingGrade,
    accuracy: number,
    offsetMs: number,
  ): void {
    this.evaluatedPrompts.add(prompt.id)

    if (timingGrade === 'MISS') {
      this.state.combo = 0
    } else {
      this.state.combo++
      if (this.state.combo > this.state.maxCombo) {
        this.state.maxCombo = this.state.combo
      }
    }

    const score = calculateGestureScore(timingGrade, accuracy, this.state.combo)
    this.state.score += score

    this.state.results.push({
      promptId: prompt.id,
      gestureId: prompt.gestureId,
      timingGrade,
      timingOffsetMs: offsetMs,
      poseAccuracy: accuracy,
      score,
    })
    this.state.lastTimingGrade = timingGrade
    this.state.lastGestureId = prompt.gestureId
    this.emit()
  }

  private finish(): void {
    if (this.animFrameId !== null) {
      cancelAnimationFrame(this.animFrameId)
      this.animFrameId = null
    }
    this.musicController?.pause()
    this.state.phase = 'finished'
    this.emit()
  }

  stop(): void {
    if (this.animFrameId !== null) {
      cancelAnimationFrame(this.animFrameId)
      this.animFrameId = null
    }
    this.musicController?.pause()
    this.state.phase = 'idle'
    this.emit()
  }

  getState(): GameState {
    return { ...this.state }
  }

  getComboMultiplier(): number {
    return getComboMultiplier(this.state.combo)
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export const gameEngine = new GameEngine()

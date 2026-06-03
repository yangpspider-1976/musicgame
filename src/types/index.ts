// ─── Point & Pose ────────────────────────────────────────────────────────────

export interface Point2D {
  x: number
  y: number
}

export interface Landmark {
  x: number
  y: number
  z: number
  visibility?: number
}

export interface PoseFrame {
  landmarks: Landmark[]
  timestamp: number
  /** true while no movement detected (for FREEZE check) */
  frozen?: boolean
}

// ─── Audio ───────────────────────────────────────────────────────────────────

export interface BeatMarker {
  time: number   // seconds from track start
  strength: number // 0-1
  index: number
}

export interface AudioAnalysisResult {
  bpm: number
  confidence: number
  beats: BeatMarker[]
  duration: number
  sampleRate: number
}

// ─── Music Source ─────────────────────────────────────────────────────────────

export type MusicSourceType = 'local_upload' | 'youtube_link' | 'licensed_catalog'

export interface LocalUploadSource {
  type: 'local_upload'
  file: File
  objectUrl: string
  fileName: string
  duration: number
}

export interface YouTubeLinkSource {
  type: 'youtube_link'
  videoId: string
  url: string
  title?: string
  channelTitle?: string
  thumbnailUrl?: string
  duration?: number
}

export type MusicSource = LocalUploadSource | YouTubeLinkSource

// ─── Gestures ────────────────────────────────────────────────────────────────

export type GestureId =
  | 'LEFT_HAND_UP'
  | 'RIGHT_HAND_UP'
  | 'BOTH_HANDS_UP'
  | 'LEFT_PUNCH'
  | 'RIGHT_PUNCH'
  | 'HANDS_CROSS'
  | 'HEART_POSE'
  | 'SIDE_LEAN_LEFT'
  | 'SIDE_LEAN_RIGHT'
  | 'FREEZE_POSE'

export interface GestureDefinition {
  id: GestureId
  name: string
  emoji: string
  description: string
  evaluate: (frame: PoseFrame, prevFrames?: PoseFrame[]) => boolean
}

export type GestureGenerationMode = 'BEAT_BASED' | 'MUSIC_STYLE' | 'LYRIC_MEANING' | 'CREATOR_RECORDING'

export type MusicStyleProfile = 'KPOP' | 'HIPHOP' | 'EDM' | 'BALLAD' | 'FREESTYLE'

export interface GesturePrompt {
  id: string
  gestureId: GestureId
  beatIndex: number
  startTime: number   // seconds
  endTime: number     // seconds
  windowMs: number    // detection window in ms
  sourceMode?: GestureGenerationMode
}

// ─── Gameplay ────────────────────────────────────────────────────────────────

export type TimingGrade = 'PERFECT' | 'GOOD' | 'MISS'
export type LetterGrade = 'S' | 'A' | 'B' | 'C' | 'D'

export interface GestureResult {
  promptId: string
  gestureId: GestureId
  timingGrade: TimingGrade
  timingOffsetMs: number
  poseAccuracy: number  // 0-1
  score: number
}

export interface PlaySession {
  id: string
  challengeId: string
  startedAt: number
  endedAt?: number
  results: GestureResult[]
  totalScore: number
  maxCombo: number
  grade: LetterGrade
}

// ─── Challenge ───────────────────────────────────────────────────────────────

export type Difficulty = 'easy' | 'normal' | 'hard'

export interface Challenge {
  id: string
  title: string
  source: MusicSource
  analysis?: AudioAnalysisResult
  prompts: GesturePrompt[]
  difficulty: Difficulty
  segmentStart: number  // seconds
  segmentEnd: number    // seconds
  createdAt: number
  bpmOverride?: number
  generationMode?: GestureGenerationMode
  styleProfile?: MusicStyleProfile
}

// ─── Ranking ─────────────────────────────────────────────────────────────────

export interface RankingEntry {
  id: string
  challengeId: string
  challengeTitle: string
  playerName: string
  score: number
  grade: LetterGrade
  maxCombo: number
  date: number
}

// ─── Tap Tempo ───────────────────────────────────────────────────────────────

export interface TapTempoResult {
  bpm: number
  confidence: number
  tapCount: number
}

// ─── Sync Settings ───────────────────────────────────────────────────────────

export interface SyncSettings {
  offsetMs: number  // -500 to +500
}

// ─── App Screens ─────────────────────────────────────────────────────────────

export type AppScreen =
  | 'HOME'
  | 'AUDIO_SETUP'
  | 'YOUTUBE_SETUP'
  | 'CHALLENGE_PREVIEW'
  | 'CAMERA_SETUP'
  | 'GAMEPLAY'
  | 'RESULT'

import { create } from 'zustand'
import type {
  AppScreen,
  Challenge,
  Difficulty,
  MusicSource,
  PlaySession,
  SyncSettings,
} from '../types'

interface GameStore {
  // Navigation
  screen: AppScreen
  setScreen: (screen: AppScreen) => void

  // Music source
  musicSource: MusicSource | null
  setMusicSource: (source: MusicSource | null) => void

  // Current challenge being built
  pendingChallenge: Partial<Challenge> | null
  setPendingChallenge: (c: Partial<Challenge> | null) => void
  updatePendingChallenge: (updates: Partial<Challenge>) => void

  // Active challenge (confirmed, ready to play)
  activeChallenge: Challenge | null
  setActiveChallenge: (c: Challenge | null) => void

  // Session result
  lastSession: PlaySession | null
  setLastSession: (s: PlaySession | null) => void

  // Sync settings
  syncSettings: SyncSettings
  setSyncOffset: (offsetMs: number) => void

  // Difficulty
  difficulty: Difficulty
  setDifficulty: (d: Difficulty) => void

  // Camera stream (for preview and gameplay)
  cameraStream: MediaStream | null
  setCameraStream: (s: MediaStream | null) => void

  // Recorded gameplay video blob (set at end of gameplay)
  recordedVideoBlob: Blob | null
  setRecordedVideoBlob: (blob: Blob | null) => void

  // Reset entire game state
  resetGame: () => void
}

const DEFAULT_SYNC: SyncSettings = { offsetMs: 0 }

export const useGameStore = create<GameStore>((set) => ({
  screen: 'HOME',
  setScreen: (screen) => set({ screen }),

  musicSource: null,
  setMusicSource: (musicSource) => set({ musicSource }),

  pendingChallenge: null,
  setPendingChallenge: (pendingChallenge) => set({ pendingChallenge }),
  updatePendingChallenge: (updates) =>
    set((state) => ({
      pendingChallenge: state.pendingChallenge
        ? { ...state.pendingChallenge, ...updates }
        : updates,
    })),

  activeChallenge: null,
  setActiveChallenge: (activeChallenge) => set({ activeChallenge }),

  lastSession: null,
  setLastSession: (lastSession) => set({ lastSession }),

  syncSettings: DEFAULT_SYNC,
  setSyncOffset: (offsetMs) => set({ syncSettings: { offsetMs } }),

  difficulty: 'normal',
  setDifficulty: (difficulty) => set({ difficulty }),

  cameraStream: null,
  setCameraStream: (cameraStream) => set({ cameraStream }),

  recordedVideoBlob: null,
  setRecordedVideoBlob: (recordedVideoBlob) => set({ recordedVideoBlob }),

  resetGame: () =>
    set({
      screen: 'HOME',
      musicSource: null,
      pendingChallenge: null,
      activeChallenge: null,
      lastSession: null,
      syncSettings: DEFAULT_SYNC,
      difficulty: 'normal',
      cameraStream: null,
      recordedVideoBlob: null,
    }),
}))

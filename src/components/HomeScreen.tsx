import { useGameStore } from '../store/gameStore'

export function HomeScreen() {
  const setScreen = useGameStore((s) => s.setScreen)

  return (
    <div className="screen items-center justify-between safe-top safe-bottom px-6 py-10">
      {/* Hero */}
      <div className="text-center space-y-4 pt-8">
        <div className="text-8xl animate-pulse-neon">🎵</div>
        <h1 className="text-4xl font-black">
          <span className="neon-text-purple">Rhythm</span>
          <br />
          <span className="neon-text-cyan">Gesture</span>
          <br />
          <span className="neon-text-pink">Game</span>
        </h1>
        <p className="text-slate-400 text-base leading-relaxed">
          Follow gesture prompts on beat.
          <br />
          Powered by pose detection.
        </p>
      </div>

      {/* Feature pills */}
      <div className="flex flex-wrap justify-center gap-2 py-6">
        {[
          { emoji: '📷', label: 'Camera Pose' },
          { emoji: '🎯', label: 'Beat Sync' },
          { emoji: '📊', label: 'Score & Grade' },
          { emoji: '📤', label: '9:16 Export' },
        ].map((f) => (
          <div
            key={f.label}
            className="flex items-center gap-2 bg-dark-700 border border-slate-700 rounded-full px-3 py-1.5 text-sm"
          >
            <span>{f.emoji}</span>
            <span className="text-slate-300">{f.label}</span>
          </div>
        ))}
      </div>

      {/* Actions */}
      <div className="w-full space-y-3">
        <button
          onClick={() => setScreen('AUDIO_SETUP')}
          className="btn-primary w-full py-4 text-lg flex items-center justify-center gap-3"
        >
          <span className="text-2xl">🎵</span>
          Upload Audio File
        </button>
        <button
          onClick={() => setScreen('YOUTUBE_SETUP')}
          className="w-full py-4 text-lg font-bold rounded-xl flex items-center justify-center gap-3
            bg-red-700/80 text-white active:scale-95 transition-all duration-150
            shadow-lg shadow-red-900/40"
        >
          <span className="text-2xl">▶️</span>
          Use YouTube Link
        </button>
        <p className="text-center text-slate-600 text-xs">
          MP3 · WAV · M4A supported
        </p>
      </div>
    </div>
  )
}

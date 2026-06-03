import { useGameStore } from '../store/gameStore'
import { GESTURE_MAP } from '../features/gestures/gestureDefinitions'

export function ChallengePreviewScreen() {
  const { activeChallenge, difficulty, setScreen } = useGameStore()

  if (!activeChallenge) {
    setScreen('HOME')
    return null
  }

  const { prompts, segmentStart, segmentEnd, bpmOverride } = activeChallenge
  const duration = segmentEnd - segmentStart
  const uniqueGestures = [...new Set(prompts.map((p) => p.gestureId))]

  return (
    <div className="screen safe-top safe-bottom">
      <div className="flex items-center gap-3 p-4 border-b border-slate-800">
        <button onClick={() => setScreen('AUDIO_SETUP')} className="text-slate-400 p-1">←</button>
        <h2 className="font-bold text-lg text-slate-100">Challenge Preview</h2>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Challenge info */}
        <div className="card space-y-3">
          <h3 className="text-xl font-bold text-slate-100 line-clamp-2">
            {activeChallenge.title}
          </h3>
          <div className="grid grid-cols-3 gap-3 text-center">
            <div>
              <div className="text-2xl font-black text-neon-purple">{bpmOverride ?? '~'}</div>
              <div className="text-xs text-slate-500">BPM</div>
            </div>
            <div>
              <div className="text-2xl font-black text-neon-cyan">{Math.round(duration)}s</div>
              <div className="text-xs text-slate-500">Duration</div>
            </div>
            <div>
              <div className="text-2xl font-black text-neon-pink">{prompts.length}</div>
              <div className="text-xs text-slate-500">Gestures</div>
            </div>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-slate-400">Difficulty</span>
            <span className={`font-bold capitalize ${
              difficulty === 'easy' ? 'text-green-400'
              : difficulty === 'normal' ? 'text-yellow-400'
              : 'text-red-400'
            }`}>{difficulty}</span>
          </div>
        </div>

        {/* Gesture preview */}
        <div className="card space-y-3">
          <h4 className="font-semibold text-slate-200">Gestures in this challenge</h4>
          <div className="grid grid-cols-2 gap-2">
            {uniqueGestures.map((gId) => {
              const g = GESTURE_MAP[gId]
              if (!g) return null
              const count = prompts.filter((p) => p.gestureId === gId).length
              return (
                <div key={gId} className="flex items-center gap-3 bg-dark-700 rounded-xl p-3">
                  <span className="text-3xl">{g.emoji}</span>
                  <div>
                    <p className="text-sm font-semibold text-slate-200">{g.name}</p>
                    <p className="text-xs text-slate-500">{count}×</p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Tips */}
        <div className="card bg-dark-700/50 space-y-2">
          <h4 className="font-semibold text-slate-300 text-sm">Tips</h4>
          <ul className="text-slate-400 text-sm space-y-1">
            <li>• Make sure your upper body is visible to the camera</li>
            <li>• Good lighting improves detection accuracy</li>
            <li>• Perform gestures clearly and hold them briefly</li>
            <li>• PERFECT: within ±200ms of the beat</li>
          </ul>
        </div>
      </div>

      <div className="p-4 space-y-3 border-t border-slate-800">
        <button
          onClick={() => setScreen('CAMERA_SETUP')}
          className="btn-primary w-full py-4 text-lg"
        >
          Set Up Camera →
        </button>
      </div>
    </div>
  )
}

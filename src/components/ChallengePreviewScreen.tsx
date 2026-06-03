import { useState } from 'react'
import { useGameStore } from '../store/gameStore'
import { GESTURE_MAP } from '../features/gestures/gestureDefinitions'
import { generateFromStyle, generateFromStyleBPM } from '../features/gestures/musicStyleMode'
import { generateGestureMap, generateGestureMapFromBPM } from '../features/gestures/generateGestureMap'
import type { GestureGenerationMode, MusicStyleProfile } from '../types'

const STYLE_OPTIONS: { value: MusicStyleProfile; label: string; emoji: string }[] = [
  { value: 'KPOP', label: 'K-Pop', emoji: '💜' },
  { value: 'HIPHOP', label: 'Hip-Hop', emoji: '🤜' },
  { value: 'EDM', label: 'EDM', emoji: '🙌' },
  { value: 'BALLAD', label: 'Ballad', emoji: '🎵' },
  { value: 'FREESTYLE', label: 'Freestyle', emoji: '🎲' },
]

const MODE_OPTIONS: { value: GestureGenerationMode; label: string; desc: string }[] = [
  { value: 'BEAT_BASED', label: 'Auto Beat', desc: 'Generate gestures from beat detection' },
  { value: 'MUSIC_STYLE', label: 'Music Style', desc: 'Choose a style preset for gesture selection' },
  { value: 'CREATOR_RECORDING', label: 'Record My Gestures', desc: 'Record your own gesture choreography' },
]

export function ChallengePreviewScreen() {
  const { activeChallenge, setActiveChallenge, difficulty, setScreen } = useGameStore()
  const [generationMode, setGenerationMode] = useState<GestureGenerationMode>('BEAT_BASED')
  const [selectedStyle, setSelectedStyle] = useState<MusicStyleProfile>('FREESTYLE')
  const [showComingSoon, setShowComingSoon] = useState(false)

  if (!activeChallenge) {
    setScreen('HOME')
    return null
  }

  const { prompts, segmentStart, segmentEnd, bpmOverride, analysis } = activeChallenge
  const duration = segmentEnd - segmentStart
  const uniqueGestures = [...new Set(prompts.map((p) => p.gestureId))]

  const handleRegenerateWithStyle = () => {
    if (!activeChallenge) return
    let newPrompts = prompts
    if (generationMode === 'MUSIC_STYLE') {
      if (analysis?.beats && analysis.beats.length > 0) {
        const result = generateFromStyle(selectedStyle, analysis.beats, difficulty, segmentStart, segmentEnd)
        newPrompts = result.prompts
      } else if (bpmOverride) {
        const result = generateFromStyleBPM(selectedStyle, bpmOverride, duration, difficulty, segmentStart, segmentEnd)
        newPrompts = result.prompts
      }
      setActiveChallenge({ ...activeChallenge, prompts: newPrompts, generationMode, styleProfile: selectedStyle })
    } else if (generationMode === 'BEAT_BASED') {
      if (analysis?.beats && analysis.beats.length > 0) {
        newPrompts = generateGestureMap(analysis.beats, difficulty, segmentStart, segmentEnd)
      } else if (bpmOverride) {
        newPrompts = generateGestureMapFromBPM(bpmOverride, duration, difficulty, segmentStart, segmentEnd)
      }
      setActiveChallenge({ ...activeChallenge, prompts: newPrompts, generationMode })
    } else if (generationMode === 'CREATOR_RECORDING') {
      setShowComingSoon(true)
    }
  }

  if (showComingSoon) {
    return (
      <div className="screen safe-top safe-bottom flex flex-col items-center justify-center gap-6 p-8">
        <span className="text-6xl">🎬</span>
        <h2 className="text-2xl font-black text-slate-100 text-center">Creator Recording</h2>
        <p className="text-slate-400 text-center text-sm leading-relaxed">
          Record your own gesture choreography and turn it into a playable challenge.
          This feature is coming soon!
        </p>
        <button
          onClick={() => setShowComingSoon(false)}
          className="btn-primary px-8 py-3"
        >
          ← Back
        </button>
      </div>
    )
  }

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

        {/* Generation mode selector */}
        <div className="card space-y-3">
          <h4 className="font-semibold text-slate-200">Generation Mode</h4>
          <div className="space-y-2">
            {MODE_OPTIONS.map((mode) => (
              <button
                key={mode.value}
                onClick={() => setGenerationMode(mode.value)}
                className={`w-full text-left p-3 rounded-xl border transition-colors ${
                  generationMode === mode.value
                    ? 'border-neon-purple bg-neon-purple/10 text-slate-100'
                    : 'border-slate-700 bg-dark-700 text-slate-400'
                }`}
              >
                <div className="font-semibold text-sm">{mode.label}</div>
                <div className="text-xs opacity-70">{mode.desc}</div>
              </button>
            ))}
          </div>

          {/* Style selector when Music Style mode */}
          {generationMode === 'MUSIC_STYLE' && (
            <div className="space-y-2 pt-2 border-t border-slate-700">
              <p className="text-sm text-slate-400">Choose a style:</p>
              <div className="grid grid-cols-3 gap-2">
                {STYLE_OPTIONS.map((s) => (
                  <button
                    key={s.value}
                    onClick={() => setSelectedStyle(s.value)}
                    className={`flex flex-col items-center gap-1 p-3 rounded-xl border transition-colors ${
                      selectedStyle === s.value
                        ? 'border-neon-cyan bg-neon-cyan/10 text-slate-100'
                        : 'border-slate-700 bg-dark-700 text-slate-400'
                    }`}
                  >
                    <span className="text-2xl">{s.emoji}</span>
                    <span className="text-xs font-semibold">{s.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <button
            onClick={handleRegenerateWithStyle}
            className="btn-secondary w-full py-2 text-sm"
          >
            ↻ Regenerate Gestures
          </button>
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

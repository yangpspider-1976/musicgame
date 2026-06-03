import { useState, useCallback } from 'react'
import { TapTempo } from '../features/youtube/tapTempo'
import type { Difficulty, SyncSettings } from '../types'

interface Props {
  duration: number          // seconds
  defaultBpm?: number
  isYouTubeMode?: boolean
  onConfirm: (params: {
    segmentStart: number
    segmentEnd: number
    bpm: number
    difficulty: Difficulty
    syncSettings: SyncSettings
  }) => void
}

const SYNC_STEPS = [-500, -250, 0, 250, 500]

export function SegmentSelector({ duration, defaultBpm = 120, isYouTubeMode = false, onConfirm }: Props) {
  const [start, setStart] = useState(0)
  const [end, setEnd] = useState(Math.min(60, duration))
  const [bpm, setBpm] = useState(defaultBpm)
  const [difficulty, setDifficulty] = useState<Difficulty>('normal')
  const [syncOffset, setSyncOffset] = useState(0)
  const [tapResult, setTapResult] = useState<{ bpm: number; tapCount: number } | null>(null)
  const tapTempo = useCallback(() => new TapTempo(), [])()

  const handleTap = () => {
    const result = tapTempo.tap()
    setTapResult({ bpm: result.bpm, tapCount: result.tapCount })
    if (result.confidence > 0.3 && result.bpm > 0) {
      setBpm(result.bpm)
    }
  }

  const resetTap = () => {
    tapTempo.reset()
    setTapResult(null)
  }

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60)
    const sec = Math.floor(s % 60)
    return `${m}:${sec.toString().padStart(2, '0')}`
  }

  const segDuration = end - start

  const difficulties: { id: Difficulty; label: string; desc: string }[] = [
    { id: 'easy', label: 'Easy', desc: 'Every 4 beats' },
    { id: 'normal', label: 'Normal', desc: 'Every 2 beats' },
    { id: 'hard', label: 'Hard', desc: 'Every beat' },
  ]

  return (
    <div className="space-y-5">
      {/* Segment selection */}
      <div className="card space-y-4">
        <h3 className="font-semibold text-slate-200">Segment</h3>

        <div className="space-y-3">
          <div>
            <div className="flex justify-between text-sm text-slate-400 mb-1">
              <span>Start</span>
              <span className="text-neon-cyan font-mono">{formatTime(start)}</span>
            </div>
            <input
              type="range"
              min={0}
              max={Math.max(0, duration - 5)}
              step={1}
              value={start}
              onChange={(e) => {
                const v = Number(e.target.value)
                setStart(v)
                if (v >= end - 5) setEnd(Math.min(duration, v + 5))
              }}
              className="w-full accent-neon-purple"
            />
          </div>

          <div>
            <div className="flex justify-between text-sm text-slate-400 mb-1">
              <span>End</span>
              <span className="text-neon-cyan font-mono">{formatTime(end)}</span>
            </div>
            <input
              type="range"
              min={Math.min(5, duration)}
              max={duration}
              step={1}
              value={end}
              onChange={(e) => {
                const v = Number(e.target.value)
                setEnd(v)
                if (v <= start + 5) setStart(Math.max(0, v - 5))
              }}
              className="w-full accent-neon-purple"
            />
          </div>

          <div className="text-center text-slate-400 text-sm">
            Duration: <span className="text-neon-purple font-semibold">{segDuration}s</span>
            {' · '}~<span className="text-neon-purple font-semibold">{Math.round(segDuration * bpm / 60)}</span> beats
          </div>
        </div>
      </div>

      {/* BPM */}
      <div className="card space-y-4">
        <h3 className="font-semibold text-slate-200">
          BPM {isYouTubeMode && <span className="text-slate-500 text-sm font-normal">(required for YouTube)</span>}
        </h3>

        <div className="flex items-center gap-3">
          <button
            className="w-10 h-10 bg-dark-700 rounded-lg text-slate-300 text-xl font-bold
              active:scale-95 transition-transform"
            onClick={() => setBpm((b) => Math.max(60, b - 1))}
          >−</button>
          <div className="flex-1 text-center">
            <input
              type="number"
              value={bpm}
              min={60}
              max={200}
              onChange={(e) => setBpm(Math.max(60, Math.min(200, Number(e.target.value))))}
              className="w-24 bg-dark-700 border border-slate-700 rounded-lg px-3 py-2
                text-center text-neon-cyan font-mono text-xl font-bold
                focus:outline-none focus:border-neon-cyan"
            />
            <div className="text-slate-500 text-xs mt-1">BPM</div>
          </div>
          <button
            className="w-10 h-10 bg-dark-700 rounded-lg text-slate-300 text-xl font-bold
              active:scale-95 transition-transform"
            onClick={() => setBpm((b) => Math.min(200, b + 1))}
          >+</button>
        </div>

        {/* Tap tempo */}
        <div className="space-y-2">
          <button
            onPointerDown={handleTap}
            className="w-full py-4 bg-dark-700 border-2 border-neon-pink/50 rounded-xl
              text-neon-pink font-bold text-lg active:scale-95 transition-all duration-75
              active:bg-neon-pink/20 active:border-neon-pink select-none"
          >
            👆 Tap to the Beat
          </button>
          {tapResult && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-400">
                {tapResult.tapCount} taps → <span className="text-neon-pink font-bold">{tapResult.bpm} BPM</span>
              </span>
              <button onClick={resetTap} className="text-slate-500 hover:text-slate-300 text-xs">
                Reset
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Difficulty */}
      <div className="card space-y-3">
        <h3 className="font-semibold text-slate-200">Difficulty</h3>
        <div className="grid grid-cols-3 gap-2">
          {difficulties.map((d) => (
            <button
              key={d.id}
              onClick={() => setDifficulty(d.id)}
              className={`py-3 px-2 rounded-xl border transition-all duration-150 text-center
                ${difficulty === d.id
                  ? 'border-neon-purple bg-purple-900/30 text-neon-purple'
                  : 'border-slate-700 text-slate-400 hover:border-slate-500'
                }`}
            >
              <div className="font-semibold text-sm">{d.label}</div>
              <div className="text-xs opacity-70 mt-0.5">{d.desc}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Sync offset */}
      <div className="card space-y-3">
        <h3 className="font-semibold text-slate-200">Sync Offset</h3>
        <p className="text-slate-500 text-sm">Adjust if gestures feel early or late</p>
        <div className="flex gap-2 justify-between">
          {SYNC_STEPS.map((step) => (
            <button
              key={step}
              onClick={() => setSyncOffset(step)}
              className={`flex-1 py-2 rounded-lg text-xs font-mono border transition-all
                ${syncOffset === step
                  ? 'border-neon-cyan bg-cyan-900/30 text-neon-cyan'
                  : 'border-slate-700 text-slate-400'
                }`}
            >
              {step > 0 ? `+${step}` : step}ms
            </button>
          ))}
        </div>
      </div>

      <button
        onClick={() =>
          onConfirm({
            segmentStart: start,
            segmentEnd: end,
            bpm,
            difficulty,
            syncSettings: { offsetMs: syncOffset },
          })
        }
        className="btn-primary w-full text-lg py-4"
      >
        Generate Challenge →
      </button>
    </div>
  )
}

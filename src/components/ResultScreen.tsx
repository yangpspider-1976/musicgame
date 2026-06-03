import type { Challenge, PlaySession } from '../types'
import { getGradeColor } from '../features/gameplay/scoring'
import { GESTURE_MAP } from '../features/gestures/gestureDefinitions'

interface Props {
  session: PlaySession
  challenge: Challenge
  onReplay: () => void
  onHome: () => void
  onExport: () => void
}

export function ResultScreen({ session, challenge, onReplay, onHome, onExport }: Props) {
  const perfects = session.results.filter((r) => r.timingGrade === 'PERFECT').length
  const goods = session.results.filter((r) => r.timingGrade === 'GOOD').length
  const misses = session.results.filter((r) => r.timingGrade === 'MISS').length
  const total = session.results.length

  const hitRate = total > 0 ? Math.round(((perfects + goods) / total) * 100) : 0
  const gradeColor = getGradeColor(session.grade)

  return (
    <div className="screen safe-top safe-bottom">
      {/* Header */}
      <div className="text-center pt-8 pb-6 px-4">
        <p className="text-slate-400 text-sm uppercase tracking-widest mb-2">Result</p>
        <h2 className="text-slate-200 font-semibold text-lg line-clamp-1">{challenge.title}</h2>
      </div>

      {/* Grade */}
      <div className="flex justify-center mb-6">
        <div
          className="w-32 h-32 rounded-full flex items-center justify-center border-4 relative"
          style={{
            borderColor: gradeColor,
            boxShadow: `0 0 40px ${gradeColor}60`,
          }}
        >
          <span
            className="text-7xl font-black"
            style={{ color: gradeColor, textShadow: `0 0 20px ${gradeColor}` }}
          >
            {session.grade}
          </span>
        </div>
      </div>

      {/* Score */}
      <div className="text-center mb-6">
        <div className="text-5xl font-black text-slate-100 font-mono tabular-nums">
          {session.totalScore.toLocaleString()}
        </div>
        <div className="text-slate-500 text-sm mt-1">points</div>
      </div>

      {/* Stats grid */}
      <div className="px-4 mb-6">
        <div className="grid grid-cols-4 gap-2 card">
          {[
            { label: 'PERFECT', value: perfects, color: '#a855f7' },
            { label: 'GOOD', value: goods, color: '#06b6d4' },
            { label: 'MISS', value: misses, color: '#ef4444' },
            { label: 'COMBO', value: session.maxCombo, color: '#eab308' },
          ].map((s) => (
            <div key={s.label} className="text-center">
              <div className="text-2xl font-black" style={{ color: s.color }}>
                {s.value}
              </div>
              <div className="text-xs text-slate-500 mt-0.5">{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Hit rate */}
      <div className="px-4 mb-6">
        <div className="card">
          <div className="flex justify-between text-sm text-slate-400 mb-2">
            <span>Hit Rate</span>
            <span className="text-neon-purple font-bold">{hitRate}%</span>
          </div>
          <div className="h-2 bg-dark-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-neon-purple to-neon-cyan transition-all duration-500"
              style={{ width: `${hitRate}%` }}
            />
          </div>
        </div>
      </div>

      {/* Gesture breakdown */}
      {session.results.length > 0 && (
        <div className="px-4 mb-6">
          <div className="card space-y-2 max-h-40 overflow-y-auto">
            <p className="text-slate-400 text-xs uppercase tracking-wide">Gesture Log</p>
            {session.results.map((r, i) => {
              const def = GESTURE_MAP[r.gestureId]
              const colors = { PERFECT: '#a855f7', GOOD: '#06b6d4', MISS: '#ef4444' }
              return (
                <div key={i} className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2">
                    <span>{def?.emoji ?? '?'}</span>
                    <span className="text-slate-400">{def?.name ?? r.gestureId}</span>
                  </span>
                  <span style={{ color: colors[r.timingGrade] }} className="font-bold text-xs">
                    {r.timingGrade}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="px-4 space-y-3 mt-auto pb-6">
        <button onClick={onExport} className="btn-cyan w-full flex items-center justify-center gap-2">
          <span>📤</span> Export Video (9:16)
        </button>
        <div className="grid grid-cols-2 gap-3">
          <button onClick={onReplay} className="btn-primary">
            🔄 Replay
          </button>
          <button onClick={onHome} className="btn-secondary">
            🏠 Home
          </button>
        </div>
      </div>
    </div>
  )
}

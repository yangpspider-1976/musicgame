import { useEffect, useRef } from 'react'
import type { GestureId, TimingGrade } from '../types'
import { getTimingFeedbackText } from '../features/gameplay/scoring'
import { GESTURE_MAP } from '../features/gestures/gestureDefinitions'

interface Props {
  score: number
  combo: number
  maxCombo: number
  lastTimingGrade: TimingGrade | null
  lastGestureId: GestureId | null
  progress: number   // 0-1 through the challenge
  totalPrompts: number
  completedPrompts: number
}

export function GameplayHUD({
  score,
  combo,
  maxCombo,
  lastTimingGrade,
  lastGestureId,
  progress,
  totalPrompts,
  completedPrompts,
}: Props) {
  const timingRef = useRef<HTMLDivElement>(null)
  const prevGrade = useRef<TimingGrade | null>(null)

  useEffect(() => {
    if (lastTimingGrade && lastTimingGrade !== prevGrade.current) {
      prevGrade.current = lastTimingGrade
      if (timingRef.current) {
        timingRef.current.classList.remove('combo-pop')
        void timingRef.current.offsetWidth
        timingRef.current.classList.add('combo-pop')
      }
    }
  }, [lastTimingGrade])

  const timingClass = {
    PERFECT: 'timing-perfect',
    GOOD: 'timing-good',
    MISS: 'timing-miss',
  }

  return (
    <div className="space-y-2">
      {/* Top row: score + combo */}
      <div className="flex items-center justify-between px-1">
        <div>
          <div className="text-3xl font-black text-slate-100 font-mono tabular-nums">
            {score.toLocaleString()}
          </div>
          <div className="text-xs text-slate-500 uppercase tracking-wide">Score</div>
        </div>

        <div className="text-right">
          {combo >= 3 && (
            <div className="text-neon-yellow font-black text-2xl combo-pop">
              x{combo} <span className="text-sm">COMBO</span>
            </div>
          )}
          {combo < 3 && (
            <div className="text-slate-600 text-sm">
              Best: {maxCombo}
            </div>
          )}
        </div>
      </div>

      {/* Timing feedback */}
      <div ref={timingRef} className="h-8 flex items-center justify-center">
        {lastTimingGrade && lastGestureId && (
          <div className="flex items-center gap-2">
            <span className="text-xl">{GESTURE_MAP[lastGestureId]?.emoji ?? ''}</span>
            <span className={timingClass[lastTimingGrade]}>
              {getTimingFeedbackText(lastTimingGrade)}
            </span>
          </div>
        )}
      </div>

      {/* Progress bar */}
      <div className="space-y-1">
        <div className="h-2 bg-dark-700 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-neon-purple to-neon-cyan transition-all duration-200"
            style={{ width: `${progress * 100}%` }}
          />
        </div>
        <div className="flex justify-between text-xs text-slate-600">
          <span>{completedPrompts} done</span>
          <span>{totalPrompts} total</span>
        </div>
      </div>
    </div>
  )
}

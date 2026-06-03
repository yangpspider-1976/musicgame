import { useEffect, useRef } from 'react'
import type { GesturePrompt } from '../types'
import { GESTURE_MAP } from '../features/gestures/gestureDefinitions'

interface Props {
  currentPrompt: GesturePrompt | null
  nextPrompt: GesturePrompt | null
  currentTime: number
  detected?: boolean
}

export function GesturePromptView({ currentPrompt, nextPrompt, currentTime, detected = false }: Props) {
  const prevPromptId = useRef<string | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (currentPrompt && currentPrompt.id !== prevPromptId.current) {
      prevPromptId.current = currentPrompt.id
      if (containerRef.current) {
        containerRef.current.classList.remove('gesture-prompt-appear')
        void containerRef.current.offsetWidth // reflow
        containerRef.current.classList.add('gesture-prompt-appear')
      }
    }
  }, [currentPrompt?.id])

  const current = currentPrompt ? GESTURE_MAP[currentPrompt.gestureId] : null
  const next = nextPrompt ? GESTURE_MAP[nextPrompt.gestureId] : null

  // Progress within current window
  let progress = 0
  if (currentPrompt) {
    progress = Math.min(
      1,
      (currentTime - currentPrompt.startTime) /
        (currentPrompt.endTime - currentPrompt.startTime),
    )
  }

  return (
    <div ref={containerRef} className="space-y-3">
      {/* Current gesture */}
      <div
        className={`
          card relative overflow-hidden transition-all duration-200
          ${detected
            ? 'border-neon-green shadow-lg shadow-green-900/50'
            : currentPrompt
            ? 'border-neon-purple/60 shadow-lg shadow-purple-900/30'
            : 'border-slate-800 opacity-50'
          }
        `}
      >
        {currentPrompt && (
          <div
            className="absolute bottom-0 left-0 h-1 bg-neon-purple transition-all duration-100"
            style={{ width: `${(1 - progress) * 100}%` }}
          />
        )}

        <div className="flex items-center gap-4 p-2">
          <div className={`text-6xl transition-transform duration-150 ${detected ? 'scale-125' : 'scale-100'}`}>
            {current?.emoji ?? '❓'}
          </div>
          <div className="flex-1">
            {current ? (
              <>
                <p className="font-bold text-lg text-slate-100">{current.name}</p>
                <p className="text-slate-400 text-sm">{current.description}</p>
                {detected && (
                  <p className="text-neon-green text-sm font-bold mt-1 animate-pulse">
                    ✓ Detected!
                  </p>
                )}
              </>
            ) : (
              <p className="text-slate-500">Get ready...</p>
            )}
          </div>
        </div>
      </div>

      {/* Next gesture preview */}
      {next && (
        <div className="flex items-center gap-3 px-2 opacity-60">
          <span className="text-slate-500 text-xs uppercase font-semibold tracking-wide">Next</span>
          <span className="text-2xl">{next.emoji}</span>
          <span className="text-slate-400 text-sm">{next.name}</span>
        </div>
      )}
    </div>
  )
}

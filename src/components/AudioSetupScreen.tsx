import { useState } from 'react'
import { AudioUploader } from './AudioUploader'
import { SegmentSelector } from './SegmentSelector'
import { useGameStore } from '../store/gameStore'
import { generateGestureMap } from '../features/gestures/generateGestureMap'
import { generateChallengeId } from '../features/storage/localChallengeStore'
import type { AudioAnalysisResult, Challenge, Difficulty, LocalUploadSource, SyncSettings } from '../types'

type Step = 'upload' | 'segment'

export function AudioSetupScreen() {
  const { setScreen, setMusicSource, setActiveChallenge, setSyncOffset, setDifficulty } = useGameStore()
  const [step, setStep] = useState<Step>('upload')
  const [source, setSource] = useState<LocalUploadSource | null>(null)
  const [analysis, setAnalysis] = useState<AudioAnalysisResult | null>(null)

  const handleSourceReady = (s: LocalUploadSource, a: AudioAnalysisResult) => {
    setSource(s)
    setAnalysis(a)
    setMusicSource(s)
    setStep('segment')
  }

  const handleConfirm = (params: {
    segmentStart: number
    segmentEnd: number
    bpm: number
    difficulty: Difficulty
    syncSettings: SyncSettings
  }) => {
    if (!source || !analysis) return

    const beats = analysis.beats.filter(
      (b) => b.time >= params.segmentStart && b.time <= params.segmentEnd,
    )
    const prompts = generateGestureMap(beats, params.difficulty, params.segmentStart, params.segmentEnd)

    const challenge: Challenge = {
      id: generateChallengeId(),
      title: source.fileName.replace(/\.[^.]+$/, ''),
      source,
      analysis,
      prompts,
      difficulty: params.difficulty,
      segmentStart: params.segmentStart,
      segmentEnd: params.segmentEnd,
      createdAt: Date.now(),
      bpmOverride: params.bpm,
    }

    setActiveChallenge(challenge)
    setSyncOffset(params.syncSettings.offsetMs)
    setDifficulty(params.difficulty)
    setScreen('CHALLENGE_PREVIEW')
  }

  return (
    <div className="screen safe-top safe-bottom">
      {/* Header */}
      <div className="flex items-center gap-3 p-4 border-b border-slate-800">
        <button
          onClick={() => step === 'segment' ? setStep('upload') : setScreen('HOME')}
          className="text-slate-400 p-1"
        >
          ←
        </button>
        <h2 className="font-bold text-lg text-slate-100">
          {step === 'upload' ? 'Upload Audio' : 'Configure Challenge'}
        </h2>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {step === 'upload' && (
          <AudioUploader onSourceReady={handleSourceReady} />
        )}

        {step === 'segment' && analysis && source && (
          <>
            {/* Analysis summary */}
            <div className="card flex gap-4">
              <div className="text-4xl">🎵</div>
              <div>
                <p className="font-semibold text-slate-200 line-clamp-1">
                  {source.fileName}
                </p>
                <p className="text-sm text-slate-400 mt-1">
                  <span className="text-neon-purple font-bold">{analysis.bpm} BPM</span>
                  {' · '}
                  {Math.floor(analysis.duration / 60)}:{String(Math.floor(analysis.duration % 60)).padStart(2, '0')}
                  {' · '}
                  <span className="text-slate-500">{Math.round(analysis.confidence * 100)}% confidence</span>
                </p>
              </div>
            </div>

            <SegmentSelector
              duration={analysis.duration}
              defaultBpm={analysis.bpm}
              isYouTubeMode={false}
              onConfirm={handleConfirm}
            />
          </>
        )}
      </div>
    </div>
  )
}

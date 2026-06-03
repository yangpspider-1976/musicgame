import { useRef, useState } from 'react'
import { YouTubeLinkInput } from './YouTubeLinkInput'
import { SegmentSelector } from './SegmentSelector'
import { useGameStore } from '../store/gameStore'
import { generateGestureMapFromBPM } from '../features/gestures/generateGestureMap'
import { generateChallengeId } from '../features/storage/localChallengeStore'
import { YouTubePlayer } from '../features/youtube/youtubePlayer'
import type { Challenge, Difficulty, SyncSettings, YouTubeLinkSource } from '../types'

type Step = 'link' | 'segment'

export function YouTubeSetupScreen() {
  const { setScreen, setMusicSource, setActiveChallenge, setSyncOffset, setDifficulty } = useGameStore()
  const [step, setStep] = useState<Step>('link')
  const [ytSource, setYtSource] = useState<YouTubeLinkSource | null>(null)
  const playerContainerRef = useRef<HTMLDivElement>(null)
  const ytPlayerRef = useRef<YouTubePlayer | null>(null)

  const handleSourceReady = async (source: YouTubeLinkSource) => {
    setYtSource(source)
    setMusicSource(source)
    setStep('segment')

    // Mount YouTube player
    if (playerContainerRef.current) {
      const player = new YouTubePlayer()
      ytPlayerRef.current = player
      try {
        await player.mount(playerContainerRef.current, source.videoId)
      } catch {
        // Player failed, continue without it
      }
    }
  }

  const handleConfirm = (params: {
    segmentStart: number
    segmentEnd: number
    bpm: number
    difficulty: Difficulty
    syncSettings: SyncSettings
  }) => {
    if (!ytSource) return

    const duration = ytSource.duration ?? 180
    const prompts = generateGestureMapFromBPM(
      params.bpm,
      duration,
      params.difficulty,
      params.segmentStart,
      params.segmentEnd,
    )

    const challenge: Challenge = {
      id: generateChallengeId(),
      title: ytSource.title ?? `YouTube: ${ytSource.videoId}`,
      source: ytSource,
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

  const duration = ytSource?.duration ?? 180

  return (
    <div className="screen safe-top safe-bottom">
      <div className="flex items-center gap-3 p-4 border-b border-slate-800">
        <button
          onClick={() => step === 'segment' ? setStep('link') : setScreen('HOME')}
          className="text-slate-400 p-1"
        >
          ←
        </button>
        <h2 className="font-bold text-lg text-slate-100">
          {step === 'link' ? 'YouTube Link' : 'Configure Challenge'}
        </h2>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {step === 'link' && (
          <YouTubeLinkInput onSourceReady={handleSourceReady} />
        )}

        {step === 'segment' && ytSource && (
          <>
            {/* Embedded YouTube player */}
            <div className="card space-y-2">
              <div className="flex gap-3 items-start">
                {ytSource.thumbnailUrl && (
                  <img
                    src={ytSource.thumbnailUrl}
                    alt={ytSource.title}
                    className="w-16 h-12 object-cover rounded-lg flex-shrink-0"
                  />
                )}
                <div>
                  <p className="font-semibold text-slate-200 text-sm line-clamp-2">
                    {ytSource.title ?? ytSource.videoId}
                  </p>
                  {ytSource.channelTitle && (
                    <p className="text-slate-500 text-xs">{ytSource.channelTitle}</p>
                  )}
                </div>
              </div>
              <div
                ref={playerContainerRef}
                className="w-full aspect-video rounded-xl overflow-hidden bg-black"
              />
              <p className="text-slate-600 text-xs text-center">
                Official YouTube player — no audio extraction
              </p>
            </div>

            <SegmentSelector
              duration={duration}
              defaultBpm={120}
              isYouTubeMode={true}
              onConfirm={handleConfirm}
            />
          </>
        )}
      </div>
    </div>
  )
}

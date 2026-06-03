import { useState } from 'react'
import { useGameStore } from '../store/gameStore'
import { HomeScreen } from '../components/HomeScreen'
import { AudioSetupScreen } from '../components/AudioSetupScreen'
import { YouTubeSetupScreen } from '../components/YouTubeSetupScreen'
import { ChallengePreviewScreen } from '../components/ChallengePreviewScreen'
import { CameraSetupScreen } from '../components/CameraSetupScreen'
import { GameplayScreen } from '../components/GameplayScreen'
import { ResultScreen } from '../components/ResultScreen'
import { VideoExporter } from '../components/VideoExporter'

export function App() {
  const { screen, setScreen, lastSession, activeChallenge, resetGame } = useGameStore()
  const [showExporter, setShowExporter] = useState(false)

  const renderScreen = () => {
    switch (screen) {
      case 'HOME':
        return <HomeScreen />
      case 'AUDIO_SETUP':
        return <AudioSetupScreen />
      case 'YOUTUBE_SETUP':
        return <YouTubeSetupScreen />
      case 'CHALLENGE_PREVIEW':
        return <ChallengePreviewScreen />
      case 'CAMERA_SETUP':
        return <CameraSetupScreen />
      case 'GAMEPLAY':
        return <GameplayScreen />
      case 'RESULT':
        return lastSession && activeChallenge ? (
          <ResultScreen
            session={lastSession}
            challenge={activeChallenge}
            onReplay={() => setScreen('CAMERA_SETUP')}
            onHome={() => resetGame()}
            onExport={() => setShowExporter(true)}
          />
        ) : (
          <HomeScreen />
        )
      default:
        return <HomeScreen />
    }
  }

  return (
    <div className="min-h-dvh bg-dark-900 max-w-md mx-auto relative">
      {renderScreen()}

      {showExporter && lastSession && activeChallenge && (
        <VideoExporter
          session={lastSession}
          challenge={activeChallenge}
          onClose={() => setShowExporter(false)}
        />
      )}
    </div>
  )
}

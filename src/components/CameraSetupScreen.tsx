import { useState } from 'react'
import { CameraPreview } from './CameraPreview'
import { useGameStore } from '../store/gameStore'

export function CameraSetupScreen() {
  const { setScreen, setCameraStream } = useGameStore()
  const [cameraReady, setCameraReady] = useState(false)
  const [poseDetected, setPoseDetected] = useState(false)

  const handleCameraReady = (stream: MediaStream) => {
    setCameraStream(stream)
    setCameraReady(true)
  }

  return (
    <div className="screen safe-top safe-bottom">
      <div className="flex items-center gap-3 p-4 border-b border-slate-800">
        <button onClick={() => setScreen('CHALLENGE_PREVIEW')} className="text-slate-400 p-1">←</button>
        <h2 className="font-bold text-lg text-slate-100">Camera Setup</h2>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Camera preview */}
        <CameraPreview
          onReady={handleCameraReady}
          onPoseFrame={(frame) => {
            // Check if key landmarks are visible
            const shoulders = [11, 12].every(
              (i) => (frame.landmarks[i]?.visibility ?? 0) > 0.5,
            )
            setPoseDetected(shoulders)
          }}
          showSkeleton={true}
          className="w-full aspect-[3/4]"
        />

        {/* Status */}
        <div className="card space-y-2">
          <div className="flex items-center gap-3">
            <div className={`w-3 h-3 rounded-full ${cameraReady ? 'bg-green-400' : 'bg-yellow-400 animate-pulse'}`} />
            <span className="text-sm text-slate-300">
              Camera {cameraReady ? 'ready' : 'starting...'}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <div className={`w-3 h-3 rounded-full ${poseDetected ? 'bg-green-400' : 'bg-slate-600'}`} />
            <span className="text-sm text-slate-300">
              Pose detection {poseDetected ? 'active ✓' : 'waiting...'}
            </span>
          </div>
        </div>

        {/* Positioning guide */}
        <div className="card bg-dark-700/50 space-y-2">
          <h4 className="text-slate-300 font-semibold text-sm">Positioning</h4>
          <ul className="text-slate-400 text-sm space-y-1.5">
            <li>📏 Stand ~1-2 meters from camera</li>
            <li>👕 Shoulders and arms fully visible</li>
            <li>💡 Face a light source (window/lamp)</li>
            <li>🔲 Avoid busy backgrounds</li>
          </ul>
        </div>
      </div>

      <div className="p-4 border-t border-slate-800">
        <button
          onClick={() => setScreen('GAMEPLAY')}
          disabled={!cameraReady}
          className="btn-primary w-full py-4 text-lg disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {cameraReady ? "Let's Play! 🎮" : 'Waiting for camera...'}
        </button>
      </div>
    </div>
  )
}

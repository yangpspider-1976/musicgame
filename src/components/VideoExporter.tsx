import { useEffect, useState } from 'react'
import { exportShortVideo, downloadBlob } from '../features/video/exportShortVideo'
import type { Challenge, PlaySession } from '../types'

interface Props {
  session: PlaySession
  challenge: Challenge
  /** Pre-recorded gameplay blob from GameplayScreen (preferred over post-game render) */
  recordedBlob?: Blob | null
  onClose: () => void
}

export function VideoExporter({ session, challenge, recordedBlob, onClose }: Props) {
  const [status, setStatus] = useState<'idle' | 'exporting' | 'done' | 'error'>('idle')
  const [progress, setProgress] = useState(0)
  const [blobUrl, setBlobUrl] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  // If we already have a recorded blob, surface it immediately
  useEffect(() => {
    if (recordedBlob && recordedBlob.size > 0) {
      const url = URL.createObjectURL(recordedBlob)
      setBlobUrl(url)
      setStatus('done')
    }
  }, [recordedBlob])

  const handleExport = async () => {
    setStatus('exporting')
    setProgress(0)
    try {
      const segmentDurationMs = (challenge.segmentEnd - challenge.segmentStart) * 1000
      const blob = await exportShortVideo({
        session,
        challenge,
        durationMs: Math.max(3000, segmentDurationMs),
        onProgress: (p) => setProgress(p),
      })
      const url = URL.createObjectURL(blob)
      setBlobUrl(url)
      setStatus('done')
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Export failed')
      setStatus('error')
    }
  }

  const handleDownload = () => {
    if (!blobUrl) return
    const timestamp = new Date().toISOString().slice(0, 10)
    const safeTitle = challenge.title.replace(/[^a-z0-9]/gi, '_').slice(0, 30)
    const ext = blobUrl.includes('mp4') ? 'mp4' : 'webm'
    const a = document.createElement('a')
    a.href = blobUrl
    a.download = `rhythm_${safeTitle}_${session.grade}_${timestamp}.${ext}`
    a.click()
  }

  const hasRecordedBlob = !!recordedBlob && recordedBlob.size > 0

  return (
    <div className="fixed inset-0 bg-black/80 flex items-end justify-center z-50">
      <div className="w-full max-w-md bg-dark-800 rounded-t-3xl p-6 space-y-4 animate-slide-up safe-bottom">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-lg text-slate-100">Export Result Video</h3>
          <button onClick={onClose} className="text-slate-400 text-2xl">✕</button>
        </div>

        <div className="text-center text-slate-400 text-sm">
          {hasRecordedBlob
            ? 'Gameplay recording ready — includes camera feed and overlays'
            : 'Creates a 9:16 vertical result card (720×1280)'}
        </div>

        {status === 'idle' && !hasRecordedBlob && (
          <button onClick={handleExport} className="btn-cyan w-full py-4 text-lg">
            🎬 Generate Video
          </button>
        )}

        {status === 'exporting' && (
          <div className="space-y-3">
            <div className="h-3 bg-dark-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-neon-purple to-neon-cyan transition-all duration-100"
                style={{ width: `${progress * 100}%` }}
              />
            </div>
            <p className="text-center text-slate-400 text-sm">
              Composing video... {Math.round(progress * 100)}%
            </p>
          </div>
        )}

        {status === 'done' && blobUrl && (
          <div className="space-y-3">
            <video
              src={blobUrl}
              controls
              playsInline
              className="w-full rounded-xl max-h-72 bg-black"
            />
            <button onClick={handleDownload} className="btn-primary w-full">
              ⬇️ Download
            </button>
            {hasRecordedBlob && (
              <button
                onClick={handleExport}
                className="btn-secondary w-full py-2 text-sm"
              >
                🎬 Generate Result Card Instead
              </button>
            )}
          </div>
        )}

        {status === 'error' && (
          <div className="space-y-3">
            <div className="bg-red-900/30 border border-red-700 rounded-xl p-3 text-red-400 text-sm text-center">
              {errorMsg ?? 'Export failed'}
            </div>
            <button onClick={handleExport} className="btn-secondary w-full">
              Try Result Card
            </button>
          </div>
        )}

        <p className="text-slate-600 text-xs text-center">
          Only share music you own or have permission to use.
        </p>
      </div>
    </div>
  )
}

// Re-export for consumers that use it directly
export { downloadBlob }

import { useState } from 'react'
import { extractVideoId, fetchYouTubeMetadata } from '../features/youtube/youtubePlayer'
import type { YouTubeLinkSource } from '../types'

interface Props {
  onSourceReady: (source: YouTubeLinkSource) => void
}

export function YouTubeLinkInput({ onSourceReady }: Props) {
  const [url, setUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [preview, setPreview] = useState<YouTubeLinkSource | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    const videoId = extractVideoId(url.trim())
    if (!videoId) {
      setError('Invalid YouTube URL. Please paste a valid youtube.com or youtu.be link.')
      return
    }

    setLoading(true)
    try {
      const apiKey = import.meta.env.VITE_YOUTUBE_API_KEY
      const meta = await fetchYouTubeMetadata(videoId, apiKey)
      const source: YouTubeLinkSource = {
        type: 'youtube_link',
        videoId,
        url: url.trim(),
        ...meta,
      }
      setPreview(source)
    } catch {
      setError('Failed to fetch video info. Check your API key or try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleConfirm = () => {
    if (preview) onSourceReady(preview)
  }

  return (
    <div className="space-y-4">
      {/* Policy notice */}
      <div className="bg-blue-900/20 border border-blue-700/50 rounded-xl p-3 text-blue-300 text-sm flex gap-2">
        <span className="text-lg flex-shrink-0">ℹ️</span>
        <span>
          This app uses the official YouTube player. It does not download or extract YouTube audio.
          BPM is set manually via tap tempo.
        </span>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="relative">
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://youtube.com/watch?v=..."
            className="w-full bg-dark-700 border border-slate-700 rounded-xl px-4 py-3
              text-slate-100 placeholder-slate-500 focus:outline-none
              focus:border-neon-purple transition-colors"
          />
        </div>

        <button
          type="submit"
          disabled={loading || !url.trim()}
          className="btn-primary w-full disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Loading...
            </span>
          ) : (
            'Load Video'
          )}
        </button>
      </form>

      {error && (
        <div className="bg-red-900/30 border border-red-700 rounded-xl p-3 text-red-400 text-sm">
          {error}
        </div>
      )}

      {preview && (
        <div className="card space-y-3 animate-fade-in">
          <div className="flex gap-3">
            {preview.thumbnailUrl && (
              <img
                src={preview.thumbnailUrl}
                alt={preview.title ?? 'Video thumbnail'}
                className="w-20 h-14 object-cover rounded-lg flex-shrink-0"
              />
            )}
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-slate-100 line-clamp-2 text-sm">
                {preview.title ?? preview.videoId}
              </p>
              {preview.channelTitle && (
                <p className="text-slate-400 text-xs mt-1">{preview.channelTitle}</p>
              )}
              {preview.duration && (
                <p className="text-slate-500 text-xs">
                  {Math.floor(preview.duration / 60)}:{String(preview.duration % 60).padStart(2, '0')}
                </p>
              )}
            </div>
          </div>
          <button onClick={handleConfirm} className="btn-cyan w-full">
            Use This Video →
          </button>
        </div>
      )}
    </div>
  )
}

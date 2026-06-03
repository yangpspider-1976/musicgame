import type { YouTubeLinkSource } from '../../types'

declare global {
  interface Window {
    YT: {
      Player: new (elementId: string | HTMLElement, config: YTPlayerConfig) => YTPlayer
      PlayerState: {
        UNSTARTED: -1
        ENDED: 0
        PLAYING: 1
        PAUSED: 2
        BUFFERING: 3
        CUED: 5
      }
    }
    onYouTubeIframeAPIReady: () => void
  }
}

interface YTPlayerConfig {
  videoId?: string
  width?: number | string
  height?: number | string
  playerVars?: Record<string, string | number>
  events?: {
    onReady?: (event: { target: YTPlayer }) => void
    onStateChange?: (event: { data: number }) => void
    onError?: (event: { data: number }) => void
  }
}

interface YTPlayer {
  playVideo(): void
  pauseVideo(): void
  stopVideo(): void
  seekTo(seconds: number, allowSeekAhead: boolean): void
  getCurrentTime(): number
  getDuration(): number
  getVideoData(): { title: string; author: string; video_id: string }
  destroy(): void
  getPlayerState(): number
  setVolume(volume: number): void
  unMute(): void
  mute(): void
  isMuted(): boolean
}

let ytApiLoaded = false
let ytApiReady = false
const ytApiReadyCallbacks: (() => void)[] = []

export function loadYouTubeAPI(): Promise<void> {
  return new Promise((resolve) => {
    if (ytApiReady) {
      resolve()
      return
    }

    ytApiReadyCallbacks.push(resolve)

    if (!ytApiLoaded) {
      ytApiLoaded = true
      window.onYouTubeIframeAPIReady = () => {
        ytApiReady = true
        ytApiReadyCallbacks.forEach((cb) => cb())
        ytApiReadyCallbacks.length = 0
      }

      const script = document.createElement('script')
      script.src = 'https://www.youtube.com/iframe_api'
      document.head.appendChild(script)
    }
  })
}

/**
 * Extract a YouTube video ID from a URL or return the raw ID.
 */
export function extractVideoId(urlOrId: string): string | null {
  // Already an ID (11 chars, no slashes)
  if (/^[a-zA-Z0-9_-]{11}$/.test(urlOrId)) return urlOrId

  try {
    const url = new URL(urlOrId)

    // youtube.com/watch?v=...
    const v = url.searchParams.get('v')
    if (v && /^[a-zA-Z0-9_-]{11}$/.test(v)) return v

    // youtu.be/...
    if (url.hostname === 'youtu.be') {
      const id = url.pathname.slice(1)
      if (/^[a-zA-Z0-9_-]{11}$/.test(id)) return id
    }

    // youtube.com/shorts/...
    const shortsMatch = url.pathname.match(/\/shorts\/([a-zA-Z0-9_-]{11})/)
    if (shortsMatch) return shortsMatch[1]
  } catch {
    // Not a URL
  }

  return null
}

/**
 * Fetch video metadata via YouTube Data API v3.
 */
export async function fetchYouTubeMetadata(
  videoId: string,
  apiKey?: string,
): Promise<Partial<YouTubeLinkSource>> {
  if (!apiKey) {
    // Return minimal info without API
    return {
      videoId,
      thumbnailUrl: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
    }
  }

  try {
    const res = await fetch(
      `https://www.googleapis.com/youtube/v3/videos?id=${videoId}&part=snippet,contentDetails&key=${apiKey}`,
    )
    const data = (await res.json()) as {
      items?: Array<{
        snippet: { title: string; channelTitle: string; thumbnails: { high: { url: string } } }
        contentDetails: { duration: string }
      }>
    }

    const item = data.items?.[0]
    if (!item) return { videoId }

    return {
      videoId,
      title: item.snippet.title,
      channelTitle: item.snippet.channelTitle,
      thumbnailUrl: item.snippet.thumbnails.high.url,
      duration: parseISO8601Duration(item.contentDetails.duration),
    }
  } catch {
    return { videoId }
  }
}

/**
 * Parse ISO 8601 duration (e.g., PT3M45S) to seconds.
 */
function parseISO8601Duration(duration: string): number {
  const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/)
  if (!match) return 0
  const h = parseInt(match[1] ?? '0')
  const m = parseInt(match[2] ?? '0')
  const s = parseInt(match[3] ?? '0')
  return h * 3600 + m * 60 + s
}

export class YouTubePlayer {
  private player: YTPlayer | null = null
  async mount(container: HTMLElement, videoId: string): Promise<void> {
    await loadYouTubeAPI()

    return new Promise((resolve, reject) => {
      const div = document.createElement('div')
      div.id = `yt_player_${Date.now()}`
      container.appendChild(div)

      this.player = new window.YT.Player(div, {
        videoId,
        width: '100%',
        height: '100%',
        playerVars: {
          autoplay: 0,
          controls: 1,
          rel: 0,
          modestbranding: 1,
          origin: window.location.origin,
        },
        events: {
          onReady: () => resolve(),
          onError: (e) => reject(new Error(`YouTube player error: ${e.data}`)),
        },
      })
    })
  }

  play(): void { this.player?.playVideo() }
  pause(): void { this.player?.pauseVideo() }
  seekTo(seconds: number): void { this.player?.seekTo(seconds, true) }
  getCurrentTime(): number { return this.player?.getCurrentTime() ?? 0 }
  getDuration(): number { return this.player?.getDuration() ?? 0 }

  destroy(): void {
    this.player?.destroy()
    this.player = null
  }
}

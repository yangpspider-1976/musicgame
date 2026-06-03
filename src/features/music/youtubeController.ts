import type { PlayableMusicController } from './musicController'
import { loadYouTubeAPI } from '../youtube/youtubePlayer'

const YT_PLAYING = 1

export class YouTubeAudioController implements PlayableMusicController {
  sourceType = 'youtube_link' as const
  /** Set only after onReady fires — the constructor return is a partial object */
  private player: YTPlayerMin | null = null
  private _ready = false

  constructor(private videoId: string) {}

  async mount(container: HTMLElement): Promise<void> {
    await loadYouTubeAPI()
    return new Promise((resolve, reject) => {
      const div = document.createElement('div')
      container.appendChild(div)

      // Do NOT assign this.player here — the constructor return is not ready.
      // Grab the fully-initialized instance from event.target inside onReady.
      new window.YT.Player(div as unknown as string, {
        videoId: this.videoId,
        width: '100%',
        height: '100%',
        playerVars: {
          enablejsapi: 1,
          playsinline: 1,
          controls: 1,
          rel: 0,
          modestbranding: 1,
          autoplay: 0,
          origin: window.location.origin,
        },
        events: {
          onReady: (event: { target: YTPlayerMin }) => {
            // event.target is the fully-initialized player instance
            this.player = event.target
            this._ready = true
            resolve()
          },
          onError: (e: { data: number }) => reject(new Error(`YouTube player error: ${e.data}`)),
        },
      })
    })
  }

  async load(): Promise<void> { /* loading happens via mount() */ }

  async play(): Promise<void> {
    if (!this._ready || !this.player) throw new Error('YouTube player not ready')
    this.safeCall('unMute')
    this.safeCall('setVolume', 100)
    this.safeCall('playVideo')
  }

  pause(): void { this.safeCall('pauseVideo') }
  stop(): void { this.safeCall('stopVideo') }
  seekTo(seconds: number): void { this.safeCall('seekTo', seconds, true) }

  getCurrentTime(): number {
    return this._ready ? (this.player?.getCurrentTime() ?? 0) : 0
  }
  getDuration(): number {
    return this._ready ? (this.player?.getDuration() ?? 0) : 0
  }
  setVolume(v: number): void {
    this.safeCall('setVolume', Math.round(Math.max(0, Math.min(1, v)) * 100))
  }
  unmute(): void { this.safeCall('unMute') }

  isPlaying(): boolean {
    if (!this._ready || !this.player) return false
    return this.player.getPlayerState() === YT_PLAYING
  }

  isReady(): boolean { return this._ready }

  getPlayerState(): number {
    if (!this._ready || !this.player) return -1
    return this.player.getPlayerState()
  }

  async waitForPlayingState(timeoutMs: number): Promise<boolean> {
    const deadline = Date.now() + timeoutMs
    while (Date.now() < deadline) {
      if (this.isPlaying()) return true
      await sleep(100)
    }
    return false
  }

  destroy(): void {
    if (this._ready && this.player) {
      this.safeCall('destroy')
    }
    this.player = null
    this._ready = false
  }

  /** Call a player method only if ready and the method exists */
  private safeCall(method: string, ...args: unknown[]): void {
    if (!this.player) return
    const fn = (this.player as Record<string, unknown>)[method]
    if (typeof fn === 'function') {
      (fn as (...a: unknown[]) => void).apply(this.player, args)
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

interface YTPlayerMin {
  playVideo(): void
  pauseVideo(): void
  stopVideo(): void
  seekTo(seconds: number, allowSeekAhead: boolean): void
  getCurrentTime(): number
  getDuration(): number
  getPlayerState(): number
  setVolume(volume: number): void
  unMute(): void
  destroy(): void
}

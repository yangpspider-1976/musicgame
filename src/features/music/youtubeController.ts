import type { PlayableMusicController } from './musicController'
import { loadYouTubeAPI } from '../youtube/youtubePlayer'

const YT_PLAYING = 1

export class YouTubeAudioController implements PlayableMusicController {
  sourceType = 'youtube_link' as const
  private player: YTPlayerMin | null = null
  private _ready = false
  private _containerEl: HTMLElement | null = null

  constructor(private videoId: string) {}

  async mount(container: HTMLElement): Promise<void> {
    this._containerEl = container
    await loadYouTubeAPI()
    return new Promise((resolve, reject) => {
      const div = document.createElement('div')
      container.appendChild(div)

      this.player = new window.YT.Player(div as unknown as string, {
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
          onReady: () => { this._ready = true; resolve() },
          onError: (e: { data: number }) => reject(new Error(`YouTube player error: ${e.data}`)),
        },
      })
    })
  }

  async load(): Promise<void> { /* loading happens via mount() */ }

  async play(): Promise<void> {
    if (!this.player) throw new Error('YouTube player not mounted')
    this.player.unMute()
    this.player.setVolume(100)
    this.player.playVideo()
  }

  pause(): void { this.player?.pauseVideo() }
  stop(): void { this.player?.stopVideo() }

  seekTo(seconds: number): void { this.player?.seekTo(seconds, true) }

  getCurrentTime(): number { return this.player?.getCurrentTime() ?? 0 }
  getDuration(): number { return this.player?.getDuration() ?? 0 }

  setVolume(v: number): void {
    this.player?.setVolume(Math.round(Math.max(0, Math.min(1, v)) * 100))
  }

  unmute(): void { this.player?.unMute() }

  isPlaying(): boolean {
    return this.player?.getPlayerState() === YT_PLAYING
  }

  isReady(): boolean { return this._ready }

  getPlayerState(): number { return this.player?.getPlayerState() ?? -1 }

  async waitForPlayingState(timeoutMs: number): Promise<boolean> {
    const deadline = Date.now() + timeoutMs
    while (Date.now() < deadline) {
      if (this.isPlaying()) return true
      await sleep(100)
    }
    return false
  }

  destroy(): void {
    this.player?.destroy()
    this.player = null
    this._ready = false
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

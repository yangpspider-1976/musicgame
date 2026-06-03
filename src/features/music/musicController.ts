export interface PlayableMusicController {
  sourceType: 'local_upload' | 'youtube_link' | 'licensed_catalog'
  load(): Promise<void>
  play(): Promise<void>
  pause(): void
  stop(): void
  seekTo(seconds: number): void
  getCurrentTime(): number
  getDuration(): number
  setVolume(volume: number): void  // 0.0 – 1.0
  unmute(): void
  isPlaying(): boolean
  isReady(): boolean
  destroy(): void
}

export class LocalAudioController implements PlayableMusicController {
  sourceType = 'local_upload' as const
  private audio: HTMLAudioElement
  private _ready = false
  private _playing = false

  constructor(objectUrl: string) {
    this.audio = new Audio(objectUrl)
    this.audio.preload = 'auto'
    this.audio.muted = false
    this.audio.volume = 1.0
    this.audio.addEventListener('ended', () => { this._playing = false })
    this.audio.addEventListener('pause', () => { this._playing = false })
    this.audio.addEventListener('play', () => { this._playing = true })
  }

  async load(): Promise<void> {
    if (this._ready) return
    return new Promise((resolve, reject) => {
      // canplaythrough may have already fired if src loads quickly
      if (this.audio.readyState >= 4) {
        this._ready = true
        resolve()
        return
      }
      const onReady = () => { this._ready = true; cleanup(); resolve() }
      const onError = (e: Event) => { cleanup(); reject(e) }
      const cleanup = () => {
        this.audio.removeEventListener('canplaythrough', onReady)
        this.audio.removeEventListener('error', onError)
      }
      this.audio.addEventListener('canplaythrough', onReady, { once: true })
      this.audio.addEventListener('error', onError, { once: true })
      this.audio.load()
    })
  }

  async play(): Promise<void> {
    this.audio.muted = false
    this.audio.volume = 1.0
    await this.audio.play()
    this._playing = true
  }

  pause(): void {
    this.audio.pause()
    this._playing = false
  }

  stop(): void {
    this.audio.pause()
    this.audio.currentTime = 0
    this._playing = false
  }

  seekTo(s: number): void {
    this.audio.currentTime = s
  }

  getCurrentTime(): number {
    return this.audio.currentTime
  }

  getDuration(): number {
    return isFinite(this.audio.duration) ? this.audio.duration : 0
  }

  setVolume(v: number): void {
    this.audio.volume = Math.max(0, Math.min(1, v))
  }

  unmute(): void {
    this.audio.muted = false
  }

  isPlaying(): boolean {
    return this._playing && !this.audio.paused
  }

  isReady(): boolean {
    return this._ready || this.audio.readyState >= 3
  }

  destroy(): void {
    this.audio.pause()
    this.audio.src = ''
    this._playing = false
  }
}

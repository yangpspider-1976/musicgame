export interface PlayableMusicController {
  sourceType: 'local_upload' | 'youtube_link' | 'licensed_catalog'
  load(): Promise<void>
  play(): Promise<void> | void
  pause(): void
  seekTo(seconds: number): void
  getCurrentTime(): number
  getDuration?(): number | undefined
  isReady(): boolean
  destroy?(): void
}

export class LocalAudioController implements PlayableMusicController {
  sourceType = 'local_upload' as const
  private audio: HTMLAudioElement
  private _ready = false

  constructor(objectUrl: string) {
    this.audio = new Audio(objectUrl)
    this.audio.preload = 'auto'
  }

  async load(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.audio.addEventListener('canplaythrough', () => { this._ready = true; resolve() }, { once: true })
      this.audio.addEventListener('error', reject, { once: true })
      this.audio.load()
    })
  }

  play() { return this.audio.play() }
  pause() { this.audio.pause() }
  seekTo(s: number) { this.audio.currentTime = s }
  getCurrentTime() { return this.audio.currentTime }
  getDuration() { return this.audio.duration || undefined }
  isReady() { return this._ready }
  destroy() { this.audio.pause(); this.audio.src = '' }
}

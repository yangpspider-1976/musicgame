export interface RecordingOptions {
  canvas: HTMLCanvasElement
  mimeType?: string
  videoBitsPerSecond?: number
}

export class GameplayRecorder {
  private mediaRecorder: MediaRecorder | null = null
  private chunks: Blob[] = []
  private stream: MediaStream | null = null

  start(options: RecordingOptions): void {
    const { canvas, videoBitsPerSecond = 2_500_000 } = options

    const mimeType = getSupportedMimeType(options.mimeType)
    this.stream = canvas.captureStream(30)
    this.chunks = []

    this.mediaRecorder = new MediaRecorder(this.stream, {
      mimeType,
      videoBitsPerSecond,
    })

    this.mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) this.chunks.push(e.data)
    }

    this.mediaRecorder.start(100) // 100ms timeslice
  }

  stop(): Promise<Blob> {
    return new Promise((resolve, reject) => {
      if (!this.mediaRecorder) {
        reject(new Error('MediaRecorder not started'))
        return
      }

      const stream = this.stream
      this.mediaRecorder.onstop = () => {
        stream?.getTracks().forEach((t) => t.stop())
        const mimeType = this.mediaRecorder?.mimeType ?? 'video/webm'
        const blob = new Blob(this.chunks, { type: mimeType })
        resolve(blob)
      }

      this.mediaRecorder.stop()
    })
  }

  isRecording(): boolean {
    return this.mediaRecorder?.state === 'recording'
  }
}

function getSupportedMimeType(preferred?: string): string {
  const candidates = [
    preferred,
    'video/webm;codecs=vp9',
    'video/webm;codecs=vp8',
    'video/webm',
    'video/mp4',
  ].filter(Boolean) as string[]

  for (const mime of candidates) {
    if (MediaRecorder.isTypeSupported(mime)) return mime
  }
  return 'video/webm'
}

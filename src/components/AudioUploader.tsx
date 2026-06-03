import { useRef, useState } from 'react'
import { analyzeAudio } from '../features/audio/analyzeAudio'
import type { AudioAnalysisResult, LocalUploadSource } from '../types'

interface Props {
  onSourceReady: (source: LocalUploadSource, analysis: AudioAnalysisResult) => void
}

const ACCEPTED = '.mp3,.wav,.m4a,audio/*'

export function AudioUploader({ onSourceReady }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fileName, setFileName] = useState<string | null>(null)
  const [dragging, setDragging] = useState(false)

  const handleFile = async (file: File) => {
    setError(null)
    setFileName(file.name)
    setAnalyzing(true)

    try {
      const analysis = await analyzeAudio(file)
      const objectUrl = URL.createObjectURL(file)
      const source: LocalUploadSource = {
        type: 'local_upload',
        file,
        objectUrl,
        fileName: file.name,
        duration: analysis.duration,
      }
      onSourceReady(source, analysis)
    } catch (err) {
      setError(`Failed to analyze audio: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setAnalyzing(false)
    }
  }

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
  }

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files?.[0]
    if (file && file.type.startsWith('audio/')) handleFile(file)
  }

  return (
    <div className="space-y-4">
      <div
        className={`
          relative border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer
          transition-all duration-200
          ${dragging
            ? 'border-neon-purple bg-purple-900/20'
            : 'border-slate-700 hover:border-neon-purple/60 hover:bg-dark-700/50'
          }
        `}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
      >
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED}
          className="hidden"
          onChange={onInputChange}
        />

        {analyzing ? (
          <div className="space-y-3">
            <div className="w-12 h-12 mx-auto border-4 border-neon-purple border-t-transparent rounded-full animate-spin" />
            <p className="text-slate-300">Analyzing audio...</p>
            <p className="text-slate-500 text-sm">{fileName}</p>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="text-5xl">🎵</div>
            <p className="text-slate-200 font-semibold">
              {fileName ?? 'Drop audio file here'}
            </p>
            <p className="text-slate-500 text-sm">MP3, WAV, M4A — tap to browse</p>
          </div>
        )}
      </div>

      {error && (
        <div className="bg-red-900/30 border border-red-700 rounded-xl p-3 text-red-400 text-sm">
          {error}
        </div>
      )}
    </div>
  )
}

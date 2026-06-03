# AI Rhythm Gesture Game

A mobile-first PWA web game where you follow gesture prompts in sync with music using your camera.

## Features

- Upload audio (MP3/WAV/M4A) or use YouTube links for rhythm
- AI-powered BPM detection and beat grid generation
- Real-time pose detection via MediaPipe
- Score gestures with timing accuracy (Perfect/Good/Miss)
- Export 9:16 vertical result video

## Setup

```bash
pnpm install
cp .env.example .env
# Add your YouTube Data API v3 key to .env (optional, for YouTube metadata)
pnpm dev
```

## YouTube API Key

Get a free key at https://console.cloud.google.com/ — enable "YouTube Data API v3".

Set `VITE_YOUTUBE_API_KEY=your_key` in `.env`.

## Legal Notice

This app uses the official YouTube IFrame Player API for playback. It does not download or extract YouTube audio. Only share music you own or have permission to use.

## Tech Stack

- Vite + React + TypeScript
- Tailwind CSS
- Zustand
- Web Audio API (beat detection)
- MediaPipe Pose (CDN)
- YouTube IFrame Player API
- MediaRecorder + Canvas API

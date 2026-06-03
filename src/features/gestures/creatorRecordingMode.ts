import type { BeatMarker, GestureId, GesturePrompt, PoseFrame } from '../../types'
import type { PlayableMusicController } from '../music/musicController'

export interface RecordedFrame {
  poseFrame: PoseFrame
  musicTime: number // seconds
}

export class CreatorRecordingMode {
  private recording = false
  private frames: RecordedFrame[] = []
  private musicController: PlayableMusicController | null = null

  startRecording(musicController: PlayableMusicController): void {
    this.musicController = musicController
    this.frames = []
    this.recording = true
  }

  recordFrame(poseFrame: PoseFrame): void {
    if (!this.recording || !this.musicController) return
    const musicTime = this.musicController.getCurrentTime()
    this.frames.push({ poseFrame, musicTime })
  }

  stopRecording(): RecordedFrame[] {
    this.recording = false
    return [...this.frames]
  }

  isRecording(): boolean {
    return this.recording
  }

  /**
   * Convert recorded movement frames to GesturePrompt[].
   * Uses movement intensity at beat times to assign gesture IDs.
   */
  convertToGestureMap(
    frames: RecordedFrame[],
    beatTimes: BeatMarker[],
  ): GesturePrompt[] {
    const prompts: GesturePrompt[] = []
    const GESTURE_SEQUENCE: GestureId[] = [
      'LEFT_HAND_UP', 'RIGHT_HAND_UP', 'BOTH_HANDS_UP',
      'LEFT_PUNCH', 'RIGHT_PUNCH', 'FREEZE_POSE',
    ]
    let gestureIdx = 0
    let idCounter = 0

    for (let i = 0; i < beatTimes.length; i++) {
      const beat = beatTimes[i]
      const nextBeat = beatTimes[i + 1]
      if (!nextBeat) continue

      // Find frames within this beat window
      const beatFrames = frames.filter(
        (f) => f.musicTime >= beat.time && f.musicTime < nextBeat.time,
      )

      // Check if there was significant movement in this beat
      const hasMovement = beatFrames.length > 0
      if (!hasMovement) continue

      const gestureId = GESTURE_SEQUENCE[gestureIdx % GESTURE_SEQUENCE.length]
      gestureIdx++

      prompts.push({
        id: `creator_${Date.now()}_${idCounter++}`,
        gestureId,
        beatIndex: beat.index,
        startTime: beat.time,
        endTime: nextBeat.time,
        windowMs: (nextBeat.time - beat.time) * 1000,
      })
    }

    return prompts
  }
}

export const creatorRecordingMode = new CreatorRecordingMode()

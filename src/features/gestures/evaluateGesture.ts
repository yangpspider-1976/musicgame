import type { GestureId, PoseFrame } from '../../types'
import { GESTURE_MAP } from './gestureDefinitions'

export interface EvaluationResult {
  detected: boolean
  accuracy: number  // 0-1
}

/**
 * Evaluate whether a gesture is being performed in the given pose frame.
 */
export function evaluateGesture(
  gestureId: GestureId,
  frame: PoseFrame,
  prevFrames?: PoseFrame[],
): EvaluationResult {
  const def = GESTURE_MAP[gestureId]
  if (!def) return { detected: false, accuracy: 0 }

  const detected = def.evaluate(frame, prevFrames)
  // Accuracy is binary for now; could be made continuous with landmark confidence
  const avgVisibility = frame.landmarks.slice(0, 25).reduce(
    (sum, lm) => sum + (lm.visibility ?? 1),
    0,
  ) / 25

  return {
    detected,
    accuracy: detected ? Math.max(0.5, avgVisibility) : 0,
  }
}

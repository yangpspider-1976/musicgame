import type { GestureDefinition, PoseFrame, Landmark } from '../../types'

// MediaPipe Pose landmark indices
const LM = {
  NOSE: 0,
  LEFT_SHOULDER: 11,
  RIGHT_SHOULDER: 12,
  LEFT_ELBOW: 13,
  RIGHT_ELBOW: 14,
  LEFT_WRIST: 15,
  RIGHT_WRIST: 16,
  LEFT_HIP: 23,
  RIGHT_HIP: 24,
} as const

function lm(frame: PoseFrame, idx: number): Landmark {
  return frame.landmarks[idx] ?? { x: 0.5, y: 0.5, z: 0, visibility: 0 }
}

function midpoint(a: Landmark, b: Landmark) {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
}

function dist(a: { x: number; y: number }, b: { x: number; y: number }) {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2)
}

export const GESTURE_DEFINITIONS: GestureDefinition[] = [
  {
    id: 'LEFT_HAND_UP',
    name: 'Left Hand Up',
    emoji: '🤚',
    description: 'Raise your left hand above your shoulder',
    evaluate: (frame) => {
      const wrist = lm(frame, LM.LEFT_WRIST)
      const shoulder = lm(frame, LM.LEFT_SHOULDER)
      // In normalized coords, y increases downward, so wrist.y < shoulder.y means wrist is higher
      return wrist.y < shoulder.y
    },
  },
  {
    id: 'RIGHT_HAND_UP',
    name: 'Right Hand Up',
    emoji: '✋',
    description: 'Raise your right hand above your shoulder',
    evaluate: (frame) => {
      const wrist = lm(frame, LM.RIGHT_WRIST)
      const shoulder = lm(frame, LM.RIGHT_SHOULDER)
      return wrist.y < shoulder.y
    },
  },
  {
    id: 'BOTH_HANDS_UP',
    name: 'Both Hands Up',
    emoji: '🙌',
    description: 'Raise both hands above your shoulders',
    evaluate: (frame) => {
      const lw = lm(frame, LM.LEFT_WRIST)
      const rw = lm(frame, LM.RIGHT_WRIST)
      const ls = lm(frame, LM.LEFT_SHOULDER)
      const rs = lm(frame, LM.RIGHT_SHOULDER)
      return lw.y < ls.y && rw.y < rs.y
    },
  },
  {
    id: 'LEFT_PUNCH',
    name: 'Left Punch',
    emoji: '👊',
    description: 'Punch to the left side',
    evaluate: (frame) => {
      const wrist = lm(frame, LM.LEFT_WRIST)
      const shoulder = lm(frame, LM.LEFT_SHOULDER)
      // In normalized coords, left is smaller x (camera is mirrored in display but landmarks use image coords)
      return wrist.x < shoulder.x - 0.1
    },
  },
  {
    id: 'RIGHT_PUNCH',
    name: 'Right Punch',
    emoji: '🤜',
    description: 'Punch to the right side',
    evaluate: (frame) => {
      const wrist = lm(frame, LM.RIGHT_WRIST)
      const shoulder = lm(frame, LM.RIGHT_SHOULDER)
      return wrist.x > shoulder.x + 0.1
    },
  },
  {
    id: 'HANDS_CROSS',
    name: 'Hands Cross',
    emoji: '✖️',
    description: 'Cross your hands in front of your chest',
    evaluate: (frame) => {
      const lw = lm(frame, LM.LEFT_WRIST)
      const rw = lm(frame, LM.RIGHT_WRIST)
      const ls = lm(frame, LM.LEFT_SHOULDER)
      const rs = lm(frame, LM.RIGHT_SHOULDER)
      const chest = midpoint(ls, rs)
      // Wrists close together
      const wristDist = Math.abs(lw.x - rw.x)
      // Wrists near chest height
      const avgWristY = (lw.y + rw.y) / 2
      const nearChest = Math.abs(avgWristY - chest.y) < 0.15
      return wristDist < 0.1 && nearChest
    },
  },
  {
    id: 'HEART_POSE',
    name: 'Heart Pose',
    emoji: '❤️',
    description: 'Make a heart shape with both hands near your chest',
    evaluate: (frame) => {
      const lw = lm(frame, LM.LEFT_WRIST)
      const rw = lm(frame, LM.RIGHT_WRIST)
      const ls = lm(frame, LM.LEFT_SHOULDER)
      const rs = lm(frame, LM.RIGHT_SHOULDER)
      const chest = midpoint(ls, rs)
      const wristDist = dist(lw, rw)
      const avgWristY = (lw.y + rw.y) / 2
      // Wrists close together and above chest (upper chest area)
      const aboveChest = avgWristY < chest.y + 0.1 && avgWristY > chest.y - 0.2
      return wristDist < 0.15 && aboveChest
    },
  },
  {
    id: 'SIDE_LEAN_LEFT',
    name: 'Side Lean Left',
    emoji: '⬅️',
    description: 'Lean your body to the left',
    evaluate: (frame) => {
      const nose = lm(frame, LM.NOSE)
      const ls = lm(frame, LM.LEFT_SHOULDER)
      const rs = lm(frame, LM.RIGHT_SHOULDER)
      const mid = midpoint(ls, rs)
      return nose.x < mid.x - 0.05
    },
  },
  {
    id: 'SIDE_LEAN_RIGHT',
    name: 'Side Lean Right',
    emoji: '➡️',
    description: 'Lean your body to the right',
    evaluate: (frame) => {
      const nose = lm(frame, LM.NOSE)
      const ls = lm(frame, LM.LEFT_SHOULDER)
      const rs = lm(frame, LM.RIGHT_SHOULDER)
      const mid = midpoint(ls, rs)
      return nose.x > mid.x + 0.05
    },
  },
  {
    id: 'FREEZE_POSE',
    name: 'Freeze!',
    emoji: '🧊',
    description: 'Hold completely still',
    evaluate: (frame, prevFrames) => {
      if (!prevFrames || prevFrames.length < 3) return false
      // Check if frame is marked frozen (set by pose detector)
      if (frame.frozen) return true
      // Fallback: check movement of key landmarks vs recent frames
      const recentFrame = prevFrames[prevFrames.length - 1]
      const keyLandmarks = [LM.NOSE, LM.LEFT_WRIST, LM.RIGHT_WRIST, LM.LEFT_SHOULDER, LM.RIGHT_SHOULDER]
      let totalMovement = 0
      for (const idx of keyLandmarks) {
        const cur = lm(frame, idx)
        const prev = lm(recentFrame, idx)
        totalMovement += dist(cur, prev)
      }
      return totalMovement < 0.05
    },
  },
]

export const GESTURE_MAP = Object.fromEntries(
  GESTURE_DEFINITIONS.map((g) => [g.id, g]),
) as Record<string, GestureDefinition>

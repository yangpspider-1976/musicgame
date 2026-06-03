/**
 * Target pose landmark positions for each gesture.
 * Coordinates are normalized (0-1), in image space (x: left=0, right=1; y: top=0, bottom=1).
 * Canvas is CSS-mirrored (scale-x-[-1]), so these are drawn correctly as a mirror reflection.
 */

export interface PoseLandmarks {
  nose: [number, number]
  leftShoulder: [number, number]
  rightShoulder: [number, number]
  leftElbow: [number, number]
  rightElbow: [number, number]
  leftWrist: [number, number]
  rightWrist: [number, number]
  leftHip: [number, number]
  rightHip: [number, number]
}

// Neutral standing pose (baseline)
const NEUTRAL: PoseLandmarks = {
  nose:          [0.50, 0.12],
  leftShoulder:  [0.37, 0.32],
  rightShoulder: [0.63, 0.32],
  leftElbow:     [0.27, 0.50],
  rightElbow:    [0.73, 0.50],
  leftWrist:     [0.22, 0.65],
  rightWrist:    [0.78, 0.65],
  leftHip:       [0.40, 0.63],
  rightHip:      [0.60, 0.63],
}

export const GESTURE_POSES: Record<string, PoseLandmarks> = {
  LEFT_HAND_UP: {
    ...NEUTRAL,
    leftElbow:  [0.32, 0.22],
    leftWrist:  [0.30, 0.06],
  },
  RIGHT_HAND_UP: {
    ...NEUTRAL,
    rightElbow: [0.68, 0.22],
    rightWrist: [0.70, 0.06],
  },
  BOTH_HANDS_UP: {
    ...NEUTRAL,
    leftElbow:  [0.32, 0.20],
    leftWrist:  [0.30, 0.05],
    rightElbow: [0.68, 0.20],
    rightWrist: [0.70, 0.05],
  },
  LEFT_PUNCH: {
    ...NEUTRAL,
    leftElbow:  [0.20, 0.38],
    leftWrist:  [0.06, 0.38],
  },
  RIGHT_PUNCH: {
    ...NEUTRAL,
    rightElbow: [0.80, 0.38],
    rightWrist: [0.94, 0.38],
  },
  HANDS_CROSS: {
    ...NEUTRAL,
    leftElbow:  [0.44, 0.40],
    leftWrist:  [0.53, 0.45],
    rightElbow: [0.56, 0.40],
    rightWrist: [0.47, 0.45],
  },
  HEART_POSE: {
    ...NEUTRAL,
    leftElbow:  [0.40, 0.38],
    leftWrist:  [0.45, 0.26],
    rightElbow: [0.60, 0.38],
    rightWrist: [0.55, 0.26],
  },
  SIDE_LEAN_LEFT: {
    nose:          [0.37, 0.12],
    leftShoulder:  [0.24, 0.32],
    rightShoulder: [0.52, 0.32],
    leftElbow:     [0.16, 0.50],
    rightElbow:    [0.62, 0.48],
    leftWrist:     [0.12, 0.64],
    rightWrist:    [0.70, 0.62],
    leftHip:       [0.28, 0.62],
    rightHip:      [0.52, 0.60],
  },
  SIDE_LEAN_RIGHT: {
    nose:          [0.63, 0.12],
    leftShoulder:  [0.48, 0.32],
    rightShoulder: [0.76, 0.32],
    leftElbow:     [0.38, 0.48],
    rightElbow:    [0.84, 0.50],
    leftWrist:     [0.30, 0.62],
    rightWrist:    [0.88, 0.64],
    leftHip:       [0.48, 0.60],
    rightHip:      [0.72, 0.62],
  },
  FREEZE_POSE: {
    ...NEUTRAL,
    leftElbow:  [0.28, 0.46],
    leftWrist:  [0.22, 0.58],
    rightElbow: [0.72, 0.46],
    rightWrist: [0.78, 0.58],
  },
}

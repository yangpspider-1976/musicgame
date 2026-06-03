import type { Challenge } from '../../types'

const STORAGE_KEY = 'rhythm_game_challenges'

export function saveChallenges(challenges: Challenge[]): void {
  try {
    // Store without File objects (they can't be serialized)
    const serializable = challenges.map((c) => ({
      ...c,
      source:
        c.source.type === 'local_upload'
          ? { ...c.source, file: null, objectUrl: '' }
          : c.source,
    }))
    localStorage.setItem(STORAGE_KEY, JSON.stringify(serializable))
  } catch {
    // localStorage may be full
  }
}

export function loadChallenges(): Challenge[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    return JSON.parse(raw) as Challenge[]
  } catch {
    return []
  }
}

export function saveChallenge(challenge: Challenge): void {
  const all = loadChallenges()
  const idx = all.findIndex((c) => c.id === challenge.id)
  if (idx >= 0) {
    all[idx] = challenge
  } else {
    all.push(challenge)
  }
  saveChallenges(all)
}

export function deleteChallenge(id: string): void {
  const all = loadChallenges().filter((c) => c.id !== id)
  saveChallenges(all)
}

export function generateChallengeId(): string {
  return `challenge_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

import type { RankingEntry } from '../../types'

const STORAGE_KEY = 'rhythm_game_rankings'
const MAX_ENTRIES = 100

export function saveRankingEntry(entry: RankingEntry): void {
  const all = loadRankings()
  all.push(entry)
  // Keep only top MAX_ENTRIES by score
  all.sort((a, b) => b.score - a.score)
  const trimmed = all.slice(0, MAX_ENTRIES)
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed))
  } catch {
    // ignore
  }
}

export function loadRankings(): RankingEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    return JSON.parse(raw) as RankingEntry[]
  } catch {
    return []
  }
}

export function getRankingsForChallenge(challengeId: string): RankingEntry[] {
  return loadRankings()
    .filter((r) => r.challengeId === challengeId)
    .sort((a, b) => b.score - a.score)
}

export function clearRankings(): void {
  localStorage.removeItem(STORAGE_KEY)
}

export function generateRankingId(): string {
  return `ranking_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

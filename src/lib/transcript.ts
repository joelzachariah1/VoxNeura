import type { Reliability } from './reliability.ts'
import { toCsv } from './download.ts'

export type LogEntry = {
  id: string
  at: string
  token: string
  reliability: Reliability
  choiceCount: number
  confidence: number
  neededConfirmation: boolean
  matchedRow: number | null
}

type SavedInterface = {
  version: 1
  state: Reliability
  matchedRow: number | null
  confidence: number
  speech: boolean
  log: LogEntry[]
}

const STORAGE_KEY = 'voxneura.interface.v1'
const LEVELS: readonly Reliability[] = ['high', 'medium', 'low']

function isEntry(value: unknown): value is LogEntry {
  if (!value || typeof value !== 'object') return false
  const entry = value as Record<string, unknown>
  return (
    typeof entry.id === 'string' &&
    typeof entry.at === 'string' &&
    typeof entry.token === 'string' &&
    typeof entry.reliability === 'string' &&
    LEVELS.includes(entry.reliability as Reliability) &&
    typeof entry.choiceCount === 'number' &&
    typeof entry.confidence === 'number' &&
    typeof entry.neededConfirmation === 'boolean' &&
    (entry.matchedRow === null || typeof entry.matchedRow === 'number')
  )
}

export function loadInterface(): SavedInterface {
  const fallback: SavedInterface = {
    version: 1,
    state: 'high',
    matchedRow: null,
    confidence: 80,
    speech: false,
    log: [],
  }
  if (typeof localStorage === 'undefined') return fallback
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return fallback
    const parsed: unknown = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return fallback
    const saved = parsed as Partial<SavedInterface>
    return {
      version: 1,
      state: LEVELS.includes(saved.state as Reliability) ? (saved.state as Reliability) : 'high',
      matchedRow: typeof saved.matchedRow === 'number' ? saved.matchedRow : null,
      confidence:
        typeof saved.confidence === 'number'
          ? Math.min(100, Math.max(0, saved.confidence))
          : 80,
      speech: saved.speech === true,
      log: Array.isArray(saved.log) ? saved.log.filter(isEntry) : [],
    }
  } catch {
    return fallback
  }
}

export function saveInterface(saved: SavedInterface): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(saved))
  } catch {
    // The transcript remains on screen if storage is unavailable.
  }
}

export function transcriptToCsv(log: LogEntry[]): string {
  return toCsv(
    [
      'at',
      'token',
      'reliability',
      'choice_count',
      'confidence',
      'needed_confirmation',
      'matched_row',
      'rule',
      'data_source',
    ],
    log.map((entry) => [
      entry.at,
      entry.token,
      entry.reliability,
      entry.choiceCount,
      entry.confidence,
      entry.neededConfirmation ? 'true' : 'false',
      entry.matchedRow,
      entry.matchedRow === null ? 'manual' : 'variability-tertiles-v1',
      'interface-demonstration',
    ]),
  )
}

export function canSpeak(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window
}

export function speak(text: string): boolean {
  if (!canSpeak()) return false
  window.speechSynthesis.cancel()
  const utterance = new SpeechSynthesisUtterance(text)
  utterance.rate = 0.92
  window.speechSynthesis.speak(utterance)
  return true
}

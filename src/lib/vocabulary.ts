import type { Reliability } from './reliability.ts'

export const ESSENTIAL = ['YES', 'NO', 'HELP', 'RETRY'] as const
export const MEDIUM_EXTRA = ['STOP', 'PAIN', 'WATER', 'OK'] as const
export const HIGH_EXTRA = ['HUNGRY', 'TIRED', 'BATHROOM', 'COLD', 'HOT', 'CALL', 'WAIT', 'AGAIN'] as const

export const VOCAB: Record<Reliability, readonly string[]> = {
  low: ESSENTIAL,
  medium: [...ESSENTIAL, ...MEDIUM_EXTRA],
  high: [...ESSENTIAL, ...MEDIUM_EXTRA, ...HIGH_EXTRA],
}

export function reliabilityLabel(state: Reliability): string {
  if (state === 'high') return 'High'
  if (state === 'medium') return 'Medium'
  return 'Low'
}

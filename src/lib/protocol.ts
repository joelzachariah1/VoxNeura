import type { Reliability } from './reliability.ts'
import { ESSENTIAL, VOCAB } from './vocabulary.ts'

export type ScenarioId = 'held-high' | 'step-down' | 'held-low'
export type Policy = 'fixed' | 'adaptive'
export type TargetPool = 'essential' | 'full'

export const SCENARIO_IDS: readonly ScenarioId[] = ['held-high', 'step-down', 'held-low']
export const POLICIES: readonly Policy[] = ['fixed', 'adaptive']

export const STEP_TO_MEDIUM_MS = 5000
export const STEP_TO_LOW_MS = 10000
export const TRIAL_LIMIT_MS = 30000
export const PAIRED_SEQUENCE_LENGTH = 8

/** Demonstration cutoff. Confirmation is required strictly below this value. */
export const CONFIRM_BELOW = 70

export function needsConfirmation(confidence: number): boolean {
  return confidence < CONFIRM_BELOW
}

export function scenarioName(id: ScenarioId): string {
  if (id === 'held-high') return 'Held high'
  if (id === 'step-down') return 'Step down'
  return 'Held low'
}

export function policyName(policy: Policy): string {
  return policy === 'fixed' ? 'Fixed' : 'Adaptive'
}

export function stateAt(scenario: ScenarioId, elapsedMs: number): Reliability {
  if (scenario === 'held-high') return 'high'
  if (scenario === 'held-low') return 'low'
  if (elapsedMs < STEP_TO_MEDIUM_MS) return 'high'
  if (elapsedMs < STEP_TO_LOW_MS) return 'medium'
  return 'low'
}

export function choicesFor(policy: Policy, state: Reliability): readonly string[] {
  return policy === 'fixed' ? VOCAB.high : VOCAB[state]
}

export function phrasesForPool(pool: TargetPool): readonly string[] {
  return pool === 'full' ? VOCAB.high : ESSENTIAL
}

export function drawTargetFrom(pool: readonly string[], random: () => number = Math.random): string {
  if (pool.length === 0) throw new Error('Target pool is empty.')
  const index = Math.floor(random() * pool.length)
  const token = pool[index]
  if (!token) throw new Error('Target draw failed.')
  return token
}

export function drawTarget(): string {
  return drawTargetFrom(ESSENTIAL)
}

export function drawSequence(
  pool: readonly string[],
  count: number,
  random: () => number = Math.random,
): string[] {
  if (!Number.isInteger(count) || count < 1) throw new Error('Sequence length must be a positive integer.')
  return Array.from({ length: count }, () => drawTargetFrom(pool, random))
}

export function targetOnBoard(target: string, choices: readonly string[]): boolean {
  return choices.includes(target)
}

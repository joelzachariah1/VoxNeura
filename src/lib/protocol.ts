import type { Reliability } from './reliability.ts'
import { ESSENTIAL, VOCAB } from './vocabulary.ts'

export type ScenarioId = 'held-high' | 'step-down' | 'held-low'
export type Policy = 'fixed' | 'adaptive'

export const SCENARIO_IDS: readonly ScenarioId[] = ['held-high', 'step-down', 'held-low']
export const POLICIES: readonly Policy[] = ['fixed', 'adaptive']

export const STEP_TO_MEDIUM_MS = 5000
export const STEP_TO_LOW_MS = 10000
export const TRIAL_LIMIT_MS = 30000

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

export function drawTarget(): string {
  const index = Math.floor(Math.random() * ESSENTIAL.length)
  const token = ESSENTIAL[index]
  if (!token) throw new Error('Target draw failed.')
  return token
}

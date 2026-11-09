import { mean, median } from './stats.ts'
import type { Policy, ScenarioId } from './protocol.ts'
import { policyName, scenarioName } from './protocol.ts'
import type { Reliability } from './reliability.ts'
import { toCsv } from './download.ts'

export type EndedBy = 'selection' | 'timeout' | 'stopped'

export type TrialRecord = {
  id: string
  startedAt: string
  scenario: ScenarioId
  policy: Policy
  target: string
  selection: string | null
  correct: boolean | null
  rtMs: number | null
  choiceCount: number | null
  reliability: Reliability | null
  endedBy: EndedBy
}

export type GroupSummary = {
  key: string
  trials: number
  selections: number
  correct: number
  incorrect: number
  timeouts: number
  stopped: number
  medianRtMs: number | null
  meanRtMs: number | null
}

const STORAGE_KEY = 'voxneura.trials.v1'
const SCENARIOS: readonly ScenarioId[] = ['held-high', 'step-down', 'held-low']
const POLICIES: readonly Policy[] = ['fixed', 'adaptive']
const ENDINGS: readonly EndedBy[] = ['selection', 'timeout', 'stopped']
const LEVELS: readonly Reliability[] = ['high', 'medium', 'low']

function isTrial(value: unknown): value is TrialRecord {
  if (!value || typeof value !== 'object') return false
  const trial = value as Record<string, unknown>
  return (
    typeof trial.id === 'string' &&
    typeof trial.startedAt === 'string' &&
    typeof trial.scenario === 'string' &&
    SCENARIOS.includes(trial.scenario as ScenarioId) &&
    typeof trial.policy === 'string' &&
    POLICIES.includes(trial.policy as Policy) &&
    typeof trial.target === 'string' &&
    (trial.selection === null || typeof trial.selection === 'string') &&
    (trial.correct === null || typeof trial.correct === 'boolean') &&
    (trial.rtMs === null || typeof trial.rtMs === 'number') &&
    (trial.choiceCount === null || typeof trial.choiceCount === 'number') &&
    (trial.reliability === null ||
      (typeof trial.reliability === 'string' && LEVELS.includes(trial.reliability as Reliability))) &&
    typeof trial.endedBy === 'string' &&
    ENDINGS.includes(trial.endedBy as EndedBy)
  )
}

export function loadTrials(): TrialRecord[] {
  if (typeof localStorage === 'undefined') return []
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object' || !('trials' in parsed)) return []
    const trials = (parsed as { trials: unknown }).trials
    if (!Array.isArray(trials)) return []
    return trials.filter(isTrial)
  } catch {
    return []
  }
}

export function saveTrials(trials: TrialRecord[]): boolean {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, trials }))
    return true
  } catch {
    return false
  }
}

export function summarizeGroup(trials: TrialRecord[], key: string): GroupSummary {
  const selections = trials.filter((trial) => trial.endedBy === 'selection' && trial.rtMs !== null)
  const times = selections.map((trial) => trial.rtMs as number)
  const correct = selections.filter((trial) => trial.correct === true).length
  return {
    key,
    trials: trials.length,
    selections: selections.length,
    correct,
    incorrect: selections.length - correct,
    timeouts: trials.filter((trial) => trial.endedBy === 'timeout').length,
    stopped: trials.filter((trial) => trial.endedBy === 'stopped').length,
    medianRtMs: median(times),
    meanRtMs: times.length ? mean(times) : null,
  }
}

export function summaryRows(trials: TrialRecord[]): GroupSummary[] {
  const rows: GroupSummary[] = [summarizeGroup(trials, 'All recorded trials')]
  for (const policy of POLICIES) {
    rows.push(summarizeGroup(trials.filter((trial) => trial.policy === policy), policyName(policy)))
  }
  for (const scenario of SCENARIOS) {
    for (const policy of POLICIES) {
      rows.push(
        summarizeGroup(
          trials.filter((trial) => trial.scenario === scenario && trial.policy === policy),
          `${scenarioName(scenario)}, ${policyName(policy).toLowerCase()}`,
        ),
      )
    }
  }
  for (const level of LEVELS) {
    rows.push(
      summarizeGroup(
        trials.filter((trial) => trial.reliability === level),
        `Demonstration state: ${level}`,
      ),
    )
  }
  return rows
}

export function trialsToCsv(trials: TrialRecord[]): string {
  return toCsv(
    [
      'id',
      'started_at',
      'scenario',
      'policy',
      'target',
      'selection',
      'correct',
      'rt_ms',
      'visible_choices_at_selection',
      'demonstration_state_at_selection',
      'ended_by',
      'data_source',
    ],
    trials.map((trial) => [
      trial.id,
      trial.startedAt,
      trial.scenario,
      trial.policy,
      trial.target,
      trial.selection,
      trial.correct === null ? '' : trial.correct ? 'true' : 'false',
      trial.rtMs,
      trial.choiceCount,
      trial.reliability,
      trial.endedBy,
      'browser-demonstration',
    ]),
  )
}

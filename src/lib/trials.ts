import { mean, median } from './stats.ts'
import type { Policy, ScenarioId, TargetPool } from './protocol.ts'
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
  durationMs?: number | null
  targetPool?: TargetPool | null
  targetOnBoard?: boolean | null
  visibleChoicesAtEnd?: number | null
  pairId?: string | null
  sequenceIndex?: number | null
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
    ENDINGS.includes(trial.endedBy as EndedBy) &&
    (trial.durationMs === undefined || trial.durationMs === null || typeof trial.durationMs === 'number') &&
    (trial.targetPool === undefined ||
      trial.targetPool === null ||
      trial.targetPool === 'essential' ||
      trial.targetPool === 'full') &&
    (trial.targetOnBoard === undefined || trial.targetOnBoard === null || typeof trial.targetOnBoard === 'boolean') &&
    (trial.visibleChoicesAtEnd === undefined ||
      trial.visibleChoicesAtEnd === null ||
      typeof trial.visibleChoicesAtEnd === 'number') &&
    (trial.pairId === undefined || trial.pairId === null || typeof trial.pairId === 'string') &&
    (trial.sequenceIndex === undefined || trial.sequenceIndex === null || typeof trial.sequenceIndex === 'number')
  )
}

function withDefaults(trial: TrialRecord): TrialRecord {
  return {
    ...trial,
    durationMs: typeof trial.durationMs === 'number' ? trial.durationMs : null,
    targetPool: trial.targetPool === 'essential' || trial.targetPool === 'full' ? trial.targetPool : null,
    targetOnBoard: typeof trial.targetOnBoard === 'boolean' ? trial.targetOnBoard : null,
    visibleChoicesAtEnd: typeof trial.visibleChoicesAtEnd === 'number' ? trial.visibleChoicesAtEnd : null,
    pairId: typeof trial.pairId === 'string' ? trial.pairId : null,
    sequenceIndex: typeof trial.sequenceIndex === 'number' ? trial.sequenceIndex : null,
  }
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
    return trials.filter(isTrial).map(withDefaults)
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

export type OutcomeMeasures = {
  key: string
  trials: number
  accuracy: number | null
  medianRtMs: number | null
  meanRtMs: number | null
  timeoutRate: number | null
  errorRate: number | null
  correctPerMinute: number | null
  targetsHidden: number | null
}

function grouped(trials: TrialRecord[]): { key: string; trials: TrialRecord[] }[] {
  const rows: { key: string; trials: TrialRecord[] }[] = [{ key: 'All recorded trials', trials }]
  for (const policy of POLICIES) {
    rows.push({ key: policyName(policy), trials: trials.filter((trial) => trial.policy === policy) })
  }
  for (const scenario of SCENARIOS) {
    for (const policy of POLICIES) {
      rows.push({
        key: `${scenarioName(scenario)}, ${policyName(policy).toLowerCase()}`,
        trials: trials.filter((trial) => trial.scenario === scenario && trial.policy === policy),
      })
    }
  }
  for (const level of LEVELS) {
    rows.push({
      key: `Demonstration state: ${level}`,
      trials: trials.filter((trial) => trial.reliability === level),
    })
  }
  return rows
}

function outcomeFor(trials: TrialRecord[], key: string): OutcomeMeasures {
  const summary = summarizeGroup(trials, key)
  const durations = trials.map((trial) => trial.durationMs)
  const durationKnown = trials.length > 0 && durations.every((value) => typeof value === 'number')
  const totalMs = durationKnown ? durations.reduce<number>((sum, value) => sum + (value as number), 0) : 0
  const knownBoard = trials.filter((trial) => typeof trial.targetOnBoard === 'boolean')
  return {
    key,
    trials: summary.trials,
    accuracy: summary.selections > 0 ? summary.correct / summary.selections : null,
    medianRtMs: summary.medianRtMs,
    meanRtMs: summary.meanRtMs,
    timeoutRate: summary.trials > 0 ? summary.timeouts / summary.trials : null,
    errorRate: summary.selections > 0 ? summary.incorrect / summary.selections : null,
    correctPerMinute: durationKnown && totalMs > 0 ? summary.correct / (totalMs / 60000) : null,
    targetsHidden:
      knownBoard.length === 0 ? null : knownBoard.filter((trial) => trial.targetOnBoard === false).length,
  }
}

export function summaryRows(trials: TrialRecord[]): GroupSummary[] {
  return grouped(trials).map((group) => summarizeGroup(group.trials, group.key))
}

export function outcomeRows(trials: TrialRecord[]): OutcomeMeasures[] {
  return grouped(trials).map((group) => outcomeFor(group.trials, group.key))
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
      'visible_choices_at_end',
      'demonstration_state_at_selection',
      'target_on_board',
      'duration_ms',
      'target_pool',
      'pair_id',
      'sequence_index',
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
      trial.visibleChoicesAtEnd ?? null,
      trial.reliability,
      trial.targetOnBoard === null || trial.targetOnBoard === undefined ? '' : trial.targetOnBoard ? 'true' : 'false',
      trial.durationMs ?? null,
      trial.targetPool ?? null,
      trial.pairId ?? null,
      trial.sequenceIndex ?? null,
      trial.endedBy,
      'browser-demonstration',
    ]),
  )
}

import { useEffect, useRef, useState } from 'react'
import { Board } from '../components/Board.tsx'
import { Mark } from '../components/Mark.tsx'
import { PageHeader } from '../components/PageHeader.tsx'
import { usePageTitle } from '../components/usePageTitle.ts'
import { downloadCsv } from '../lib/download.ts'
import { formatMs, stamp, uid } from '../lib/format.ts'
import {
  PAIRED_SEQUENCE_LENGTH,
  POLICIES,
  SCENARIO_IDS,
  STEP_TO_LOW_MS,
  STEP_TO_MEDIUM_MS,
  TRIAL_LIMIT_MS,
  choicesFor,
  drawSequence,
  drawTargetFrom,
  phrasesForPool,
  policyName,
  scenarioName,
  stateAt,
  targetOnBoard,
} from '../lib/protocol.ts'
import type { Policy, ScenarioId, TargetPool } from '../lib/protocol.ts'
import { loadTrials, outcomeRows, saveTrials, summaryRows, trialsToCsv } from '../lib/trials.ts'
import type { EndedBy, TrialRecord } from '../lib/trials.ts'
import { VOCAB, demonstrationStatePhrase, reliabilityLabel } from '../lib/vocabulary.ts'

function monotonicNow(): number {
  return performance.now()
}

const SCHEDULE = [
  { label: '0 up to 5 s', ms: 0 },
  { label: '5 s up to 10 s', ms: STEP_TO_MEDIUM_MS },
  { label: '10 s and after', ms: STEP_TO_LOW_MS },
] as const

type Running = {
  id: string
  t0: number
  startedAt: string
  scenario: ScenarioId
  policy: Policy
  target: string
  targetPool: TargetPool
  record: boolean
  pairId: string | null
  sequenceIndex: number | null
}

type Pair = {
  id: string
  pool: TargetPool
  scenario: ScenarioId
  targets: string[]
  index: number
}

export function ExperimentsPage() {
  usePageTitle('Experiments')
  const [scenario, setScenario] = useState<ScenarioId>('step-down')
  const [policy, setPolicy] = useState<Policy>('adaptive')
  const [pool, setPool] = useState<TargetPool>('full')
  const [pair, setPair] = useState<Pair | null>(null)
  const [record, setRecord] = useState(true)
  const [trials, setTrials] = useState<TrialRecord[]>(() => loadTrials())
  const [running, setRunning] = useState<Running | null>(null)
  const [clock, setClock] = useState(0)
  const [lockedTarget, setLockedTarget] = useState<string | null>(null)
  const [lastRun, setLastRun] = useState<{ target: string; scenario: ScenarioId; policy: Policy } | null>(
    () => {
      const stored = loadTrials()
      const latest = stored.at(-1)
      return latest
        ? { target: latest.target, scenario: latest.scenario, policy: latest.policy }
        : null
    },
  )
  const [outcome, setOutcome] = useState('')
  const [armClear, setArmClear] = useState(false)
  const [storageError, setStorageError] = useState('')
  const finishedId = useRef<string | null>(null)
  const outcomeRef = useRef<HTMLParagraphElement>(null)
  const targetRef = useRef<HTMLParagraphElement>(null)
  const trialsRef = useRef(trials)
  const pairRef = useRef(pair)

  const activeScenario = running?.scenario ?? scenario
  const activePolicy = running?.policy ?? policy
  const elapsed = running ? clock : 0
  const reliability = stateAt(activeScenario, elapsed)
  const choices = choicesFor(activePolicy, reliability)

  function finish(trial: Running, endedBy: EndedBy, selection: string | null, elapsedMs: number) {
    if (finishedId.current === trial.id) return
    finishedId.current = trial.id
    const state = stateAt(trial.scenario, elapsedMs)
    const visible = choicesFor(trial.policy, state)
    const selected = endedBy === 'selection'
    const choiceCount = selected ? visible.length : null
    const rtMs = selected ? Math.round(elapsedMs) : null
    const correct = selection === null ? null : selection === trial.target
    const onBoard = targetOnBoard(trial.target, visible)
    const stored = trial.record
    setOutcome(outcomeText(trial, endedBy, selection, elapsedMs, stored))
    setLastRun({ target: trial.target, scenario: trial.scenario, policy: trial.policy })
    setRunning(null)
    setClock(0)
    if (!stored) return
    const next = [
      ...trialsRef.current,
      {
        id: trial.id,
        startedAt: trial.startedAt,
        scenario: trial.scenario,
        policy: trial.policy,
        target: trial.target,
        selection,
        correct,
        rtMs,
        choiceCount,
        reliability: selected ? state : null,
        endedBy,
        durationMs: Math.round(elapsedMs),
        targetPool: trial.targetPool,
        targetOnBoard: onBoard,
        visibleChoicesAtEnd: visible.length,
        pairId: trial.pairId,
        sequenceIndex: trial.sequenceIndex,
      } satisfies TrialRecord,
    ]
    trialsRef.current = next
    setTrials(next)
    if (!saveTrials(next)) {
      setStorageError('The trial is on screen, but this browser did not save it.')
    }
    const activePair = pairRef.current
    if (activePair && trial.pairId === activePair.id && trial.sequenceIndex === activePair.index) {
      setPair({ ...activePair, index: activePair.index + 1 })
    }
  }

  const finishRef = useRef(finish)

  useEffect(() => {
    trialsRef.current = trials
  }, [trials])

  useEffect(() => {
    pairRef.current = pair
  }, [pair])

  useEffect(() => {
    finishRef.current = finish
  })

  useEffect(() => {
    if (!running) return
    const trial = running
    const id = window.setInterval(() => {
      const elapsedMs = monotonicNow() - trial.t0
      if (elapsedMs >= TRIAL_LIMIT_MS) {
        window.clearInterval(id)
        finishRef.current(trial, 'timeout', null, TRIAL_LIMIT_MS)
        return
      }
      setClock(elapsedMs)
    }, 100)
    return () => window.clearInterval(id)
  }, [running])

  useEffect(() => {
    if (running) targetRef.current?.focus()
  }, [running])

  useEffect(() => {
    if (!running && outcome) outcomeRef.current?.focus()
  }, [running, outcome])

  function onChoose(token: string) {
    if (!running) return
    finish(running, 'selection', token, monotonicNow() - running.t0)
  }

  const choicesRef = useRef(choices)
  const onChooseRef = useRef(onChoose)

  useEffect(() => {
    choicesRef.current = choices
    onChooseRef.current = onChoose
  })

  useEffect(() => {
    if (!running) return
    function onKey(event: KeyboardEvent) {
      const target = event.target
      if (target instanceof HTMLElement) {
        const tag = target.tagName
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable) return
      }
      if (!/^[1-9]$/.test(event.key)) return
      const token = choicesRef.current[Number(event.key) - 1]
      if (!token) return
      event.preventDefault()
      onChooseRef.current(token)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [running])

  function start() {
    const activePair = pairRef.current
    const fromPair =
      lockedTarget === null && activePair && activePair.index < activePair.targets.length
        ? activePair
        : null
    const target = lockedTarget ?? (fromPair ? fromPair.targets[fromPair.index] : drawTargetFrom(phrasesForPool(pool)))
    if (!target) return
    setLockedTarget(null)
    setArmClear(false)
    setOutcome('')
    setClock(0)
    setRunning({
      id: uid(),
      t0: monotonicNow(),
      startedAt: new Date().toISOString(),
      scenario: fromPair ? fromPair.scenario : scenario,
      policy,
      target,
      targetPool: fromPair ? fromPair.pool : pool,
      record,
      pairId: fromPair ? fromPair.id : null,
      sequenceIndex: fromPair ? fromPair.index : null,
    })
  }

  function preparePair() {
    const targets = drawSequence(phrasesForPool(pool), PAIRED_SEQUENCE_LENGTH)
    setPair({ id: uid(), pool, scenario, targets, index: 0 })
    setLockedTarget(null)
    setOutcome(`Prepared ${targets.length} targets. Both policies can use this same list.`)
  }

  function switchPairPolicy() {
    if (!pair) return
    setPolicy(policy === 'fixed' ? 'adaptive' : 'fixed')
    setPair({ ...pair, index: 0 })
    setOutcome('The same targets will start again at the first phrase, with the other policy.')
  }

  function chooseScenario(id: ScenarioId) {
    setScenario(id)
    if (pair) {
      setPair(null)
      setOutcome('The paired sequence was cleared because the scenario changed.')
    }
  }

  function choosePool(next: TargetPool) {
    setPool(next)
    if (pair) {
      setPair(null)
      setOutcome('The paired sequence was cleared because the target pool changed.')
    }
  }

  function stop() {
    if (!running) return
    finish(running, 'stopped', null, monotonicNow() - running.t0)
  }

  const summaries = summaryRows(trials)
  const outcomes = outcomeRows(trials)
  const fixed = summaries.find((row) => row.key === 'Fixed')
  const adaptive = summaries.find((row) => row.key === 'Adaptive')

  return (
    <>
      <PageHeader eyebrow="Experiments" title="Fixed board against adaptive board">
        <p>
          <Mark kind="demonstration" /> This experiment evaluates browser-based board selection. It
          records selections made in this browser. It does not measure actual EEG performance, and
          it does not measure clinical communication outcomes. It does not record EEG, and it is
          not a participant study. A target can be any phrase in the
          selected pool. The full pool includes phrases that leave the board when the adaptive
          policy is medium or low. The essential-only pool keeps the earlier task, where YES, NO,
          HELP, and RETRY are always available. The scenario clock is not an EEG quality measurement.
        </p>
      </PageHeader>

      <section className="block">
        <h2>Protocol</h2>
        <p>
          A trial ends at the first selection, at 30 seconds with no selection, or when Stop trial
          is pressed. Held high is a control: both policies show the same {VOCAB.high.length}{' '}
          choices, so a time difference there is not explained by the size of the board. Step down
          changes the demonstration state at {STEP_TO_MEDIUM_MS / 1000} seconds and again at{' '}
          {STEP_TO_LOW_MS / 1000} seconds. Held low stays low. None of these clocks is computed from
          EEG. A paired sequence draws {PAIRED_SEQUENCE_LENGTH} targets once. The same list can be
          run under each policy. The draw is not seeded. The stored log contains the targets that
          were actually used. One person completing both orders still has practice effects, so the
          log does not support a claim that one policy is better.
        </p>
        <p>
          Fixed always shows {VOCAB.high.length} choices. Adaptive shows {VOCAB.high.length} at
          high, {VOCAB.medium.length} at medium, and {VOCAB.low.length} at low. The four essential
          words stay in the same order at the start of the board.
        </p>
        <div className="table-wrap">
          <table className="prose-table">
            <caption>
              Demonstration state by scenario and elapsed time. This clock is not an EEG
              measurement. Choice counts follow the policy.
            </caption>
            <thead>
              <tr>
                <th scope="col">Elapsed</th>
                {SCENARIO_IDS.map((id) => (
                  <th key={id} scope="col">
                    {scenarioName(id)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {SCHEDULE.map((slot) => (
                <tr key={slot.label}>
                  <th scope="row">{slot.label}</th>
                  {SCENARIO_IDS.map((id) => (
                    <td key={id}>{reliabilityLabel(stateAt(id, slot.ms))}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="note">
          No significance test is reported. Accuracy is correct selections divided by selections.
          Timeout rate is timeouts divided by trials. Error rate is incorrect selections divided by
          selections. Correct per minute uses the stored duration of every trial in the group, and
          it is blank when an older trial has no duration. Targets hidden counts trials whose
          target was absent from the board when the trial ended.
        </p>
      </section>

      <section className="block">
        <h2>Trial</h2>
        <fieldset disabled={running !== null}>
          <legend>Setup</legend>
          <div className="choice-grid">
            <fieldset>
              <legend>Scenario</legend>
              {SCENARIO_IDS.map((id) => (
                <label key={id} className="check">
                  <input
                    type="radio"
                    name="scenario"
                    checked={scenario === id}
                    onChange={() => chooseScenario(id)}
                  />
                  {scenarioName(id)}
                </label>
              ))}
            </fieldset>
            <fieldset>
              <legend>Policy</legend>
              {POLICIES.map((id) => (
                <label key={id} className="check">
                  <input
                    type="radio"
                    name="policy"
                    checked={policy === id}
                    onChange={() => setPolicy(id)}
                  />
                  {policyName(id)}
                </label>
              ))}
            </fieldset>
            <fieldset>
              <legend>Target pool</legend>
              <label className="check">
                <input
                  type="radio"
                  name="pool"
                  checked={pool === 'full'}
                  onChange={() => choosePool('full')}
                />
                Full vocabulary, {VOCAB.high.length} phrases
              </label>
              <label className="check">
                <input
                  type="radio"
                  name="pool"
                  checked={pool === 'essential'}
                  onChange={() => choosePool('essential')}
                />
                Essential four only
              </label>
            </fieldset>
          </div>
          <label className="check">
            <input
              type="checkbox"
              checked={record}
              onChange={(event) => setRecord(event.target.checked)}
            />
            Record this trial
          </label>
          <p className="note">
            {record
              ? 'The result will be stored in this browser.'
              : 'Practice uses the same timer and board. The result stays on screen and is not written to the log.'}
          </p>
          {pair ? (
            <p>
              {pair.index >= pair.targets.length
                ? `Paired sequence complete, ${pair.targets.length} of ${pair.targets.length}.`
                : `Paired sequence ${pair.index + 1} of ${pair.targets.length}.`}{' '}
              Targets: {pair.targets.join(', ')}.
            </p>
          ) : null}
          {!running &&
            (lockedTarget ? (
              <p>
                Next target is locked to {lockedTarget}.{' '}
                <button type="button" onClick={() => setLockedTarget(null)}>
                  Clear lock
                </button>
              </p>
            ) : (
              <p className="note">The next target will be drawn when the trial starts.</p>
            ))}
        </fieldset>

        <div className="tools">
          {running ? (
            <button type="button" onClick={stop}>
              Stop trial
            </button>
          ) : (
            <button type="button" className="is-primary" onClick={start}>
              Start trial
            </button>
          )}
          <button
            type="button"
            disabled={!lastRun || running !== null}
            onClick={() => {
              if (!lastRun) return
              setScenario(lastRun.scenario)
              setPolicy(lastRun.policy === 'fixed' ? 'adaptive' : 'fixed')
              setLockedTarget(lastRun.target)
              setOutcome(`Next trial will ask for ${lastRun.target} with the other policy.`)
            }}
          >
            Repeat with the other policy
          </button>
          <button type="button" disabled={running !== null} onClick={preparePair}>
            Prepare {PAIRED_SEQUENCE_LENGTH} shared targets
          </button>
          <button type="button" disabled={!pair || running !== null} onClick={switchPairPolicy}>
            Restart the shared targets with the other policy
          </button>
        </div>

        <p className="outcome" role="status" tabIndex={-1} ref={outcomeRef}>
          {outcome || 'No trial result yet.'}
        </p>
        {storageError ? <p role="alert">{storageError}</p> : null}

        {running ? (
          <>
            <p className="kicker">Target</p>
            <p className="utterance" tabIndex={-1} ref={targetRef}>
              Select {running.target}
            </p>
            {targetOnBoard(running.target, choices) ? null : (
              <p>{running.target} is not on the board in this demonstration state.</p>
            )}
            <p>
              {formatMs(clock)} elapsed. {demonstrationStatePhrase(reliability)}. {choices.length}{' '}
              choices. {policyName(running.policy)} policy. {scenarioName(running.scenario)}.
              {running.record ? ' Recording.' : ' Practice, not recorded.'}
            </p>
          </>
        ) : (
          <p className="note">
            Preview at 0 seconds. {demonstrationStatePhrase(reliability)}, {choices.length} choices. The
            buttons stay inactive until the trial starts.
          </p>
        )}
        <Board choices={choices} onChoose={running ? onChoose : undefined} />
        <p className="note">During a trial, keys 1 through 9 select the first nine visible choices. One selection ends the trial.</p>
      </section>

      <section className="block">
        <h2>Recorded results</h2>
        <p>{comparisonSentence(fixed, adaptive)}</p>
        <div className="tools">
          <button type="button" onClick={() => downloadCsv(`voxneura-trials-${stamp()}.csv`, trialsToCsv(trials))}>
            Download trial log
          </button>
          {armClear ? (
            <button
              type="button"
              onClick={() => {
                setTrials([])
                trialsRef.current = []
                saveTrials([])
                setLastRun(null)
                setLockedTarget(null)
                setPair(null)
                setArmClear(false)
                setOutcome('The log was cleared from this browser.')
              }}
            >
              Confirm clear
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                if (trials.length === 0) {
                  setOutcome('The log is already empty.')
                  return
                }
                setArmClear(true)
              }}
            >
              Clear log
            </button>
          )}
        </div>
        {trials.length === 0 ? (
          <p className="note">No trials are stored. A download now contains the column headers only.</p>
        ) : null}
        <div className="table-wrap">
          <table className="numeric">
            <caption>
              Browser-demonstration summary. Groups are by policy, by scenario and policy, and by
              the demonstration state recorded at selection. Timeouts and stopped trials have no
              selection state, so they are absent from the state groups.
            </caption>
            <thead>
              <tr>
                <th scope="col">Group</th>
                <th scope="col">Trials</th>
                <th scope="col">Selections</th>
                <th scope="col">Correct</th>
                <th scope="col">Incorrect</th>
                <th scope="col">Timeouts</th>
                <th scope="col">Stopped</th>
                <th scope="col">Median</th>
                <th scope="col">Mean</th>
              </tr>
            </thead>
            <tbody>
              {summaries.map((row) => (
                <tr key={row.key}>
                  <th scope="row">{row.key}</th>
                  <td>{row.trials}</td>
                  <td>{row.selections}</td>
                  <td>{row.correct}</td>
                  <td>{row.incorrect}</td>
                  <td>{row.timeouts}</td>
                  <td>{row.stopped}</td>
                  <td>{formatMs(row.medianRtMs)}</td>
                  <td>{formatMs(row.meanRtMs)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="table-wrap">
          <table className="numeric">
            <caption>
              Descriptive outcome measures for the same groups. Blank rates mean the denominator
              was zero, or an older trial did not store duration. No p-value is calculated.
            </caption>
            <thead>
              <tr>
                <th scope="col">Group</th>
                <th scope="col">Accuracy</th>
                <th scope="col">Median</th>
                <th scope="col">Mean</th>
                <th scope="col">Timeout rate</th>
                <th scope="col">Error rate</th>
                <th scope="col">Correct per minute</th>
                <th scope="col">Targets hidden</th>
              </tr>
            </thead>
            <tbody>
              {outcomes.map((row) => (
                <tr key={row.key}>
                  <th scope="row">{row.key}</th>
                  <td>{formatRate(row.accuracy)}</td>
                  <td>{formatMs(row.medianRtMs)}</td>
                  <td>{formatMs(row.meanRtMs)}</td>
                  <td>{formatRate(row.timeoutRate)}</td>
                  <td>{formatRate(row.errorRate)}</td>
                  <td>{row.correctPerMinute === null ? '' : row.correctPerMinute.toFixed(2)}</td>
                  <td>{row.targetsHidden ?? ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="table-wrap">
          <table className="numeric">
            <caption>Newest recorded trial first. The CSV is oldest first.</caption>
            <thead>
              <tr>
                <th scope="col">Started</th>
                <th scope="col">Scenario</th>
                <th scope="col">Policy</th>
                <th scope="col">Target</th>
                <th scope="col">Selection</th>
                <th scope="col">Correct</th>
                <th scope="col">Time</th>
                <th scope="col">Visible choices at selection</th>
                <th scope="col">State at selection</th>
                <th scope="col">On board</th>
                <th scope="col">Pool</th>
                <th scope="col">Pair index</th>
                <th scope="col">Ended</th>
              </tr>
            </thead>
            <tbody>
              {trials.length === 0 ? (
                <tr>
                  <td colSpan={13}>No recorded trials.</td>
                </tr>
              ) : (
                [...trials].reverse().map((trial) => (
                  <tr key={trial.id}>
                    <td>{trial.startedAt}</td>
                    <td>{scenarioName(trial.scenario)}</td>
                    <td>{policyName(trial.policy)}</td>
                    <td>{trial.target}</td>
                    <td>{trial.selection ?? ''}</td>
                    <td>{trial.correct === null ? '' : trial.correct ? 'yes' : 'no'}</td>
                    <td>{formatMs(trial.rtMs)}</td>
                    <td>{trial.choiceCount ?? ''}</td>
                    <td>{trial.reliability ?? ''}</td>
                    <td>{trial.targetOnBoard === null || trial.targetOnBoard === undefined ? '' : trial.targetOnBoard ? 'yes' : 'no'}</td>
                    <td>{trial.targetPool ?? ''}</td>
                    <td>{trial.sequenceIndex === null || trial.sequenceIndex === undefined ? '' : trial.sequenceIndex + 1}</td>
                    <td>{trial.endedBy}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </>
  )
}

function formatRate(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return ''
  return `${(value * 100).toFixed(1)}%`
}

function outcomeText(
  trial: Running,
  endedBy: EndedBy,
  selection: string | null,
  elapsedMs: number,
  stored: boolean,
): string {
  const seconds = formatMs(endedBy === 'timeout' ? TRIAL_LIMIT_MS : elapsedMs)
  let head = 'Trial stopped before a selection.'
  if (endedBy === 'selection' && selection === trial.target) {
    head = `Selected ${selection} in ${seconds}. That matches the target.`
  } else if (endedBy === 'selection') {
    head = `Selected ${selection} in ${seconds}. The target was ${trial.target}.`
  } else if (endedBy === 'timeout') {
    head = 'No selection within 30 seconds.'
  }
  return `${head} ${stored ? 'Stored in the log.' : 'Practice. Not stored.'}`
}

function comparisonSentence(
  fixed: { key: string; selections: number; correct: number; medianRtMs: number | null } | undefined,
  adaptive: { key: string; selections: number; correct: number; medianRtMs: number | null } | undefined,
): string {
  const parts = [fixed, adaptive]
    .filter((group): group is NonNullable<typeof group> => Boolean(group && group.selections > 0))
    .map((group) => {
      const noun = group.selections === 1 ? 'selection' : 'selections'
      return `${group.key}: ${group.correct} correct out of ${group.selections} ${noun}, median ${formatMs(group.medianRtMs)}.`
    })
  if (parts.length === 0) {
    return 'No selections have been stored yet. Medians appear after a recorded trial ends with a choice.'
  }
  return `These numbers describe browser selections stored on this computer. ${parts.join(' ')} They are not an EEG result, not a participant study, and not a significance test.`
}

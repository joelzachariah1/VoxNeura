import { useEffect, useRef, useState } from 'react'
import { Board } from '../components/Board.tsx'
import { Mark } from '../components/Mark.tsx'
import { PageHeader } from '../components/PageHeader.tsx'
import { usePageTitle } from '../components/usePageTitle.ts'
import { downloadCsv } from '../lib/download.ts'
import { formatMs, stamp, uid } from '../lib/format.ts'
import {
  POLICIES,
  SCENARIO_IDS,
  STEP_TO_LOW_MS,
  STEP_TO_MEDIUM_MS,
  TRIAL_LIMIT_MS,
  choicesFor,
  drawTarget,
  policyName,
  scenarioName,
  stateAt,
} from '../lib/protocol.ts'
import type { Policy, ScenarioId } from '../lib/protocol.ts'
import { loadTrials, saveTrials, summaryRows, trialsToCsv } from '../lib/trials.ts'
import type { EndedBy, TrialRecord } from '../lib/trials.ts'
import { VOCAB, reliabilityLabel } from '../lib/vocabulary.ts'

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
  record: boolean
}

export function ExperimentsPage() {
  usePageTitle('Experiments')
  const [scenario, setScenario] = useState<ScenarioId>('step-down')
  const [policy, setPolicy] = useState<Policy>('adaptive')
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

  const activeScenario = running?.scenario ?? scenario
  const activePolicy = running?.policy ?? policy
  const elapsed = running ? clock : 0
  const reliability = stateAt(activeScenario, elapsed)
  const choices = choicesFor(activePolicy, reliability)

  function finish(trial: Running, endedBy: EndedBy, selection: string | null, elapsedMs: number) {
    if (finishedId.current === trial.id) return
    finishedId.current = trial.id
    const state = stateAt(trial.scenario, elapsedMs)
    const choiceCount = choicesFor(trial.policy, state).length
    const rtMs = endedBy === 'selection' ? Math.round(elapsedMs) : null
    const correct = selection === null ? null : selection === trial.target
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
        reliability: state,
        endedBy,
      } satisfies TrialRecord,
    ]
    trialsRef.current = next
    setTrials(next)
    if (!saveTrials(next)) {
      setStorageError('The trial is on screen, but this browser did not save it.')
    }
  }

  const finishRef = useRef(finish)

  useEffect(() => {
    trialsRef.current = trials
  }, [trials])

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
    const target = lockedTarget ?? drawTarget()
    setLockedTarget(null)
    setArmClear(false)
    setOutcome('')
    setClock(0)
    setRunning({
      id: uid(),
      t0: monotonicNow(),
      startedAt: new Date().toISOString(),
      scenario,
      policy,
      target,
      record,
    })
  }

  function stop() {
    if (!running) return
    finish(running, 'stopped', null, monotonicNow() - running.t0)
  }

  const summaries = summaryRows(trials)
  const fixed = summaries.find((row) => row.key === 'Fixed')
  const adaptive = summaries.find((row) => row.key === 'Adaptive')

  return (
    <>
      <PageHeader eyebrow="Experiments" title="Fixed board against adaptive board">
        <p>
          <Mark kind="demonstration" /> This page records selections made in this browser. It does
          not record EEG, and it is not a result from a participant study. Each trial asks for one
          of YES, NO, HELP, or RETRY, because those four words exist in every reliability state.
        </p>
      </PageHeader>

      <section className="block">
        <h2>Protocol</h2>
        <p>
          A trial ends at the first selection, at 30 seconds with no selection, or when Stop trial
          is pressed. Held high is a control: both policies show the same {VOCAB.high.length}{' '}
          choices, so a time difference there is not explained by the size of the board. Step down
          changes state at {STEP_TO_MEDIUM_MS / 1000} seconds and again at {STEP_TO_LOW_MS / 1000}{' '}
          seconds. Held low stays low.
        </p>
        <p>
          Fixed always shows {VOCAB.high.length} choices. Adaptive shows {VOCAB.high.length} at
          high, {VOCAB.medium.length} at medium, and {VOCAB.low.length} at low. The four essential
          words stay in the same order at the start of the board.
        </p>
        <div className="table-wrap">
          <table className="prose-table">
            <caption>Reliability state by scenario and elapsed time. Choice counts follow the policy.</caption>
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
          The target is drawn with equal chance from the four essential words. The draw is not
          seeded. Repeat with the other policy keeps the same word for the next trial.
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
                    onChange={() => setScenario(id)}
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
            <p>
              {formatMs(clock)} elapsed. Reliability {reliabilityLabel(reliability)}. {choices.length}{' '}
              choices. {policyName(running.policy)} policy. {scenarioName(running.scenario)}.
              {running.record ? ' Recording.' : ' Practice, not recorded.'}
            </p>
          </>
        ) : (
          <p className="note">
            Preview at 0 seconds. {reliabilityLabel(reliability)}, {choices.length} choices. The
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
            <caption>Summary of trials stored in this browser.</caption>
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
                <th scope="col">Choices</th>
                <th scope="col">State</th>
                <th scope="col">Ended</th>
              </tr>
            </thead>
            <tbody>
              {trials.length === 0 ? (
                <tr>
                  <td colSpan={10}>No recorded trials.</td>
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
  return `These numbers describe trials stored in this browser. ${parts.join(' ')} They are not a result from a participant study.`
}

import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Board } from '../components/Board.tsx'
import { Mark } from '../components/Mark.tsx'
import { PageHeader } from '../components/PageHeader.tsx'
import { usePageTitle } from '../components/usePageTitle.ts'
import { useFeatures } from '../context/features-state.ts'
import { downloadCsv } from '../lib/download.ts'
import { formatSci, spokenForm, stamp, uid } from '../lib/format.ts'
import { CONFIRM_BELOW, needsConfirmation } from '../lib/protocol.ts'
import { RULE_ID, RELIABILITY_LEVELS, assignByVariability } from '../lib/reliability.ts'
import type { Reliability } from '../lib/reliability.ts'
import {
  canSpeak,
  loadInterface,
  saveInterface,
  speak,
  transcriptToCsv,
} from '../lib/transcript.ts'
import type { LogEntry } from '../lib/transcript.ts'
import { VOCAB, reliabilityLabel } from '../lib/vocabulary.ts'

export function InterfacePage() {
  usePageTitle('Interface')
  const data = useFeatures()
  const [params] = useSearchParams()
  const [saved] = useState(loadInterface)
  const [manualReliability, setManualReliability] = useState<Reliability>(saved.state)
  const [matchedRow, setMatchedRow] = useState<number | null>(saved.matchedRow)
  const [followUrl, setFollowUrl] = useState(true)
  const [rowPick, setRowPick] = useState(saved.matchedRow ?? 1)
  const [confidence, setConfidence] = useState(saved.confidence)
  const [speechOn, setSpeechOn] = useState(saved.speech)
  const [log, setLog] = useState<LogEntry[]>(saved.log)
  const [pending, setPending] = useState<string | null>(null)
  const [notice, setNotice] = useState('Ready.')
  const [armClear, setArmClear] = useState(false)
  const [announcedUrl, setAnnouncedUrl] = useState(false)
  const sendRef = useRef<HTMLButtonElement>(null)
  const lastCommitAt = useRef(0)
  const rows = data.status === 'ready' ? data.rows : null
  const assignments = useMemo(
    () =>
      rows
        ? assignByVariability(rows.map((row) => ({ index: row.index, variability: row.variability })))
        : [],
    [rows],
  )
  const urlIndex = Number(params.get('row'))
  const urlAssignment = assignments.find((item) => item.index === urlIndex)
  const reliability = followUrl && urlAssignment ? urlAssignment.state : manualReliability
  const linkedRow = followUrl && urlAssignment ? urlAssignment.index : matchedRow
  const matched = assignments.find((item) => item.index === linkedRow) ?? null
  const matchedValues = rows?.find((row) => row.index === linkedRow) ?? null
  const choices = VOCAB[reliability]
  const [trackedChoices, setTrackedChoices] = useState(choices)

  if (!announcedUrl && urlAssignment) {
    setAnnouncedUrl(true)
    setRowPick(urlAssignment.index)
    setNotice(
      `Matched row ${urlAssignment.index}. Reliability is ${urlAssignment.state}. ${VOCAB[urlAssignment.state].length} choices.`,
    )
  }
  if (trackedChoices !== choices) {
    setTrackedChoices(choices)
    if (pending && !choices.includes(pending)) {
      setPending(null)
      setNotice(`${pending} left the board when reliability changed. It was not sent.`)
    }
  }

  useEffect(() => {
    saveInterface({
      version: 1,
      state: reliability,
      matchedRow: linkedRow,
      confidence,
      speech: speechOn,
      log,
    })
  }, [reliability, linkedRow, confidence, speechOn, log])

  useEffect(() => {
    if (pending) sendRef.current?.focus()
  }, [pending])

  useEffect(() => {
    return () => {
      if (canSpeak()) window.speechSynthesis.cancel()
    }
  }, [])

  function commitToken(token: string, neededConfirmation: boolean) {
    const now = Date.now()
    if (now - lastCommitAt.current < 400) return
    lastCommitAt.current = now
    const entry: LogEntry = {
      id: uid(),
      at: new Date().toISOString(),
      token,
      reliability,
      choiceCount: choices.length,
      confidence,
      neededConfirmation,
      matchedRow: linkedRow,
    }
    setLog((current) => [...current, entry])
    setPending(null)
    setArmClear(false)
    let message = `${token} sent.`
    if (speechOn) {
      const spoke = speak(spokenForm(token))
      if (!spoke) message = `${token} sent. This browser did not speak.`
    }
    setNotice(message)
  }

  function press(token: string) {
    if (needsConfirmation(confidence)) {
      setPending(token)
      setNotice(`${token} is waiting. It has not been sent.`)
      return
    }
    commitToken(token, false)
  }

  const pressRef = useRef(press)
  const commitRef = useRef(commitToken)
  const live = useRef({ pending, choices })

  useEffect(() => {
    pressRef.current = press
    commitRef.current = commitToken
    live.current = { pending, choices }
  })

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const target = event.target
      if (target instanceof HTMLElement) {
        const tag = target.tagName
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable) {
          return
        }
      }
      const current = live.current
      if (current.pending) {
        if (event.key === 'Enter') {
          event.preventDefault()
          commitRef.current(current.pending, true)
        } else if (event.key === 'Escape') {
          event.preventDefault()
          setPending(null)
          setNotice('Confirmation cancelled.')
        }
        return
      }
      if (!/^[1-9]$/.test(event.key)) return
      const token = current.choices[Number(event.key) - 1]
      if (!token) return
      event.preventDefault()
      pressRef.current(token)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  function applyManual(next: Reliability) {
    setFollowUrl(false)
    setManualReliability(next)
    setMatchedRow(null)
    setNotice(`Reliability set to ${next}. ${VOCAB[next].length} choices.`)
  }

  function matchRow() {
    const assignment = assignments.find((item) => item.index === rowPick)
    if (!assignment) return
    setFollowUrl(false)
    setManualReliability(assignment.state)
    setMatchedRow(rowPick)
    setNotice(
      `Matched row ${rowPick}. Reliability is ${assignment.state}. ${VOCAB[assignment.state].length} choices.`,
    )
  }

  const last = log[log.length - 1] ?? null
  const waiting = needsConfirmation(confidence)

  return (
    <>
      <PageHeader eyebrow="Interface" title="Adaptive communication board">
        <p>
          <Mark kind="demonstration" /> High, medium, and low change the choices immediately.
          Confidence does not. HELP records the word and can speak it. It does not contact
          emergency services.
        </p>
      </PageHeader>

      <section className="partner" aria-labelledby="message-label">
        <p id="message-label" className="kicker">
          Message
        </p>
        <p className="utterance">{pending ?? last?.token ?? 'Nothing sent'}</p>
        <p className="utterance-state">
          {pending ? 'Not sent. Waiting for confirmation.' : last ? 'Sent.' : 'No message yet.'}
        </p>
      </section>
      <p className="status" role="status">
        {notice}
      </p>

      <div className="controls">
        <fieldset>
          <legend>Reliability</legend>
          <div className="seg">
            {RELIABILITY_LEVELS.map((level) => (
              <button
                key={level}
                type="button"
                aria-pressed={reliability === level}
                onClick={() => applyManual(level)}
              >
                {reliabilityLabel(level)}
              </button>
            ))}
          </div>
          <p className="note">
            {matched
              ? `Matched to row ${matched.index}, variability rank ${matched.rank}. Rule ${RULE_ID}.`
              : 'Set manually. Pressing a level clears a matched row.'}
          </p>
        </fieldset>

        <fieldset>
          <legend>Feature row</legend>
          {data.status === 'loading' ? <p>Feature rows are loading. Manual reliability still works.</p> : null}
          {data.status === 'error' ? <p role="alert">{data.message}</p> : null}
          {rows && (
            <>
              <label htmlFor="iface-row">
                Row
                <select
                  id="iface-row"
                  value={rowPick}
                  onChange={(event) => setRowPick(Number(event.target.value))}
                >
                  {rows.map((row) => (
                    <option key={row.index} value={row.index}>
                      Row {row.index}
                    </option>
                  ))}
                </select>
              </label>
              <div className="tools">
                <button type="button" onClick={matchRow}>
                  Match this row
                </button>
              </div>
              {matched && matchedValues && matched.index === rowPick ? (
                <p className="note">
                  Variability {formatSci(matchedValues.variability)}. Theta {formatSci(matchedValues.theta)}.
                  Alpha {formatSci(matchedValues.alpha)}. Beta {formatSci(matchedValues.beta)}. Mean
                  amplitude {formatSci(matchedValues.mean_amp)}.
                </p>
              ) : matched ? (
                <p className="note">
                  The board is still matched to row {matched.index}. Choose Match this row to apply row {rowPick}.
                </p>
              ) : (
                <p className="note">
                  Matching applies rule {RULE_ID}. <Link to="/reliability">Read the rule</Link>.
                </p>
              )}
            </>
          )}
        </fieldset>

        <fieldset>
          <legend>Demonstration confidence</legend>
          <label htmlFor="iface-confidence">Value: {confidence}</label>
          <input
            id="iface-confidence"
            type="range"
            min={0}
            max={100}
            step={1}
            value={confidence}
            onChange={(event) => setConfidence(Number(event.target.value))}
            aria-describedby="confidence-note"
          />
          <p id="confidence-note" className="note">
            Not read from features.csv. Confirmation is required below {CONFIRM_BELOW}.
          </p>
        </fieldset>

        <fieldset>
          <legend>Speech</legend>
          <label className="check">
            <input
              type="checkbox"
              checked={speechOn}
              onChange={(event) => setSpeechOn(event.target.checked)}
            />
            Speak sent messages
          </label>
          <p className="note">
            {canSpeak()
              ? 'Speech uses the voice built into this browser. The transcript is kept either way.'
              : 'This browser has no speech synthesis. The transcript still works.'}
          </p>
        </fieldset>
      </div>

      {pending ? (
        <div className="confirm-bar" role="region" aria-label="Confirmation">
          <p>{pending} has not been sent.</p>
          <div className="tools">
            <button
              ref={sendRef}
              type="button"
              className="is-primary"
              onClick={() => commitToken(pending, true)}
            >
              Send {pending}
            </button>
            <button
              type="button"
              onClick={() => {
                setPending(null)
                setNotice('Confirmation cancelled.')
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}

      <Board choices={choices} onChoose={press} pending={pending} />
      <p className="note">
        {choices.length} choices are on screen because reliability is {reliability}. Confidence does
        not change this count.{' '}
        {waiting
          ? `A choice waits for confirmation because confidence is ${confidence}, below ${CONFIRM_BELOW}.`
          : `A choice is sent immediately because confidence is ${confidence}, at or above ${CONFIRM_BELOW}.`}
      </p>
      <p className="note">Keys 1 through 9 select the first nine visible choices. Enter sends a waiting choice. Escape cancels it.</p>

      <section className="block">
        <h2>Transcript</h2>
        <p className="note">Newest message first. The CSV is oldest first and is stored in this browser.</p>
        <div className="tools">
          <button type="button" onClick={() => downloadCsv(`voxneura-transcript-${stamp()}.csv`, transcriptToCsv(log))}>
            Download transcript
          </button>
          <button
            type="button"
            onClick={() => {
              setLog((current) => current.slice(0, -1))
              setNotice(log.length ? 'Removed the last message.' : 'The transcript is already empty.')
            }}
          >
            Remove last message
          </button>
          {armClear ? (
            <button
              type="button"
              onClick={() => {
                setLog([])
                setArmClear(false)
                setNotice('Transcript cleared from this browser.')
              }}
            >
              Confirm clear
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                if (log.length === 0) {
                  setNotice('The transcript is already empty.')
                  return
                }
                setArmClear(true)
              }}
            >
              Clear transcript
            </button>
          )}
        </div>
        <div className="table-wrap">
          <table className="numeric">
            <caption>Messages sent from this board.</caption>
            <thead>
              <tr>
                <th scope="col">Sent</th>
                <th scope="col">Token</th>
                <th scope="col">Reliability</th>
                <th scope="col">Choices</th>
                <th scope="col">Confidence</th>
                <th scope="col">Confirmation</th>
                <th scope="col">Row</th>
              </tr>
            </thead>
            <tbody>
              {log.length === 0 ? (
                <tr>
                  <td colSpan={7}>No messages sent.</td>
                </tr>
              ) : (
                [...log].reverse().map((entry) => (
                  <tr key={entry.id}>
                    <td>{entry.at}</td>
                    <td>{entry.token}</td>
                    <td>{entry.reliability}</td>
                    <td>{entry.choiceCount}</td>
                    <td>{entry.confidence}</td>
                    <td>{entry.neededConfirmation ? 'yes' : 'no'}</td>
                    <td>{entry.matchedRow ?? 'manual'}</td>
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

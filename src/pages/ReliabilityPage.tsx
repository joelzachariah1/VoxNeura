import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { FeaturesGate } from '../components/FeaturesGate.tsx'
import { Mark } from '../components/Mark.tsx'
import { PageHeader } from '../components/PageHeader.tsx'
import { usePageTitle } from '../components/usePageTitle.ts'
import { bandShares } from '../lib/features.ts'
import type { FeatureRow } from '../lib/features.ts'
import { formatSci } from '../lib/format.ts'
import {
  CONFIRM_BELOW,
  needsConfirmation,
} from '../lib/protocol.ts'
import {
  RULE_ID,
  RULE_SUMMARY,
  assignByVariability,
  binCounts,
  binEdges,
} from '../lib/reliability.ts'
import { VOCAB, reliabilityLabel } from '../lib/vocabulary.ts'

export function ReliabilityPage() {
  usePageTitle('Reliability')
  return (
    <>
      <PageHeader eyebrow="Reliability" title="Two different judgments">
        <p>
          Signal reliability asks whether the EEG segment is stable enough to support a
          communication decision. Classifier confidence asks how strongly a classifier, if one
          were used, would favor one label over the others. A confident output can still be wrong,
          including on a poor signal.
        </p>
      </PageHeader>

      <section className="block" id="distinction">
        <h2>What each one changes</h2>
        <div className="split">
          <section>
            <h3>Signal reliability</h3>
            <p>Changes the number of choices.</p>
            <p>
              High shows {VOCAB.high.length}. Medium shows {VOCAB.medium.length}. Low shows{' '}
              {VOCAB.low.join(', ')}.
            </p>
          </section>
          <section>
            <h3>Classifier confidence</h3>
            <p>Does not change the number of choices.</p>
            <p>
              In this demonstration it only decides whether a selected word is sent at once or
              waits until it is confirmed. The cutoff is {CONFIRM_BELOW}. Below that, the word is
              not sent until Send is pressed.
            </p>
          </section>
        </div>
        <p>
          features.csv has neither a reliability label nor a classifier probability. The controls
          below are marked as a demonstration so those two facts stay visible.
        </p>
      </section>

      <section className="block" id="rule">
        <h2>
          <Mark kind="demonstration" /> Rule {RULE_ID}
        </h2>
        <p>{RULE_SUMMARY}</p>
        <FeaturesGate>
          {({ rows }) => <RuleDemo rows={rows} />}
        </FeaturesGate>
      </section>

      <section className="block">
        <h2>Why variability is only a proxy</h2>
        <p>
          The noisier screenshot is visually dominated by large, fast spikes. Amplitude variability
          is the column in the table that is closest to that appearance. The mapping still has a
          hole in it: a large value can be artifact, or it can be a large neural signal. The table
          does not say which. Equal-count thirds also force three groups even when the values sit
          close together. The boundaries are reported on this page so that closeness is visible.
        </p>
        <p>
          The names theta, alpha, and beta match the usual names of EEG bands, often about 4 to 7
          Hz, 8 to 12 Hz, and 13 to 30 Hz. The file does not state the band edges, the window, the
          reference, or the units. Those names are context for the column titles, not a record of
          the preprocessing.
        </p>
        <p>
          <Link to="/interface">Use the rule on the interface</Link>, or inspect the distribution on
          the <Link to="/data">data page</Link>.
        </p>
      </section>
    </>
  )
}

function RuleDemo({ rows }: { rows: FeatureRow[] }) {
  const assignments = useMemo(
    () => assignByVariability(rows.map((row) => ({ index: row.index, variability: row.variability }))),
    [rows],
  )
  const counts = binCounts(rows.length)
  const edges = binEdges(assignments)
  const [index, setIndex] = useState(1)
  const [confidence, setConfidence] = useState(80)
  const row = rows.find((item) => item.index === index) ?? rows[0]
  const assignment = assignments.find((item) => item.index === row.index)
  const shares = bandShares(row)
  const state = assignment?.state ?? 'low'
  const waiting = needsConfirmation(confidence)

  return (
    <>
      <p>
        This file produces {counts.high} high, {counts.medium} medium, and {counts.low} low rows.
        {edges.highMax !== null && edges.mediumMax !== null
          ? ` The highest variability in the high group is ${formatSci(edges.highMax)}, and in the medium group it is ${formatSci(edges.mediumMax)}.`
          : ''}
      </p>
      <div className="controls">
        <fieldset>
          <legend>Feature row</legend>
          <label htmlFor="rule-row">
            Row
            <select
              id="rule-row"
              value={row.index}
              onChange={(event) => setIndex(Number(event.target.value))}
            >
              {rows.map((item) => (
                <option key={item.index} value={item.index}>
                  Row {item.index}
                </option>
              ))}
            </select>
          </label>
          <dl className="facts">
            <dt>Theta</dt>
            <dd>{formatSci(row.theta)}</dd>
            <dt>Alpha</dt>
            <dd>{formatSci(row.alpha)}</dd>
            <dt>Beta</dt>
            <dd>{formatSci(row.beta)}</dd>
            <dt>Variability</dt>
            <dd>{formatSci(row.variability)}</dd>
            <dt>Mean amplitude</dt>
            <dd>{formatSci(row.mean_amp)}</dd>
            <dt>Rank</dt>
            <dd>
              {assignment ? `${assignment.rank} of ${rows.length}` : ''}
            </dd>
            <dt>Band shares</dt>
            <dd>
              {shares
                ? `${shares.theta.toFixed(3)}, ${shares.alpha.toFixed(3)}, ${shares.beta.toFixed(3)}`
                : 'undefined'}
            </dd>
          </dl>
          <p>
            Demonstration state: {reliabilityLabel(state)}. The board would show {VOCAB[state].length}{' '}
            choices: {VOCAB[state].join(', ')}.
          </p>
          <p>
            <Link to={`/interface?row=${row.index}`}>Match row {row.index} on the interface</Link>
          </p>
        </fieldset>
        <fieldset>
          <legend>Demonstration confidence</legend>
          <label htmlFor="rule-confidence">Value: {confidence}</label>
          <input
            id="rule-confidence"
            type="range"
            min={0}
            max={100}
            step={1}
            value={confidence}
            onChange={(event) => setConfidence(Number(event.target.value))}
          />
          <p>
            {waiting
              ? `A selection would wait for confirmation. The choice list stays at ${VOCAB[state].length}.`
              : `A selection would be sent immediately. The choice list stays at ${VOCAB[state].length}.`}
          </p>
          <p className="note">
            Move this slider and the phrase list above does not change. Move the row, and the phrase
            list can change. That is the distinction.
          </p>
        </fieldset>
      </div>
    </>
  )
}

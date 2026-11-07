import { Link } from 'react-router-dom'
import { FeaturesGate } from '../components/FeaturesGate.tsx'
import { Mark } from '../components/Mark.tsx'
import { PageHeader } from '../components/PageHeader.tsx'
import { usePageTitle } from '../components/usePageTitle.ts'
import { FEATURE_COLUMNS, correlationMatrix } from '../lib/features.ts'
import type { FeatureRow } from '../lib/features.ts'
import { formatR, formatSci } from '../lib/format.ts'
import { RULE_ID, assignByVariability, binCounts, binEdges } from '../lib/reliability.ts'
import { columnStat, mean } from '../lib/stats.ts'

const UNANSWERED = [
  'Who was recorded, and how many people?',
  'What task were they doing?',
  'What were the sampling rate, reference, filters, and montage?',
  'How were theta, alpha, beta, variability, and mean amplitude computed, and in what units?',
  'Do the rows line up with the three screenshots?',
  'Was a classifier trained? If so, what were its inputs, labels, and outputs?',
  'Were the fixed and adaptive boards compared with participants, and what was measured?',
]

export function ResearchPage() {
  usePageTitle('Research')
  return (
    <>
      <PageHeader eyebrow="Research" title="What the materials support">
        <p>
          This page separates calculations on the supplied file from facts that were not in the
          project folder. No accuracy, participant count, or clinical outcome is stated here,
          because none was supplied.
        </p>
      </PageHeader>

      <section className="block">
        <h2>
          <Mark kind="recorded" /> Materials
        </h2>
        <ul>
          <li>features.csv, with the header theta, alpha, beta, variability, mean_amp.</li>
          <li>A cleaner EEG screenshot, a noisier EEG screenshot, and a power spectrum.</li>
        </ul>
        <p>
          The spectrum axis is labeled in the image as power in dB/Hz relative to 1 µV², from 0 to
          40 Hz. The time-series scales that can be read are 97.57 µV and 40.0 µV. Those units
          belong to the figures. They are not printed in the CSV, so the table is not converted
          into microvolts.
        </p>
      </section>

      <FeaturesGate>{({ rows }) => <Findings rows={rows} />}</FeaturesGate>

      <section className="block" id="not-reported">
        <h2>Not reported in the supplied files</h2>
        <ul>
          {UNANSWERED.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
        <p>These are open questions. They are not filled in with estimates.</p>
      </section>

      <section className="block">
        <h2>
          <Mark kind="demonstration" /> What the software adds
        </h2>
        <p>
          The interface uses rule {RULE_ID}, documented on the <Link to="/reliability">reliability page</Link>.
          The experiment log is created when someone uses the <Link to="/experiments">experiments page</Link>.
          Both are demonstrations. Neither is a reconstruction of a completed study.
        </p>
      </section>

      <section className="block" id="limitations">
        <h2>Limitations</h2>
        <ul>
          <li>This is not a medical device, and no clinical validation is claimed.</li>
          <li>Selecting a word is not evidence that EEG classified an intention.</li>
          <li>The feature rows are not identified as independent participants.</li>
          <li>The screenshots are pictures of a viewer. They are not the recording.</li>
          <li>Figure 1 and Figure 2 use different microvolt scales, so their amplitudes should not be compared by eye.</li>
          <li>The variability tertiles are equal-count bins. They can split a narrow range into three labels.</li>
          <li>High variability is not labeled as artifact anywhere in the file.</li>
          <li>The confidence slider is not the output of a model.</li>
          <li>Speech depends on the browser. HELP does not contact anyone.</li>
          <li>A literature review was not part of the supplied materials, so none is invented here.</li>
        </ul>
      </section>
    </>
  )
}

function Findings({ rows }: { rows: FeatureRow[] }) {
  const stats = FEATURE_COLUMNS.map((key) => columnStat(key, 'file', rows.map((row) => row[key])))
  const bandOrder = (['theta', 'alpha', 'beta'] as const)
    .map((key) => ({ key, value: mean(rows.map((row) => row[key])) }))
    .sort((a, b) => b.value - a.value)
  const negative = rows.filter((row) => row.mean_amp < 0).length
  const positiveBands = (['theta', 'alpha', 'beta', 'variability'] as const).every((key) =>
    rows.every((row) => row[key] > 0),
  )
  const assignments = assignByVariability(
    rows.map((row) => ({ index: row.index, variability: row.variability })),
  )
  const counts = binCounts(rows.length)
  const edges = binEdges(assignments)
  const matrix = correlationMatrix(rows)
  let strongest: { a: string; b: string; r: number } | null = null
  for (const cell of matrix) {
    if (cell.a === cell.b || cell.r === null) continue
    if (FEATURE_COLUMNS.indexOf(cell.a) > FEATURE_COLUMNS.indexOf(cell.b)) continue
    if (!strongest || Math.abs(cell.r) > Math.abs(strongest.r)) {
      strongest = { a: cell.a, b: cell.b, r: cell.r }
    }
  }

  return (
    <section className="block">
      <h2>
        <Mark kind="computed" /> Calculations from this file
      </h2>
      <ul>
        <li>The file contains {rows.length} data rows and {FEATURE_COLUMNS.length} columns.</li>
        {positiveBands ? (
          <li>Theta, alpha, beta, and variability are positive in every row.</li>
        ) : (
          <li>At least one of theta, alpha, beta, or variability is not positive.</li>
        )}
        <li>
          {negative === 0
            ? 'No row has a negative mean amplitude.'
            : negative === 1
              ? '1 row has a negative mean amplitude. The file does not define the sign.'
              : `${negative} rows have a negative mean amplitude. The file does not define the sign.`}
        </li>
        <li>
          Among the three band columns, the means from largest to smallest are{' '}
          {bandOrder.map((item) => `${item.key} (${formatSci(item.value)})`).join(', ')}.
        </li>
        <li>
          The demonstration split of these rows is {counts.high} high, {counts.medium} medium, and{' '}
          {counts.low} low.
          {edges.highMax !== null && edges.mediumMax !== null
            ? ` The high-group maximum variability is ${formatSci(edges.highMax)}, and the medium-group maximum is ${formatSci(edges.mediumMax)}.`
            : ''}
        </li>
        {strongest ? (
          <li>
            The largest absolute off-diagonal correlation is between {strongest.a} and {strongest.b}{' '}
            (r = {formatR(strongest.r)}). This describes the rows in the file. It is not a
            significance test.
          </li>
        ) : null}
      </ul>
      <p>
        The full tables and charts are on the <Link to="/data">data page</Link>. One check against
        the statistics there: the theta mean is {formatSci(stats[0]?.mean ?? Number.NaN)}.
      </p>
    </section>
  )
}

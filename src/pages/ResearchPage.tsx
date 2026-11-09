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

const MISSING_METHODS = [
  'Sampling rate.',
  'Recording duration, and whether each row is a window, a trial, or a person.',
  'Subject information: who was recorded, how many people, and any inclusion criteria.',
  'Feature extraction: how theta, alpha, beta, variability, and mean amplitude were computed, including band edges, window, and reference.',
  'Units for all five columns. The CSV header does not state them.',
  'Dataset source: where the recording and features.csv came from.',
]

const UNANSWERED = [
  'What task were they doing?',
  'What were the reference, filters, and montage?',
  'Do the rows line up with the three screenshots?',
  'Was a classifier trained? If so, what were its inputs, labels, and outputs?',
  'Were the fixed and adaptive boards compared with participants, and what was measured?',
]

const REFERENCES = [
  {
    topic: 'EEG preprocessing',
    cite: 'Bigdely-Shamlo N, Mullen T, Kothe C, Su K-M, Robbins KA. The PREP pipeline: standardized preprocessing for large-scale EEG analysis. Frontiers in Neuroinformatics. 2015;9:16. doi:10.3389/fninf.2015.00016',
    scope:
      'Describes an early-stage EEG pipeline for line noise, a robust average reference, and bad-channel detection. It was not applied to features.csv, and it does not define the variability tertiles used here.',
  },
  {
    topic: 'EEG signal quality',
    cite: 'Urigüen JA, García-Zapirain B. EEG artifact removal, state-of-the-art and guidelines. Journal of Neural Engineering. 2015;12:031001. doi:10.1088/1741-2560/12/3/031001',
    scope:
      'Reviews methods for ocular, muscular, and cardiac artifact removal. It does not label the rows in features.csv, and it does not treat one variability number as a validated reliability score.',
  },
  {
    topic: 'Communication interfaces',
    cite: 'Wolpaw JR, Birbaumer N, McFarland DJ, Pfurtscheller G, Vaughan TM. Brain-computer interfaces for communication and control. Clinical Neurophysiology. 2002. doi:10.1016/S1388-2457(02)00057-3',
    scope:
      'Reviews brain-computer interfaces that translate brain signals into communication or control outputs. It does not evaluate this website, this CSV, or a rule that changes the number of phrases from a variability tertile.',
  },
] as const

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

      <section className="block" id="current-and-proposed">
        <h2>Current Implementation and Proposed System</h2>
        <p>
          The proposed workflow is EEG acquisition, then signal-quality assessment, then an
          adaptive communication board, then a user selection, then message output.
        </p>
        <h3>Implemented in this prototype</h3>
        <ul>
          <li>EEG feature data analysis and visualization from the supplied features.csv file.</li>
          <li>Variability-based demonstration states. These states are a sorting rule, not a validated reliability measurement.</li>
          <li>An interactive communication board with 16, 8, or 4 choices.</li>
          <li>A browser-based comparison of a fixed board and an adaptive board, with stored selections and descriptive outcomes.</li>
        </ul>
        <h3>Not yet implemented</h3>
        <ul>
          <li>Live EEG acquisition and processing.</li>
          <li>Validated EEG signal-quality assessment.</li>
          <li>EEG-driven automatic board adaptation.</li>
          <li>Integration with a trained EEG classifier.</li>
          <li>Evaluation with actual EEG users or participants.</li>
        </ul>
        <p>
          Advancing the proposed system requires documented EEG recordings, a defensible
          signal-quality assessment method, integration of that method with the interface, and
          appropriately designed participant studies.
        </p>
      </section>

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

      <section className="block" id="missing-methods">
        <h2>Missing methodological information</h2>
        <p>
          The items below are absent from the supplied files. They are listed so the gap is
          explicit. No value is estimated for any of them.
        </p>
        <ul>
          {MISSING_METHODS.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>

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
          The groups it produces are variability-based demonstration states. They illustrate a
          proposed adaptive mechanism. They are not validated EEG reliability measurements.
          The experiment log is created when someone uses the <Link to="/experiments">experiments page</Link>.
          Those trials are browser selections. The target pool can be the full vocabulary or the
          four essential phrases. They are not an EEG study, and the page does not report a
          significance test.
        </p>
      </section>

      <section className="block" id="reproducibility">
        <h2>Reproducibility</h2>
        <ul>
          <li>Dataset source: unknown. No license, recording site, or data-use statement was supplied.</li>
          <li>Recording metadata: not supplied. Sampling rate, duration, montage, reference, and filters are absent.</li>
          <li>Preprocessing and feature extraction: not supplied. The five CSV columns are used as stored.</li>
          <li>Signal-quality calculation: not run. src/lib/signal-quality.ts returns unavailable and does not read the CSV.</li>
          <li>Thresholds: none are set, so the board sizes 16, 8, and 4 are not applied from a quality score.</li>
          <li>Classifier: none is included. The confidence slider is a page control.</li>
          <li>Browser experiment: unseeded draws. A paired sequence stores the realized targets in the trial log. The log is browser-demonstration data in localStorage key voxneura.trials.v1.</li>
          <li>Software: React, Vite, and TypeScript, with versions in package.json. npm test runs the parser, the tertile split, the quality gate, and the trial summaries.</li>
        </ul>
      </section>

      <section className="block" id="future">
        <h2>What is required next</h2>
        <ol>
          <li>Add a continuous multichannel recording with sampling rate, channel names, units, reference, and filters.</li>
          <li>Define each quality indicator in those units, then set cutoffs from an independent labeled set or a published standard.</li>
          <li>Only after that cutoff exists, connect it to the 16, 8, and 4 phrase boards and keep classifier confidence separate.</li>
          <li>A comparison of fixed and adaptive boards with participants needs review with the project mentor and the appropriate research oversight before recruitment.</li>
        </ol>
      </section>

      <section className="block" id="limitations">
        <h2>Limitations</h2>
        <ul>
          <li>This is not a medical device, and no clinical validation is claimed.</li>
          <li>Selecting a word is not evidence that EEG classified an intention.</li>
          <li>The feature rows are not identified as independent participants.</li>
          <li>The screenshots are pictures of a viewer. They are not the recording.</li>
          <li>Figure 1 and Figure 2 use different microvolt scales, so their amplitudes should not be compared by eye.</li>
          <li>The variability tertiles are equal-count bins. They can split a narrow range into three labels. That split has not been validated as EEG reliability.</li>
          <li>High variability is not labeled as artifact anywhere in the file, and low variability is not labeled as a reliable signal.</li>
          <li>No EEG quality score is calculated, and no cutoff assigns the 16, 8, or 4 phrase boards.</li>
          <li>The browser experiment can hide a full-vocabulary target on the shorter adaptive boards. Its results are descriptive. One operator and an unseeded draw do not establish that adaptation improves communication.</li>
          <li>The confidence slider is not the output of a trained classifier.</li>
          <li>Speech depends on the browser. HELP does not contact anyone. No patient communication was recorded.</li>
          <li>The references below are background reading. They were not in the supplied project files, and they are not evidence that this demonstration works.</li>
        </ul>
      </section>

      <section className="block" id="references">
        <h2>References</h2>
        <p>
          No bibliography was supplied with the project. The three records below were checked
          against their publishers. Each note states what the source covers. None of them tested
          variability-tertiles-v1, and none of them reports a result from this dataset.
        </p>
        {REFERENCES.map((item) => (
          <section key={item.cite}>
            <h3>{item.topic}</h3>
            <p>{item.cite}</p>
            <p>{item.scope}</p>
          </section>
        ))}
        <p>
          No verified source in this revision evaluates an interface that changes the number of
          communication phrases from a variability tertile. That claim is not attached to the
          papers above.
        </p>
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
          Rule {RULE_ID} places these rows into {counts.high} high, {counts.medium} medium, and{' '}
          {counts.low} low variability-based demonstration states. Those counts are a reproducible
          sort, not a validated reliability classification.
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

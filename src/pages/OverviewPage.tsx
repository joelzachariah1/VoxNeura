import { Link } from 'react-router-dom'
import { PageHeader } from '../components/PageHeader.tsx'
import { usePageTitle } from '../components/usePageTitle.ts'
import { useFeatures } from '../context/features-state.ts'
import { RELIABILITY_LEVELS } from '../lib/reliability.ts'
import { VOCAB, reliabilityLabel } from '../lib/vocabulary.ts'

const SECTIONS = [
  ['/data', 'Data', 'The feature table, descriptive statistics, and charts.'],
  ['/figures', 'Figures', 'The clean EEG, noisy EEG, and power spectrum images.'],
  ['/reliability', 'Reliability', 'How signal reliability differs from classifier confidence.'],
  ['/interface', 'Interface', 'The working board. High, medium, and low change the choices.'],
  ['/experiments', 'Experiments', 'A labeled comparison of fixed and adaptive boards.'],
  ['/research', 'Research', 'What the files support, and what they do not.'],
] as const

export function OverviewPage() {
  usePageTitle('Overview')
  const data = useFeatures()
  const fileLine =
    data.status === 'ready'
      ? `The supplied table has ${data.rows.length} rows and five columns: theta, alpha, beta, variability, and mean_amp.`
      : data.status === 'loading'
        ? 'The feature table is loading.'
        : data.message

  return (
    <>
      <PageHeader eyebrow="Overview" title="Choices that shrink when the signal is less reliable">
        <p>
          VoxNeura is an adaptive communication interface. When EEG signal reliability is judged
          to be high, the board offers more phrases.
          When it is moderate, the board is shorter. When it is low, the board keeps YES, NO, HELP,
          and RETRY.
        </p>
        <p>
          EEG measures voltage at the scalp. It does not contain words, and this application does
          not read thoughts. A message leaves the board only when someone selects it.
        </p>
      </PageHeader>

      <section className="block" aria-labelledby="idea">
        <h2 id="idea">The idea, in one path</h2>
        <ol className="flow">
          <li>
            <h3>Feature row</h3>
            <p>Five numbers from the supplied table. The file does not label them as clean or noisy.</p>
          </li>
          <li>
            <h3>Reliability state</h3>
            <p>High, medium, or low. This decides how many choices are offered.</p>
          </li>
          <li>
            <h3>Choice set</h3>
            <p>
              {VOCAB.high.length}, {VOCAB.medium.length}, or {VOCAB.low.length} phrases. Confidence
              does not change this count.
            </p>
          </li>
        </ol>
        <p>
          Classifier confidence is a different quantity. If a classifier existed, confidence would
          say how strongly it favored one label. It can be high on a bad signal. In this
          application a separate demonstration control uses confidence for one decision only:
          send a selection immediately, or wait for confirmation. <Link to="/reliability">Reliability</Link>{' '}
          shows the two controls moving independently.
        </p>
      </section>

      <section className="block" aria-labelledby="states">
        <h2 id="states">The three boards</h2>
        <p>
          These phrases were chosen for the demonstration. They are not a stimulus list from a
          published experiment.
        </p>
        <div className="state-list">
          {RELIABILITY_LEVELS.map((level) => (
            <section key={level}>
              <h3>
                {reliabilityLabel(level)} reliability, {VOCAB[level].length} choices
              </h3>
              <p>{VOCAB[level].join(', ')}</p>
            </section>
          ))}
        </div>
        <p>
          <Link to="/interface">Open the interface</Link> and switch High, Medium, and Low. The
          board changes immediately.
        </p>
      </section>

      <section className="block" aria-labelledby="materials">
        <h2 id="materials">What was supplied</h2>
        <p>{fileLine}</p>
        <p>
          There is no column for subject, time, task, label, or classifier probability. Three
          images were also supplied: a cleaner multichannel EEG view, a noisier view, and a power
          spectrum. The images do not say that they were computed from the same recording as the
          table.
        </p>
        <p>
          Anything this application calculates is marked Computed here. Anything that is a
          working example, including the reliability tertiles and the experiment log, is marked
          Demonstration.
        </p>
      </section>

      <section className="block" aria-labelledby="map">
        <h2 id="map">In this application</h2>
        <ol className="toc">
          {SECTIONS.map(([to, label, text]) => (
            <li key={to}>
              <Link to={to}>{label}</Link>
              <span>{text}</span>
            </li>
          ))}
        </ol>
      </section>
    </>
  )
}

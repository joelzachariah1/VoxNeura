import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { HistogramChart, XYChart } from '../components/Charts.tsx'
import type { ChartGuide } from '../components/Charts.tsx'
import { FeaturesGate } from '../components/FeaturesGate.tsx'
import { Mark } from '../components/Mark.tsx'
import { PageHeader } from '../components/PageHeader.tsx'
import { usePageTitle } from '../components/usePageTitle.ts'
import { downloadCsv, sha256Hex, toCsv } from '../lib/download.ts'
import {
  FEATURE_COLUMNS,
  RECORDED_SHA256,
  bandShares,
  correlationMatrix,
} from '../lib/features.ts'
import type { FeatureKey, FeatureRow } from '../lib/features.ts'
import { formatR, formatSci, formatShare, stamp } from '../lib/format.ts'
import { assignByVariability, binEdges } from '../lib/reliability.ts'
import type { Reliability, RowAssignment } from '../lib/reliability.ts'
import { columnStat, histogram, pearson } from '../lib/stats.ts'
import type { ColumnStat } from '../lib/stats.ts'

type SortKey =
  | 'index'
  | FeatureKey
  | 'thetaShare'
  | 'alphaShare'
  | 'betaShare'
  | 'rank'
  | 'state'

type SortDir = 'asc' | 'desc'

type ViewRow = FeatureRow & {
  thetaShare: number | null
  alphaShare: number | null
  betaShare: number | null
  rank: number
  state: Reliability
}

const STATE_ORDER: Record<Reliability, number> = { high: 0, medium: 1, low: 2 }

const FILE_HEADERS: { key: SortKey; label: string }[] = [
  { key: 'index', label: 'Row' },
  { key: 'theta', label: 'Theta' },
  { key: 'alpha', label: 'Alpha' },
  { key: 'beta', label: 'Beta' },
  { key: 'variability', label: 'Variability' },
  { key: 'mean_amp', label: 'Mean amplitude' },
]

const COMPUTED_HEADERS: { key: SortKey; label: string }[] = [
  { key: 'thetaShare', label: 'Theta share' },
  { key: 'alphaShare', label: 'Alpha share' },
  { key: 'betaShare', label: 'Beta share' },
  { key: 'rank', label: 'Variability rank' },
  { key: 'state', label: 'State' },
]

export function DataPage() {
  usePageTitle('Data')
  return (
    <>
      <PageHeader eyebrow="Data" title="features.csv, as supplied">
        <p>
          <Mark kind="recorded" /> The table below is the project file. Units, sampling rate,
          window length, and subject identifiers are not in it. Numbers are shown in scientific
          notation, with no unit conversion.
        </p>
      </PageHeader>
      <FeaturesGate>{(data) => <Explorer rows={data.rows} raw={data.raw} />}</FeaturesGate>
    </>
  )
}

function Explorer({ rows, raw }: { rows: FeatureRow[]; raw: string }) {
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir }>({ key: 'index', dir: 'asc' })
  const [selected, setSelected] = useState(1)
  const [jump, setJump] = useState('1')
  const [jumpError, setJumpError] = useState('')

  const assignments = useMemo(
    () => assignByVariability(rows.map((row) => ({ index: row.index, variability: row.variability }))),
    [rows],
  )
  const byIndex = useMemo(() => new Map(assignments.map((item) => [item.index, item])), [assignments])
  const view = useMemo(() => rows.map((row) => toView(row, assignmentFor(byIndex, row.index))), [rows, byIndex])
  const sorted = useMemo(() => {
    const copy = [...view]
    copy.sort((a, b) => compareRows(a, b, sort.key, sort.dir))
    return copy
  }, [view, sort])

  const fileStats = FEATURE_COLUMNS.map((key) =>
    columnStat(key, 'file', rows.map((row) => row[key])),
  )
  const shareStats = (['thetaShare', 'alphaShare', 'betaShare'] as const).map((key) =>
    columnStat(
      key,
      'computed',
      view.map((row) => row[key]).filter((value): value is number => value !== null),
    ),
  )
  const matrix = correlationMatrix(rows)
  const edges = binEdges(assignments)
  const guides: ChartGuide[] = [
    edges.highMax === null ? null : { value: edges.highMax },
    edges.mediumMax === null ? null : { value: edges.mediumMax },
  ].filter((guide): guide is ChartGuide => guide !== null)
  const selectedRow = view.find((row) => row.index === selected) ?? view[0]
  const thetaAlpha = pearson(
    rows.map((row) => row.alpha),
    rows.map((row) => row.theta),
  )
  const betaVariability = pearson(
    rows.map((row) => row.variability),
    rows.map((row) => row.beta),
  )

  function toggleSort(key: SortKey) {
    setSort((current) =>
      current.key === key
        ? { key, dir: current.dir === 'asc' ? 'desc' : 'asc' }
        : { key, dir: 'asc' },
    )
  }

  function goToRow(event: FormEvent) {
    event.preventDefault()
    const index = Number(jump)
    if (!Number.isInteger(index) || index < 1 || index > rows.length) {
      setJumpError(`Enter a whole number from 1 to ${rows.length}.`)
      return
    }
    setJumpError('')
    setSelected(index)
    document.getElementById(`row-${index}`)?.scrollIntoView({ block: 'center' })
  }

  function downloadStats() {
    downloadCsv(
      `voxneura-statistics-${stamp()}.csv`,
      toCsv(
        ['column', 'source', 'n', 'min', 'max', 'mean', 'sample_sd', 'q1', 'median', 'q3'],
        [...fileStats, ...shareStats].map(statRow),
      ),
    )
  }

  function downloadTable() {
    downloadCsv(
      `voxneura-table-${stamp()}.csv`,
      toCsv(
        [
          'row',
          'theta',
          'alpha',
          'beta',
          'variability',
          'mean_amp',
          'theta_share',
          'alpha_share',
          'beta_share',
          'variability_rank',
          'demonstration_state',
          'rule',
        ],
        sorted.map((row) => [
          row.index,
          row.theta,
          row.alpha,
          row.beta,
          row.variability,
          row.mean_amp,
          row.thetaShare,
          row.alphaShare,
          row.betaShare,
          row.rank,
          row.state,
          'variability-tertiles-v1',
        ]),
      ),
    )
  }

  function downloadCorrelations() {
    downloadCsv(
      `voxneura-correlations-${stamp()}.csv`,
      toCsv(
        ['column_a', 'column_b', 'pearson_r'],
        matrix.map((cell) => [cell.a, cell.b, cell.r]),
      ),
    )
  }

  return (
    <>
      <FileHash raw={raw} />
      <div className="tools">
        <a className="button" href="/data/features.csv" download="features.csv">
          Download original features.csv
        </a>
        <button type="button" onClick={downloadStats}>
          Download statistics
        </button>
        <button type="button" onClick={downloadTable}>
          Download table with computed columns
        </button>
        <button type="button" onClick={downloadCorrelations}>
          Download correlations
        </button>
      </div>

      <section className="block">
        <h2>
          <Mark kind="recorded" /> Descriptive statistics
        </h2>
        <p className="note">
          The mean is the arithmetic mean. The standard deviation uses the sample divisor n - 1.
          Quartiles use linear interpolation (Hyndman and Fan, type 7).
        </p>
        <StatTable caption="Statistics of the five columns stored in features.csv." rows={fileStats} />
      </section>

      <section className="block">
        <h2>
          <Mark kind="computed" /> Band shares
        </h2>
        <p className="note">
          Each share is that band column divided by the sum of theta, alpha, and beta in the same
          row. This is not a column in the file.
        </p>
        <StatTable caption="Statistics of the three computed band shares." rows={shareStats} />
      </section>

      <section className="block">
        <h2>
          <Mark kind="computed" /> Charts
        </h2>
        <XYChart
          caption="Theta, alpha, and beta in file order."
          filename="voxneura-bands.svg"
          xLabel="Row"
          yLabel="File value"
          series={[
            line('theta', 'Theta', '#f2f0e9', rows.map((row) => ({ x: row.index, y: row.theta }))),
            line('alpha', 'Alpha', '#9ec0ef', rows.map((row) => ({ x: row.index, y: row.alpha })), '5 4'),
            line('beta', 'Beta', '#e0b4a8', rows.map((row) => ({ x: row.index, y: row.beta })), '2 3'),
          ]}
        />
        <p className="note">
          Theta is solid, alpha is dashed, and beta is dotted. Neighboring rows often move
          together. The file does not say whether a row is a person, a trial, or a window, so
          these {rows.length} rows should not be read as {rows.length} independent participants.
        </p>
        <XYChart
          caption="Variability in file order. Dashed lines are the demonstration bin edges."
          filename="voxneura-variability.svg"
          xLabel="Row"
          yLabel="Variability"
          yGuides={guides}
          series={[line('variability', 'Variability', '#f2f0e9', rows.map((row) => ({ x: row.index, y: row.variability })))]}
        />
        <XYChart
          caption="Mean amplitude in file order. The gray line is zero."
          filename="voxneura-mean-amplitude.svg"
          xLabel="Row"
          yLabel="Mean amplitude"
          series={[line('mean', 'Mean amplitude', '#9ec0ef', rows.map((row) => ({ x: row.index, y: row.mean_amp })))]}
        />
        <XYChart
          caption="Share of each band in the sum of the three band columns."
          filename="voxneura-band-shares.svg"
          xLabel="Row"
          yLabel="Share"
          yDomain={[0, 1]}
          series={[
            line('theta', 'Theta', '#f2f0e9', sharePoints(view, 'thetaShare')),
            line('alpha', 'Alpha', '#9ec0ef', sharePoints(view, 'alphaShare'), '5 4'),
            line('beta', 'Beta', '#e0b4a8', sharePoints(view, 'betaShare'), '2 3'),
          ]}
        />
        <HistogramChart
          caption="Distribution of variability. Ten equal-width bins. Dashed lines are the bin edges."
          filename="voxneura-variability-histogram.svg"
          xLabel="Variability"
          bins={histogram(rows.map((row) => row.variability), 10)}
          xGuides={guides}
        />
        <XYChart
          mode="dots"
          caption={`Theta against alpha. Descriptive Pearson r = ${formatR(thetaAlpha)}. Not a significance test.`}
          filename="voxneura-theta-alpha.svg"
          xLabel="Alpha"
          yLabel="Theta"
          series={[line('pair', 'Rows', '#9ec0ef', rows.map((row) => ({ x: row.alpha, y: row.theta })))]}
        />
        <XYChart
          mode="dots"
          caption={`Beta against variability. Descriptive Pearson r = ${formatR(betaVariability)}. Not a significance test.`}
          filename="voxneura-beta-variability.svg"
          xLabel="Variability"
          yLabel="Beta"
          series={[line('pair', 'Rows', '#e0b4a8', rows.map((row) => ({ x: row.variability, y: row.beta })))]}
        />
      </section>

      <section className="block">
        <h2>
          <Mark kind="computed" /> Correlations
        </h2>
        <p className="note">
          Pearson r for every pair of file columns. The diagonal is 1. No p-value is reported.
        </p>
        <div className="table-wrap">
          <table className="numeric">
            <caption>Descriptive correlation matrix for the five file columns.</caption>
            <thead>
              <tr>
                <th scope="col">Column</th>
                {FEATURE_COLUMNS.map((key) => (
                  <th key={key} scope="col">
                    {key}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {FEATURE_COLUMNS.map((rowKey) => (
                <tr key={rowKey}>
                  <th scope="row">{rowKey}</th>
                  {FEATURE_COLUMNS.map((columnKey) => {
                    const cell = matrix.find((item) => item.a === rowKey && item.b === columnKey)
                    return <td key={columnKey}>{formatR(cell?.r ?? null)}</td>
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="block">
        <h2>All rows</h2>
        <p className="note">
          Row numbers follow the order in the file. They are not identifiers supplied with the
          data. State is the demonstration tertile. Sorting that column ascending puts high, then
          medium, then low.
        </p>
        <form className="form-row" onSubmit={goToRow}>
          <label htmlFor="jump">
            Go to row
            <input
              id="jump"
              inputMode="numeric"
              value={jump}
              onChange={(event) => setJump(event.target.value)}
            />
          </label>
          <button type="submit">Show row</button>
        </form>
        {jumpError ? (
          <p className="status" role="alert">
            {jumpError}
          </p>
        ) : null}
        {selectedRow ? <RowDetail row={selectedRow} total={rows.length} /> : null}
        <div className="table-wrap">
          <table className="numeric">
            <caption>
              All {rows.length} rows. The first six columns are the file. The last five are
              computed in this application.
            </caption>
            <thead>
              <tr>
                <th scope="colgroup" colSpan={FILE_HEADERS.length}>
                  File
                </th>
                <th scope="colgroup" colSpan={COMPUTED_HEADERS.length}>
                  Computed here
                </th>
              </tr>
              <tr>
                {[...FILE_HEADERS, ...COMPUTED_HEADERS].map((header) => (
                  <th
                    key={header.key}
                    scope="col"
                    aria-sort={
                      sort.key === header.key
                        ? sort.dir === 'asc'
                          ? 'ascending'
                          : 'descending'
                        : 'none'
                    }
                  >
                    <button type="button" onClick={() => toggleSort(header.key)}>
                      {header.label}
                      {sort.key === header.key ? (sort.dir === 'asc' ? ' ↑' : ' ↓') : ''}
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.map((row) => (
                <tr key={row.index} id={`row-${row.index}`} className={row.index === selected ? 'is-selected' : undefined}>
                  <th scope="row">
                    <button
                      type="button"
                      aria-pressed={row.index === selected}
                      onClick={() => setSelected(row.index)}
                    >
                      {row.index}
                    </button>
                  </th>
                  <td>{formatSci(row.theta)}</td>
                  <td>{formatSci(row.alpha)}</td>
                  <td>{formatSci(row.beta)}</td>
                  <td>{formatSci(row.variability)}</td>
                  <td>{formatSci(row.mean_amp)}</td>
                  <td>{formatShare(row.thetaShare)}</td>
                  <td>{formatShare(row.alphaShare)}</td>
                  <td>{formatShare(row.betaShare)}</td>
                  <td>{row.rank}</td>
                  <td>{row.state}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  )
}

function RowDetail({ row, total }: { row: ViewRow; total: number }) {
  return (
    <div className="detail">
      <h3>Row {row.index}</h3>
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
        <dt>Variability rank</dt>
        <dd>
          {row.rank} of {total}
        </dd>
        <dt>Demonstration state</dt>
        <dd>{row.state}</dd>
      </dl>
      <p>
        <Link to={`/interface?row=${row.index}`}>Match row {row.index} on the interface</Link>
      </p>
    </div>
  )
}

function StatTable({ caption, rows }: { caption: string; rows: ColumnStat[] }) {
  return (
    <div className="table-wrap">
      <table className="numeric">
        <caption>{caption}</caption>
        <thead>
          <tr>
            <th scope="col">Column</th>
            <th scope="col">n</th>
            <th scope="col">Minimum</th>
            <th scope="col">Q1</th>
            <th scope="col">Median</th>
            <th scope="col">Mean</th>
            <th scope="col">Q3</th>
            <th scope="col">Maximum</th>
            <th scope="col">Sample SD</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.column}>
              <th scope="row">{row.column}</th>
              <td>{row.n}</td>
              <td>{formatSci(row.min)}</td>
              <td>{formatSci(row.q1)}</td>
              <td>{formatSci(row.median)}</td>
              <td>{formatSci(row.mean)}</td>
              <td>{formatSci(row.q3)}</td>
              <td>{formatSci(row.max)}</td>
              <td>{row.sampleSd === null ? '' : formatSci(row.sampleSd)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function FileHash({ raw }: { raw: string }) {
  const [hash, setHash] = useState('Computing SHA-256.')
  useEffect(() => {
    let cancelled = false
    sha256Hex(raw)
      .then((value) => {
        if (!cancelled) setHash(value)
      })
      .catch((error: unknown) => {
        if (!cancelled) setHash(error instanceof Error ? error.message : 'SHA-256 failed.')
      })
    return () => {
      cancelled = true
    }
  }, [raw])
  const matches = hash === RECORDED_SHA256
  return (
    <p className="note">
      SHA-256 of the loaded file text: <span className="num">{hash}</span>
      {hash.startsWith('Computing') || hash.includes(' ')
        ? ''
        : matches
          ? ' This matches the hash recorded when the project file was added.'
          : ' This does not match the hash recorded when the project file was added.'}
    </p>
  )
}

function sharePoints(rows: ViewRow[], key: 'thetaShare' | 'alphaShare' | 'betaShare') {
  return rows.flatMap((row) => {
    const value = row[key]
    return value === null ? [] : [{ x: row.index, y: value }]
  })
}

function line(
  id: string,
  name: string,
  color: string,
  points: { x: number; y: number }[],
  dash?: string,
) {
  return { id, name, color, points, dash }
}

function toView(row: FeatureRow, assignment: RowAssignment): ViewRow {
  const shares = bandShares(row)
  return {
    ...row,
    thetaShare: shares?.theta ?? null,
    alphaShare: shares?.alpha ?? null,
    betaShare: shares?.beta ?? null,
    rank: assignment.rank,
    state: assignment.state,
  }
}

function assignmentFor(map: Map<number, RowAssignment>, index: number): RowAssignment {
  const found = map.get(index)
  if (!found) throw new Error(`No demonstration state for row ${index}.`)
  return found
}

function compareRows(a: ViewRow, b: ViewRow, key: SortKey, dir: SortDir): number {
  const sign = dir === 'asc' ? 1 : -1
  if (key === 'state') return (STATE_ORDER[a.state] - STATE_ORDER[b.state]) * sign
  const left = a[key]
  const right = b[key]
  if (left === null) return 1
  if (right === null) return -1
  return (Number(left) - Number(right)) * sign
}

function statRow(stat: ColumnStat): (string | number | null)[] {
  return [
    stat.column,
    stat.source,
    stat.n,
    stat.min,
    stat.max,
    stat.mean,
    stat.sampleSd,
    stat.q1,
    stat.median,
    stat.q3,
  ]
}

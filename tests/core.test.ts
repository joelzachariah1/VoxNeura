import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { toCsv } from '../src/lib/download.ts'
import { bandShares, correlationMatrix, parseFeatures } from '../src/lib/features.ts'
import { choicesFor, needsConfirmation, stateAt } from '../src/lib/protocol.ts'
import { assignByVariability, binCounts, binEdges } from '../src/lib/reliability.ts'
import { columnStat, histogram, mean, pearson, quantile, sampleSd } from '../src/lib/stats.ts'
import { summarizeGroup, summaryRows } from '../src/lib/trials.ts'
import type { TrialRecord } from '../src/lib/trials.ts'
import { VOCAB } from '../src/lib/vocabulary.ts'

const csvPath = fileURLToPath(new URL('../public/data/features.csv', import.meta.url))

describe('features.csv', () => {
  const rows = parseFeatures(readFileSync(csvPath, 'utf8'))

  it('parses 64 rows with the supplied header', () => {
    expect(rows).toHaveLength(64)
    expect(rows[0]?.index).toBe(1)
    expect(rows[63]?.index).toBe(64)
  })

  it('keeps theta, alpha, beta, and variability positive', () => {
    for (const row of rows) {
      expect(row.theta).toBeGreaterThan(0)
      expect(row.alpha).toBeGreaterThan(0)
      expect(row.beta).toBeGreaterThan(0)
      expect(row.variability).toBeGreaterThan(0)
    }
  })

  it('splits variability into 21, 21, and 22 without crossing ranks', () => {
    const assigned = assignByVariability(rows.map((row) => ({ index: row.index, variability: row.variability })))
    const counts = binCounts(rows.length)
    expect(counts).toEqual({ high: 21, medium: 21, low: 22 })
    const high = assigned.filter((row) => row.state === 'high')
    const medium = assigned.filter((row) => row.state === 'medium')
    const low = assigned.filter((row) => row.state === 'low')
    expect(high).toHaveLength(21)
    expect(medium).toHaveLength(21)
    expect(low).toHaveLength(22)
    const edges = binEdges(assigned)
    expect(edges.highMax).not.toBeNull()
    expect(edges.mediumMax).not.toBeNull()
    expect(edges.highMax as number).toBeLessThanOrEqual(Math.min(...medium.map((row) => row.variability)))
    expect(edges.mediumMax as number).toBeLessThanOrEqual(Math.min(...low.map((row) => row.variability)))
  })

  it('computes band shares that sum to 1', () => {
    for (const row of rows) {
      const shares = bandShares(row)
      expect(shares).not.toBeNull()
      expect((shares?.theta ?? 0) + (shares?.alpha ?? 0) + (shares?.beta ?? 0)).toBeCloseTo(1, 10)
    }
  })

  it('reports a correlation matrix with a unit diagonal', () => {
    const matrix = correlationMatrix(rows)
    expect(matrix).toHaveLength(25)
    for (const cell of matrix) {
      if (cell.a === cell.b) expect(cell.r).toBeCloseTo(1, 10)
    }
  })
})

describe('statistics', () => {
  it('uses the sample divisor for standard deviation', () => {
    expect(mean([1, 2, 3])).toBe(2)
    expect(sampleSd([1, 2, 3])).toBeCloseTo(1, 10)
    expect(sampleSd([1])).toBeNull()
  })

  it('matches Hyndman-Fan type 7 for a short series', () => {
    expect(quantile([1, 2, 3, 4], 0.25)).toBeCloseTo(1.75, 10)
    expect(quantile([1, 2, 3, 4], 0.5)).toBeCloseTo(2.5, 10)
  })

  it('returns pearson correlations of 1 and -1', () => {
    expect(pearson([1, 2, 3], [1, 2, 3])).toBeCloseTo(1, 10)
    expect(pearson([1, 2, 3], [3, 2, 1])).toBeCloseTo(-1, 10)
    expect(pearson([1, 1, 1], [1, 2, 3])).toBeNull()
  })

  it('puts every value into a histogram bin', () => {
    const bins = histogram([1, 2, 3, 4], 4)
    expect(bins.reduce((sum, bin) => sum + bin.count, 0)).toBe(4)
  })

  it('rejects a changed header', () => {
    expect(() => parseFeatures('a,b\n1,2\n')).toThrow(/header/)
  })

  it('labels column statistics with their source', () => {
    const stat = columnStat('theta', 'file', [1, 2, 3, 4])
    expect(stat.source).toBe('file')
    expect(stat.n).toBe(4)
    expect(stat.min).toBe(1)
    expect(stat.max).toBe(4)
  })
})

describe('protocol', () => {
  it('keeps the essential words inside every board', () => {
    expect(VOCAB.low).toEqual(['YES', 'NO', 'HELP', 'RETRY'])
    expect(VOCAB.medium.slice(0, 4)).toEqual([...VOCAB.low])
    expect(VOCAB.high.slice(0, 8)).toEqual([...VOCAB.medium])
    expect(VOCAB.high).toHaveLength(16)
  })

  it('changes step-down at 5 and 10 seconds', () => {
    expect(stateAt('step-down', 4999)).toBe('high')
    expect(stateAt('step-down', 5000)).toBe('medium')
    expect(stateAt('step-down', 9999)).toBe('medium')
    expect(stateAt('step-down', 10000)).toBe('low')
    expect(stateAt('held-high', 20000)).toBe('high')
    expect(stateAt('held-low', 0)).toBe('low')
  })

  it('lets the fixed policy ignore reliability', () => {
    expect(choicesFor('fixed', 'low')).toHaveLength(16)
    expect(choicesFor('adaptive', 'low')).toHaveLength(4)
    expect(choicesFor('adaptive', 'medium')).toHaveLength(8)
  })

  it('requires confirmation only below 70', () => {
    expect(needsConfirmation(69)).toBe(true)
    expect(needsConfirmation(70)).toBe(false)
  })

  it('breaks ties in variability by file order', () => {
    const assigned = assignByVariability([
      { index: 2, variability: 1 },
      { index: 1, variability: 1 },
      { index: 3, variability: 1 },
    ])
    expect(assigned.map((row) => row.index)).toEqual([1, 2, 3])
    expect(assigned.map((row) => row.state)).toEqual(['high', 'medium', 'low'])
  })
})

describe('trials and csv', () => {
  it('quotes commas and round-trips a selection into the fixed group', () => {
    expect(toCsv(['a', 'b'], [['hello, there', null]])).toBe('a,b\r\n"hello, there",\r\n')
    const trial: TrialRecord = {
      id: 't1',
      startedAt: '2026-11-07T00:00:00.000Z',
      scenario: 'held-high',
      policy: 'fixed',
      target: 'YES',
      selection: 'YES',
      correct: true,
      rtMs: 1200,
      choiceCount: 16,
      reliability: 'high',
      endedBy: 'selection',
    }
    const summary = summaryRows([trial])
    expect(summarizeGroup([trial], 'Fixed').medianRtMs).toBe(1200)
    expect(summary.find((row) => row.key === 'Fixed')?.correct).toBe(1)
    expect(summary.find((row) => row.key === 'Adaptive')?.trials).toBe(0)
    expect(summary.find((row) => row.key === 'Held high, fixed')?.selections).toBe(1)
  })
})

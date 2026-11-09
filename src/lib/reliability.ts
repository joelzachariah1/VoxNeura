export type Reliability = 'high' | 'medium' | 'low'

export const RELIABILITY_LEVELS: readonly Reliability[] = ['high', 'medium', 'low']

export const RULE_ID = 'variability-tertiles-v1'

export const RULE_SUMMARY =
  'Rows are ordered by variability, lowest first. The first third is the high variability-based demonstration state, the middle third is medium, and the remaining rows are low. When the row count is not divisible by 3, the low state receives the extra rows. Lower variability is mapped to the larger choice set. This mapping is a demonstration assumption. It illustrates a proposed adaptive mechanism. It is not a validated measurement of EEG reliability. The file has no artifact labels, signal-quality labels, or reliability scores. A high-variability row is not identified as noise, and a low-variability row is not identified as a reliable signal.'

export type VariabilityRow = { index: number; variability: number }

export type RowAssignment = {
  index: number
  variability: number
  rank: number
  state: Reliability
}

export function binCounts(n: number): { high: number; medium: number; low: number } {
  if (n < 0) throw new Error('row count cannot be negative')
  const high = Math.floor(n / 3)
  const mediumEnd = Math.floor((2 * n) / 3)
  return { high, medium: mediumEnd - high, low: n - mediumEnd }
}

export function assignByVariability(rows: VariabilityRow[]): RowAssignment[] {
  const sorted = [...rows].sort(
    (a, b) => a.variability - b.variability || a.index - b.index,
  )
  const cuts = binCounts(sorted.length)
  return sorted.map((row, index) => {
    let state: Reliability = 'low'
    if (index < cuts.high) state = 'high'
    else if (index < cuts.high + cuts.medium) state = 'medium'
    return {
      index: row.index,
      variability: row.variability,
      rank: index + 1,
      state,
    }
  })
}

export function binEdges(assignments: RowAssignment[]): {
  highMax: number | null
  mediumMax: number | null
} {
  const high = assignments.filter((row) => row.state === 'high').map((row) => row.variability)
  const medium = assignments
    .filter((row) => row.state === 'medium')
    .map((row) => row.variability)
  return {
    highMax: high.length ? Math.max(...high) : null,
    mediumMax: medium.length ? Math.max(...medium) : null,
  }
}

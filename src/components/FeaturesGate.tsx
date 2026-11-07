import type { ReactNode } from 'react'
import { useFeatures } from '../context/features-state.ts'
import type { FeatureRow } from '../lib/features.ts'

export function FeaturesGate({
  children,
}: {
  children: (data: { rows: FeatureRow[]; raw: string }) => ReactNode
}) {
  const state = useFeatures()
  if (state.status === 'loading') {
    return <p className="status">Loading features.csv.</p>
  }
  if (state.status === 'error') {
    return (
      <p className="status" role="alert">
        {state.message}
      </p>
    )
  }
  return children({ rows: state.rows, raw: state.raw })
}

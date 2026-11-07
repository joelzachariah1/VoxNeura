import { createContext, useContext } from 'react'
import type { FeatureRow } from '../lib/features.ts'

export type FeaturesState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; rows: FeatureRow[]; raw: string }

export const FeaturesContext = createContext<FeaturesState>({ status: 'loading' })

export function useFeatures(): FeaturesState {
  return useContext(FeaturesContext)
}

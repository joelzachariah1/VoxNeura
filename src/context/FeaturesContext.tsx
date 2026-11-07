import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { parseFeatures } from '../lib/features.ts'
import { FeaturesContext } from './features-state.ts'
import type { FeaturesState } from './features-state.ts'

export function FeaturesProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<FeaturesState>({ status: 'loading' })

  useEffect(() => {
    let cancelled = false
    fetch('/data/features.csv')
      .then((response) => {
        if (!response.ok) {
          throw new Error(`features.csv could not be loaded (HTTP ${response.status}).`)
        }
        return response.text()
      })
      .then((raw) => {
        if (cancelled) return
        setState({ status: 'ready', rows: parseFeatures(raw), raw })
      })
      .catch((error: unknown) => {
        if (cancelled) return
        const message = error instanceof Error ? error.message : 'features.csv could not be loaded.'
        setState({ status: 'error', message })
      })
    return () => {
      cancelled = true
    }
  }, [])

  return <FeaturesContext.Provider value={state}>{children}</FeaturesContext.Provider>
}

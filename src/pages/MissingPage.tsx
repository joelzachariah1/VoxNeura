import { Link } from 'react-router-dom'
import { usePageTitle } from '../components/usePageTitle.ts'

export function MissingPage() {
  usePageTitle('Not found')
  return (
    <>
      <h1>This page is not in VoxNeura</h1>
      <p>
        <Link to="/">Return to the overview</Link>
      </p>
    </>
  )
}

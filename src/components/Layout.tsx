import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { ErrorBoundary } from './ErrorBoundary.tsx'

const NAV = [
  { to: '/', label: 'Overview', end: true },
  { to: '/data', label: 'Data', end: false },
  { to: '/figures', label: 'Figures', end: false },
  { to: '/reliability', label: 'Reliability', end: false },
  { to: '/interface', label: 'Interface', end: false },
  { to: '/experiments', label: 'Experiments', end: false },
  { to: '/research', label: 'Research', end: false },
]

export function Layout() {
  const location = useLocation()
  return (
    <div className="shell">
      <a className="skip" href="#content">
        Skip to content
      </a>
      <header className="mast">
        <NavLink to="/" end className="brand">
          <span className="brand-name">VoxNeura</span>
        </NavLink>
        <nav aria-label="Primary">
          <ul>
            {NAV.map((item) => (
              <li key={item.to}>
                <NavLink to={item.to} end={item.end}>
                  {item.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
        <p className="mast-note">Not a clinical device.</p>
      </header>
      <div className="main-col">
        <main id="content" tabIndex={-1}>
          <ErrorBoundary key={location.pathname}>
            <Outlet />
          </ErrorBoundary>
        </main>
        <footer className="colophon">
          <p>VoxNeura. Adaptive EEG communication interface. Demonstration software.</p>
        </footer>
      </div>
    </div>
  )
}

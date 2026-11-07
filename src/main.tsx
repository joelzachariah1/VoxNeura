import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource-variable/geist/wght.css'
import '@fontsource-variable/geist/wght-italic.css'
import '@fontsource/ibm-plex-mono/latin-400.css'
import './styles.css'
import App from './App.tsx'

const root = document.getElementById('root')
if (!root) throw new Error('Root element missing.')

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

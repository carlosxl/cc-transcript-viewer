import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './index.css'

const root = document.documentElement
if (!root.getAttribute('data-theme')) root.setAttribute('data-theme', 'dark')
if (!root.getAttribute('data-density')) root.setAttribute('data-density', 'comfortable')

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

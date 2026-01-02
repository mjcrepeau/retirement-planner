import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { CountryProvider } from './contexts/CountryContext'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <CountryProvider initialCountry="US">
      <App />
    </CountryProvider>
  </StrictMode>,
)

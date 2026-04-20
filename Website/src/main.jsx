import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HelmetProvider } from 'react-helmet-async'
import './index.css'
import App from './App.jsx'
import DeferredAnalytics from './components/DeferredAnalytics.jsx'
import { SpeedInsights } from '@vercel/speed-insights/react'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <HelmetProvider>
      <App />
      <DeferredAnalytics />
      <SpeedInsights />
    </HelmetProvider>
  </StrictMode>,
)

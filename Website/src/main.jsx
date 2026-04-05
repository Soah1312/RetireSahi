import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import DeferredAnalytics from './components/DeferredAnalytics.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
    <DeferredAnalytics />
  </StrictMode>,
)

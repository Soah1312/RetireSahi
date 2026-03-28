import { BrowserRouter, Routes, Route } from 'react-router-dom';
import LandingPage from './pages/LandingPage';
import Onboarding from './pages/Onboarding';
import Dashboard from './pages/Dashboard';
import TaxShield from './pages/TaxShield';
import Learn from './pages/Learn';
import Methodology from './pages/Methodology';
import DreamPlanner from './pages/DreamPlanner';
import AICopilot from './pages/AICopilot';
import Settings from './pages/Settings';
import ProtectedRoute from './components/ProtectedRoute';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/onboarding" element={<ProtectedRoute><Onboarding /></ProtectedRoute>} />
        <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
        <Route path="/tax-shield" element={<ProtectedRoute><TaxShield /></ProtectedRoute>} />
        <Route path="/learn" element={<Learn />} />
        <Route path="/methodology" element={<Methodology />} />
        <Route path="/dream-planner" element={<ProtectedRoute><DreamPlanner /></ProtectedRoute>} />
        <Route path="/ai-copilot" element={<ProtectedRoute><AICopilot /></ProtectedRoute>} />
        <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;

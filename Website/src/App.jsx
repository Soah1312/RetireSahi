import { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import ProtectedRoute from './components/ProtectedRoute';
import { AuthSessionProvider } from './components/AuthSessionProvider';

const LandingPage = lazy(() => import('./pages/LandingPage'));
const Onboarding = lazy(() => import('./pages/Onboarding'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const TaxShield = lazy(() => import('./pages/TaxShield'));
const Learn = lazy(() => import('./pages/Learn'));
const Methodology = lazy(() => import('./pages/Methodology'));
const DreamPlanner = lazy(() => import('./pages/DreamPlanner'));
const AICopilot = lazy(() => import('./pages/AICopilot'));
const Settings = lazy(() => import('./pages/Settings'));

function RouteFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#FFFDF5]">
      <div className="animate-pulse flex flex-col items-center">
        <div className="w-16 h-16 bg-[#8B5CF6]/20 rounded-full mb-4" />
        <div className="h-4 w-32 bg-slate-200 rounded" />
      </div>
    </div>
  );
}

function App() {
  return (
    <AuthSessionProvider>
      <BrowserRouter>
        <Suspense fallback={<RouteFallback />}>
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
        </Suspense>
      </BrowserRouter>
    </AuthSessionProvider>
  );
}

export default App;

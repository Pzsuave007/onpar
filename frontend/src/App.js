import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Toaster } from 'sonner';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import Navbar from '@/components/Navbar';
import LandingPage from '@/pages/LandingPage';
import LoginPage from '@/pages/LoginPage';
import AuthCallback from '@/pages/AuthCallback';
import PlayerDashboard from '@/pages/PlayerDashboard';
import ScorecardEntry from '@/pages/ScorecardEntry';
import AdminPanel from '@/pages/AdminPanel';
import PublicLeaderboard from '@/pages/PublicLeaderboard';
import PlayerProfile from '@/pages/PlayerProfile';
import LiveScorer from '@/pages/LiveScorer';
import Challenges from '@/pages/Challenges';
import ChallengeDetail from '@/pages/ChallengeDetail';
import PlayRound from '@/pages/PlayRound';
import '@/App.css';

function ProtectedRoute({ children, adminOnly = false }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F4F4F0]">
        <div className="animate-pulse text-[#1B3C35] text-lg font-medium">Loading...</div>
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  if (adminOnly && user.role !== 'admin') return <Navigate to="/dashboard" replace />;
  return children;
}

function AppRouter() {
  const location = useLocation();

  // Check for OAuth callback synchronously before rendering routes
  if (location.hash?.includes('session_id=')) {
    return <AuthCallback />;
  }

  return (
    <>
      <Navbar />
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/leaderboard" element={<PublicLeaderboard />} />
        <Route path="/leaderboard/:tournamentId" element={<PublicLeaderboard />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/dashboard" element={<ProtectedRoute><PlayerDashboard /></ProtectedRoute>} />
        <Route path="/scorecard/:tournamentId" element={<ProtectedRoute><ScorecardEntry /></ProtectedRoute>} />
        <Route path="/admin" element={<ProtectedRoute adminOnly><AdminPanel /></ProtectedRoute>} />
        <Route path="/keeper/:tournamentId" element={<ProtectedRoute adminOnly><LiveScorer /></ProtectedRoute>} />
        <Route path="/challenges" element={<Challenges />} />
        <Route path="/challenges/:challengeId" element={<ChallengeDetail />} />
        <Route path="/play" element={<ProtectedRoute><PlayRound /></ProtectedRoute>} />
        <Route path="/play/:courseId" element={<ProtectedRoute><PlayRound /></ProtectedRoute>} />
        <Route path="/player/:userId" element={<PlayerProfile />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRouter />
        <Toaster position="top-right" richColors />
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;

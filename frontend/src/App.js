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
import Tours from '@/pages/Tours';
import TourDetail from '@/pages/TourDetail';
import TournamentSettings from '@/pages/TournamentSettings';
import TournamentEdit from '@/pages/TournamentEdit';
import TournamentTeams from '@/pages/TournamentTeams';
import CourseSearch from '@/pages/CourseSearch';
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
        <Route path="/tournaments/join/:inviteCode" element={<PublicLeaderboard />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/dashboard" element={<ProtectedRoute><PlayerDashboard /></ProtectedRoute>} />
        <Route path="/scorecard/:tournamentId" element={<ProtectedRoute><ScorecardEntry /></ProtectedRoute>} />
        <Route path="/admin" element={<ProtectedRoute adminOnly><AdminPanel /></ProtectedRoute>} />
        <Route path="/keeper/:tournamentId" element={<ProtectedRoute><LiveScorer /></ProtectedRoute>} />
        <Route path="/tournament/:tournamentId/settings" element={<ProtectedRoute adminOnly><TournamentSettings /></ProtectedRoute>} />
        <Route path="/tournament/:tournamentId/teams" element={<ProtectedRoute adminOnly><TournamentTeams /></ProtectedRoute>} />
        <Route path="/tournament/:tournamentId/edit" element={<ProtectedRoute adminOnly><TournamentEdit /></ProtectedRoute>} />
        <Route path="/tournament/new/edit" element={<ProtectedRoute adminOnly><TournamentEdit /></ProtectedRoute>} />
        <Route path="/courses/search" element={<ProtectedRoute adminOnly><CourseSearch /></ProtectedRoute>} />
        <Route path="/challenges" element={<Challenges />} />
        <Route path="/challenges/:challengeId" element={<ChallengeDetail />} />
        <Route path="/challenges/join/:inviteCode" element={<Challenges />} />
        <Route path="/play" element={<ProtectedRoute><PlayRound /></ProtectedRoute>} />
        <Route path="/play/:courseId" element={<ProtectedRoute><PlayRound /></ProtectedRoute>} />
        <Route path="/tours" element={<Tours />} />
        <Route path="/tournaments" element={<Tours />} />
        <Route path="/tours/:tourId" element={<TourDetail />} />
        <Route path="/tours/join/:inviteCode" element={<TourDetail />} />
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

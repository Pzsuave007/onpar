import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Flag, LayoutDashboard, Shield, LogOut, Menu, X } from 'lucide-react';
import { useState } from 'react';

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  return (
    <nav className="glass-nav sticky top-0 z-50" data-testid="navbar">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <Link to="/" className="flex items-center gap-2 group" data-testid="nav-logo">
            <Flag className="h-6 w-6 text-[#1B3C35]" />
            <span className="text-xl font-bold text-[#1B3C35] tracking-tight" style={{ fontFamily: 'Outfit' }}>
              Fairway
            </span>
          </Link>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-1">
            <Link to="/leaderboard" data-testid="nav-leaderboard">
              <Button variant="ghost" className="text-[#1B3C35] hover:bg-[#E8E9E3]">Leaderboard</Button>
            </Link>
            {user && (
              <Link to="/dashboard" data-testid="nav-dashboard">
                <Button variant="ghost" className="text-[#1B3C35] hover:bg-[#E8E9E3]">
                  <LayoutDashboard className="h-4 w-4 mr-1" />Dashboard
                </Button>
              </Link>
            )}
            {user?.role === 'admin' && (
              <Link to="/admin" data-testid="nav-admin">
                <Button variant="ghost" className="text-[#1B3C35] hover:bg-[#E8E9E3]">
                  <Shield className="h-4 w-4 mr-1" />Admin
                </Button>
              </Link>
            )}
          </div>

          <div className="hidden md:flex items-center gap-3">
            {user ? (
              <div className="flex items-center gap-3">
                <span className="text-sm text-[#6B6E66]" data-testid="nav-user-name">{user.name}</span>
                <Button variant="outline" size="sm" onClick={handleLogout} data-testid="nav-logout-btn"
                  className="border-[#E2E3DD] text-[#1B3C35] hover:bg-[#E8E9E3]">
                  <LogOut className="h-4 w-4 mr-1" />Logout
                </Button>
              </div>
            ) : (
              <Link to="/login" data-testid="nav-login">
                <Button className="bg-[#1B3C35] hover:bg-[#1B3C35]/90 text-white">Sign In</Button>
              </Link>
            )}
          </div>

          {/* Mobile menu button */}
          <button className="md:hidden p-2" onClick={() => setMobileOpen(!mobileOpen)} data-testid="nav-mobile-toggle">
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>

        {/* Mobile menu */}
        {mobileOpen && (
          <div className="md:hidden pb-4 border-t border-[#E2E3DD] pt-3 space-y-2 fade-in">
            <Link to="/leaderboard" className="block px-3 py-2 rounded-lg hover:bg-[#E8E9E3] text-[#1B3C35]"
              onClick={() => setMobileOpen(false)} data-testid="nav-mobile-leaderboard">Leaderboard</Link>
            {user && (
              <Link to="/dashboard" className="block px-3 py-2 rounded-lg hover:bg-[#E8E9E3] text-[#1B3C35]"
                onClick={() => setMobileOpen(false)} data-testid="nav-mobile-dashboard">Dashboard</Link>
            )}
            {user?.role === 'admin' && (
              <Link to="/admin" className="block px-3 py-2 rounded-lg hover:bg-[#E8E9E3] text-[#1B3C35]"
                onClick={() => setMobileOpen(false)} data-testid="nav-mobile-admin">Admin</Link>
            )}
            {user ? (
              <button className="block w-full text-left px-3 py-2 rounded-lg hover:bg-[#E8E9E3] text-[#C96A52]"
                onClick={() => { handleLogout(); setMobileOpen(false); }} data-testid="nav-mobile-logout">Logout</button>
            ) : (
              <Link to="/login" className="block px-3 py-2 rounded-lg bg-[#1B3C35] text-white text-center"
                onClick={() => setMobileOpen(false)} data-testid="nav-mobile-login">Sign In</Link>
            )}
          </div>
        )}
      </div>
    </nav>
  );
}

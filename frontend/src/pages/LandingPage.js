import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { Flag, Trophy, Target, Globe, Camera, CirclePlay } from 'lucide-react';

const HERO_IMG = 'https://images.unsplash.com/photo-1768396747921-5a18367415d2?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NTY2NzZ8MHwxfHNlYXJjaHwyfHxnb2xmJTIwY291cnNlJTIwZmFpcndheSUyMGdyZWVuJTIwYWVyaWFsfGVufDB8fHx8MTc3NjQwMDQ5Nnww&ixlib=rb-4.1.0&q=85';

export default function LandingPage() {
  const { user } = useAuth();

  return (
    <div className="min-h-[calc(100vh-4rem)] flex flex-col" data-testid="landing-page">

      {/* Hero - Full screen, no scroll needed */}
      <div className="relative flex-1 flex flex-col justify-end">
        {/* Background image */}
        <div className="absolute inset-0">
          <img src={HERO_IMG} alt="Golf course" className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#1B3C35] via-[#1B3C35]/60 to-transparent" />
        </div>

        {/* Content */}
        <div className="relative z-10 px-6 pb-8 pt-20 max-w-lg mx-auto w-full">
          {/* Logo */}
          <div className="flex items-center gap-2 mb-6">
            <Flag className="h-7 w-7 text-white" />
            <span className="text-2xl font-bold text-white tracking-tight" style={{ fontFamily: 'Outfit' }}>
              OnPar <span className="text-[#C96A52]">Live</span>
            </span>
          </div>

          {/* Headline */}
          <h1 className="text-3xl sm:text-4xl font-bold text-white leading-tight mb-3" style={{ fontFamily: 'Outfit' }}>
            Track Scores.<br />
            Share the Game.
          </h1>
          <p className="text-base text-white/80 mb-8 leading-relaxed">
            Live scoring, photo feed, leaderboards, and challenges — all from your phone.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col gap-3 mb-8">
            {user ? (
              <Link to="/dashboard" data-testid="hero-dashboard-btn">
                <Button className="w-full h-14 text-base bg-[#C96A52] hover:bg-[#C96A52]/90 rounded-xl font-semibold">
                  <CirclePlay className="h-5 w-5 mr-2" />Go to Dashboard
                </Button>
              </Link>
            ) : (
              <Link to="/login" data-testid="hero-get-started-btn">
                <Button className="w-full h-14 text-base bg-[#C96A52] hover:bg-[#C96A52]/90 rounded-xl font-semibold">
                  <CirclePlay className="h-5 w-5 mr-2" />Get Started Free
                </Button>
              </Link>
            )}
            <Link to="/leaderboard" data-testid="hero-leaderboard-btn">
              <Button variant="outline" className="w-full h-12 text-base border-white/30 text-white hover:bg-white/10 rounded-xl">
                <Trophy className="h-5 w-5 mr-2" />View Leaderboard
              </Button>
            </Link>
          </div>

          {/* Quick features - compact icons */}
          <div className="flex justify-between px-2">
            <div className="flex flex-col items-center gap-1">
              <div className="w-10 h-10 rounded-full bg-white/15 flex items-center justify-center">
                <Trophy className="h-5 w-5 text-white" />
              </div>
              <span className="text-[10px] text-white/70 font-medium">Leaderboard</span>
            </div>
            <div className="flex flex-col items-center gap-1">
              <div className="w-10 h-10 rounded-full bg-white/15 flex items-center justify-center">
                <Camera className="h-5 w-5 text-white" />
              </div>
              <span className="text-[10px] text-white/70 font-medium">Live Photos</span>
            </div>
            <div className="flex flex-col items-center gap-1">
              <div className="w-10 h-10 rounded-full bg-white/15 flex items-center justify-center">
                <Target className="h-5 w-5 text-white" />
              </div>
              <span className="text-[10px] text-white/70 font-medium">Challenges</span>
            </div>
            <div className="flex flex-col items-center gap-1">
              <div className="w-10 h-10 rounded-full bg-white/15 flex items-center justify-center">
                <Globe className="h-5 w-5 text-white" />
              </div>
              <span className="text-[10px] text-white/70 font-medium">Virtual Tournaments</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

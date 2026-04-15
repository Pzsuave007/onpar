import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { ClipboardList, Trophy, BarChart3 } from 'lucide-react';

const features = [
  {
    icon: ClipboardList,
    title: 'Hole-by-Hole Scoring',
    desc: 'Enter scores for each hole with real-time calculations. Supports both Stroke Play and Stableford formats.'
  },
  {
    icon: Trophy,
    title: 'Live Leaderboard',
    desc: 'PGA-style leaderboard with real-time standings, tie handling, and color-coded scores visible to everyone.'
  },
  {
    icon: BarChart3,
    title: 'Easy Administration',
    desc: 'Create and manage tournaments effortlessly. Set par for each hole, track players, and control tournament flow.'
  }
];

export default function LandingPage() {
  const { user } = useAuth();

  return (
    <div className="min-h-screen" data-testid="landing-page">
      {/* Hero */}
      <section className="relative h-[80vh] min-h-[500px] flex items-center overflow-hidden">
        <img
          src="https://images.unsplash.com/photo-1775686318424-9987122d8402?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NTY2OTV8MHwxfHNlYXJjaHwxfHxnb2xmJTIwY291cnNlJTIwYWVyaWFsJTIwdmlld3xlbnwwfHx8fDE3NzYyMTQyNzR8MA&ixlib=rb-4.1.0&q=85"
          alt="Golf course aerial"
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="hero-overlay absolute inset-0" />
        <div className="relative z-10 max-w-7xl mx-auto px-6 md:px-8 w-full">
          <div className="max-w-2xl">
            <p className="text-xs tracking-[0.2em] uppercase font-bold text-[#C96A52] mb-4">
              Tournament Management
            </p>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl tracking-tighter font-bold text-white mb-6" style={{ fontFamily: 'Outfit' }}>
              Your Golf Tournaments,{' '}
              <span className="text-[#C96A52]">Simplified</span>
            </h1>
            <p className="text-base md:text-lg text-white/80 mb-8 leading-relaxed max-w-lg">
              Manage tournaments, enter scores hole by hole, and share live leaderboards with the world. Built for organizers and players alike.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link to="/leaderboard" data-testid="hero-leaderboard-btn">
                <Button size="lg" className="bg-white text-[#1B3C35] hover:bg-white/90 font-semibold px-8 h-12">
                  View Leaderboard
                </Button>
              </Link>
              <Link to={user ? '/dashboard' : '/login'} data-testid="hero-get-started-btn">
                <Button size="lg" className="bg-[#C96A52] text-white hover:bg-[#C96A52]/90 font-semibold px-8 h-12">
                  {user ? 'Go to Dashboard' : 'Get Started'}
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 px-6 md:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-2xl sm:text-3xl lg:text-4xl tracking-tight font-semibold text-[#1B3C35] mb-4" style={{ fontFamily: 'Outfit' }}>
              Everything You Need
            </h2>
            <p className="text-base text-[#6B6E66] max-w-md mx-auto">
              From scorecards to standings, manage your entire tournament experience in one place.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {features.map((f, i) => (
              <div key={i} className="bg-white border border-[#E2E3DD] rounded-xl p-8 hover:-translate-y-1 hover:shadow-lg transition-all duration-300"
                data-testid={`feature-card-${i}`}>
                <div className="w-12 h-12 rounded-lg bg-[#1B3C35] flex items-center justify-center mb-5">
                  <f.icon className="h-6 w-6 text-white" />
                </div>
                <h3 className="text-xl font-medium text-[#1B3C35] mb-3" style={{ fontFamily: 'Outfit' }}>{f.title}</h3>
                <p className="text-sm text-[#6B6E66] leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 px-6 md:px-8 bg-[#1B3C35]">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-2xl sm:text-3xl font-semibold text-white mb-4" style={{ fontFamily: 'Outfit' }}>
            Ready to Tee Off?
          </h2>
          <p className="text-base text-white/70 mb-8">
            Join Fairway today and take your golf tournaments to the next level.
          </p>
          <Link to={user ? '/dashboard' : '/login'} data-testid="cta-get-started-btn">
            <Button size="lg" className="bg-[#C96A52] text-white hover:bg-[#C96A52]/90 font-semibold px-10 h-12">
              {user ? 'Go to Dashboard' : 'Create Free Account'}
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-6 border-t border-[#E2E3DD] text-center">
        <p className="text-sm text-[#6B6E66]">Fairway Golf Tournaments</p>
      </footer>
    </div>
  );
}

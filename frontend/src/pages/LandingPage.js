import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { Flag, Trophy, Target, Globe, Camera, Users, ClipboardList, CirclePlay, ChevronRight, Zap, Share2 } from 'lucide-react';

const mainFeatures = [
  {
    icon: CirclePlay, color: 'bg-[#C96A52]',
    title: 'Play a Round',
    desc: 'Pick your course, select your tee (Blue/White/Red), and track your score hole by hole. Color-coded birdies, bogeys, and pars.',
    link: '/play'
  },
  {
    icon: Target, color: 'bg-amber-500',
    title: 'Birdie Challenge',
    desc: 'Pick multiple courses and race your friends to birdie every single hole. First to complete them all wins!',
    link: '/challenges'
  },
  {
    icon: Globe, color: 'bg-blue-600',
    title: 'Virtual Tours',
    desc: 'Compete remotely with friends anywhere in the world. Everyone plays their local course - scores compared by relative to par.',
    link: '/tours'
  },
];

const moreFeatures = [
  {
    icon: Trophy,
    title: 'PGA-Style Leaderboard',
    desc: 'Live public leaderboard with expandable hole-by-hole scores, color-coded birdies/bogeys, and player avatars.'
  },
  {
    icon: Users,
    title: 'Live Scorer Mode',
    desc: 'Be the observer - enter scores for multiple players from your phone while they play. Perfect for coaching or family events.'
  },
  {
    icon: Camera,
    title: 'AI Scorecard Scanner',
    desc: 'Take a photo of any scorecard and the AI extracts all pars, yardages, and tees automatically. Save courses for reuse.'
  },
  {
    icon: ClipboardList,
    title: 'Tournament Management',
    desc: 'Multi-round tournaments with registration, Stroke Play and Stableford formats, admin controls, and shareable results.'
  },
  {
    icon: Share2,
    title: 'Share with Family',
    desc: 'Share a link and anyone can watch live scores - no account needed. Send tournament or challenge links via WhatsApp.'
  },
  {
    icon: Zap,
    title: 'Auto-Challenge Tracking',
    desc: 'Play a round and birdies are automatically counted toward your active Birdie Challenges. No extra steps needed.'
  },
];

const steps = [
  { num: '1', title: 'Scan a Scorecard', desc: 'Take a photo of the course scorecard. AI extracts pars, yardages, and tee info.' },
  { num: '2', title: 'Create a Game', desc: 'Start a round, create a challenge, or launch a virtual tour with friends.' },
  { num: '3', title: 'Play & Track', desc: 'Enter scores hole by hole. Birdies auto-detect across all your active games.' },
  { num: '4', title: 'Share & Compete', desc: 'Family and friends follow live on the public leaderboard. First to finish wins!' },
];

export default function LandingPage() {
  const { user } = useAuth();

  return (
    <div className="min-h-screen" data-testid="landing-page">
      {/* Hero */}
      <section className="relative min-h-[85vh] flex items-center overflow-hidden">
        <img
          src="https://images.unsplash.com/photo-1775686318424-9987122d8402?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NTY2OTV8MHwxfHNlYXJjaHwxfHxnb2xmJTIwY291cnNlJTIwYWVyaWFsJTIwdmlld3xlbnwwfHx8fDE3NzYyMTQyNzR8MA&ixlib=rb-4.1.0&q=85"
          alt="Golf course aerial" className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="hero-overlay absolute inset-0" />
        <div className="relative z-10 max-w-7xl mx-auto px-6 md:px-8 w-full">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm rounded-full px-4 py-1.5 mb-6">
              <Flag className="h-3.5 w-3.5 text-[#C96A52]" />
              <span className="text-xs tracking-wider uppercase font-bold text-white/90">Play, Compete, Share</span>
            </div>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl tracking-tighter font-bold text-white mb-6 leading-[1.1]" style={{ fontFamily: 'Outfit' }}>
              Your Golf Game,{' '}
              <span className="text-[#C96A52]">Everywhere</span>
            </h1>
            <p className="text-base md:text-lg text-white/80 mb-8 leading-relaxed max-w-lg">
              Track scores, challenge friends to birdie every hole, compete remotely in virtual tours, and share live leaderboards with your family - all from your phone.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link to={user ? '/play' : '/login'} data-testid="hero-play-btn">
                <Button size="lg" className="bg-[#C96A52] text-white hover:bg-[#C96A52]/90 font-semibold px-8 h-12">
                  <CirclePlay className="h-5 w-5 mr-2" />
                  {user ? 'Play Now' : 'Get Started Free'}
                </Button>
              </Link>
              <Link to="/leaderboard" data-testid="hero-leaderboard-btn">
                <Button size="lg" className="bg-white/10 text-white hover:bg-white/20 backdrop-blur-sm font-semibold px-8 h-12 border border-white/20">
                  View Leaderboard
                </Button>
              </Link>
            </div>
          </div>
        </div>
        {/* Scroll indicator */}
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 animate-bounce">
          <div className="w-6 h-10 rounded-full border-2 border-white/30 flex justify-center pt-2">
            <div className="w-1 h-2.5 bg-white/50 rounded-full" />
          </div>
        </div>
      </section>

      {/* Main Features - 3 big cards */}
      <section className="py-16 sm:py-24 px-6 md:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-14">
            <p className="text-xs tracking-[0.2em] uppercase font-bold text-[#C96A52] mb-3">Game Modes</p>
            <h2 className="text-2xl sm:text-3xl lg:text-4xl tracking-tight font-bold text-[#1B3C35] mb-4" style={{ fontFamily: 'Outfit' }}>
              Three Ways to Play
            </h2>
            <p className="text-base text-[#6B6E66] max-w-lg mx-auto">
              Whether you're on the course solo, competing with friends locally, or challenging them across the country.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {mainFeatures.map((f, i) => (
              <Link to={user ? f.link : '/login'} key={i} className="group block" data-testid={`main-feature-${i}`}>
                <div className="bg-white border border-[#E2E3DD] rounded-2xl p-7 h-full hover:-translate-y-1.5 hover:shadow-xl transition-all duration-300">
                  <div className={`w-14 h-14 rounded-xl ${f.color} flex items-center justify-center mb-5 group-hover:scale-110 transition-transform`}>
                    <f.icon className="h-7 w-7 text-white" />
                  </div>
                  <h3 className="text-xl font-bold text-[#1B3C35] mb-3" style={{ fontFamily: 'Outfit' }}>{f.title}</h3>
                  <p className="text-sm text-[#6B6E66] leading-relaxed mb-4">{f.desc}</p>
                  <span className="text-sm font-semibold text-[#C96A52] flex items-center gap-1 group-hover:gap-2 transition-all">
                    Try it <ChevronRight className="h-4 w-4" />
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-16 sm:py-20 px-6 md:px-8 bg-[#1B3C35]">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-2xl sm:text-3xl font-bold text-white mb-3" style={{ fontFamily: 'Outfit' }}>
              How It Works
            </h2>
            <p className="text-base text-white/60">From scorecard to leaderboard in minutes</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {steps.map((s, i) => (
              <div key={i} className="relative" data-testid={`step-${i}`}>
                <div className="text-5xl font-bold text-white/10 mb-3" style={{ fontFamily: 'Outfit' }}>{s.num}</div>
                <h3 className="text-lg font-bold text-white mb-2" style={{ fontFamily: 'Outfit' }}>{s.title}</h3>
                <p className="text-sm text-white/60 leading-relaxed">{s.desc}</p>
                {i < 3 && <ChevronRight className="hidden lg:block absolute top-8 -right-3 h-6 w-6 text-white/20" />}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* More Features Grid */}
      <section className="py-16 sm:py-24 px-6 md:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-14">
            <p className="text-xs tracking-[0.2em] uppercase font-bold text-[#C96A52] mb-3">Features</p>
            <h2 className="text-2xl sm:text-3xl lg:text-4xl tracking-tight font-bold text-[#1B3C35] mb-4" style={{ fontFamily: 'Outfit' }}>
              Everything You Need
            </h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {moreFeatures.map((f, i) => (
              <div key={i} className="flex gap-4 p-5 rounded-xl border border-[#E2E3DD] bg-white hover:shadow-md transition-shadow"
                data-testid={`feature-card-${i}`}>
                <div className="w-10 h-10 rounded-lg bg-[#1B3C35]/8 flex items-center justify-center shrink-0">
                  <f.icon className="h-5 w-5 text-[#1B3C35]" />
                </div>
                <div>
                  <h3 className="font-bold text-[#1B3C35] mb-1" style={{ fontFamily: 'Outfit' }}>{f.title}</h3>
                  <p className="text-xs text-[#6B6E66] leading-relaxed">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Social Proof / Use Cases */}
      <section className="py-16 px-6 md:px-8 bg-[#E8E9E3]/30">
        <div className="max-w-5xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
            <div>
              <p className="text-4xl font-bold text-[#C96A52] tabular-nums" style={{ fontFamily: 'Outfit' }}>18</p>
              <p className="text-sm text-[#6B6E66] mt-1">Holes tracked per round</p>
            </div>
            <div>
              <p className="text-4xl font-bold text-[#1B3C35] tabular-nums" style={{ fontFamily: 'Outfit' }}>3</p>
              <p className="text-sm text-[#6B6E66] mt-1">Game modes to compete</p>
            </div>
            <div>
              <p className="text-4xl font-bold text-[#4A5D23] tabular-nums" style={{ fontFamily: 'Outfit' }}>100%</p>
              <p className="text-sm text-[#6B6E66] mt-1">Free & shareable leaderboards</p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-6 md:px-8 bg-[#1B3C35] relative overflow-hidden">
        <div className="absolute inset-0 opacity-5">
          <div className="absolute top-10 left-10 w-64 h-64 rounded-full border border-white" />
          <div className="absolute bottom-10 right-10 w-96 h-96 rounded-full border border-white" />
        </div>
        <div className="max-w-3xl mx-auto text-center relative z-10">
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-white mb-4" style={{ fontFamily: 'Outfit' }}>
            Ready to Hit the Course?
          </h2>
          <p className="text-base text-white/60 mb-8 max-w-md mx-auto">
            Start tracking your scores, challenge your friends, and share your game with the world.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <Link to={user ? '/play' : '/login'} data-testid="cta-play-btn">
              <Button size="lg" className="bg-[#C96A52] text-white hover:bg-[#C96A52]/90 font-semibold px-10 h-12">
                <CirclePlay className="h-5 w-5 mr-2" />
                {user ? 'Play a Round' : 'Create Free Account'}
              </Button>
            </Link>
            <Link to="/challenges" data-testid="cta-challenges-btn">
              <Button size="lg" className="bg-white/10 text-white hover:bg-white/20 font-semibold px-8 h-12 border border-white/20">
                <Target className="h-5 w-5 mr-2" />
                View Challenges
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-6 border-t border-[#E2E3DD]">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Flag className="h-4 w-4 text-[#1B3C35]" />
            <span className="font-bold text-[#1B3C35]" style={{ fontFamily: 'Outfit' }}>Fairway</span>
          </div>
          <div className="flex gap-6 text-sm text-[#6B6E66]">
            <Link to="/leaderboard" className="hover:text-[#1B3C35] transition-colors">Leaderboard</Link>
            <Link to="/challenges" className="hover:text-[#1B3C35] transition-colors">Challenges</Link>
            <Link to="/tours" className="hover:text-[#1B3C35] transition-colors">Tours</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

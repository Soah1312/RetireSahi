import React, { useEffect, useState } from 'react';
import { ArrowRight, Lock, Zap, IndianRupee, PieChart, Activity, Wallet, ShieldCheck, Sun, Bot, Check, Play, Menu, X } from 'lucide-react';
import AuthModal from '../components/AuthModal';
import { auth, db } from '../lib/firebase';
import { isSignInWithEmailLink, signInWithEmailLink, onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';

const COLORS = {
  bg: '#FFFDF5',
  fg: '#1E293B',
  violet: '#8B5CF6',
  pink: '#F472B6',
  amber: '#FBBF24',
  emerald: '#34D399',
  slate: '#F1F5F9'
};

const SHADOW = '4px 4px 0px 0px #1E293B';
const SHADOW_HOVER = '6px 6px 0px 0px #1E293B';
const SHADOW_ACTIVE = '2px 2px 0px 0px #1E293B';

// Background patterns
const MemphisDotGrid = ({ className, opacity = 0.06 }) => (
  <div 
    className={`absolute inset-0 z-0 pointer-events-none ${className}`}
    style={{
      backgroundImage: 'radial-gradient(#1E293B 1px, transparent 1px)',
      backgroundSize: '28px 28px',
      opacity: opacity
    }}
    aria-hidden="true"
  />
);

const Confetti = () => (
  <div className="absolute inset-0 overflow-hidden pointer-events-none z-0" aria-hidden="true">
    <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
      {/* Triangles */}
      <polygon className="animate-float" style={{ animationDelay: '0s' }} points="50,15 65,40 35,40" fill={COLORS.pink} transform="translate(100, 100) rotate(20) scale(0.6)" />
      <polygon className="animate-float" style={{ animationDelay: '1.2s' }} points="50,15 65,40 35,40" fill={COLORS.amber} transform="translate(800, 300) rotate(-45) scale(0.7)" />
      <polygon className="animate-float" style={{ animationDelay: '2.5s' }} points="50,15 65,40 35,40" fill={COLORS.emerald} transform="translate(200, 600) rotate(110) scale(0.5)" />
      {/* Circles */}
      <circle className="animate-float" style={{ animationDelay: '0.8s' }} cx="30" cy="30" r="15" fill={COLORS.emerald} transform="translate(900, 150)" />
      <circle className="animate-float" style={{ animationDelay: '1.5s' }} cx="30" cy="30" r="10" fill={COLORS.violet} transform="translate(150, 450)" />
      <circle className="animate-float" style={{ animationDelay: '0.3s' }} cx="30" cy="30" r="12" fill={COLORS.pink} transform="translate(700, 700)" />
      {/* Squares & Pills */}
      <rect className="animate-float" style={{ animationDelay: '2.1s' }} x="0" y="0" width="24" height="24" fill={COLORS.amber} transform="translate(450, 200) rotate(15)" />
      <rect className="animate-float" style={{ animationDelay: '0.9s' }} x="0" y="0" width="20" height="20" fill={COLORS.violet} transform="translate(950, 500) rotate(-20)" />
      <rect className="animate-float" style={{ animationDelay: '1.8s' }} x="0" y="0" width="30" height="12" rx="6" fill={COLORS.pink} transform="translate(50, 250) rotate(35)" />
    </svg>
  </div>
);

// Underlines
const SquigglyUnderline = () => (
  <svg className="absolute w-[110%] h-8 -bottom-3 -left-2 z-0 text-[#F472B6]" viewBox="0 0 200 20" preserveAspectRatio="none" aria-hidden="true">
    <path d="M0,15 C50,0 150,25 200,5" fill="none" stroke="currentColor" strokeWidth="8" strokeLinecap="round" />
  </svg>
);

const SmallSquigglyUnderline = () => (
  <svg className="absolute w-[80%] h-4 -bottom-2 left-1/2 -translate-x-1/2 z-0 text-[#34D399]" viewBox="0 0 200 20" preserveAspectRatio="none" aria-hidden="true">
    <path d="M0,10 Q50,20 100,10 T200,10" fill="none" stroke="currentColor" strokeWidth="6" strokeLinecap="round" />
  </svg>
);

// Hero Visual Arc
const ScoreArc = () => {
  const [offset, setOffset] = useState(283); // Circumference approx 283 for r=45
  useEffect(() => {
    // Animate to 74%
    const timeout = setTimeout(() => {
      setOffset(283 - (283 * 0.74));
    }, 100);
    return () => clearTimeout(timeout);
  }, []);

  return (
    <div className="relative w-full aspect-square max-w-[400px] mx-auto flex items-center justify-center">
      <div className="absolute inset-0 bg-[#FBBF24] rounded-full mix-blend-multiply opacity-80 -translate-x-6 translate-y-6" />
      <div className="absolute inset-0 memphis-dot-grid opacity-20 mask-circle" />
      
      <div className="relative z-10 w-full h-full bg-white border-4 border-[#1E293B] rounded-full p-8 flex flex-col items-center justify-center pop-shadow">
        <svg viewBox="0 0 100 100" className="w-full h-full absolute inset-0 -rotate-90 p-6 overflow-visible">
          {/* Background Arc */}
          <circle cx="50" cy="50" r="45" fill="none" stroke="#F1F5F9" strokeWidth="8" strokeDasharray="283" strokeLinecap="round" />
          {/* Progress Arc */}
          <circle 
            cx="50" cy="50" r="45" 
            fill="none" 
            stroke={COLORS.violet} 
            strokeWidth="8" 
            strokeDasharray="283" 
            strokeDashoffset={offset} 
            strokeLinecap="round"
            className="transition-all duration-1500 ease-out" 
            style={{ transitionDuration: '1.5s', transitionTimingFunction: 'cubic-bezier(0.34, 1.56, 0.64, 1)' }}
          />
        </svg>
        <div className="text-center relative z-20 mt-4">
          <div className="font-heading font-extrabold text-[#1E293B] text-7xl leading-none">74</div>
          <div className="font-bold text-[#8B5CF6] uppercase tracking-widest text-sm mt-2">On Track</div>
        </div>
        <div className="absolute bottom-10 bg-white border-2 border-[#1E293B] rounded-full px-4 py-1.5 text-xs font-bold uppercase tracking-wider flex items-center gap-2 shadow-[2px_2px_0_0_#1E293B] hover:-translate-y-1 hover:shadow-[4px_4px_0_0_#1E293B] transition-all cursor-pointer">
          <Activity className="w-3 h-3 text-[#34D399]" /> Readiness Score
        </div>
      </div>
    </div>
  );
};

export default function LandingPage() {
  const navigate = useNavigate();
  const [scrolled, setScrolled] = useState(false);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [user, setUser] = useState(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, setUser);
    return () => unsub();
  }, []);

  useEffect(() => {
    document.title = "NPS Pulse | Your Retirement, Demystified";
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);

    // Magic link verification
    if (auth && isSignInWithEmailLink(auth, window.location.href)) {
      let email = window.localStorage.getItem('emailForSignIn');
      if (!email) {
        email = window.prompt('Please provide your email for confirmation to complete sign-in');
      }
      if (email) {
        signInWithEmailLink(auth, email, window.location.href)
          .then(async (result) => {
            window.localStorage.removeItem('emailForSignIn');
            const userDoc = await getDoc(doc(db, 'users', auth.currentUser.uid));
            if (userDoc.exists()) {
              navigate('/dashboard');
            } else {
              navigate('/onboarding');
            }
          })
          .catch((err) => {
            console.error(err);
          });
      }
    }

    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div className="min-h-screen text-[#1E293B] overflow-x-hidden selection:bg-[#F472B6] selection:text-white" style={{ backgroundColor: COLORS.bg, fontFamily: '"Plus Jakarta Sans", sans-serif' }}>
      <style>{`
        h1, h2, h3, h4, .font-heading { font-family: 'Outfit', sans-serif; }
        
        .pop-shadow {
          box-shadow: ${SHADOW};
          transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
        }
        .pop-shadow:hover {
          box-shadow: ${SHADOW_HOVER};
          transform: translate(-2px, -2px);
        }
        .pop-shadow:active {
          box-shadow: ${SHADOW_ACTIVE};
          transform: translate(2px, 2px);
        }

        .candy-btn {
          background-color: ${COLORS.violet};
          color: white;
          border: 2px solid ${COLORS.fg};
          border-radius: 9999px;
          position: relative;
        }

        .candy-btn-secondary {
          background-color: transparent;
          color: ${COLORS.fg};
          border: 2px solid ${COLORS.fg};
          border-radius: 9999px;
          box-shadow: ${SHADOW};
          transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
        }
        .candy-btn-secondary:hover {
          background-color: ${COLORS.amber};
          box-shadow: ${SHADOW_HOVER};
          transform: translate(-2px, -2px);
        }

        .sticker-card {
          background-color: white;
          border: 2px solid ${COLORS.fg};
          border-radius: 12px;
          box-shadow: ${SHADOW};
          transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
        }
        .sticker-card:hover {
          transform: rotate(-1deg) scale(1.02);
          box-shadow: ${SHADOW_HOVER};
        }
        .sticker-card:hover .icon-wiggle {
          animation: wiggle 0.4s ease-in-out;
        }

        .nav-link {
          position: relative;
        }
        .nav-link::after {
          content: '';
          position: absolute;
          width: 0;
          height: 3px;
          bottom: -4px;
          left: 0;
          background-color: ${COLORS.violet};
          transition: width 0.3s ease;
        }
        .nav-link:hover::after {
          width: 100%;
        }

        @keyframes float {
          0%, 100% { transform: translateY(0) rotate(var(--rot, 0deg)); }
          50% { transform: translateY(-8px) rotate(calc(var(--rot, 0deg) + 5deg)); }
        }
        .animate-float {
          animation: float 4s ease-in-out infinite;
        }

        @keyframes wiggle {
          0%, 100% { transform: rotate(0deg); }
          25% { transform: rotate(-3deg); }
          75% { transform: rotate(3deg); }
        }

        @keyframes slideDown {
          from { opacity: 0; transform: translateY(-10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-slide-down {
          animation: slideDown 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
        }

        @media (prefers-reduced-motion: reduce) {
          * {
            animation-duration: 0.01ms !important;
            animation-iteration-count: 1 !important;
            transition-duration: 150ms !important;
            scroll-behavior: auto !important;
          }
        }
      `}</style>

      {/* Navbar */}
      <nav 
        className={`bg-white border-b-2 border-[#1E293B] sticky top-0 z-50 transition-shadow duration-300 w-full`}
        style={scrolled ? { boxShadow: '0 4px 0 0 rgba(30,41,59,0.1)' } : {}}
      >
        <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => navigate('/')}>
            <div className="w-10 h-10 bg-[#8B5CF6] border-2 border-[#1E293B] rounded-full flex items-center justify-center pop-shadow">
              <span className="font-heading font-extrabold text-white text-xl">N</span>
            </div>
            <span className="font-heading font-extrabold text-2xl tracking-tight hidden sm:block">NPS Pulse</span>
          </div>
          
          <div className="hidden md:flex gap-8 font-bold uppercase tracking-wide text-sm">
             <a href="#features" className="nav-link text-[#1E293B] hover:text-[#8B5CF6] transition-colors">Features</a>
             <a href="#how" className="nav-link text-[#1E293B] hover:text-[#F472B6] transition-colors">How It Works</a>
             <button onClick={() => navigate('/learn')} className="nav-link text-[#1E293B] hover:text-[#8B5CF6] transition-colors cursor-pointer uppercase tracking-wide">Learn</button>
          </div>
          
          <div className="hidden md:flex items-center gap-6 font-bold text-[#1E293B]">
            {user ? (
              <div className="flex items-center gap-4">
                <button 
                  onClick={() => navigate('/dashboard')}
                  className="hover:text-[#8B5CF6] transition-colors cursor-pointer mr-2"
                >
                  Dashboard
                </button>
                <div className="flex items-center gap-2 bg-white border-2 border-[#1E293B] rounded-full py-1 px-2 pr-3" style={{ boxShadow: '2px 2px 0px 0px #1E293B' }}>
                  {user.photoURL ? (
                    <img src={user.photoURL} alt="Profile" className="w-8 h-8 rounded-full border-2 border-[#1E293B]" />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-[#34D399] border-2 border-[#1E293B] flex items-center justify-center font-bold text-white">
                      {(user.displayName || user.email || 'U')[0].toUpperCase()}
                    </div>
                  )}
                  <span className="font-bold text-sm hidden lg:block">
                    {user.displayName || user.email?.split('@')[0]}
                  </span>
                </div>
                <button 
                  onClick={() => signOut(auth)}
                  className="font-bold border-2 border-[#1E293B] rounded-full px-5 py-2 hover:bg-[#F472B6] hover:text-white transition-all cursor-pointer" style={{ boxShadow: '2px 2px 0px 0px #1E293B' }}
                >
                  Log Out
                </button>
              </div>
            ) : (
              <>
                <button onClick={() => setIsAuthOpen(true)} className="hover:text-[#8B5CF6] transition-colors cursor-pointer">Log In</button>
                <button 
                  onClick={() => setIsAuthOpen(true)}
                  className="candy-btn px-6 py-2.5 font-bold uppercase tracking-widest text-[#1E293B] cursor-pointer" style={{ backgroundColor: '#34D399' }}
                >
                  Get Started
                </button>
              </>
            )}
          </div>

          {/* Mobile Menu Button */}
          <div className="md:hidden flex items-center">
            <button 
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="p-2 border-2 border-[#1E293B] rounded-lg bg-[#F1F5F9] pop-shadow active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all"
            >
              {isMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>

        {/* Mobile Menu Overlay */}
        {isMenuOpen && (
          <div className="md:hidden bg-white border-b-2 border-[#1E293B] animate-slide-down">
            <div className="flex flex-col p-6 gap-6 font-bold uppercase tracking-wide text-sm">
              <a href="#features" onClick={() => setIsMenuOpen(false)} className="py-2 border-b border-[#1E293B]/10 hover:text-[#8B5CF6]">Features</a>
              <a href="#how" onClick={() => setIsMenuOpen(false)} className="py-2 border-b border-[#1E293B]/10 hover:text-[#F472B6]">How It Works</a>
              <button 
                onClick={() => { navigate('/learn'); setIsMenuOpen(false); }} 
                className="text-left py-2 border-b border-[#1E293B]/10 hover:text-[#8B5CF6]"
              >
                Learn
              </button>
              
              <div className="pt-4 flex flex-col gap-4">
                {user ? (
                  <>
                    <div className="flex items-center gap-3 p-3 bg-slate-50 border-2 border-[#1E293B] rounded-2xl">
                      {user.photoURL ? (
                        <img src={user.photoURL} alt="Profile" referrerPolicy="no-referrer" className="w-10 h-10 rounded-full border-2 border-[#1E293B]" />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-[#34D399] border-2 border-[#1E293B] flex items-center justify-center font-bold text-white text-lg">
                          {(user.displayName || user.email || 'U')[0].toUpperCase()}
                        </div>
                      )}
                      <div className="flex flex-col">
                        <span className="text-xs text-[#1E293B]/50">Logged in as</span>
                        <span className="text-sm truncate max-w-[150px]">{user.displayName || user.email}</span>
                      </div>
                    </div>
                    <button 
                      onClick={() => { navigate('/dashboard'); setIsMenuOpen(false); }}
                      className="candy-btn w-full py-3 text-center" style={{ backgroundColor: COLORS.violet }}
                    >
                      Dashboard
                    </button>
                    <button 
                      onClick={() => { signOut(auth); setIsMenuOpen(false); }}
                      className="w-full py-3 border-2 border-[#1E293B] rounded-full hover:bg-[#F472B6] hover:text-white transition-all"
                    >
                      Log Out
                    </button>
                  </>
                ) : (
                  <>
                    <button 
                      onClick={() => { setIsAuthOpen(true); setIsMenuOpen(false); }}
                      className="w-full py-3 border-2 border-[#1E293B] rounded-full hover:bg-[#F1F5F9] transition-all"
                    >
                      Log In
                    </button>
                    <button 
                      onClick={() => { setIsAuthOpen(true); setIsMenuOpen(false); }}
                      className="candy-btn w-full py-3 text-center" style={{ backgroundColor: '#34D399' }}
                    >
                      Get Started
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </nav>

      <main>
        {/* Hero */}
        <section className="relative pt-20 pb-32 px-6 overflow-hidden min-h-[85vh] flex items-center">
          <MemphisDotGrid />
          <Confetti />
          
          <div className="max-w-7xl mx-auto flex flex-col lg:flex-row items-center gap-16 relative z-10 w-full">
            <div className="flex-1 w-full relative z-20">
              
              <div className="inline-block px-4 py-1.5 border-2 border-[#1E293B] bg-[#F472B6] text-white font-bold uppercase tracking-widest text-xs rounded-full mb-8 pop-shadow transform -rotate-2">
                Your Retirement, Demystified.
              </div>
              
              <h1 className="font-heading font-extrabold text-[#1E293B] mb-6 relative z-10" style={{ fontSize: 'clamp(2.5rem, 6vw, 4rem)', lineHeight: 1.1 }}>
                Know Exactly Where<br/>
                <span className="relative inline-block">
                  <span className="relative z-10">Your Retirement</span>
                  <SquigglyUnderline />
                </span> Stands
              </h1>
              
              <p className="font-medium mb-10 text-[#1E293B]/80" style={{ fontSize: '1.125rem', lineHeight: 1.7, maxWidth: '600px' }}>
                NPS Pulse calculates your personalized retirement readiness score, shows you exactly how much to contribute, and tells you how much tax you're leaving on the table — all in under 2 minutes.
              </p>
              
              <div className="flex flex-col sm:flex-row gap-6 mb-8">
                <button onClick={() => setIsAuthOpen(true)} className="candy-btn pop-shadow px-8 py-4 font-bold uppercase tracking-wide text-lg flex justify-center items-center gap-3 group cursor-pointer">
                  Get Started Free
                  <div className="w-8 h-8 bg-white rounded-full flex items-center justify-center group-hover:translate-x-1 transition-transform">
                    <ArrowRight className="text-[#8B5CF6] w-5 h-5" strokeWidth={3} />
                  </div>
                </button>
                
                <a href="#how" className="candy-btn-secondary px-8 py-4 font-bold uppercase tracking-wide text-lg flex justify-center items-center cursor-pointer">
                  See How It Works
                </a>
              </div>
              
              {/* Trust Nudges */}
              <div className="flex flex-wrap items-center gap-4 font-bold uppercase tracking-widest text-xs text-[#1E293B]/70">
                <span className="flex items-center gap-1.5 bg-[#1E293B]/5 px-3 py-1.5 rounded-full border border-[#1E293B]/10"><Lock className="w-3.5 h-3.5 text-[#8B5CF6]" /> Google Sign-in</span>
                <span className="flex items-center gap-1.5 bg-[#1E293B]/5 px-3 py-1.5 rounded-full border border-[#1E293B]/10"><Zap className="w-3.5 h-3.5 text-[#F472B6]" /> 2 min setup</span>
                <span className="flex items-center gap-1.5 bg-[#1E293B]/5 px-3 py-1.5 rounded-full border border-[#1E293B]/10"><IndianRupee className="w-3.5 h-3.5 text-[#34D399]" /> ₹0 to start</span>
              </div>
            </div>
            
            <div className="flex-1 w-full relative h-full min-h-[400px] flex items-center justify-center">
               <ScoreArc />
            </div>
          </div>
        </section>

        {/* Features */}
        <section id="features" className="py-32 px-6 relative bg-[#FFFDF5] border-t-2 border-[#1E293B]">
          <MemphisDotGrid />
          <Confetti />
          
          <div className="max-w-7xl mx-auto relative z-10">
            <div className="text-center max-w-2xl mx-auto mb-24 relative">
              <h2 className="font-heading font-extrabold text-[#1E293B] relative inline-block z-10" style={{ fontSize: 'clamp(1.8rem, 4vw, 2.8rem)' }}>
                Powerful Features
                <SmallSquigglyUnderline />
              </h2>
            </div>
            
            <div className="relative">
              {/* Desktop dashed connections */}
              <div className="hidden lg:block absolute top-[150px] left-0 w-full border-t-2 border-dashed border-[#1E293B]/20 -z-10" aria-hidden="true" />
              <div className="hidden lg:block absolute bottom-[180px] left-0 w-full border-t-2 border-dashed border-[#1E293B]/20 -z-10" aria-hidden="true" />
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-y-20 gap-x-8">
                {[
                  { icon: Activity, title: "Retirement Readiness Score", desc: "Your retirement health in one number. Our arc-based score tells you exactly where you stand based on your real financial data." },
                  { icon: PieChart, title: "Live Portfolio Value", desc: "Upload your NPS statement PDF and we fetch live NAV from the NPS Trust to show your real portfolio value today." },
                  { icon: Wallet, title: "Corpus Gap Closer", desc: "See exactly how much more you need to contribute each month to close your retirement gap." },
                  { icon: ShieldCheck, title: "Tax Shield Analyzer", desc: "Most subscribers leave ₹10K-15K in tax savings unused every year. We show you what you're missing under 80CCD." },
                  { icon: Sun, title: "Dream Planner", desc: "Pick your retirement lifestyle. We calculate exactly what it'll cost after inflation & if your current plan gets you there." },
                  { icon: Bot, title: "AI Co-Pilot", desc: "Ask anything about your NPS in plain English. Powered by Gemini, with your full financial profile injected." }
                ].map((feat, i) => {
                  const colors = [COLORS.violet, COLORS.pink, COLORS.amber, COLORS.emerald, COLORS.violet, COLORS.pink];
                  return (
                    <div key={i} className="sticker-card p-8 pt-10 relative bg-white group mt-6">
                      <div 
                        className="absolute -top-10 left-8 w-20 h-20 rounded-full border-2 border-[#1E293B] flex items-center justify-center shadow-[4px_4px_0_0_#1E293B] z-10"
                        style={{ backgroundColor: colors[i] }}
                      >
                        <feat.icon className="w-10 h-10 text-white icon-wiggle" strokeWidth={2.5} />
                      </div>
                      <h3 className="font-heading font-bold text-[#1E293B] mb-4 mt-6" style={{ fontSize: '1.25rem' }}>
                        {feat.title}
                      </h3>
                      <p className="text-[#1E293B]/80 font-medium" style={{ fontSize: '1.125rem', lineHeight: 1.7 }}>
                        {feat.desc}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </section>

        {/* How It Works */}
        <section id="how" className="py-32 px-6 relative bg-[#F1F5F9] border-y-2 border-[#1E293B] overflow-hidden">
          <MemphisDotGrid opacity={0.04} />
          
          <div className="max-w-7xl mx-auto relative z-10">
            <h2 className="font-heading font-extrabold text-center mb-24 relative inline-block left-1/2 -translate-x-1/2" style={{ fontSize: 'clamp(1.8rem, 4vw, 2.8rem)' }}>
              How It Works
              <SmallSquigglyUnderline />
            </h2>
            
            <div className="relative">
              {/* Desktop connecting line */}
              <div className="hidden lg:block absolute top-[40px] left-16 right-16 border-t-[3px] border-dashed border-[#1E293B]/30 z-0" aria-hidden="true" />
              
              <div className="grid grid-cols-1 lg:grid-cols-4 gap-12 relative z-10">
                {[
                  { title: "Sign in with Google", desc: "One click. No forms, no passwords. Your account is ready instantly." },
                  { title: "Tell Us About Yourself", desc: "Share your details or upload your statement PDF and we auto-fill everything." },
                  { title: "See Your Score", desc: "Your Retirement Readiness Score appears immediately with your projected corpus." },
                  { title: "Close the Gap", desc: "Use our tools to build a retirement plan that works. Ask the AI anything." }
                ].map((step, i) => {
                  const colors = [COLORS.violet, COLORS.pink, COLORS.amber, COLORS.emerald];
                  return (
                    <div key={i} className="flex flex-col lg:items-center text-left lg:text-center group">
                      <div className="flex lg:justify-center items-center mb-8 relative z-10 w-full lg:w-auto">
                         {/* Circle Badge */}
                        <div 
                          className="w-20 h-20 border-2 border-[#1E293B] rounded-full flex items-center justify-center pop-shadow shrink-0 transition-transform group-hover:scale-110"
                          style={{ backgroundColor: colors[i] }}
                        >
                          <span className="font-heading font-extrabold text-3xl text-white">
                            {i + 1}
                          </span>
                        </div>
                        {/* Mobile connection line */}
                        {i !== 3 && <div className="lg:hidden w-1 flex-1 h-full border-l-[3px] border-dashed border-[#1E293B]/30 ml-10 absolute left-10 top-20 bottom-[-3rem]" />}
                      </div>
                      
                      <h3 className="font-heading font-bold text-[#1E293B] mb-3 ml-24 lg:ml-0" style={{ fontSize: '1.25rem' }}>
                        {step.title}
                      </h3>
                      <p className="text-[#1E293B]/80 font-medium ml-24 lg:ml-0" style={{ fontSize: '1.125rem', lineHeight: 1.7 }}>
                        {step.desc}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="bg-[#1E293B] text-white py-20 px-6 relative overflow-hidden text-center md:text-left">
        {/* Footer Background Confetti */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none z-0" aria-hidden="true">
           <svg className="w-full h-full opacity-20" xmlns="http://www.w3.org/2000/svg">
              <polygon points="50,15 65,40 35,40" fill={COLORS.pink} transform="translate(200, 100) rotate(45) scale(0.6)" />
              <circle cx="30" cy="30" r="15" fill={COLORS.amber} transform="translate(800, 50)" />
              <rect x="0" y="0" width="20" height="20" fill={COLORS.emerald} transform="translate(500, 150) rotate(-20)" />
              <rect x="0" y="0" width="30" height="12" rx="6" fill={COLORS.violet} transform="translate(80, 180) rotate(70)" />
           </svg>
        </div>
        
        <div className="max-w-7xl mx-auto relative z-10">
          <div className="flex flex-col md:flex-row justify-between items-center gap-10 mb-16">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-[#8B5CF6] border-2 border-white rounded-full flex items-center justify-center pop-shadow">
                <span className="font-heading font-extrabold text-white text-2xl">N</span>
              </div>
              <span className="font-heading font-extrabold text-3xl tracking-tight">NPS Pulse</span>
            </div>
            
            <div className="flex flex-wrap justify-center md:justify-end gap-8 font-bold uppercase tracking-wide text-sm">
              <a href="#features" className="hover:text-[#F472B6] transition-colors">Features</a>
              <a href="#how" className="hover:text-[#FBBF24] transition-colors">How It Works</a>
              <button onClick={() => navigate('/learn')} className="hover:text-[#8B5CF6] transition-colors cursor-pointer uppercase tracking-wide font-bold">Learn</button>
              <a href="#" className="hover:text-[#34D399] transition-colors">Privacy Policy</a>
              <a href="#" className="hover:text-[#8B5CF6] transition-colors">Terms of Service</a>
            </div>
          </div>
          
          <div className="border-t border-white/20 pt-8 flex flex-col md:flex-row justify-between items-center gap-4 text-white/50 font-bold uppercase tracking-widest text-xs">
            <div>© 2025 NPS Pulse. Built for India's retirement future.</div>
            <div className="flex items-center gap-2">
               Made with <Zap className="w-3" fill="currentColor" /> in India
            </div>
          </div>
        </div>
      </footer>
      
      <AuthModal isOpen={isAuthOpen} onClose={() => setIsAuthOpen(false)} />
    </div>
  );
}

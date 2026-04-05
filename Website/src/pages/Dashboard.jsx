import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Home, Shield, Moon, Bot, Settings, TrendingUp, Target, Zap, 
  Clock, PiggyBank, Wallet, LogOut, Menu, X, Bell, ArrowRight,
  ChevronUp, Sparkles, CheckCircle2, Info, BarChart2, HelpCircle
} from 'lucide-react';
import { auth, db } from '../lib/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { signOut } from 'firebase/auth';
import TourOverlay from '../components/TourOverlay';
import InfoTooltip from '../components/InfoTooltip';
import { TOUR_STEPS, DASHBOARD_TIPS } from '../constants/tooltips';
import { decryptUserData, encryptUserData } from '../utils/encryption';
import { RETIREMENT_MODES } from '../constants/investmentSchemes.js';
import { useAuthSession } from '../components/authSessionContext';
import { getOrLoadUserProfile, invalidateUserProfileCache, writeUserProfileCache } from '../lib/userProfileCache';
import { 
  calculateRetirement, 
  getMilestoneAge, 
  computeWhatIfScenarios, 
   computeTaxSavings,
   computeTax,
  getMaxEquityPct, 
  SCHEME_E_RETURN, 
  SCHEME_C_RETURN, 
  SCHEME_G_RETURN, 
  SWR, 
  ANNUITY_PCT, 
  ANNUITY_RATE, 
  INFLATION_RATE,
  LIFESTYLE_MULTIPLIERS,
  COLORS,
  getScoreBand,
  formatIndian
} from '../utils/math';

// --- UI Components ---
const ScoreArc = ({ score, assumptionsOpen, setAssumptionsOpen }) => {
  const { label, color } = getScoreBand(score);
  const [offset, setOffset] = useState(283);
  
  useEffect(() => {
    const timeout = setTimeout(() => { setOffset(283 - (283 * (score / 100))); }, 300);
    return () => clearTimeout(timeout);
  }, [score]);

  return (
    <div className="bg-white border-2 border-[#1E293B] rounded-[24px] p-8 pop-shadow flex flex-col items-center justify-center relative overflow-hidden group">
      <button 
        onClick={() => setAssumptionsOpen(!assumptionsOpen)}
        className="absolute top-4 right-4 text-[#1E293B]/40 hover:text-[#8B5CF6] transition-colors p-1"
      >
        <Info className="w-5 h-5" />
      </button>
      
      <div className="relative w-full max-w-[240px] aspect-square flex items-center justify-center">
        <svg viewBox="0 0 100 100" className="w-full h-full absolute inset-0 -rotate-90 p-4 pb-0 overflow-visible">
           <circle cx="50" cy="50" r="45" fill="none" stroke="#F1F5F9" strokeWidth="10" strokeDasharray="283" strokeLinecap="round" />
           <circle 
            cx="50" cy="50" r="45" fill="none" stroke={color} strokeWidth="10" 
            strokeDasharray="283" strokeDashoffset={offset} strokeLinecap="round"
            className="cubic"
            style={{ transition: 'stroke-dashoffset 1.5s cubic-bezier(0.34, 1.56, 0.64, 1), stroke 0.5s ease' }}
          />
        </svg>
        <div className="text-center relative z-20">
          <div className="font-heading font-extrabold text-[#1E293B] text-6xl md:text-7xl leading-none tabular-nums">{score}</div>
          <div className="font-bold uppercase tracking-[0.2em] text-sm mt-2" style={{ color }}>{label}</div>
        </div>
      </div>
    </div>
  );
};

const StatCard = ({ label, value, subtext, icon: Icon, accent, fullWidth }) => (
  <div className={`bg-white border-2 border-[#1E293B] rounded-[16px] p-6 pop-shadow hover:-translate-y-1 transition-all cubic flex flex-col justify-between group ${fullWidth ? 'col-span-full' : ''}`}>
    <div className="flex justify-between items-start mb-4">
       <div>
         <div className="text-[10px] md:text-xs font-bold uppercase tracking-[2px] text-[#1E293B]/40 mb-1">{label}</div>
         <div className="font-heading font-extrabold text-2xl md:text-3xl text-[#1E293B]">{value}</div>
       </div>
       <div className={`w-10 h-10 md:w-12 md:h-12 rounded-full flex items-center justify-center border-2 border-[#1E293B] shadow-[2px_2px_0_0_#1E293B] group-hover:shadow-[3px_3px_0_0_#1E293B] transition-all`} style={{ backgroundColor: `${accent}22` }}>
          {React.createElement(Icon, { className: 'w-5 h-5 md:w-6 md:h-6', strokeWidth: 2.5, style: { color: accent } })}
       </div>
    </div>
    <div className="text-xs md:text-sm font-bold text-[#1E293B]/60 uppercase tracking-widest">{subtext}</div>
  </div>
);

const QuickStat = ({ label, value, subtext, icon: Icon, color }) => (
  <div className="bg-white border-2 border-[#1E293B] rounded-[12px] p-4 pop-shadow flex items-start gap-4 group hover:-translate-y-1 transition-all cubic">
    <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 border-[#1E293B] shrink-0 font-bold`} style={{ backgroundColor: `${color}22` }}>
          {React.createElement(Icon, { className: 'w-5 h-5', strokeWidth: 2.5, style: { color } })}
    </div>
    <div>
      <div className="text-[9px] font-bold uppercase tracking-widest text-[#1E293B]/40 mb-1">{label}</div>
      <div className="font-heading font-bold text-lg text-[#1E293B]">{value}</div>
      <div className="text-[9px] font-bold text-[#1E293B]/60 uppercase tracking-widest mt-1">{subtext}</div>
    </div>
  </div>
);

const ScenarioCard = ({ title, impact, desc, onClick }) => (
  <button 
    onClick={onClick}
    className="bg-white border-2 border-[#1E293B] rounded-[16px] p-5 text-left pop-shadow hover:-translate-y-1 hover:rotate-[-1deg] transition-all cubic cursor-pointer group w-full"
  >
    <div className="flex justify-between items-center mb-3">
       <div className="font-bold text-sm md:text-base leading-tight text-[#1E293B] group-hover:text-[#8B5CF6] transition-colors">{title}</div>
       <div className={`px-2 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border-2 border-[#1E293B] shrink-0 ${impact > 0 ? 'bg-[#D1FAE5] text-[#065F46] shadow-[2px_2px_0_0_#34D399]' : impact < 0 ? 'bg-[#FEE2E2] text-[#991B1B] shadow-[2px_2px_0_0_#EF4444]' : 'bg-slate-100 text-slate-500 shadow-[2px_2px_0_0_#CBD5E1]'}`}>
         {impact > 0 ? `+${impact}` : impact} PTS
       </div>
    </div>
    <div className="text-[10px] font-bold text-[#1E293B]/50 uppercase tracking-wide">{desc}</div>
  </button>
);

const MilestoneItem = ({ milestone, age, achieved, color }) => (
  <div className="flex-shrink-0 flex flex-col items-center">
    <div className={`px-6 py-3 rounded-full border-2 border-[#1E293B] font-black uppercase tracking-widest text-sm flex items-center gap-2 group transition-all cubic`} style={{ backgroundColor: achieved ? '#34D399' : color, color: achieved ? '#1E293B' : 'white', boxShadow: '3px 3px 0 0 #1E293B' }}>
       {formatIndian(milestone)}
       {achieved && <CheckCircle2 className="w-4 h-4" />}
    </div>
    <div className="mt-2 font-bold text-xs uppercase tracking-widest text-[#1E293B]/50">
      {achieved ? '✓ Achieved' : `at age ${age}`}
    </div>
  </div>
);

export default function Dashboard() {
  const navigate = useNavigate();
   const { currentUser, authLoading } = useAuthSession();
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [simulatorOpen, setSimulatorOpen] = useState(false);
  const [assumptionsOpen, setAssumptionsOpen] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [tourActive, setTourActive] = useState(false);
  const [simValues, setSimValues] = useState({
    npsContribution: 0,
    retireAge: 60,
    stepUp: 0,
    npsEquity: 50
  });

  // State checks and Auth logic
  useEffect(() => {
    document.title = "RetireSahi | Dashboard";
      if (authLoading) {
         return;
      }

      let cancelled = false;

      const loadDashboard = async () => {
         if (!currentUser) {
            navigate('/');
            setLoading(false);
            return;
         }

         const data = await getOrLoadUserProfile({
            uid: currentUser.uid,
            loader: async () => {
               const snap = await getDoc(doc(db, 'users', currentUser.uid));
               if (!snap.exists()) {
                  return null;
               }
               return decryptUserData(snap.data(), currentUser.uid);
            },
         });

         if (!data) {
            navigate('/onboarding');
            setLoading(false);
            return;
         }

         if (cancelled) return;

         setUserData(data);
         setSimValues({
            npsContribution: data.npsContribution || 5000,
            retireAge: data.retireAge || 60,
            stepUp: data.stepUp || 0,
            npsEquity: data.npsEquity || 50
         });

         if (!localStorage.getItem('retiresahi_tour_seen')) {
            setTimeout(() => setTourActive(true), 800);
         }

         setLoading(false);
      };

      loadDashboard().catch((error) => {
         if (!cancelled) {
            console.error('Failed to load dashboard data:', error);
            setLoading(false);
         }
      });

      return () => {
         cancelled = true;
      };
   }, [authLoading, currentUser, navigate]);

  // Derived metrics from user data using math utility
  const baseResults = useMemo(() => userData ? calculateRetirement(userData) : null, [userData]);
  
  // Dynamic scenarios
  const scenarios = useMemo(() => {
    if (!userData || !baseResults) return [];
    
    // Determine dynamic values for overrides
    const nextLifestyle = userData.lifestyle === 'premium' ? 'comfortable' : userData.lifestyle === 'essential' ? 'comfortable' : 'essential';
    const currentContribution = Number(userData.npsContribution || 0);
    const currentRetireAge = Number(userData.retireAge || 60);
    const currentCorpus = Number(userData.npsCorpus || 0);
    const currentAge = Number(userData.age || 28);
    
    const overridesMap = {
      'contribute_more': { npsContribution: currentContribution + 2000 },
      'step_up': { stepUp: 0.10 },
      'retire_later': { retireAge: currentRetireAge + 2 },
      'lifestyle_switch': { lifestyle: nextLifestyle },
      'lump_sum': { npsCorpus: currentCorpus + 100000 },
      'max_equity': { npsEquity: getMaxEquityPct(currentAge) }
    };

    const generated = computeWhatIfScenarios(userData);
    
    return generated.map(s => ({
      ...s,
      impact: s.delta,
      desc: s.description,
         overrides: s.overrides || overridesMap[s.id] || {}
    }));
  }, [userData, baseResults]);

  // Simulated results linked to bottom panel
  const simResults = useMemo(() => {
    if (!userData) return null;
    return calculateRetirement({
      ...userData,
      ...simValues
    });
  }, [userData, simValues]);

   const taxPosition = useMemo(() => {
      if (!userData) {
         return {
            label: 'Tax Position Unknown',
            detail: 'Add profile details to calculate tax position',
            color: '#94A3B8',
            bg: '#F1F5F9',
         };
      }

      const taxData = computeTaxSavings(userData);
      const annualIncome = (parseFloat(userData.monthlyIncome) || 0) * 12;
      const employerNPS = Math.round(taxData.ccd2?.potential || 0);
      const newRegimeTax = computeTax(annualIncome, 'new', 0);
      const oldRegimeTax = computeTax(
         annualIncome,
         'old',
         taxData.ccd1.used + 50000 + employerNPS
      );

      const delta = Math.abs(oldRegimeTax - newRegimeTax);

      if (delta === 0) {
         return {
            label: 'Tax Position Optimized',
            detail: 'No immediate tax action needed',
            color: '#059669',
            bg: '#D1FAE5',
         };
      }

      const betterRegime = newRegimeTax < oldRegimeTax ? 'New Regime' : 'Old Regime';
      return {
         label: 'Tax Opportunity Detected',
         detail: `${betterRegime} can save ${formatIndian(delta)} per year`,
         color: '#B45309',
         bg: '#FEF3C7',
      };
   }, [userData]);

  // Dynamic Milestones
  const dynamicMilestones = useMemo(() => {
    if (!userData || !baseResults) return [];
    const targets = [1000000, 2500000, 5000000, 10000000, 50000000, 100000000];
      const corpus = baseResults.combinedSavingsUsed || 0;
      const pmt = baseResults.totalMonthlyContribution || 0;
    const currentAge = parseInt(userData.age) || 28;
    
    return targets.map(target => ({
       target,
       ...getMilestoneAge(target, currentAge, corpus, pmt, baseResults.blendedReturn)
    }));
  }, [userData, baseResults]);

   const isNonNpsOnly = baseResults?.retirementMode === RETIREMENT_MODES.NON_NPS_ONLY;

  const handleLogout = async () => {
      invalidateUserProfileCache(currentUser?.uid);
    await signOut(auth);
    navigate('/');
  };

  const handleTourComplete = () => {
    localStorage.setItem('retiresahi_tour_seen', 'true');
    setTourActive(false);
  };

  const handleTourSkip = () => {
    localStorage.setItem('retiresahi_tour_seen', 'true');
    setTourActive(false);
  };

  const handleStartTour = () => {
    // Jump to top instantly so Step 1 is immediately in view and measurable
    window.scrollTo({ top: 0, behavior: 'instant' });
    // Minimal delay to ensure browser has painted the jump
    setTimeout(() => setTourActive(true), 50);
  };

  const navItems = [
    { label: 'Dashboard', icon: Home, path: '/dashboard', active: true },
    { label: 'Tax Shield', icon: Shield, path: '/tax-shield' },
    { label: 'Dream Planner', icon: Moon, path: '/dream-planner' },
    { label: 'AI Co-Pilot', icon: Bot, path: '/ai-copilot' },
    { label: 'Methodology', icon: BarChart2, path: '/methodology' },
    { label: 'Settings', icon: Settings, path: '/settings' },
  ];

  if (loading) {
     return (
       <div className="min-h-screen flex items-center justify-center bg-[#FFFDF5]">
         <div className="animate-pulse flex flex-col items-center">
            <div className="w-16 h-16 bg-[#8B5CF6]/20 rounded-full mb-4" />
            <div className="h-4 w-32 bg-slate-200 rounded" />
         </div>
       </div>
     );
  }

  return (
    <div className="min-h-screen bg-[#FFFDF5] text-[#1E293B] relative" style={{ fontFamily: '"Plus Jakarta Sans", sans-serif' }}>
      <style>{`
        h1, h2, h3, .font-heading { font-family: 'Outfit', sans-serif; }
        .cubic { transition-timing-function: cubic-bezier(0.34, 1.56, 0.64, 1); }
        .pop-shadow { box-shadow: 4px 4px 0px 0px #1E293B; }
        .candy-btn {
          border-radius: 9999px;
          border: 2px solid #1E293B;
          box-shadow: 4px 4px 0px 0px #1E293B;
          transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
        }
        .candy-btn:hover { transform: translate(-2px, -2px); box-shadow: 6px 6px 0px 0px #1E293B; }
        .candy-btn:active { transform: translate(1px, 1px); box-shadow: 2px 2px 0px 0px #1E293B; }
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .sidebar-item-active { background: #8B5CF6; color: white; border-radius: 9999px; box-shadow: 2px 2px 0px 0px rgba(0,0,0,0.3); }

        @keyframes float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-8px); } }
        .animate-float { animation: float 4s ease-in-out infinite; }
        .animate-slide-up { animation: slideUp 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) forwards; }
        @keyframes slideUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes slideRight { from { opacity: 0; transform: translateX(-20px); } to { opacity: 1; transform: translateX(0); } }
        .animate-slide-right { animation: slideRight 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) forwards; }
        
        /* Tour framing */
        [id^="tour-"] {
          scroll-margin-top: 100px;
        }
      `}</style>

      {/* --- Sidebar (Desktop) --- */}
      <aside className={`fixed left-0 top-0 h-full bg-[#1E293B] z-40 hidden lg:flex flex-col overflow-hidden transition-all duration-300 ease-in-out ${isSidebarCollapsed ? 'w-24 p-4 items-center' : 'w-60 p-6'}`}>
         <div className="flex items-center gap-3 mb-12">
            <div className="w-10 h-10 shrink-0 bg-[#8B5CF6] rounded-full border-2 border-white flex items-center justify-center font-heading font-extrabold text-white text-xl">R</div>
            {!isSidebarCollapsed && <span className="font-heading font-extrabold text-white text-xl uppercase tracking-widest whitespace-nowrap animate-fade-in">RetireSahi</span>}
         </div>

         <nav className="flex-1 space-y-4 w-full">
            {navItems.map(item => (
              <button 
                key={item.label}
                title={isSidebarCollapsed ? item.label : undefined}
                onClick={() => navigate(item.path)}
                className={`w-full flex items-center py-3 font-bold transition-all ${item.active ? 'sidebar-item-active' : 'text-white/70 hover:bg-white/10 rounded-full'} ${isSidebarCollapsed ? 'justify-center px-0' : 'px-4 gap-4'}`}
              >
                <item.icon className="w-5 h-5 shrink-0" strokeWidth={2.5} />
                {!isSidebarCollapsed && <span className="whitespace-nowrap animate-fade-in">{item.label}</span>}
              </button>
            ))}
         </nav>

         <div className="pt-8 border-t border-white/10 mt-auto space-y-4 w-full">
             <button
               onClick={handleStartTour}
               title={isSidebarCollapsed ? "Take the Tour" : undefined}
               className={`w-full flex items-center justify-center py-2.5 rounded-full border border-white/10 text-white/50 hover:text-white hover:bg-white/5 transition-all text-[10px] font-black uppercase tracking-widest ${isSidebarCollapsed ? 'px-0' : 'px-4 gap-2'}`}
             >
               <HelpCircle className="w-4 h-4 shrink-0" /> 
               {!isSidebarCollapsed && <span className="whitespace-nowrap animate-fade-in">Take the Tour</span>}
             </button>
             <div className={`flex items-center p-2 bg-white/5 rounded-2xl ${isSidebarCollapsed ? 'flex-col gap-3 justify-center' : 'gap-3'}`}>
                        {currentUser?.photoURL ? (
                           <img src={currentUser.photoURL} alt="User" referrerPolicy="no-referrer" className="w-10 h-10 shrink-0 rounded-full border-2 border-[#8B5CF6]" />
                ) : (
                  <div className="w-10 h-10 shrink-0 rounded-full bg-[#8B5CF6] border-2 border-white flex items-center justify-center font-bold text-white uppercase text-lg">
                    {userData?.firstName?.[0] || 'U'}
                  </div>
                )}
                {!isSidebarCollapsed && (
                  <div className="flex flex-col min-w-0 pr-2">
                     <span className="text-white font-bold text-sm tracking-wide truncate">{userData?.firstName || 'User'}</span>
                     <button className="text-[10px] text-white/50 uppercase tracking-widest font-black hover:text-[#F472B6] text-left">Edit Profile</button>
                  </div>
                )}
                <button 
                   onClick={handleLogout} 
                   title={isSidebarCollapsed ? "Log Out" : undefined}
                   className={`p-2 text-white/30 hover:text-white transition-colors shrink-0 ${!isSidebarCollapsed ? 'ml-auto' : ''}`}
                >
                   <LogOut className="w-4 h-4" />
                </button>
             </div>
          </div>
      </aside>

      {/* --- Mobile Nav Bottom (Mobile Only) --- */}
         <nav className="fixed bottom-0 left-0 w-full bg-white h-[calc(4rem+env(safe-area-inset-bottom))] border-t border-slate-200 flex lg:hidden items-center justify-around z-50 px-2 pt-1 pb-[env(safe-area-inset-bottom)]">
         {navItems.map(item => (
           <button 
            key={item.label}
            onClick={() => navigate(item.path)}
                  className={`touch-target min-w-[52px] flex flex-col items-center justify-center gap-1 ${item.active ? 'text-[#8B5CF6]' : 'text-slate-400'}`}
                  aria-label={item.label}
           >
             <item.icon className="w-5 h-5" strokeWidth={2.5} />
             {item.active && <span className="text-[9px] font-black uppercase tracking-widest leading-none">{item.label}</span>}
           </button>
         ))}
      </nav>

      {/* --- Main Content area --- */}
      <main className={`min-h-screen flex flex-col relative pb-[calc(5rem+env(safe-area-inset-bottom))] lg:pb-0 transition-all duration-300 ease-in-out ${isSidebarCollapsed ? 'lg:ml-24' : 'lg:ml-60'}`}>
         <div className="absolute inset-0 z-0 pointer-events-none opacity-[0.05]" style={{ backgroundImage: 'radial-gradient(#1E293B 1px, transparent 1px)', backgroundSize: '28px 28px' }} />

         {/* Top Bar */}
         <header className="h-16 border-b border-slate-200 bg-white/80 backdrop-blur-md sticky top-0 z-30 flex items-center justify-between px-4 lg:px-8">
            <div className="flex items-center gap-3">
               <button 
                  onClick={() => setIsMenuOpen(!isMenuOpen)}
                  className="lg:hidden touch-target p-2 -ml-2 text-[#1E293B] hover:bg-slate-50 rounded-lg transition-colors"
                  aria-label={isMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
               >
                  {isMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
               </button>
               <button 
                  onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
                  className="hidden lg:flex p-2 -ml-2 text-[#1E293B] hover:bg-slate-50 rounded-lg transition-colors"
               >
                  <Menu className="w-6 h-6" />
               </button>
               <h1 className="font-heading font-extrabold text-lg md:text-2xl text-[#1E293B] uppercase tracking-widest truncate">Dashboard</h1>
            </div>
            <div className="flex items-center gap-2 md:gap-4 shrink-0">
               <div className={`flex items-center gap-1.5 md:gap-2 px-3 md:px-4 py-1.5 rounded-full border-2 border-[#1E293B] font-black uppercase tracking-widest text-[9px] md:text-[10px]`} style={{ backgroundColor: `${getScoreBand(baseResults?.score).color}22` }}>
                  <div className="w-1.5 h-1.5 md:w-2 md:h-2 rounded-full" style={{ backgroundColor: getScoreBand(baseResults?.score).color }} />
                  <span>{baseResults?.score} <span className="hidden xs:inline">{getScoreBand(baseResults?.score).label}</span></span>
               </div>
               <div
                 className="hidden md:flex items-center gap-2 px-3 md:px-4 py-1.5 rounded-full border-2 border-[#1E293B] font-black uppercase tracking-widest text-[9px] md:text-[10px]"
                 style={{ backgroundColor: taxPosition.bg, color: taxPosition.color }}
                 title={taxPosition.detail}
               >
                 <div className="w-1.5 h-1.5 md:w-2 md:h-2 rounded-full" style={{ backgroundColor: taxPosition.color }} />
                 <span>{taxPosition.label}</span>
               </div>
               <button className="p-1.5 md:p-2 text-[#1E293B]/60 hover:text-[#1E293B] relative">
                  <Bell className="w-5 h-5" />
                  <div className="absolute top-1.5 right-1.5 w-2 h-2 bg-[#F472B6] rounded-full border-2 border-white" />
               </button>
            </div>
         </header>

         {/* Mobile Menu Overlay */}
         {isMenuOpen && (
            <div className="fixed inset-0 z-[60] lg:hidden animate-fade-in">
               <div className="absolute inset-0 bg-[#1E293B]/40 backdrop-blur-sm" onClick={() => setIsMenuOpen(false)} />
               <aside className="absolute top-0 left-0 h-full w-[280px] bg-[#1E293B] p-6 flex flex-col animate-slide-right">
                  <div className="flex items-center justify-between mb-10">
                     <div className="flex items-center gap-3">
                        <div className="w-9 h-9 bg-[#8B5CF6] rounded-full border-2 border-white flex items-center justify-center font-heading font-extrabold text-white">R</div>
                        <span className="font-heading font-extrabold text-white tracking-widest">RetireSahi</span>
                     </div>
                     <button onClick={() => setIsMenuOpen(false)} className="text-white/40 hover:text-white">
                        <X className="w-6 h-6" />
                     </button>
                  </div>

                  <nav className="flex-1 space-y-2">
                     {navItems.map(item => (
                       <button 
                         key={item.label}
                         onClick={() => { navigate(item.path); setIsMenuOpen(false); }}
                         className={`w-full flex items-center gap-4 py-3.5 px-4 font-bold transition-all text-sm ${item.active ? 'sidebar-item-active' : 'text-white/70 hover:bg-white/5 rounded-full'}`}
                       >
                         <item.icon className="w-5 h-5" strokeWidth={2.5} />
                         <span>{item.label}</span>
                       </button>
                     ))}
                  </nav>

                  <div className="pt-6 border-t border-white/10 mt-auto">
                     <div className="flex items-center gap-3 p-3 bg-white/5 rounded-2xl">
                                    {currentUser?.photoURL ? (
                                       <img src={currentUser.photoURL} alt="User" referrerPolicy="no-referrer" className="w-9 h-9 rounded-full border-2 border-[#8B5CF6]" />
                        ) : (
                          <div className="w-9 h-9 rounded-full bg-[#8B5CF6] border-2 border-white flex items-center justify-center font-bold text-white text-base">
                            {userData?.firstName?.[0] || 'U'}
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                           <div className="text-white font-bold text-sm truncate">{userData?.firstName || 'User'}</div>
                           <button onClick={() => { handleLogout(); setIsMenuOpen(false); }} className="text-[10px] text-[#F472B6] font-black uppercase tracking-widest">Sign Out</button>
                        </div>
                     </div>
                  </div>
               </aside>
            </div>
         )}

         <div className="flex-1 p-4 md:p-6 lg:p-8 space-y-8 md:space-y-10 z-10 max-w-6xl mx-auto w-full">
            
            {/* 1. Hero Row */}
            <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start">
               <div id="tour-score-arc" className="lg:col-span-5 flex flex-col gap-4">
                  <ScoreArc score={baseResults?.score} assumptionsOpen={assumptionsOpen} setAssumptionsOpen={setAssumptionsOpen} />
                  
                  {assumptionsOpen && (
                    <div className="bg-[#1E293B] text-white rounded-2xl p-5 md:p-6 pop-shadow animate-slide-up space-y-4">
                       <h3 className="font-black uppercase tracking-widest text-xs text-[#8B5CF6]">Decision Assumptions</h3>
                       <div className="grid grid-cols-1 gap-3 text-[10px] font-bold uppercase tracking-widest text-white/60">
                          <div className="flex justify-between border-b border-white/10 pb-2">
                             <span>Returns (Blended)</span>
                             <span className="text-white">{(baseResults?.blendedReturn * 100).toFixed(2)}% p.a.</span>
                          </div>
                          <div className="flex justify-between border-b border-white/10 pb-2">
                             <span>Inflation</span>
                             <span className="text-white">{INFLATION_RATE * 100}% p.a.</span>
                          </div>
                          <div className="flex justify-between border-b border-white/10 pb-2">
                             <span>Safe Withdrawal Rate</span>
                             <span className="text-white">{SWR * 100}% p.a.</span>
                          </div>
                          <div className="flex justify-between border-b border-white/10 pb-2">
                             <span>Annuity Split</span>
                             <span className="text-white">{ANNUITY_PCT * 100}% mandated</span>
                          </div>
                          <div className="flex justify-between">
                             <span>Lifestyle Need</span>
                             <span className="text-white">{LIFESTYLE_MULTIPLIERS[userData?.lifestyle] * 100}% of CTC</span>
                          </div>
                       </div>
                       <p className="text-[9px] text-white/30 font-bold leading-relaxed border-t border-white/10 pt-4 italic">
                          Returns based on: Scheme E (12.69%), C (8.87%), G (8.74%). Annuity assumes LIC rate of 6% p.a.
                       </p>
                    </div>
                  )}
               </div>

               <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-4 lg:gap-6 w-full">
                  <div id="tour-projected-value">
                    <StatCard 
                      label={<>Projected Value <InfoTooltip text={DASHBOARD_TIPS.projectedValue} /></>} 
                      value={formatIndian(baseResults?.projectedValue)} 
                      subtext={`Available after ${ANNUITY_PCT*100}% annuity`} 
                      icon={TrendingUp} 
                      accent={COLORS.emerald} 
                    />
                  </div>
                  <div id="tour-annuity">
                    <StatCard 
                      label={<>Mandatory Annuity <InfoTooltip text={DASHBOARD_TIPS.annuity} /></>} 
                      value={formatIndian(baseResults?.annuityCorpus)} 
                      subtext={`Pension: ${formatIndian(baseResults?.monthlyAnnuityIncome)}/m`} 
                      icon={Shield} 
                      accent={COLORS.violet} 
                    />
                  </div>
                  <div id="tour-corpus-gap" className="col-span-full bg-[#FBBF24] border-2 border-[#1E293B] rounded-[20px] p-6 md:p-8 pop-shadow-vivid relative group" style={{ boxShadow: '4px 4px 0px 0px #1E293B' }}>
                     <div className="text-[10px] font-black uppercase tracking-[2px] text-[#1E293B]/50 mb-3 flex items-center gap-2">
                        <span className="w-3.5 h-3.5 flex items-center justify-center font-black">₹</span> Corpus Gap Closer <InfoTooltip text={DASHBOARD_TIPS.corpusGap} />
                     </div>
                     <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                        <div>
                         <div className="font-heading font-black text-2xl md:text-5xl text-[#1E293B] leading-none mb-2">
                            {baseResults?.monthlyGap > 0 ? `${formatIndian(baseResults.monthlyGap)}/m more` : "You're all set! 🎉"}
                         </div>
                         <div className="text-xs md:text-sm font-bold text-[#1E293B]/70 uppercase tracking-widest leading-relaxed max-w-sm">
                            {baseResults?.monthlyGap > 0 
                              ? `Bridge the ${formatIndian(baseResults.gap)} gap by increasing your monthly pulse.` 
                              : "Your current pulse is high enough to sustain your lifestyle!"}
                         </div>
                        </div>
                        {baseResults?.monthlyGap > 0 && (
                          <div className="bg-white/30 px-3 py-1.5 rounded-lg text-[9px] md:text-[10px] font-black text-[#1E293B] shrink-0 w-fit">
                             ~{((baseResults.monthlyGap / userData.monthlyIncome) * 100).toFixed(1)}% OF CTC
                          </div>
                        )}
                     </div>
                  </div>
               </div>
            </section>

            {/* Required Corpus - Horizontally Extended Full Width Card */}
            <section className="mb-8 md:mb-10 w-full animate-slide-up" style={{ animationDelay: '0.1s' }}>
               <div id="required-corpus-card" className="bg-white border-2 border-[#1E293B] rounded-[24px] p-6 md:p-8 pop-shadow hover:-translate-y-1 transition-all cubic flex flex-col xl:flex-row xl:items-center justify-between gap-6 md:gap-8 group">
                  {/* Title & Amount Sector */}
                  <div className="flex justify-between items-center xl:w-[30%] shrink-0">
                     <div>
                       <div className="text-[10px] md:text-sm font-bold uppercase tracking-[2px] text-[#1E293B]/40 mb-1 flex items-center gap-1">
                          REQUIRED CORPUS <InfoTooltip text={`Total savings needed at age ${userData?.retireAge || 60} to fund your ${userData?.lifestyle || 'comfortable'} lifestyle for life. Uses 3.5% Safe Withdrawal Rate adjusted for Indian inflation.`} />
                       </div>
                       <div className="font-heading font-extrabold text-3xl md:text-3xl text-[#1E293B]">{formatIndian(baseResults?.requiredCorpus)}</div>
                       <div className="text-[10px] font-bold text-[#1E293B]/60 uppercase tracking-widest mt-1">Target by age {userData?.retireAge || 60}</div>
                     </div>
                     <div className="w-12 h-12 md:w-16 md:h-16 rounded-full flex items-center justify-center border-2 border-[#1E293B] shadow-[2px_2px_0_0_#1E293B] bg-[#3B82F6]/20 shrink-0">
                        <Target className="w-6 h-6 md:w-8 md:h-8 text-[#3B82F6]" strokeWidth={2.5} />
                     </div>
                  </div>

                  {/* Progress Bar Sector */}
                  <div className="flex-1 min-w-0 flex flex-col justify-center">
                    <div className="text-[10px] md:text-xs font-bold text-[#1E293B] uppercase tracking-widest flex justify-between">
                      <span>Gap: {formatIndian(baseResults?.gap)}</span>
                      <span>{Math.round(((baseResults?.gap || 0) / (baseResults?.requiredCorpus || 1)) * 100)}% remaining</span>
                    </div>
                    <div style={{ background: '#E2E8F0', borderRadius: 9999, height: 10, marginTop: 12 }}>
                      <div style={{
                        width: `${Math.min(100, Math.round(((baseResults?.projectedValue || 0) / (baseResults?.requiredCorpus || 1)) * 100))}%`,
                        height: '100%',
                        background: baseResults?.score >= 70 ? '#34D399' : baseResults?.score >= 50 ? '#F97316' : '#EF4444',
                        borderRadius: 9999,
                        transition: 'width 1.5s cubic-bezier(0.34, 1.56, 0.64, 1)'
                      }} />
                    </div>
                    <div style={{ fontSize: '11px', color: '#1E293B', marginTop: 8, fontWeight: '900', textTransform: 'uppercase' }}>
                      {Math.min(100, Math.round(((baseResults?.projectedValue || 0) / (baseResults?.requiredCorpus || 1)) * 100))}% funded
                    </div>
                  </div>

                  {/* Stat Pills Sector */}
                  <div className="flex gap-4 xl:w-[35%] shrink-0">
                    <div className="flex-1 bg-[#F1F5F9] border-2 border-[#1E293B] rounded-[16px] p-3 md:p-4 flex flex-col items-center justify-center shadow-[3px_3px_0_0_#1E293B]">
                      <span className="text-[9px] md:text-[10px] font-black uppercase tracking-[2px] text-[#1E293B]/50 text-center mb-1">
                        LUMP SUM AT {userData?.retireAge || 60}
                      </span>
                      <span className="text-sm md:text-xl font-black text-[#1E293B] font-heading">
                        {formatIndian(baseResults?.lumpSumCorpus)}
                      </span>
                    </div>

                    <div className="flex-1 bg-[#F1F5F9] border-2 border-[#1E293B] rounded-[16px] p-3 md:p-4 flex flex-col items-center justify-center shadow-[3px_3px_0_0_#1E293B]">
                      <span className="text-[9px] md:text-[10px] font-black uppercase tracking-[2px] text-[#1E293B]/50 text-center mb-1">
                        MONTHLY PENSION
                      </span>
                      <span className="text-sm md:text-xl font-black text-[#8B5CF6] font-heading">
                        {formatIndian(baseResults?.monthlyAnnuityIncome)}/m
                      </span>
                    </div>
                  </div>
               </div>
            </section>

            {/* 2. Your Biggest Lever */}
            <section>
               <div className="bg-white border-2 border-[#1E293B] rounded-[24px] overflow-hidden flex flex-col md:flex-row pop-shadow group">
                  <div className="h-1.5 md:h-auto md:w-2 bg-[#8B5CF6]" />
                  <div className="p-6 md:p-8 flex-1 flex flex-col md:flex-row items-center gap-6 md:gap-8">
                     <div className="flex-1 space-y-3 w-full">
                        <div className="flex items-center gap-2 text-[#8B5CF6]">
                           <Zap className="w-4 h-4" fill="currentColor" />
                           <span className="text-[10px] md:text-xs font-black uppercase tracking-widest">Optimized Strategy</span>
                        </div>
                        <h2 className="font-heading font-extrabold text-xl md:text-3xl text-[#1E293B] leading-tight">
                           {baseResults?.monthlyGap > 0 
                             ? `Boost your monthly contribution to completely zero-out the retirement gap.`
                             : `Enable a 10% annual step-up to secure a significant surplus!`}
                        </h2>
                        <button 
                          onClick={() => setSimulatorOpen(true)}
                          className="candy-btn w-full md:w-fit px-8 py-3 bg-[#8B5CF6] text-white font-black uppercase tracking-widest text-xs flex items-center justify-center gap-2 group cursor-pointer"
                        >
                          Try Simulator <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                        </button>
                     </div>
                     <div className="flex items-center gap-4 shrink-0 bg-[#F1F5F9]/30 p-4 rounded-2xl md:bg-transparent md:p-0">
                        <div className="text-center font-black">
                           <div className="text-[9px] md:text-[10px] text-[#1E293B]/30 mb-2">NOW</div>
                           <div className="w-12 h-12 md:w-16 md:h-16 rounded-full border-2 border-[#1E293B] flex items-center justify-center font-heading text-lg md:text-xl text-[#1E293B] bg-white tabular-nums">{baseResults?.score}</div>
                        </div>
                        <ArrowRight className="text-[#1E293B]/20 w-4 h-4 md:w-5 md:h-5" />
                        <div className="text-center font-black">
                           <div className="text-[9px] md:text-[10px] text-[#8B5CF6] mb-2 font-black uppercase">Goal</div>
                           <div className="w-16 h-16 md:w-20 md:h-20 rounded-full border-4 border-[#8B5CF6] flex items-center justify-center font-heading text-xl md:text-2xl text-[#8B5CF6] bg-white tabular-nums shadow-[4px_4px_0_0_#8B5CF622]">100</div>
                        </div>
                     </div>
                  </div>
               </div>
            </section>

            {/* 3. Quick Stats Row */}
            <section id="tour-quick-stats" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
                      <QuickStat label={<>Monthly Pulse <InfoTooltip text={DASHBOARD_TIPS.monthlyPulse} /></>} value={formatIndian(baseResults?.totalMonthlyContribution || 0)} subtext="Total monthly contribution" icon={Wallet} color={COLORS.pink} />
                      <QuickStat label={<>NPS Corpus <InfoTooltip text={DASHBOARD_TIPS.totalWealth} /></>} value={formatIndian(baseResults?.npsCorpusUsed || 0)} subtext="Current NPS value" icon={Shield} color={COLORS.violet} />
                      <QuickStat label={<>Other Savings <InfoTooltip text={DASHBOARD_TIPS.totalWealth} /></>} value={formatIndian(baseResults?.otherSavingsUsed || 0)} subtext="PPF/EPF/MF/others" icon={PiggyBank} color={COLORS.emerald} />
               <QuickStat label={<>Time Remaining <InfoTooltip text={DASHBOARD_TIPS.timeRemaining} /></>} value={`${userData?.retireAge - userData?.age} years`} subtext={`Until age ${userData?.retireAge}`} icon={Clock} color={COLORS.amber} />
            </section>

                  {isNonNpsOnly && (
                     <section className="bg-[#D1FAE5] border-2 border-[#1E293B] rounded-[20px] p-6 pop-shadow flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div>
                           <div className="text-[10px] font-black uppercase tracking-[2px] text-[#065F46] mb-1">NPS Recommendation</div>
                           <h3 className="font-heading font-black text-xl text-[#1E293B]">Consider adding NPS as a government-backed retirement layer.</h3>
                           <p className="text-xs font-bold uppercase tracking-widest text-[#1E293B]/60 mt-2">Benefits: regulated structure, tax advantages, pension discipline at retirement.</p>
                        </div>
                        <button
                           onClick={() => navigate('/settings')}
                           className="px-6 py-3 bg-[#8B5CF6] text-white border-2 border-[#1E293B] rounded-full font-black uppercase tracking-widest text-xs shadow-[4px_4px_0_0_#1E293B]"
                        >
                           Enable NPS in Settings
                        </button>
                     </section>
                  )}

            {/* 4. What If Scenarios */}
            <section id="tour-scenarios" className="space-y-6">
               <div className="flex items-center gap-4">
                  <h2 className="font-heading font-extrabold text-xl md:text-3xl uppercase tracking-widest leading-none">Decision Scenarios <InfoTooltip text={DASHBOARD_TIPS.scenarios} /></h2>
                  <div className="flex-1 h-[2px] bg-[#1E293B]/10 relative">
                     <svg className="absolute top-[-8px] right-0 w-12 h-4 text-[#8B5CF6]" viewBox="0 0 100 20" preserveAspectRatio="none">
                        <path d="M0,10 Q25,0 50,10 T100,10" fill="none" stroke="currentColor" strokeWidth="4" />
                     </svg>
                  </div>
               </div>

               <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
                  {scenarios.map((s, i) => (
                    <ScenarioCard 
                      key={i} 
                      title={s.title} 
                      impact={s.impact} 
                      desc={s.desc} 
                      onClick={() => {
                        setSimValues(prev => ({ ...prev, ...s.overrides }));
                        setSimulatorOpen(true);
                      }} 
                    />
                  ))}
               </div>
            </section>

            {/* 5. Corpus Milestone Timeline */}
            <section id="tour-milestones" className="space-y-6 overflow-hidden">
               <div className="flex items-center gap-3">
                  <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-[#1E293B] flex items-center justify-center text-lg md:text-xl shrink-0">🏆</div>
                  <h2 className="font-heading font-extrabold text-xl md:text-3xl uppercase tracking-widest leading-none">Wealth Milestones <InfoTooltip text={DASHBOARD_TIPS.milestones} /></h2>
               </div>
               
               <div className="flex gap-4 md:gap-8 overflow-x-auto pb-6 px-2 no-scrollbar scroll-smooth">
                  {dynamicMilestones.map((m, i) => (
                    <MilestoneItem 
                      key={i} 
                      milestone={m.target} 
                      age={m.age} 
                      achieved={m.achieved} 
                      color={i % 2 === 0 ? COLORS.violet : COLORS.pink} 
                    />
                  ))}
               </div>
            </section>

            {/* 6. Teaser Cards (Tax & AI) */}
            <section id="tour-teasers" className="grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-8">
               {/* Tax Analysis Card */}
               <div className="bg-[#8B5CF6] border-2 border-[#1E293B] rounded-[24px] p-6 md:p-8 text-white pop-shadow relative overflow-hidden flex flex-col justify-between group">
                  <div className="relative z-10 flex flex-col h-full">
                     <div className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-white flex items-center justify-center mb-6">
                        <Shield className="text-[#8B5CF6] w-5 h-5 md:w-6 md:h-6" strokeWidth={3} />
                     </div>
                     <h3 className="font-heading font-extrabold text-xl md:text-3xl mb-4 leading-tight">Stop overpaying<br/>the Taxman.</h3>
                     <p className="text-white/80 font-bold mb-8 text-xs md:text-sm leading-relaxed max-w-[80%]">
                        Indian tax laws (AY 2025-26) have three distinct NPS buckets. Most people only use one.
                     </p>
                     <button 
                       onClick={() => navigate('/tax-shield')}
                       className="bg-white text-[#8B5CF6] px-6 py-2.5 md:py-3 rounded-full font-black uppercase tracking-widest text-[10px] md:text-xs border-2 border-white hover:bg-[#1E293B] hover:text-white transition-colors cursor-pointer w-fit mt-auto"
                     >
                        Run Analytics →
                     </button>
                  </div>
                  <div className="absolute top-1/2 right-0 translate-y-[-50%] p-8 hidden sm:flex flex-col gap-4 opacity-30 select-none pointer-events-none">
                     <div className="px-4 py-2 border-2 border-white/50 rounded-full font-black text-xs">80CCD(1)</div>
                     <div className="px-4 py-2 border-2 border-white/50 rounded-full font-black text-xs">80CCD(1B)</div>
                     <div className="px-4 py-2 border-2 border-white/50 rounded-full font-black text-xs">80CCD(2)</div>
                  </div>
               </div>

               {/* AI Co-Pilot Teaser */}
               <div className="bg-white border-2 border-[#1E293B] rounded-[24px] overflow-hidden flex flex-col pop-shadow relative group">
                  <div className="w-full h-1.5 md:h-2 bg-[#F472B6]" />
                  <div className="p-6 md:p-8 space-y-6">
                     <div className="flex items-center gap-3">
                        <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-[#F472B6]/10 flex items-center justify-center border-2 border-[#1E293B] text-lg">🤖</div>
                        <h3 className="font-heading font-extrabold text-xl md:text-3xl text-[#1E293B] uppercase tracking-widest leading-none">AI Whisper</h3>
                     </div>
                     <p className="text-[#1E293B]/60 font-bold text-xs md:text-sm leading-relaxed">
                        Every answer here is context-aware. I know your score is <span className="text-[#8B5CF6]">{baseResults?.score}</span> and your gap is <span className="text-[#FBBF24]">{formatIndian(baseResults?.gap)}</span>.
                     </p>
                     
                     <div className="space-y-3">
                        {['How do I hit ₹1Cr sooner?', 'Should I switch to corporate bond NPS?', 'Explain the 40% annuity rule.'].map(txt => (
                           <button 
                             key={txt} 
                             onClick={() => navigate('/ai-copilot', { state: { initialPrompt: txt } })}
                             className="touch-target w-full text-left p-3 rounded-xl border-2 border-[#1E293B] bg-[#FFFDF5] text-[10px] md:text-xs font-black uppercase tracking-widest shadow-[2px_2px_0_0_#1E293B] hover:shadow-[4px_4px_0_0_#F472B6] transition-all cursor-pointer whitespace-normal"
                           >
                              {txt}
                           </button>
                        ))}
                     </div>
 
                     <button 
                       onClick={() => navigate('/ai-copilot')}
                       className="w-full py-3.5 md:py-4 bg-[#F472B6] text-white border-2 border-[#1E293B] rounded-xl font-black uppercase tracking-widest text-xs md:text-sm pop-shadow hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[6px_6px_0_0_#1E293B] cursor-pointer"
                     >
                        Ask Pulse AI →
                     </button>
                  </div>
               </div>
            </section>
         </div>
      </main>

      {/* --- Power Simulator Slide-up Panel --- */}
      {simulatorOpen && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-end animate-fade-in">
           <div className="absolute inset-0 bg-[#1E293B]/40 backdrop-blur-sm" onClick={() => setSimulatorOpen(false)} />
           <div className="z-10 bg-white border-t-4 border-l-4 border-r-4 border-[#1E293B] rounded-t-[32px] sm:rounded-t-[40px] w-full max-w-4xl p-4 sm:p-8 pb-[max(1rem,env(safe-area-inset-bottom))] sm:pb-12 shadow-[0_-12px_40px_rgba(0,0,0,0.15)] flex flex-col relative animate-slide-up no-scrollbar overflow-y-auto max-h-[90vh]">
              <div className="w-16 h-2 bg-[#1E293B]/10 rounded-full mx-auto mb-8 shrink-0" />

              <div className="flex justify-between items-start mb-10 shrink-0">
                 <div>
                    <h2 className="font-heading font-black text-4xl text-[#1E293B] leading-none mb-2 tabular-nums">Decision Simulator</h2>
                    <p className="text-sm font-bold text-[#1E293B]/40 uppercase tracking-widest">Calculated using {(simResults?.blendedReturn * 100).toFixed(1)}% expected return.</p>
                 </div>
                 <button onClick={() => setSimulatorOpen(false)} className="touch-target p-3 bg-[#F1F5F9] border-2 border-[#1E293B] rounded-full hover:bg-[#FEE2E2] hover:text-[#EF4444] transition-colors cursor-pointer pop-shadow" aria-label="Close simulator">
                    <X className="w-6 h-6" />
                 </button>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 flex-1">
                 <div className="space-y-12">
                    <div className="space-y-6">
                       <div className="flex justify-between items-center pr-2">
                          <label className="text-xs font-black uppercase tracking-[3px] text-[#1E293B]/70">Monthly Investment</label>
                          <span className="px-3 py-1 bg-[#FBBF24] border-2 border-[#1E293B] rounded-full font-black text-sm shadow-[2px_2px_0_0_#1E293B] tabular-nums">{formatIndian(simValues.npsContribution)}</span>
                       </div>
                       <input 
                         type="range" min="500" max="50000" step="500" 
                         value={simValues.npsContribution} 
                         onChange={e => setSimValues({...simValues, npsContribution: parseInt(e.target.value)})}
                         className="w-full h-3 bg-[#F1F5F9] border-2 border-[#1E293B] rounded-full appearance-none cursor-pointer accent-[#8B5CF6]"
                       />
                    </div>

                    <div className="flex items-center justify-between p-6 bg-[#8B5CF6]/5 border-2 border-[#8B5CF6] rounded-2xl border-dashed">
                       <div>
                          <div className="font-black uppercase tracking-widest text-[#8B5CF6] text-sm mb-1">10% Annual Step-up</div>
                          <div className="text-[10px] font-bold text-[#1E293B]/50">Increases contribution with your salary hikes</div>
                       </div>
                       <button 
                        onClick={() => setSimValues({...simValues, stepUp: simValues.stepUp > 0 ? 0 : 0.1})}
                        className={`w-14 h-8 rounded-full border-2 border-[#1E293B] relative transition-colors duration-300 shadow-[2px_2px_0_0_#1E293B] ${simValues.stepUp > 0 ? 'bg-[#34D399]' : 'bg-[#E2E8F0]'}`}
                       >
                         <div className={`absolute top-1 w-5 h-5 bg-white border-2 border-[#1E293B] rounded-full transition-all duration-300 ${simValues.stepUp > 0 ? 'left-7' : 'left-1'}`} />
                       </button>
                    </div>

                    <div className="space-y-4">
                       <label className="text-xs font-black uppercase tracking-[3px] text-[#1E293B]/70">Equity Allocation (Max {getMaxEquityPct(userData?.age)}%)</label>
                        <div className="flex gap-4">
                          {[25, 50, 75].map(eq => (
                             <button 
                               key={eq}
                               disabled={eq > getMaxEquityPct(userData?.age)}
                               onClick={() => setSimValues({...simValues, npsEquity: eq})}
                               className={`flex-1 py-3 rounded-xl border-2 border-[#1E293B] font-black uppercase tracking-widest text-sm transition-all cubic ${simValues.npsEquity === eq ? 'bg-[#8B5CF6] text-white shadow-[4px_4px_0_0_#1E293B] -translate-y-1' : eq > getMaxEquityPct(userData?.age) ? 'bg-slate-100 text-slate-300 opacity-50 cursor-not-allowed border-[#CBD5E1]' : 'bg-white text-[#1E293B] hover:shadow-[4px_4px_0_0_#1E293B] hover:-translate-y-1'}`}
                             >
                               {eq}%
                             </button>
                          ))}
                       </div>
                    </div>

                    <div className="space-y-4">
                       <label className="text-xs font-black uppercase tracking-[3px] text-[#1E293B]/70">Retirement Age</label>
                       <div className="flex flex-wrap gap-4">
                          {[55, 58, 60, 65].map(ra => (
                             <button 
                               key={ra}
                               onClick={() => setSimValues({...simValues, retireAge: ra})}
                               className={`min-w-[70px] flex-1 py-3 rounded-xl border-2 border-[#1E293B] font-black uppercase tracking-widest text-sm transition-all cubic ${simValues.retireAge === ra ? 'bg-[#34D399] text-[#1E293B] shadow-[4px_4px_0_0_#1E293B] -translate-y-1' : 'bg-white text-[#1E293B] hover:shadow-[4px_4px_0_0_#1E293B] hover:-translate-y-1'}`}
                             >
                               {ra}
                             </button>
                          ))}
                       </div>
                    </div>
                 </div>

                 <div className="bg-[#FFFDF5] border-2 border-[#1E293B] rounded-3xl p-8 flex flex-col justify-between items-center gap-8 relative overflow-hidden shadow-[inset_4px_4px_12px_rgba(0,0,0,0.05)]">
                    <div className="absolute top-4 right-4 text-[10px] font-black uppercase tracking-widest text-[#1E293B]/20">Predictive Impact</div>
                    
                    <div className="text-center space-y-2">
                       <h3 className="text-xs font-black uppercase tracking-widest text-[#1E293B]/40">Simulated Score</h3>
                       <div className="flex items-center gap-6">
                         <div className="font-heading font-black text-8xl md:text-9xl text-[#1E293B] tabular-nums">{simResults?.score}</div>
                         <div className={`px-4 py-2 rounded-full border-2 border-[#1E293B] font-black text-sm shadow-[3px_3px_0_0_#1E293B] ${simResults?.score >= baseResults?.score ? 'bg-[#D1FAE5] text-[#065F46]' : 'bg-[#FEE2E2] text-[#991B1B]'}`}>
                            {simResults?.score >= baseResults?.score ? `+${simResults?.score - baseResults?.score}` : simResults?.score - baseResults?.score} PTS
                         </div>
                       </div>
                    </div>

                    <div className="w-full space-y-4">
                       <div className="flex justify-between items-center text-sm font-bold border-b border-[#1E293B]/10 pb-4">
                          <span className="text-[#1E293B]/50 uppercase tracking-widest">New Future Value</span>
                          <span className="text-lg font-black tabular-nums">{formatIndian(simResults?.projectedValue)}</span>
                       </div>
                       <div className="flex justify-between items-center text-sm font-bold border-b border-[#1E293B]/10 pb-4">
                          <span className="text-[#1E293B]/50 uppercase tracking-widest">New Monthly Pension</span>
                          <span className="text-lg font-black tabular-nums">{formatIndian(simResults?.monthlyAnnuityIncome)}/m</span>
                       </div>
                    </div>

                    <button 
                      onClick={async () => {
                         const user = auth.currentUser;
                                     if (user) {
                                                            const payload = {
                             ...simValues,
                             ...simResults,
                             updatedAt: new Date().toISOString()
                                        };
                                        const encrypted = await encryptUserData(payload, user.uid);
                                        await setDoc(doc(db, 'users', user.uid), encrypted, { merge: true });
                                        const nextUserData = { ...userData, ...simValues, ...simResults };
                                        setUserData(nextUserData);
                                        writeUserProfileCache(user.uid, nextUserData);
                           setSimulatorOpen(false);
                         }
                      }}
                      className="w-full py-5 bg-[#8B5CF6] text-white font-heading font-black text-xl uppercase tracking-widest candy-btn flex items-center justify-center gap-3"
                    >
                       Set As Baseline <CheckCircle2 className="w-6 h-6" />
                    </button>
                 </div>
              </div>
           </div>
        </div>
      )}

      {/* ── Tour Overlay ── */}
      {tourActive && (
        <TourOverlay
          steps={TOUR_STEPS}
          onComplete={handleTourComplete}
          onSkip={handleTourSkip}
        />
      )}
    </div>
  );
}

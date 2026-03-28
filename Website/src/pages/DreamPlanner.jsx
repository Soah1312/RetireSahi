import React, { useState, useEffect, useMemo } from 'react';
import { 
  Home, Coffee, Star, UtensilsCrossed, Heart, Plane, Users, Shield, 
  ChevronRight, ArrowRight, RotateCcw, CheckCircle2, TrendingUp, Info
} from 'lucide-react';
import { db, auth } from '../lib/firebase';
import { doc, setDoc } from 'firebase/firestore';
import { calculateRetirement, formatIndian, INFLATION_RATE, LIFESTYLE_MULTIPLIERS } from '../utils/math';
import DashboardLayout, { useUser } from '../components/DashboardLayout';

const COLORS = {
  emerald: '#34D399',
  violet: '#8B5CF6',
  pink: '#F472B6',
  amber: '#FBBF24',
  slate: '#1E293B'
};

const CATEGORIES = [
  { name: "Housing & Utilities", icon: Home,      pct: 0.35, color: "#8B5CF6" },
  { name: "Food & Dining",       icon: UtensilsCrossed, pct: 0.20, color: "#F472B6" },
  { name: "Healthcare",          icon: Heart,     pct: 0.15, color: "#EF4444" },
  { name: "Travel & Leisure",    icon: Plane,     pct: 0.15, color: "#FBBF24" },
  { name: "Family & Misc",       icon: Users,     pct: 0.10, color: "#34D399" },
  { name: "Emergency Buffer",    icon: Shield,    pct: 0.05, color: "#3B82F6" },
];

const LifestyleCard = ({ type, selected, onClick, userData }) => {
  const configs = {
    essential: {
      accent: COLORS.emerald,
      icon: Home,
      title: "Essential",
      subtitle: "Basic needs covered",
      details: ["Simple housing & utilities", "Home-cooked meals, occasional dining", "Local travel only", "Basic healthcare"],
      multiplier: LIFESTYLE_MULTIPLIERS.essential,
      tag: "40% of current income"
    },
    comfortable: {
      accent: COLORS.violet,
      icon: Coffee,
      title: "Comfortable",
      subtitle: "Travel and daily flexibility",
      details: ["Good housing in your city", "Dining out 2–3x/week", "Annual domestic travel", "Health insurance covered"],
      multiplier: LIFESTYLE_MULTIPLIERS.comfortable,
      tag: "60% of current income",
      badge: "MOST CHOSEN"
    },
    premium: {
      accent: COLORS.pink,
      icon: Star,
      title: "Premium",
      subtitle: "Financial freedom & luxury",
      details: ["Premium housing or owned home", "Fine dining, social life", "International travel yearly", "Comprehensive healthcare"],
      multiplier: LIFESTYLE_MULTIPLIERS.premium,
      tag: "80% of current income"
    }
  };

  const config = configs[type];
  const Icon = config.icon;
  const yearsToRetire = userData.retireAge - userData.age;
  const monthlyNeedToday = userData.monthlyIncome * config.multiplier;
  const monthlyNeedRetirement = monthlyNeedToday * Math.pow(1 + INFLATION_RATE, yearsToRetire);

  return (
    <button
      onClick={() => onClick(type)}
      className={`relative flex-1 bg-white border-2 rounded-[16px] p-6 text-left transition-all duration-300 group ${
        selected 
          ? 'border-[#8B5CF6] shadow-[6px_6px_0_0_#8B5CF6] scale-[1.02]' 
          : 'border-[#1E293B] shadow-[4px_4px_0_0_#1E293B] hover:-translate-y-1 hover:shadow-[6px_6px_0_0_#1E293B]'
      }`}
    >
      {config.badge && (
        <div className="absolute -top-3 -right-3 bg-[#FBBF24] border-2 border-[#1E293B] px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest rotate-3 shadow-[2px_2px_0_0_#1E293B]">
          {config.badge}
        </div>
      )}
      
      <div className={`w-12 h-12 rounded-full flex items-center justify-center border-2 border-[#1E293B] mb-4 shadow-[2px_2px_0_0_#1E293B]`} style={{ backgroundColor: `${config.accent}22` }}>
        <Icon className="w-6 h-6" style={{ color: config.accent }} strokeWidth={2.5} />
      </div>

      <h3 className="font-heading font-extrabold text-xl mb-1">{config.title}</h3>
      <p className="text-xs font-bold text-[#1E293B]/50 uppercase tracking-widest mb-4">{config.subtitle}</p>

      <ul className="space-y-2 mb-6">
        {config.details.map((detail, i) => (
          <li key={i} className="flex items-center gap-2 text-[11px] font-bold text-[#1E293B]/70">
            <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: config.accent }} />
            {detail}
          </li>
        ))}
      </ul>

      <div className="pt-4 border-t border-slate-100 mb-4">
        <div className="text-[10px] font-black text-[#1E293B]/40 uppercase tracking-widest mb-1">Monthly Need</div>
        <div className="flex items-center gap-2">
          <span className="font-heading font-bold text-base">{formatIndian(monthlyNeedToday)}</span>
          <ArrowRight className="w-3 h-3 text-slate-300" />
          <span className="font-heading font-bold text-base" style={{ color: config.accent }}>{formatIndian(monthlyNeedRetirement)}</span>
        </div>
      </div>

      <div className="bg-slate-50 border-2 border-[#1E293B]/10 rounded-full px-3 py-1 text-[9px] font-black uppercase tracking-widest text-center">
        {config.tag}
      </div>
    </button>
  );
};

const InflationRealityCheck = ({ yearsToRetire, monthlyIncome, lifestyleMultiplier }) => {
  const multiplier = Math.pow(1.06, yearsToRetire);
  const [displayMultiplier, setDisplayMultiplier] = useState(1);
  const monthlySpendToday = monthlyIncome * lifestyleMultiplier;
  const monthlySpendRetirement = monthlySpendToday * multiplier;

  useEffect(() => {
    let start = 1;
    const end = multiplier;
    if (start === end) return;
    
    let timer = setInterval(() => {
      start += (end - 1) / 30;
      if (start >= end) {
        setDisplayMultiplier(end);
        clearInterval(timer);
      } else {
        setDisplayMultiplier(start);
      }
    }, 50);
    return () => clearInterval(timer);
  }, [multiplier]);

  return (
    <div className="bg-[#FBBF24] border-2 border-[#1E293B] rounded-[24px] p-8 pop-shadow flex flex-col md:flex-row items-center justify-between gap-8">
      <div className="space-y-2 text-center md:text-left">
        <div className="text-xs font-black uppercase tracking-[3px] text-[#1E293B]">🔥 Inflation Reality Check</div>
        <h2 className="font-heading font-extrabold text-2xl md:text-3xl text-[#1E293B] leading-tight">
          Your {formatIndian(monthlySpendToday)}/month lifestyle today...
        </h2>
        <p className="text-sm md:text-lg font-bold text-[#1E293B]/70 uppercase tracking-widest">
          ...will cost {formatIndian(monthlySpendRetirement)}/month at retirement.
        </p>
        <div className="text-[10px] font-bold text-[#1E293B]/40 uppercase tracking-widest pt-2">
          Assuming 6% inflation over {yearsToRetire} years
        </div>
      </div>
      
      <div className="text-center group">
        <div className="font-heading font-black text-7xl md:text-8xl text-[#1E293B] leading-none transition-transform group-hover:scale-110 duration-500">
          {displayMultiplier.toFixed(1)}×
        </div>
        <div className="text-xs font-black uppercase tracking-widest text-[#1E293B]/60 mt-2">
          purchasing power needed
        </div>
      </div>
    </div>
  );
};

const CategoryBreakdown = ({ monthlySpendToday, monthlySpendRetirement }) => {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <h2 className="font-heading font-extrabold text-2xl md:text-3xl uppercase tracking-widest leading-none">Where Will Your Money Go?</h2>
        <div className="flex-1 h-[2px] bg-[#1E293B]/10" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {CATEGORIES.map((cat, i) => {
          const Icon = cat.icon;
          const today = monthlySpendToday * cat.pct;
          const future = monthlySpendRetirement * cat.pct;
          
          return (
            <div key={i} className="bg-white border-2 border-[#1E293B] rounded-[16px] p-5 pop-shadow group hover:-translate-y-1 transition-all">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-10 h-10 rounded-full flex items-center justify-center border-2 border-[#1E293B] shadow-[2px_2px_0_0_#1E293B]" style={{ backgroundColor: `${cat.color}22` }}>
                  <Icon className="w-5 h-5 text-[#1E293B]" strokeWidth={2.5} style={{ color: cat.color }} />
                </div>
                <div className="font-bold text-sm text-[#1E293B] uppercase tracking-widest">{cat.name}</div>
              </div>

              <div className="flex items-center justify-between mb-4">
                <div className="text-center">
                  <div className="text-[9px] font-black text-[#1E293B]/30 uppercase tracking-widest mb-1">Today</div>
                  <div className="font-bold text-sm tracking-tight">{formatIndian(today)}</div>
                </div>
                <ArrowRight className="w-4 h-4 text-slate-200" />
                <div className="text-center">
                  <div className="text-[9px] font-black text-[#1E293B]/30 uppercase tracking-widest mb-1">Retirement</div>
                  <div className="font-bold text-sm tracking-tight" style={{ color: cat.color }}>{formatIndian(future)}</div>
                </div>
              </div>

              <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden border border-[#1E293B]/10">
                <div className="h-full rounded-full transition-all duration-1000" style={{ width: `${cat.pct * 100}%`, backgroundColor: cat.color }} />
              </div>
              <div className="mt-2 text-[9px] font-black text-[#1E293B]/40 uppercase tracking-widest text-right">
                {cat.pct * 100}% of spend
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const PageContent = () => {
  const { userData, setUserData } = useUser();
  const [selectedLifestyle, setSelectedLifestyle] = useState(userData?.lifestyle || 'comfortable');
  const [showToast, setShowToast] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (userData?.lifestyle) {
      setSelectedLifestyle(userData.lifestyle);
    }
  }, [userData?.lifestyle]);

  const baseResults = useMemo(() => userData ? calculateRetirement(userData) : null, [userData]);
  
  const simResults = useMemo(() => {
    if (!userData) return null;
    return calculateRetirement({ ...userData, lifestyle: selectedLifestyle });
  }, [userData, selectedLifestyle]);

  const yearsToRetire = userData ? userData.retireAge - userData.age : 30;

  const handleSave = async () => {
    if (!auth.currentUser) return;
    setIsSaving(true);
    try {
      const dataToSave = {
        lifestyle: selectedLifestyle,
        score: simResults.score,
        projectedValue: simResults.projectedValue,
        requiredCorpus: simResults.requiredCorpus,
        monthlyGap: simResults.monthlyGap,
        monthlySpendAtRetirement: simResults.monthlySpendAtRetirement,
        updatedAt: new Date().toISOString()
      };
      await setDoc(doc(db, 'users', auth.currentUser.uid), dataToSave, { merge: true });
      setShowToast(true);
      setTimeout(() => setShowToast(false), 3000);
      setUserData(prev => ({ ...prev, ...dataToSave }));
    } catch (e) {
      console.error(e);
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    setSelectedLifestyle(userData.lifestyle || 'comfortable');
  };

  if (!userData) return null;

  const scoreInfo = (score) => {
    if (score <= 30) return { label: 'Critical', color: '#EF4444' };
    if (score <= 50) return { label: 'At Risk', color: '#F97316' };
    if (score <= 70) return { label: 'On Track', color: '#3B82F6' };
    if (score <= 85) return { label: 'Good', color: '#8B5CF6' };
    return { label: 'Excellent', color: '#34D399' };
  };

  return (
    <div className="p-4 md:p-8 space-y-12 max-w-6xl mx-auto pb-32">
      {/* Lifestyle Selector */}
      <section className="space-y-6">
        <div className="text-center md:text-left space-y-2">
          <h2 className="font-heading font-extrabold text-2xl md:text-4xl">🌙 What kind of retirement do you want?</h2>
          <p className="text-sm md:text-base font-bold text-[#1E293B]/50 uppercase tracking-widest">Pick your lifestyle. We'll tell you if you can afford it.</p>
        </div>
        
        <div className="flex flex-col md:flex-row gap-6">
          <LifestyleCard type="essential" selected={selectedLifestyle === 'essential'} onClick={setSelectedLifestyle} userData={userData} />
          <LifestyleCard type="comfortable" selected={selectedLifestyle === 'comfortable'} onClick={setSelectedLifestyle} userData={userData} />
          <LifestyleCard type="premium" selected={selectedLifestyle === 'premium'} onClick={setSelectedLifestyle} userData={userData} />
        </div>
      </section>

      {/* Inflation Reality Check */}
      <InflationRealityCheck 
        yearsToRetire={yearsToRetire} 
        monthlyIncome={userData.monthlyIncome} 
        lifestyleMultiplier={LIFESTYLE_MULTIPLIERS[selectedLifestyle]} 
      />

      {/* Category Breakdown */}
      <CategoryBreakdown 
        monthlySpendToday={userData.monthlyIncome * LIFESTYLE_MULTIPLIERS[selectedLifestyle]}
        monthlySpendRetirement={simResults.monthlySpendAtRetirement}
      />

      {/* Live Score Preview */}
      <section className="bg-white border-2 border-[#1E293B] rounded-[24px] overflow-hidden pop-shadow">
        <div className="w-1.5 absolute left-0 top-0 h-full bg-[#8B5CF6]" />
        <div className="p-8 flex flex-col md:flex-row items-center justify-between gap-12">
          <div className="flex-1 space-y-8 w-full">
            <div className="grid grid-cols-2 gap-8 items-center">
              {/* Current */}
              <div className="space-y-4 text-center">
                <div className="text-[10px] font-black text-[#1E293B]/40 uppercase tracking-[2px]">CURRENT</div>
                <div className="flex flex-col items-center">
                  <div className="w-20 h-20 rounded-full border-4 border-slate-200 flex items-center justify-center font-heading font-black text-2xl text-slate-400 bg-slate-50">
                    {baseResults.score}
                  </div>
                  <div className="mt-2 text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 border border-slate-200">
                    {userData.lifestyle}
                  </div>
                </div>
              </div>

              {/* Simulated */}
              <div className="space-y-4 text-center relative">
                  <div className="absolute left-[-24px] top-1/2 -translate-y-1/2 hidden md:block">
                    <ArrowRight className="w-8 h-8 text-slate-200" />
                  </div>
                <div className="text-[10px] font-black text-[#8B5CF6] uppercase tracking-[2px]">WITH THIS LIFESTYLE</div>
                <div className="flex flex-col items-center">
                  <div 
                    className="w-24 h-24 rounded-full border-4 flex items-center justify-center font-heading font-black text-3xl transition-all duration-500 shadow-[6px_6px_0_0_rgba(0,0,0,0.05)]"
                    style={{ borderColor: scoreInfo(simResults.score).color, color: scoreInfo(simResults.score).color }}
                  >
                    {simResults.score}
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                      <span className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full border border-[#1E293B]" style={{ backgroundColor: `${COLORS.violet}22`, color: COLORS.violet }}>
                        {selectedLifestyle}
                      </span>
                      <span className={`text-[9px] font-black px-2 py-0.5 rounded-full border border-[#1E293B] ${simResults.score >= baseResults.score ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-600'}`}>
                        {simResults.score >= baseResults.score ? '+' : ''}{simResults.score - baseResults.score} PTS
                      </span>
                  </div>
                </div>
              </div>
            </div>

            <div className={`p-4 rounded-xl border-2 border-[#1E293B] font-bold text-xs uppercase tracking-widest flex items-center gap-3 ${
              simResults.score > baseResults.score ? 'bg-[#D1FAE5] border-[#34D399] text-[#065F46]' : 
              simResults.score < baseResults.score ? 'bg-[#FFFBEB] border-[#FBBF24] text-[#92400E]' : 
              'bg-white text-slate-500'
            }`}>
              {simResults.score > baseResults.score ? (
                <> <CheckCircle2 className="w-5 h-5" /> This lifestyle improves your retirement outlook ✓ </>
              ) : simResults.score < baseResults.score ? (
                <> <Info className="w-5 h-5" /> This lifestyle requires more contributions to stay on track </>
              ) : (
                  "No change to your retirement score"
              )}
            </div>
          </div>

          <div className="hidden lg:block w-[300px] h-[300px] relative">
              <div className="absolute inset-0 bg-[#8B5CF6]/5 rounded-full border-2 border-dashed border-[#8B5CF6]/20 animate-spin-slow" />
              <div className="absolute inset-10 bg-white border-2 border-[#1E293B] rounded-[32px] pop-shadow flex items-center justify-center">
                <TrendingUp className="w-20 h-20 text-[#8B5CF6]" strokeWidth={1.5} />
              </div>
          </div>
        </div>
      </section>

      {/* Sticky Action Bar */}
      <div className="fixed bottom-0 left-0 lg:left-60 right-0 h-20 bg-white border-t-2 border-[#1E293B] z-40 px-6 flex items-center justify-between shadow-[0_-8px_30px_rgba(0,0,0,0.05)]">
          <div className="flex flex-col">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Simulating</span>
            <span className="text-sm font-bold text-[#1E293B] uppercase tracking-wide">{selectedLifestyle} lifestyle</span>
          </div>
          
          <div className="flex items-center gap-4">
            <button 
              onClick={handleReset}
              className="px-6 py-2.5 rounded-full font-black text-xs uppercase tracking-widest text-slate-400 hover:text-[#1E293B] transition-colors flex items-center gap-2"
            >
              <RotateCcw className="w-4 h-4" /> Reset
            </button>
            <button 
              onClick={handleSave}
              disabled={isSaving || selectedLifestyle === userData.lifestyle}
              className={`px-8 py-3 bg-[#8B5CF6] border-2 border-[#1E293B] rounded-full shadow-[4px_4px_0_0_#1E293B] hover:-translate-y-0.5 active:translate-y-0.5 active:shadow-[2px_2px_0_0_#1E293B] transition-all text-white text-xs font-black uppercase tracking-[2px] flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              {isSaving ? 'Saving...' : <><CheckCircle2 className="w-4 h-4" /> Save Changes</>}
            </button>
          </div>
      </div>

      {/* Toast */}
      {showToast && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 animate-slide-up">
          <div className="bg-[#FBBF24] border-2 border-[#1E293B] px-6 py-3 rounded-full font-black text-xs uppercase tracking-widest shadow-[4px_4px_0_0_#1E293B] flex items-center gap-3">
              🎉 Dream updated! Your dashboard reflects your new plan.
          </div>
        </div>
      )}
    </div>
  );
};

export default function DreamPlanner() {
  return (
    <DashboardLayout title="Dream Planner">
      <PageContent />
    </DashboardLayout>
  );
}

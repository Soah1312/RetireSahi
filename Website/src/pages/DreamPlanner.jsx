import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Home,
  Coffee,
  Star,
  UtensilsCrossed,
  Heart,
  Plane,
  Users,
  Shield,
  ArrowRight,
  RotateCcw,
  CheckCircle2,
  TrendingUp,
  Info,
  SlidersHorizontal,
} from 'lucide-react';
import InfoTooltip from '../components/InfoTooltip';
import { DREAM_PLANNER_TIPS } from '../constants/tooltips';
import { db, auth } from '../lib/firebase';
import { doc, setDoc } from 'firebase/firestore';
import { calculateRetirement, formatIndian, INFLATION_RATE } from '../utils/math';
import DashboardLayout from '../components/DashboardLayout';
import { useUser } from '../components/UserContext';
import { encryptUserData } from '../utils/encryption';
import { writeUserProfileCache } from '../lib/userProfileCache';
import {
  LIFESTYLE_MULTIPLIERS,
  LIFESTYLE_MODES,
  LIFESTYLE_CATEGORY_BLUEPRINT,
  normalizeLifestyleConfig,
  normalizeCategoryMix,
} from '../constants/lifestyleConfig.js';

const COLORS = {
  emerald: '#34D399',
  violet: '#8B5CF6',
  pink: '#F472B6',
  amber: '#FBBF24',
};

const CATEGORY_ICONS = {
  housing: Home,
  food: UtensilsCrossed,
  healthcare: Heart,
  travel: Plane,
  family: Users,
  buffer: Shield,
};

const CATEGORIES = LIFESTYLE_CATEGORY_BLUEPRINT.map((item) => ({
  ...item,
  icon: CATEGORY_ICONS[item.id] || Home,
}));

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const MAX_CATEGORY_MONTHLY_AMOUNT = 5000000;

function getPresetFallbackSpend(monthlyIncome, preset) {
  return Math.round(monthlyIncome * (LIFESTYLE_MULTIPLIERS[preset] || LIFESTYLE_MULTIPLIERS.comfortable));
}

function calculateCustomSpendFromAmounts(categoryAmounts = {}) {
  return CATEGORIES.reduce((sum, cat) => sum + Math.max(0, Number(categoryAmounts[cat.id]) || 0), 0);
}

function buildCategoryMixFromAmounts(categoryAmounts = {}) {
  const total = calculateCustomSpendFromAmounts(categoryAmounts);

  if (total <= 0) {
    return normalizeCategoryMix();
  }

  const rawMix = CATEGORIES.reduce((acc, cat) => {
    acc[cat.id] = ((Math.max(0, Number(categoryAmounts[cat.id]) || 0)) / total) * 100;
    return acc;
  }, {});

  return normalizeCategoryMix(rawMix);
}

function splitSpendAcrossCategories(totalSpend, categoryMix = {}) {
  const normalizedMix = normalizeCategoryMix(categoryMix);
  const spend = Math.max(0, Math.round(Number(totalSpend) || 0));
  const amounts = {};
  let allocated = 0;

  CATEGORIES.forEach((cat, index) => {
    if (index === CATEGORIES.length - 1) {
      amounts[cat.id] = Math.max(0, spend - allocated);
      return;
    }

    const nextValue = Math.max(0, Math.round((normalizedMix[cat.id] / 100) * spend));
    amounts[cat.id] = nextValue;
    allocated += nextValue;
  });

  return amounts;
}

const LifestyleCard = ({ type, selected, onClick, monthlyIncome, yearsToRetire }) => {
  const configs = {
    essential: {
      accent: COLORS.emerald,
      icon: Home,
      title: 'Essential',
      subtitle: 'Basic needs covered',
      details: ['Simple housing & utilities', 'Home-cooked meals, occasional dining', 'Local travel only', 'Basic healthcare'],
      multiplier: LIFESTYLE_MULTIPLIERS.essential,
      tag: '40% of current income',
    },
    comfortable: {
      accent: COLORS.violet,
      icon: Coffee,
      title: 'Comfortable',
      subtitle: 'Travel and daily flexibility',
      details: ['Good housing in your city', 'Dining out 2-3x/week', 'Annual domestic travel', 'Health insurance covered'],
      multiplier: LIFESTYLE_MULTIPLIERS.comfortable,
      tag: '60% of current income',
      badge: 'MOST CHOSEN',
    },
    premium: {
      accent: COLORS.pink,
      icon: Star,
      title: 'Premium',
      subtitle: 'Financial freedom and luxury',
      details: ['Premium housing or owned home', 'Fine dining, social life', 'International travel yearly', 'Comprehensive healthcare'],
      multiplier: LIFESTYLE_MULTIPLIERS.premium,
      tag: '80% of current income',
    },
  };

  const config = configs[type];
  const Icon = config.icon;
  const monthlyNeedToday = monthlyIncome * config.multiplier;
  const monthlyNeedRetirement = monthlyNeedToday * Math.pow(1 + INFLATION_RATE, yearsToRetire);

  return (
    <button
      onClick={() => onClick(type)}
      className={`relative flex-1 bg-white border-2 rounded-[16px] p-6 text-left transition-all duration-300 group ${
        selected
          ? 'border-[#8B5CF6] shadow-[6px_6px_0_0_#8B5CF6] scale-[1.02]'
          : 'border-[#1E293B] shadow-[4px_4px_0_0_#1E293B] hover:-translate-y-1 hover:shadow-[6px_6px_0_0_#1E293B]'
      }`}
      type="button"
    >
      {config.badge && (
        <div className="absolute -top-3 -right-3 bg-[#FBBF24] border-2 border-[#1E293B] px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest rotate-3 shadow-[2px_2px_0_0_#1E293B]">
          {config.badge}
        </div>
      )}

      <div className="w-12 h-12 rounded-full flex items-center justify-center border-2 border-[#1E293B] mb-4 shadow-[2px_2px_0_0_#1E293B]" style={{ backgroundColor: `${config.accent}22` }}>
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
        <div className="text-[10px] font-black text-[#1E293B]/40 uppercase tracking-widest mb-1">
          Monthly Need <InfoTooltip text={DREAM_PLANNER_TIPS.monthlyNeed} size={12} />
        </div>
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

const ModeSwitcher = ({ mode, onChange }) => (
  <div className="inline-flex bg-white border-2 border-[#1E293B] rounded-full p-1 pop-shadow">
    <button
      type="button"
      onClick={() => onChange(LIFESTYLE_MODES.PRESET)}
      className={`touch-target px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-[2px] transition-all ${
        mode === LIFESTYLE_MODES.PRESET ? 'bg-[#8B5CF6] text-white' : 'text-[#1E293B]/60'
      }`}
    >
      Preset
    </button>
    <button
      type="button"
      onClick={() => onChange(LIFESTYLE_MODES.CUSTOM)}
      className={`touch-target px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-[2px] transition-all ${
        mode === LIFESTYLE_MODES.CUSTOM ? 'bg-[#8B5CF6] text-white' : 'text-[#1E293B]/60'
      }`}
    >
      Custom
    </button>
  </div>
);

const CustomLifestyleEditor = ({ categoryAmounts, onCategoryAmountChange, monthlyIncome }) => {
  const customMonthlySpend = calculateCustomSpendFromAmounts(categoryAmounts);
  const categoryMix = buildCategoryMixFromAmounts(categoryAmounts);
  const salaryUsagePct = monthlyIncome > 0 ? (customMonthlySpend / monthlyIncome) * 100 : 0;
  const salarySavedPct = Math.max(0, 100 - salaryUsagePct);
  const salaryOverdrawPct = Math.max(0, salaryUsagePct - 100);

  return (
    <div className="bg-white border-2 border-[#1E293B] rounded-[20px] p-6 md:p-8 pop-shadow space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full border-2 border-[#1E293B] bg-[#8B5CF6]/10 flex items-center justify-center shadow-[2px_2px_0_0_#1E293B]">
          <SlidersHorizontal className="w-5 h-5 text-[#8B5CF6]" />
        </div>
        <div>
          <h3 className="font-heading font-black text-xl">Build Your Custom Monthly Lifestyle</h3>
          <p className="text-xs font-bold uppercase tracking-widest text-[#1E293B]/50">Set rupee amounts by category. We auto-calculate total spend.</p>
        </div>
      </div>

      <div className="rounded-xl border-2 border-[#1E293B] bg-[#FFFDF5] p-4">
        <div className="text-[10px] font-black uppercase tracking-widest text-[#1E293B]/40">Monthly Spend (Auto)</div>
        <div className="font-heading font-black text-2xl text-[#1E293B] mt-1">{formatIndian(customMonthlySpend)}</div>
        <div className="text-[10px] font-bold uppercase tracking-widest text-[#1E293B]/40 mt-1">Based on category amounts</div>
      </div>

      <div className="space-y-4">
        {CATEGORIES.map((cat) => {
          const share = Number(categoryMix[cat.id] || 0);
          const monthlyBucket = Math.max(0, Number(categoryAmounts[cat.id]) || 0);
          const displayAmount = monthlyBucket > 0 ? Math.round(monthlyBucket) : '';
          const Icon = cat.icon;

          return (
            <div key={cat.id} className="border-2 border-[#1E293B]/10 rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-full border-2 border-[#1E293B] flex items-center justify-center" style={{ backgroundColor: `${cat.color}22` }}>
                    <Icon className="w-4 h-4" style={{ color: cat.color }} strokeWidth={2.5} />
                  </div>
                  <div className="font-bold text-sm uppercase tracking-widest flex items-center gap-1">
                    {cat.name} <InfoTooltip text={DREAM_PLANNER_TIPS[cat.tooltipKey] || DREAM_PLANNER_TIPS.categoryHousing} size={12} />
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[9px] font-black uppercase tracking-widest text-[#1E293B]/40">Share</div>
                  <div className="font-heading font-bold text-sm">{share.toFixed(1)}%</div>
                </div>
              </div>

              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#1E293B]/50 font-black">₹</span>
                <input
                  type="number"
                  min="0"
                  step="500"
                  inputMode="decimal"
                  value={displayAmount}
                  onChange={(e) => onCategoryAmountChange(cat.id, Number(e.target.value))}
                  className="w-full border-2 border-[#1E293B]/20 rounded-lg pl-8 pr-3 py-2 text-sm font-black text-left focus:outline-none focus:shadow-[2px_2px_0_0_#8B5CF6]"
                />
              </div>
            </div>
          );
        })}
      </div>

      <div className={`text-[10px] font-black uppercase tracking-widest px-3 py-2 rounded-xl inline-flex flex-wrap gap-2 border-2 border-[#1E293B] ${salaryOverdrawPct > 0 ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'}`}>
        <span>Using {salaryUsagePct.toFixed(1)}% of monthly salary</span>
        <span>•</span>
        <span>Saving {salarySavedPct.toFixed(1)}%</span>
        {salaryOverdrawPct > 0 && (
          <>
            <span>•</span>
            <span>Overdrawn by {salaryOverdrawPct.toFixed(1)}%</span>
          </>
        )}
      </div>
    </div>
  );
};

const InflationRealityCheck = ({ yearsToRetire, monthlySpendToday }) => {
  const multiplier = Math.pow(1.06, yearsToRetire);
  const [displayMultiplier, setDisplayMultiplier] = useState(1);
  const monthlySpendRetirement = monthlySpendToday * multiplier;

  useEffect(() => {
    let start = 1;
    const end = multiplier;
    if (start === end) return undefined;

    const timer = setInterval(() => {
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
        <div className="text-xs font-black uppercase tracking-[3px] text-[#1E293B]">
          Inflation Reality Check <InfoTooltip text={DREAM_PLANNER_TIPS.inflationReality} size={12} />
        </div>
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
          {displayMultiplier.toFixed(1)}x
        </div>
        <div className="text-xs font-black uppercase tracking-widest text-[#1E293B]/60 mt-2">
          purchasing power needed
        </div>
      </div>
    </div>
  );
};

const CategoryBreakdown = ({ categoryMix, monthlySpendToday, monthlySpendRetirement }) => (
  <div className="space-y-6">
    <div className="flex items-center gap-4">
      <h2 className="font-heading font-extrabold text-2xl md:text-3xl uppercase tracking-widest leading-none">Where Will Your Money Go?</h2>
      <div className="flex-1 h-[2px] bg-[#1E293B]/10" />
    </div>

    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {CATEGORIES.map((cat) => {
        const Icon = cat.icon;
        const share = Number(categoryMix[cat.id] || 0) / 100;
        const today = monthlySpendToday * share;
        const future = monthlySpendRetirement * share;

        return (
          <div key={cat.id} className="bg-white border-2 border-[#1E293B] rounded-[16px] p-5 pop-shadow group hover:-translate-y-1 transition-all">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-10 h-10 rounded-full flex items-center justify-center border-2 border-[#1E293B] shadow-[2px_2px_0_0_#1E293B]" style={{ backgroundColor: `${cat.color}22` }}>
                <Icon className="w-5 h-5 text-[#1E293B]" strokeWidth={2.5} style={{ color: cat.color }} />
              </div>
              <div className="font-bold text-sm text-[#1E293B] uppercase tracking-widest flex items-center gap-1">
                {cat.name} <InfoTooltip text={DREAM_PLANNER_TIPS[cat.tooltipKey] || DREAM_PLANNER_TIPS.categoryHousing} size={12} />
              </div>
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
              <div className="h-full rounded-full transition-all duration-1000" style={{ width: `${share * 100}%`, backgroundColor: cat.color }} />
            </div>
            <div className="mt-2 text-[9px] font-black text-[#1E293B]/40 uppercase tracking-widest text-right">
              {(share * 100).toFixed(1)}% of spend
            </div>
          </div>
        );
      })}
    </div>
  </div>
);

const PageContent = () => {
  const { userData, setUserData } = useUser();
  const [showToast, setShowToast] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const baselineLifestyle = (userData?.lifestyle || 'comfortable').toLowerCase();
  const baselineConfig = useMemo(
    () => normalizeLifestyleConfig(userData?.lifestyleConfig, baselineLifestyle),
    [userData?.lifestyleConfig, baselineLifestyle]
  );
  const baselineConfigKey = useMemo(() => JSON.stringify(baselineConfig), [baselineConfig]);

  const monthlyIncome = Math.max(0, Number(userData?.monthlyIncome) || 0);
  const yearsToRetire = Math.max(1, (Number(userData?.retireAge) || 60) - (Number(userData?.age) || 30));

  const [planMode, setPlanMode] = useState(baselineConfig.mode);
  const [isModeTransitioning, setIsModeTransitioning] = useState(false);
  const [selectedLifestyle, setSelectedLifestyle] = useState(baselineConfig.preset);
  const [categoryAmounts, setCategoryAmounts] = useState(() => {
    const fallbackSpend = getPresetFallbackSpend(monthlyIncome, baselineConfig.preset);
    return splitSpendAcrossCategories(
      baselineConfig.customMonthlySpend || fallbackSpend,
      baselineConfig.categories
    );
  });
  const modeTransitionFrameRef = useRef(null);

  useEffect(() => {
    const hydrated = JSON.parse(baselineConfigKey);
    setPlanMode(hydrated.mode);
    setSelectedLifestyle(hydrated.preset);
    const fallbackSpend = getPresetFallbackSpend(monthlyIncome, hydrated.preset);
    setCategoryAmounts(splitSpendAcrossCategories(hydrated.customMonthlySpend || fallbackSpend, hydrated.categories));
  }, [baselineConfigKey, monthlyIncome]);

  useEffect(() => () => {
    if (modeTransitionFrameRef.current) {
      cancelAnimationFrame(modeTransitionFrameRef.current);
    }
  }, []);

  const customMonthlySpend = useMemo(
    () => calculateCustomSpendFromAmounts(categoryAmounts),
    [categoryAmounts]
  );

  const customCategoryMix = useMemo(
    () => buildCategoryMixFromAmounts(categoryAmounts),
    [categoryAmounts]
  );

  const simulationConfig = useMemo(
    () =>
      normalizeLifestyleConfig(
        {
          mode: planMode,
          preset: selectedLifestyle,
          customMonthlySpend: planMode === LIFESTYLE_MODES.CUSTOM ? customMonthlySpend : 0,
          categories: planMode === LIFESTYLE_MODES.CUSTOM ? customCategoryMix : baselineConfig.categories,
        },
        selectedLifestyle
      ),
    [planMode, selectedLifestyle, customMonthlySpend, customCategoryMix, baselineConfig.categories]
  );

  const simulationConfigKey = useMemo(() => JSON.stringify(simulationConfig), [simulationConfig]);
  const hasChanges = simulationConfigKey !== baselineConfigKey;

  const baseResults = useMemo(() => (userData ? calculateRetirement(userData) : null), [userData]);

  const simResults = useMemo(() => {
    if (!userData) return null;
    return calculateRetirement({
      ...userData,
      lifestyle: selectedLifestyle,
      lifestyleConfig: simulationConfig,
    });
  }, [userData, selectedLifestyle, simulationConfig]);

  if (!userData || !baseResults || !simResults) return null;

  const handleModeChange = (nextMode) => {
    if (nextMode === planMode) return;

    setIsModeTransitioning(true);
    setPlanMode(nextMode);

    if (nextMode === LIFESTYLE_MODES.CUSTOM && customMonthlySpend <= 0) {
      const fallbackSpend = getPresetFallbackSpend(monthlyIncome, selectedLifestyle);
      setCategoryAmounts(splitSpendAcrossCategories(fallbackSpend, customCategoryMix));
    }

    modeTransitionFrameRef.current = requestAnimationFrame(() => {
      modeTransitionFrameRef.current = requestAnimationFrame(() => {
        setIsModeTransitioning(false);
      });
    });
  };

  const handleCategoryAmountChange = (categoryId, nextAmount) => {
    setCategoryAmounts((prev) => ({
      ...prev,
      [categoryId]: clamp(Number(nextAmount) || 0, 0, MAX_CATEGORY_MONTHLY_AMOUNT),
    }));
  };

  const handleReset = () => {
    const hydrated = JSON.parse(baselineConfigKey);
    setPlanMode(hydrated.mode);
    setSelectedLifestyle(hydrated.preset);
    const fallbackSpend = getPresetFallbackSpend(monthlyIncome, hydrated.preset);
    setCategoryAmounts(splitSpendAcrossCategories(hydrated.customMonthlySpend || fallbackSpend, hydrated.categories));
  };

  const handleSave = async () => {
    if (!auth.currentUser) return;
    setIsSaving(true);

    try {
      const dataToSave = {
        lifestyle: selectedLifestyle,
        lifestyleConfig: simulationConfig,
        score: simResults.score,
        projectedValue: simResults.projectedValue,
        requiredCorpus: simResults.requiredCorpus,
        monthlyGap: simResults.monthlyGap,
        monthlySpendAtRetirement: simResults.monthlySpendAtRetirement,
        monthlySpendToday: simResults.monthlySpendToday,
        updatedAt: new Date().toISOString(),
      };

      const encrypted = await encryptUserData(dataToSave, auth.currentUser.uid);
      await setDoc(doc(db, 'users', auth.currentUser.uid), encrypted, { merge: true });

      setShowToast(true);
      setTimeout(() => setShowToast(false), 3000);
      const nextUserData = { ...userData, ...dataToSave };
      setUserData(nextUserData);
      writeUserProfileCache(auth.currentUser.uid, nextUserData);
    } catch (error) {
      console.error(error);
    } finally {
      setIsSaving(false);
    }
  };

  const baseScore = baseResults.scorePrecise ?? baseResults.score;
  const simScore = simResults.scorePrecise ?? simResults.score;
  const scoreDelta = Number((simScore - baseScore).toFixed(1));
  const uncappedDelta = Number(((simResults.uncappedScore || 0) - (baseResults.uncappedScore || 0)).toFixed(1));
  const cappedButMoved = baseScore === 100 && simScore === 100 && Math.abs(uncappedDelta) >= 0.1;

  const formatScore = (value) => (Number.isInteger(value) ? String(value) : value.toFixed(1));

  const scoreInfo = (score) => {
    if (score <= 30) return { label: 'Critical', color: '#EF4444' };
    if (score <= 50) return { label: 'At Risk', color: '#F97316' };
    if (score <= 70) return { label: 'On Track', color: '#3B82F6' };
    if (score <= 85) return { label: 'Good', color: '#8B5CF6' };
    return { label: 'Excellent', color: '#34D399' };
  };

  return (
    <div className="p-3 sm:p-4 md:p-8 space-y-10 sm:space-y-12 max-w-6xl mx-auto pb-[calc(13rem+env(safe-area-inset-bottom))] lg:pb-32">
      <section className="space-y-6">
        <div className="text-center md:text-left space-y-2">
          <h2 className="font-heading font-extrabold text-2xl md:text-4xl">What kind of retirement do you want?</h2>
          <p className="text-sm md:text-base font-bold text-[#1E293B]/50 uppercase tracking-widest">Choose a preset or tune every bucket yourself.</p>
        </div>

        <ModeSwitcher mode={planMode} onChange={handleModeChange} />

        <div className={`transition-all duration-300 ease-out ${isModeTransitioning ? 'opacity-0 translate-y-2 scale-[0.985]' : 'opacity-100 translate-y-0 scale-100'}`}>
          {planMode === LIFESTYLE_MODES.PRESET ? (
            <div className="flex flex-col md:flex-row gap-6">
              <LifestyleCard type="essential" selected={selectedLifestyle === 'essential'} onClick={setSelectedLifestyle} monthlyIncome={monthlyIncome} yearsToRetire={yearsToRetire} />
              <LifestyleCard type="comfortable" selected={selectedLifestyle === 'comfortable'} onClick={setSelectedLifestyle} monthlyIncome={monthlyIncome} yearsToRetire={yearsToRetire} />
              <LifestyleCard type="premium" selected={selectedLifestyle === 'premium'} onClick={setSelectedLifestyle} monthlyIncome={monthlyIncome} yearsToRetire={yearsToRetire} />
            </div>
          ) : (
            <CustomLifestyleEditor
              categoryAmounts={categoryAmounts}
              onCategoryAmountChange={handleCategoryAmountChange}
              monthlyIncome={monthlyIncome}
            />
          )}
        </div>
      </section>

      <InflationRealityCheck yearsToRetire={yearsToRetire} monthlySpendToday={simResults.monthlySpendToday} />

      <CategoryBreakdown
        categoryMix={simulationConfig.categories}
        monthlySpendToday={simResults.monthlySpendToday}
        monthlySpendRetirement={simResults.monthlySpendAtRetirement}
      />

      <section className="bg-white border-2 border-[#1E293B] rounded-[24px] overflow-hidden pop-shadow">
        <div className="w-1.5 absolute left-0 top-0 h-full bg-[#8B5CF6]" />
        <div className="p-8 flex flex-col md:flex-row items-center justify-between gap-12">
          <div className="flex-1 space-y-8 w-full">
            <div className="grid grid-cols-2 gap-8 items-center">
              <div className="space-y-4 text-center">
                <div className="text-[10px] font-black text-[#1E293B]/40 uppercase tracking-[2px]">CURRENT</div>
                <div className="flex flex-col items-center">
                  <div className="w-20 h-20 rounded-full border-4 border-slate-200 flex items-center justify-center font-heading font-black text-2xl text-slate-400 bg-slate-50">
                    {formatScore(baseScore)}
                  </div>
                  <div className="mt-2 text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 border border-slate-200">
                    {baselineConfig.preset}
                  </div>
                </div>
              </div>

              <div className="space-y-4 text-center relative">
                <div className="absolute left-[-24px] top-1/2 -translate-y-1/2 hidden md:block">
                  <ArrowRight className="w-8 h-8 text-slate-200" />
                </div>
                <div className="text-[10px] font-black text-[#8B5CF6] uppercase tracking-[2px]">WITH THIS PLAN</div>
                <div className="flex flex-col items-center">
                  <div
                    className="w-24 h-24 rounded-full border-4 flex items-center justify-center font-heading font-black text-3xl transition-all duration-500 shadow-[6px_6px_0_0_rgba(0,0,0,0.05)]"
                    style={{ borderColor: scoreInfo(simScore).color, color: scoreInfo(simScore).color }}
                  >
                    {formatScore(simScore)}
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    <span className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full border border-[#1E293B]" style={{ backgroundColor: `${COLORS.violet}22`, color: COLORS.violet }}>
                      {planMode === LIFESTYLE_MODES.CUSTOM ? 'custom' : selectedLifestyle}
                    </span>
                    {(scoreDelta !== 0 || cappedButMoved) && (
                      <span className={`text-[9px] font-black px-2 py-0.5 rounded-full border border-[#1E293B] ${scoreDelta > 0 ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-600'}`}>
                        {scoreDelta !== 0
                          ? `${scoreDelta > 0 ? '+' : ''}${formatScore(scoreDelta)} PTS`
                          : `${uncappedDelta > 0 ? '+' : ''}${formatScore(uncappedDelta)} RAW`}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div
              className={`p-4 rounded-xl border-2 border-[#1E293B] font-bold text-xs uppercase tracking-widest flex items-center gap-3 ${
                scoreDelta > 0
                  ? 'bg-[#D1FAE5] border-[#34D399] text-[#065F46]'
                  : scoreDelta < 0
                  ? 'bg-[#FFFBEB] border-[#FBBF24] text-[#92400E]'
                  : 'bg-white text-slate-500'
              }`}
            >
              {scoreDelta > 0 ? (
                <>
                  <CheckCircle2 className="w-5 h-5" /> This plan improves your retirement outlook.
                </>
              ) : scoreDelta < 0 ? (
                <>
                  <Info className="w-5 h-5" /> This plan needs higher contributions to stay on track.
                </>
              ) : cappedButMoved ? (
                <>
                  <Info className="w-5 h-5" /> Score is capped at 100, but underlying readiness moved {uncappedDelta > 0 ? 'up' : 'down'} ({uncappedDelta > 0 ? '+' : ''}{formatScore(uncappedDelta)} raw).
                </>
              ) : (
                'No change to your retirement score'
              )}
            </div>
          </div>

          <div className="hidden lg:block w-[300px] h-[300px] relative">
            <div className="absolute inset-0 bg-[#8B5CF6]/5 rounded-full border-2 border-dashed border-[#8B5CF6]/20 animate-spin-slow" />
            <div className="absolute inset-10 bg-white border-2 border-[#1E293B] rounded-[32px] pop-shadow flex items-center justify-center">
              <div style={{ textAlign: 'center', padding: '16px' }}>
                <TrendingUp style={{ color: '#8B5CF6', width: 32, height: 32, margin: '0 auto' }} />
                <p style={{ fontSize: '0.7rem', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: 8 }}>
                  SCORE IMPACT
                </p>
                <p style={{ fontSize: '1.5rem', fontWeight: 800, color: scoreDelta > 0 ? '#34D399' : scoreDelta < 0 ? '#EF4444' : '#94A3B8', fontFamily: 'Outfit' }}>
                  {scoreDelta !== 0
                    ? `${scoreDelta > 0 ? '+' : ''}${formatScore(scoreDelta)} pts`
                    : cappedButMoved
                    ? `${uncappedDelta > 0 ? '+' : ''}${formatScore(uncappedDelta)} raw`
                    : '-'}
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="fixed bottom-[calc(4.5rem+env(safe-area-inset-bottom))] lg:bottom-0 left-0 dashboard-fixed-offset right-0 min-h-[4.75rem] lg:h-20 bg-white border-t-2 border-[#1E293B] z-40 px-3 sm:px-4 lg:px-6 py-2 sm:py-3 lg:py-0 flex flex-wrap sm:flex-nowrap items-center justify-between gap-3 shadow-[0_-8px_30px_rgba(0,0,0,0.05)]">
        <div className="flex flex-col">
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Simulating</span>
          <span className="text-sm font-bold text-[#1E293B] uppercase tracking-wide">
            {planMode === LIFESTYLE_MODES.CUSTOM ? 'custom lifestyle' : `${selectedLifestyle} preset`}
          </span>
        </div>

        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={handleReset}
            disabled={!hasChanges}
            className="touch-target px-4 sm:px-6 py-2.5 rounded-full font-black text-[10px] sm:text-xs uppercase tracking-widest text-slate-400 enabled:hover:text-[#1E293B] transition-colors flex items-center gap-2 disabled:opacity-40"
          >
            <RotateCcw className="w-4 h-4" /> Reset
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving || !hasChanges}
            className="touch-target px-5 sm:px-8 py-3 bg-[#8B5CF6] border-2 border-[#1E293B] rounded-full shadow-[4px_4px_0_0_#1E293B] enabled:hover:-translate-y-0.5 enabled:active:translate-y-0.5 enabled:active:shadow-[2px_2px_0_0_#1E293B] transition-all text-white text-[10px] sm:text-xs font-black uppercase tracking-[2px] flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSaving ? 'Saving...' : (
              <>
                <CheckCircle2 className="w-4 h-4" /> Save Changes
              </>
            )}
          </button>
        </div>
      </div>

      {showToast && (
        <div className="fixed bottom-[calc(10rem+env(safe-area-inset-bottom))] lg:bottom-24 left-1/2 -translate-x-1/2 z-50 animate-slide-up px-3 w-full max-w-xl">
          <div className="bg-[#FBBF24] border-2 border-[#1E293B] px-6 py-3 rounded-full font-black text-xs uppercase tracking-widest shadow-[4px_4px_0_0_#1E293B] flex items-center gap-3">
            Dream updated! Your dashboard reflects your new plan.
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

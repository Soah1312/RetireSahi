// NPS Pulse — Financial Math Engine (AY 2025-26 / Budget 2025 compliant)

export const SCHEME_E_RETURN = 0.1269; // Equity — 12.69% p.a.
export const SCHEME_C_RETURN = 0.0887; // Corporate Bonds — 8.87% p.a.
export const SCHEME_G_RETURN = 0.0874; // Govt Securities — 8.74% p.a.
 
export const COLORS = {
  bg: '#FFFDF5',
  fg: '#1E293B',
  violet: '#8B5CF6',
  pink: '#F472B6',
  amber: '#FBBF24',
  emerald: '#34D399',
  slate: '#1E293B',
  red: '#EF4444',
  orange: '#F97316',
  blue: '#3B82F6'
};

export const getScoreInfo = (score) => {
  if (score <= 30) return { label: 'Critical', color: COLORS.red };
  if (score <= 50) return { label: 'At Risk', color: COLORS.orange };
  if (score <= 70) return { label: 'On Track', color: COLORS.blue };
  if (score <= 85) return { label: 'Good', color: COLORS.violet };
  return { label: 'Excellent', color: COLORS.emerald };
};

export function getMaxEquityPct(age) {
  if (age < 50) return 75;
  if (age >= 60) return 50;
  return 75 - (age - 50) * 2.5; // tapers 2.5% per year from 50–60
}

export function computeBlendedReturn(userEquityPct, age) {
  const equityPct = Math.min(userEquityPct, getMaxEquityPct(age)) / 100;
  const remainingPct = 1 - equityPct;
  return (equityPct * SCHEME_E_RETURN) +
         (remainingPct / 2 * SCHEME_C_RETURN) +
         (remainingPct / 2 * SCHEME_G_RETURN);
}

export const LIFESTYLE_MULTIPLIERS = {
  essential: 0.40,   // 40% of income — basic needs only
  comfortable: 0.60, // 60% — realistic middle India
  premium: 0.80,     // 80% — high lifestyle
};

export const INFLATION_RATE = 0.06;
export const SWR = 0.035; // India-adjusted 3.5%
export const LUMP_SUM_PCT = 0.60;
export const ANNUITY_PCT = 0.40;
export const ANNUITY_RATE = 0.06; // 6% p.a.

export function calculateRetirement(data) {
  const age = parseInt(data.age) || 28;
  const retireAge = parseInt(data.retireAge) || 60;
  const yearsToRetire = Math.max(1, retireAge - age);
  const monthlyIncome = parseFloat(data.monthlyIncome) || 0;
  const currentCorpus = (parseFloat(data.npsCorpus) || 0) + (parseFloat(data.totalSavings) || 0);
  const monthlyContribution = parseFloat(data.npsContribution) || 0;
  
  const blendedReturn = computeBlendedReturn(data.npsEquity || 50, age);
  const r = blendedReturn / 12;
  const n = yearsToRetire * 12;

  // FV of Current Corpus
  const fvCurrent = currentCorpus * Math.pow(1 + r, n);

  // FV of Contributions (with potential annual step-up)
  const stepUpRate = parseFloat(data.stepUp) || 0;
  let fvContributions = 0;
  
  if (stepUpRate > 0) {
    // If step-up is enabled, we calculate it year by year
    for (let k = 0; k < yearsToRetire; k++) {
      const annualPmt = monthlyContribution * Math.pow(1 + stepUpRate, k);
      const monthsRemaining = (yearsToRetire - k) * 12;
      // FV of this year's 12 contributions at the end of the full term
      fvContributions += annualPmt * (Math.pow(1 + r, 12) - 1) / r * Math.pow(1 + r, monthsRemaining - 12);
    }
  } else {
    // Standard geometric series for fixed contributions
    fvContributions = monthlyContribution * (Math.pow(1 + r, n) - 1) / r;
  }
  
  const projectedValue = fvCurrent + fvContributions;

  // Monthly spend at retirement adjusted for inflation
  const lifestyleMultiplier = LIFESTYLE_MULTIPLIERS[data.lifestyle] || 0.60;
  const monthlySpendAtRetirement = monthlyIncome * lifestyleMultiplier * Math.pow(1 + INFLATION_RATE, yearsToRetire);
  
  // Mandatory 40% Annuity Split
  const annuityCorpus = projectedValue * ANNUITY_PCT;
  const monthlyAnnuityIncome = (annuityCorpus * ANNUITY_RATE) / 12;

  // Required lump sum (for SWR drawdown portion only)
  // Needed income from SWR = Total need - Annuity income
  const swrRequiredCorpus = (Math.max(0, monthlySpendAtRetirement - monthlyAnnuityIncome) * 12) / SWR;

  // Total required corpus (restored to 100% since swrRequiredCorpus only represents the 60% lump sum portion)
  const requiredCorpus = swrRequiredCorpus / LUMP_SUM_PCT;

  const score = Math.min(100, Math.round((projectedValue / requiredCorpus) * 100));
  const gap = Math.max(0, requiredCorpus - projectedValue);
  const monthlyGap = gap > 0 ? (gap * r) / (Math.pow(1 + r, n) - 1) : 0;

  return { 
    score, 
    projectedValue, 
    requiredCorpus, 
    monthlyGap, 
    monthlySpendAtRetirement, 
    gap,
    blendedReturn,
    lumpSumCorpus: projectedValue * LUMP_SUM_PCT,
    annuityCorpus,
    monthlyAnnuityIncome
  };
}

export function computeScenarioWithStepUp(userData) {
  const results = calculateRetirement({ ...userData, stepUp: 0.10 });
  return results.score;
}

export function getMilestoneAge(milestone, userData) {
  const blendedReturn = computeBlendedReturn(userData.npsEquity || 50, userData.age);
  const r = blendedReturn / 12;
  const corpus = (parseFloat(userData.npsCorpus) || 0) + (parseFloat(userData.totalSavings) || 0);
  const pmt = parseFloat(userData.npsContribution) || 0;
  const currentAge = parseInt(userData.age) || 28;

  if (corpus >= milestone) return { age: currentAge, achieved: true };

  // Binary search for month n where FV >= milestone
  let lo = 0, hi = 600; // max 50 years
  while (lo < hi) {
    const mid = Math.floor((lo + hi) / 2);
    const fv = corpus * Math.pow(1 + r, mid) + pmt * (Math.pow(1 + r, mid) - 1) / r;
    if (fv >= milestone) hi = mid;
    else lo = mid + 1;
  }
  return { age: Math.round(currentAge + lo / 12), achieved: false };
}

// --- Tax Logic (AY 2025-26) ---

export const NEW_REGIME_SLABS = [
  { limit: 400000,  rate: 0.00 },
  { limit: 800000,  rate: 0.05 },
  { limit: 1200000, rate: 0.10 },
  { limit: 1600000, rate: 0.15 },
  { limit: 2000000, rate: 0.20 },
  { limit: 2400000, rate: 0.25 },
  { limit: Infinity, rate: 0.30 },
];

export const OLD_REGIME_SLABS = [
  { limit: 250000,  rate: 0.00 },
  { limit: 500000,  rate: 0.05 },
  { limit: 1000000, rate: 0.20 },
  { limit: Infinity, rate: 0.30 },
];

export function computeTax(annualIncome, regime, deductions = 0) {
  const stdDeduction = regime === 'new' ? 75000 : 50000;
  const taxableIncome = Math.max(0, annualIncome - stdDeduction - deductions);
  const slabs = regime === 'new' ? NEW_REGIME_SLABS : OLD_REGIME_SLABS;
  const rebateLimit = regime === 'new' ? 1200000 : 500000;

  let tax = 0;
  let prev = 0;
  for (const slab of slabs) {
    if (taxableIncome <= prev) break;
    const taxable = Math.min(taxableIncome, slab.limit) - prev;
    tax += taxable * slab.rate;
    prev = slab.limit;
  }

  // 87A rebate
  if (taxableIncome <= rebateLimit) tax = 0;

  // 4% health & education cess
  return Math.round(tax * 1.04);
}

export const BASIC_PCT = { 'Government': 0.50, 'Private Sector': 0.40, 'Self-Employed': 1.0 };

export function formatIndian(num) {
  if (num === undefined || num === null) return '₹0';
  const val = Math.abs(num);
  if (val >= 10000000) return `₹${(num / 10000000).toFixed(1)} Cr`;
  if (val >= 100000) return `₹${(num / 100000).toFixed(1)} L`;
  if (val >= 1000) return `₹${(num / 1000).toFixed(0)}K`;
  return `₹${Math.round(num)}`;
}

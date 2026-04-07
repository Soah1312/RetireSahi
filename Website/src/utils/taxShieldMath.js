// ─────────────────────────────────────────────────────────────────────────────
// taxShieldMath.js  —  TaxShield computation engine
// Covers FY 2025-26 / AY 2026-27 Indian tax rules
// ─────────────────────────────────────────────────────────────────────────────

// ─── TAX SLABS ───────────────────────────────────────────────────────────────

const OLD_REGIME_SLABS = [
  { upTo: 250000,   rate: 0.00 },
  { upTo: 500000,   rate: 0.05 },
  { upTo: 1000000,  rate: 0.20 },
  { upTo: Infinity, rate: 0.30 },
];

// New regime slabs (Budget 2024 — effective FY 2024-25 onwards)
const NEW_REGIME_SLABS = [
  { upTo: 400000,   rate: 0.00 },
  { upTo: 800000,   rate: 0.05 },
  { upTo: 1200000,  rate: 0.10 },
  { upTo: 1600000,  rate: 0.15 },
  { upTo: 2000000,  rate: 0.20 },
  { upTo: 2400000,  rate: 0.25 },
  { upTo: Infinity, rate: 0.30 },
];

const CESS_RATE          = 0.04;   // Health & Education Cess
const SURCHARGE_THRESHOLDS = [
  { above: 50000000,  rate: 0.37 },  // >₹5 Cr  (old regime only)
  { above: 20000000,  rate: 0.25 },  // >₹2 Cr  (old regime only)
  { above: 10000000,  rate: 0.15 },  // >₹1 Cr
  { above: 5000000,   rate: 0.10 },  // >₹50 L
];
// New regime surcharge capped at 25 % (no 37 % slab)
const NEW_REGIME_MAX_SURCHARGE = 0.25;

// ─── DEDUCTION LIMITS ────────────────────────────────────────────────────────

export const DEDUCTION_LIMITS = {
  sec80C:              150000,  // 80C overall cap
  sec80CCD_1B:          50000,  // NPS self-contribution extra deduction
  sec80CCD_2_cap_pct:   0.10,  // employer NPS: 10% of basic (old) / 14% new
  sec80CCD_2_new_pct:   0.14,
  sec80D_self_below60:  25000,
  sec80D_self_above60:  50000,
  sec80D_parents_below60: 25000,
  sec80D_parents_above60: 50000,
  sec80TTA:             10000,  // savings interest (old regime)
  standardDeduction_old: 50000,
  standardDeduction_new: 75000, // increased in Budget 2024
  hraExemptionMax_pct:  0.50,   // metro city HRA exemption up to 50 % of basic
  hraExemptionNonMetro_pct: 0.40,
  npsRebate87A_old:     12500,  // rebate if taxable income ≤ 5 L (old)
  rebate87A_new:        25000,  // rebate if taxable income ≤ 7 L (new) — Budget 2023
  rebate87A_new_limit:  700000,
  rebate87A_old_limit:  500000,
};

// ─── SLAB CALCULATOR ─────────────────────────────────────────────────────────

function calcSlabTax(income, slabs) {
  let tax = 0;
  let prev = 0;
  for (const { upTo, rate } of slabs) {
    if (income <= prev) break;
    const taxable = Math.min(income, upTo) - prev;
    tax += taxable * rate;
    prev = upTo;
  }
  return Math.max(0, tax);
}

function calcSurcharge(income, baseTax, isNewRegime) {
  for (const { above, rate } of SURCHARGE_THRESHOLDS) {
    if (income > above) {
      const effectiveRate = isNewRegime ? Math.min(rate, NEW_REGIME_MAX_SURCHARGE) : rate;
      return baseTax * effectiveRate;
    }
  }
  return 0;
}

function totalTaxWithCess(income, slabs, isNewRegime) {
  const base      = calcSlabTax(income, slabs);
  const surcharge = calcSurcharge(income, base, isNewRegime);
  const cess      = (base + surcharge) * CESS_RATE;
  return Math.round(base + surcharge + cess);
}

// ─── DEDUCTION BUILDER ───────────────────────────────────────────────────────

/**
 * Compute all eligible deductions for Old Regime given user profile.
 *
 * @param {object} p  — user financial profile (keys defined below)
 * @returns {object}  — itemised deductions & total
 */
function buildOldRegimeDeductions(p) {
  const D = DEDUCTION_LIMITS;
  const deductions = {};

  // Standard deduction
  deductions.standardDeduction = D.standardDeduction_old;

  // 80C bucket (EPF + ELSS + PPF + LIC + home loan principal, capped at 1.5L)
  const raw80C =
    (p.epfMonthly || 0) * 12 +
    (p.elssMonthly || 0) * 12 +
    (p.ppfMonthly || 0) * 12 +
    (p.licPremium || 0) +
    (p.homeLoanPrincipal || 0);
  deductions.sec80C = Math.min(raw80C, D.sec80C);

  // 80CCD(1B) — NPS self, additional ₹50 000
  deductions.sec80CCD_1B = Math.min(
    (p.npsSelfMonthly || 0) * 12,
    D.sec80CCD_1B
  );

  // 80CCD(2) — Employer NPS (10% of basic salary)
  const basic = p.basicSalary || (p.grossIncome || 0) * 0.4;
  deductions.sec80CCD_2 = Math.min(
    (p.npsEmployerMonthly || 0) * 12,
    basic * D.sec80CCD_2_cap_pct
  );

  // 80D — health insurance
  const selfAge = p.age || 30;
  const selfLimit = selfAge >= 60 ? D.sec80D_self_above60 : D.sec80D_self_below60;
  deductions.sec80D_self = Math.min(p.healthInsuranceSelf || 0, selfLimit);

  const parentAge = p.parentsAge || 60;
  const parentLimit = parentAge >= 60 ? D.sec80D_parents_above60 : D.sec80D_parents_below60;
  deductions.sec80D_parents = Math.min(p.healthInsuranceParents || 0, parentLimit);

  // HRA (metro vs non-metro)
  if (p.hraReceived && p.rentPaid) {
    const hraActual   = p.hraReceived;
    const rentMinus10 = Math.max(0, p.rentPaid - basic * 0.1);
    const hraMaxPct   = p.isMetroCity
      ? basic * D.hraExemptionMax_pct
      : basic * D.hraExemptionNonMetro_pct;
    deductions.hraExemption = Math.min(hraActual, rentMinus10, hraMaxPct);
  } else {
    deductions.hraExemption = 0;
  }

  // 80TTA — savings account interest
  deductions.sec80TTA = Math.min(p.savingsInterest || 0, D.sec80TTA);

  // Home loan interest (sec 24b) — up to ₹2L for self-occupied
  deductions.homeLoanInterest = Math.min(p.homeLoanInterest || 0, 200000);

  // Leave Travel Allowance (LTA) — declared by user
  deductions.lta = Math.min(p.ltaDeclared || 0, p.ltaEntitled || 0);

  const total = Object.values(deductions).reduce((s, v) => s + v, 0);
  return { ...deductions, total };
}

// ─── CORE EXPORT: computeTaxSavings ──────────────────────────────────────────

/**
 * Full TaxShield computation.
 *
 * @param {object} userData  — merged UserContext payload
 * @returns {TaxShieldResult}
 */
export function computeTaxSavings(userData) {
  const p = userData || {};
  const D = DEDUCTION_LIMITS;

  const grossIncome = p.grossIncome || p.annualIncome || 0;

  // ── OLD REGIME ─────────────────────────────────────────────────────────────
  const oldDed      = buildOldRegimeDeductions(p);
  const oldTaxable  = Math.max(0, grossIncome - oldDed.total);
  let   oldBaseTax  = calcSlabTax(oldTaxable, OLD_REGIME_SLABS);

  // Rebate 87A — old regime (if taxable ≤ 5L, max rebate ₹12 500)
  const old87AApplied = oldTaxable <= D.rebate87A_old_limit
    ? Math.min(oldBaseTax, D.npsRebate87A_old)
    : 0;
  oldBaseTax = Math.max(0, oldBaseTax - old87AApplied);

  const oldTotalTax = totalTaxWithCess(oldTaxable, OLD_REGIME_SLABS, false);

  // ── NEW REGIME ─────────────────────────────────────────────────────────────
  // New regime: only standard deduction + 80CCD(2) employer NPS allowed
  const basic          = p.basicSalary || grossIncome * 0.4;
  const newCCD2        = Math.min(
    (p.npsEmployerMonthly || 0) * 12,
    basic * D.sec80CCD_2_new_pct           // 14 % in new regime
  );
  const newStdDed      = D.standardDeduction_new;
  const newTotalDed    = newStdDed + newCCD2;
  const newTaxable     = Math.max(0, grossIncome - newTotalDed);

  let   newBaseTax     = calcSlabTax(newTaxable, NEW_REGIME_SLABS);

  // Rebate 87A — new regime (if taxable ≤ 7L, max rebate ₹25 000)
  const new87AApplied  = newTaxable <= D.rebate87A_new_limit
    ? Math.min(newBaseTax, D.rebate87A_new)
    : 0;
  newBaseTax = Math.max(0, newBaseTax - new87AApplied);

  const newTotalTax    = totalTaxWithCess(newTaxable, NEW_REGIME_SLABS, true);

  // ── RECOMMENDED REGIME ────────────────────────────────────────────────────
  const recommendedRegime = oldTotalTax <= newTotalTax ? 'OLD' : 'NEW';
  const taxSavingByOld    = newTotalTax - oldTotalTax;   // +ve = old is better
  const effectiveSaving   = Math.abs(taxSavingByOld);

  // ── LEAKAGE ANALYSIS ──────────────────────────────────────────────────────
  const leakages = [];

  // Leakage 1 — 80CCD(1B) not fully utilised
  const nps1BUsed    = Math.min((p.npsSelfMonthly || 0) * 12, D.sec80CCD_1B);
  const nps1BGap     = D.sec80CCD_1B - nps1BUsed;
  if (nps1BGap > 0 && recommendedRegime === 'OLD') {
    const taxRate    = _marginalRate(oldTaxable);
    leakages.push({
      id:          'NPS_1B_GAP',
      title:       'NPS 80CCD(1B) Underutilised',
      description: `You can invest ₹${fmt(nps1BGap)} more/year in NPS Tier-I to claim the full ₹50,000 extra deduction.`,
      potentialSaving: Math.round(nps1BGap * taxRate * (1 + CESS_RATE)),
      action:      'Increase NPS Tier-I SIP',
      priority:    'HIGH',
    });
  }

  // Leakage 2 — 80C not fully utilised
  const raw80C =
    (p.epfMonthly || 0) * 12 +
    (p.elssMonthly || 0) * 12 +
    (p.ppfMonthly || 0) * 12 +
    (p.licPremium || 0) +
    (p.homeLoanPrincipal || 0);
  const c80Gap = Math.max(0, D.sec80C - raw80C);
  if (c80Gap > 0 && recommendedRegime === 'OLD') {
    const taxRate = _marginalRate(oldTaxable);
    leakages.push({
      id:          'SEC80C_GAP',
      title:       '80C Bucket Not Full',
      description: `₹${fmt(c80Gap)} headroom remains in your 80C bucket. Consider ELSS or PPF top-up.`,
      potentialSaving: Math.round(Math.min(c80Gap, D.sec80C) * taxRate * (1 + CESS_RATE)),
      action:      'Top-up ELSS / PPF',
      priority:    'HIGH',
    });
  }

  // Leakage 3 — No health insurance declared
  if (!(p.healthInsuranceSelf) && recommendedRegime === 'OLD') {
    leakages.push({
      id:          'NO_HEALTH_INS',
      title:       'Health Insurance Gap',
      description: 'No health insurance premium declared. 80D allows up to ₹25,000 deduction (₹50,000 if 60+).',
      potentialSaving: Math.round(25000 * _marginalRate(oldTaxable) * (1 + CESS_RATE)),
      action:      'Get a health insurance plan',
      priority:    'MEDIUM',
    });
  }

  // Leakage 4 — Wrong regime chosen (universal)
  if (taxSavingByOld !== 0) {
    leakages.push({
      id:          'REGIME_CHOICE',
      title:       recommendedRegime === 'OLD'
        ? 'Switch to Old Regime to Save More'
        : 'New Regime Saves You More Tax',
      description: `Choosing the ${recommendedRegime} regime saves you ₹${fmt(effectiveSaving)}/year.`,
      potentialSaving: effectiveSaving,
      action:      `Declare ${recommendedRegime} regime with employer`,
      priority:    effectiveSaving > 20000 ? 'HIGH' : 'MEDIUM',
    });
  }

  // Leakage 5 — HRA not claimed
  if (!p.hraReceived && p.rentPaid && recommendedRegime === 'OLD') {
    leakages.push({
      id:          'HRA_NOT_DECLARED',
      title:       'HRA Exemption Unclaimed',
      description: 'You pay rent but haven\'t declared HRA. Submit rent receipts to HR to claim exemption.',
      potentialSaving: Math.round((p.rentPaid * 0.3) * _marginalRate(oldTaxable) * (1 + CESS_RATE)),
      action:      'Submit rent receipts to HR',
      priority:    'HIGH',
    });
  }

  // ── ANNUAL SAVINGS PROJECTION ──────────────────────────────────────────────
  // Project tax savings over next 10, 20, 30 years assuming 8% salary growth
  const projections = _projectSavings({
    currentSaving:   effectiveSaving,
    salaryGrowth:    p.salaryGrowthRate || 0.08,
    years:           [5, 10, 20, 30],
    investmentReturn: 0.12,  // if savings re-invested in equity
  });

  // ── EFFECTIVE TAX RATE ─────────────────────────────────────────────────────
  const oldEffectiveRate = grossIncome > 0 ? (oldTotalTax / grossIncome) * 100 : 0;
  const newEffectiveRate = grossIncome > 0 ? (newTotalTax / grossIncome) * 100 : 0;

  // ── NPS SPECIFIC BENEFIT ──────────────────────────────────────────────────
  const npsAnnualContribution  = (p.npsSelfMonthly || 0) * 12;
  const npsTotalDeduction      = Math.min(npsAnnualContribution, D.sec80CCD_1B);
  const npsTaxBenefit          = Math.round(
    npsTotalDeduction * _marginalRate(oldTaxable) * (1 + CESS_RATE)
  );

  // ── DEDUCTION BREAKDOWN for UI ────────────────────────────────────────────
  const deductionBreakdown = [
    { label: 'Standard Deduction',      old: oldDed.standardDeduction, new: newStdDed },
    { label: 'Section 80C',             old: oldDed.sec80C,             new: 0 },
    { label: 'NPS 80CCD(1B)',           old: oldDed.sec80CCD_1B,        new: 0 },
    { label: 'Employer NPS 80CCD(2)',   old: oldDed.sec80CCD_2,         new: newCCD2 },
    { label: 'Health Insurance 80D',    old: oldDed.sec80D_self + oldDed.sec80D_parents, new: 0 },
    { label: 'HRA Exemption',           old: oldDed.hraExemption,       new: 0 },
    { label: 'Home Loan Interest 24b',  old: oldDed.homeLoanInterest,   new: 0 },
    { label: 'Savings Interest 80TTA',  old: oldDed.sec80TTA,           new: 0 },
    { label: 'LTA',                     old: oldDed.lta,                new: 0 },
  ].filter(d => d.old > 0 || d.new > 0);

  return {
    // Regime comparison
    old: {
      grossIncome,
      totalDeductions:  oldDed.total,
      taxableIncome:    oldTaxable,
      baseTax:          oldBaseTax,
      rebate87A:        old87AApplied,
      totalTax:         oldTotalTax,
      effectiveRate:    +oldEffectiveRate.toFixed(2),
      takeHome:         grossIncome - oldTotalTax,
    },
    new: {
      grossIncome,
      totalDeductions:  newTotalDed,
      taxableIncome:    newTaxable,
      baseTax:          newBaseTax,
      rebate87A:        new87AApplied,
      totalTax:         newTotalTax,
      effectiveRate:    +newEffectiveRate.toFixed(2),
      takeHome:         grossIncome - newTotalTax,
    },

    recommendedRegime,
    annualTaxSaving:      effectiveSaving,
    monthlySaving:        Math.round(effectiveSaving / 12),

    deductionBreakdown,
    leakages:             leakages.sort((a, b) => b.potentialSaving - a.potentialSaving),
    projections,

    nps: {
      annualContribution:  npsAnnualContribution,
      deductionClaimed:    npsTotalDeduction,
      taxBenefit:          npsTaxBenefit,
      unutilised1B:        nps1BGap,
    },
  };
}

// ─── HELPERS ──────────────────────────────────────────────────────────────────

function _marginalRate(taxableIncome) {
  if (taxableIncome <= 250000)  return 0;
  if (taxableIncome <= 500000)  return 0.05;
  if (taxableIncome <= 1000000) return 0.20;
  return 0.30;
}

function _projectSavings({ currentSaving, salaryGrowth, years, investmentReturn }) {
  return years.map(yr => {
    // Cumulative tax savings if salary (and thus saving) grows at salaryGrowth
    let cumulative = 0;
    let saving     = currentSaving;
    let corpus     = 0;
    for (let i = 0; i < yr; i++) {
      corpus    = (corpus + saving) * (1 + investmentReturn);
      cumulative += saving;
      saving    *= (1 + salaryGrowth);
    }
    return {
      years: yr,
      cumulativeSaving: Math.round(cumulative),
      corpusIfInvested: Math.round(corpus),
    };
  });
}

function fmt(n) {
  return new Intl.NumberFormat('en-IN').format(Math.round(n));
}

// ─── WHAT-IF SCENARIOS ───────────────────────────────────────────────────────

/**
 * Returns delta cards: "if you do X, you save ₹Y more".
 * Call this after computeTaxSavings to power the scenario cards.
 */
export function computeTaxWhatIf(userData) {
  const base = computeTaxSavings(userData);
  const scenarios = [];

  // Scenario A: Max out NPS 80CCD(1B)
  if (base.nps.unutilised1B > 0) {
    const boosted = computeTaxSavings({
      ...userData,
      npsSelfMonthly: (userData.npsSelfMonthly || 0) + Math.ceil(base.nps.unutilised1B / 12),
    });
    scenarios.push({
      id:     'MAX_NPS',
      title:  'Max out NPS 80CCD(1B)',
      delta:  boosted.old.totalTax < base.old.totalTax
        ? base.old.totalTax - boosted.old.totalTax
        : base.new.totalTax - boosted.new.totalTax,
      monthlyChange: Math.ceil(base.nps.unutilised1B / 12),
      description: `Increase NPS SIP by ₹${fmt(Math.ceil(base.nps.unutilised1B / 12))}/mo`,
    });
  }

  // Scenario B: Add health insurance
  if (!userData.healthInsuranceSelf) {
    const boosted = computeTaxSavings({ ...userData, healthInsuranceSelf: 25000 });
    scenarios.push({
      id:     'ADD_HEALTH_INS',
      title:  'Get Health Insurance',
      delta:  base.old.totalTax - boosted.old.totalTax,
      monthlyChange: Math.round(25000 / 12),
      description: 'Claim ₹25,000 80D deduction with a family floater policy',
    });
  }

  // Scenario C: Top-up 80C
  const raw80C =
    (userData.epfMonthly || 0) * 12 +
    (userData.elssMonthly || 0) * 12 +
    (userData.ppfMonthly || 0) * 12 +
    (userData.licPremium || 0) +
    (userData.homeLoanPrincipal || 0);
  const gap80C = Math.max(0, 150000 - raw80C);
  if (gap80C > 0) {
    const boosted = computeTaxSavings({ ...userData, elssMonthly: (userData.elssMonthly || 0) + Math.ceil(gap80C / 12) });
    scenarios.push({
      id:     'FILL_80C',
      title:  'Fill 80C via ELSS',
      delta:  Math.max(0, base.old.totalTax - boosted.old.totalTax),
      monthlyChange: Math.ceil(gap80C / 12),
      description: `Add ₹${fmt(Math.ceil(gap80C / 12))}/mo in ELSS to fill the 80C bucket`,
    });
  }

  return scenarios.filter(s => s.delta > 0).sort((a, b) => b.delta - a.delta);
}

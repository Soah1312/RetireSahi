// ============================================
// RetireSahi — Math Engine v2.0
// All formulas verified against PFRDA rules
// and FY 2026-27 tax compliance
// ============================================

import {
  LIFESTYLE_MULTIPLIERS,
  LIFESTYLE_MODES,
  normalizeLifestyleConfig,
} from '../constants/lifestyleConfig.js'
import {
  RETIREMENT_MODES,
  OTHER_SCHEME_DEFAULT_RETURN,
  OTHER_SCHEME_CONFIGS,
  inferRetirementMode,
  getOtherSchemeAnnualReturn,
  getTotalOtherSchemeMonthlyContribution,
} from '../constants/investmentSchemes.js'
import { computeTaxSavings as computeTaxSavingsCore } from './taxShieldMath.js'

// ── SCHEME RETURNS (10-year averages) ───────
export const SCHEME_E_RETURN = 0.1269   // Equity
export const SCHEME_C_RETURN = 0.0887   // Corporate Bonds
export const SCHEME_G_RETURN = 0.0874   // Govt Securities

// ── FIXED ASSUMPTIONS ───────────────────────
export const INFLATION_RATE  = 0.06     // 6% p.a.
export const SWR             = 0.035    // 3.5% Safe Withdrawal Rate (India-adjusted)
export const ANNUITY_RATE    = 0.06     // 6% p.a. (conservative annuity estimate)
export const ANNUITY_SPLIT   = 0.40     // 40% must be annuitized (PFRDA mandate)
export const ANNUITY_PCT    = 0.40     // Alias for compatibility
export const LUMP_SUM_SPLIT  = 0.60     // 60% available as lump sum
export const LUMP_SUM_PCT  = 0.60     // Alias for compatibility
export const MIN_MODEL_MONTHLY_INCOME = 10000 // Keep readiness realistic for legacy low-income edge cases
const RETIREMENT_GOAL_FALLBACK_SWR = 0.04

// ── COLORS ─────────────────────────────────
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
}

export { LIFESTYLE_MULTIPLIERS }

// ── PFRDA EQUITY CAP BY AGE ─────────────────
export function getMaxEquityPct(age) {
  if (age < 50) return 75
  if (age >= 60) return 50
  return 75 - (age - 50) * 2.5
}

// ── BLENDED RETURN ──────────────────────────
// Based on user's equity allocation
// Remaining split equally between C and G
export function computeBlendedReturn(equityPct, age) {
  const cappedEquity = Math.min(equityPct, getMaxEquityPct(age)) / 100
  const remaining = 1 - cappedEquity
  return (
    cappedEquity * SCHEME_E_RETURN +
    (remaining / 2) * SCHEME_C_RETURN +
    (remaining / 2) * SCHEME_G_RETURN
  )
}

// ── TAX REGIME SLABS (FY 2026-27) ───────────
export const NEW_REGIME_SLABS = [
  { limit: 400000,  rate: 0.00 },
  { limit: 800000,  rate: 0.05 },
  { limit: 1200000, rate: 0.10 },
  { limit: 1600000, rate: 0.15 },
  { limit: 2000000, rate: 0.20 },
  { limit: 2400000, rate: 0.25 },
  { limit: Infinity, rate: 0.30 },
]

export const OLD_REGIME_SLABS = [
  { limit: 250000,  rate: 0.00 },
  { limit: 500000,  rate: 0.05 },
  { limit: 1000000, rate: 0.20 },
  { limit: Infinity, rate: 0.30 },
]

export const NEW_REGIME_STANDARD_DEDUCTION = 75000
export const OLD_REGIME_STANDARD_DEDUCTION = 50000
export const NEW_REGIME_87A_LIMIT = 1200000
export const OLD_REGIME_87A_LIMIT = 500000
export const NEW_REGIME_87A_REBATE = 60000
export const OLD_REGIME_87A_REBATE = 12500
export const HEALTH_EDUCATION_CESS = 0.04
export const MARGINAL_RELIEF_START = 1200000
export const MARGINAL_RELIEF_END = 1275000

// ── INDIAN NUMBER FORMATTER ─────────────────
export function formatIndian(num) {
  if (!num || isNaN(num)) return '₹0'
  if (num >= 10000000) return `₹${(num / 10000000).toFixed(1)} Cr`
  if (num >= 100000)   return `₹${(num / 100000).toFixed(1)} L`
  if (num >= 1000)     return `₹${(num / 1000).toFixed(0)}K`
  return `₹${Math.round(num)}`
}

// ── SCORE BAND ──────────────────────────────
export function getScoreBand(score) {
  if (score <= 30) return { label: 'Critical',  color: '#EF4444' }
  if (score <= 50) return { label: 'At Risk',   color: '#F97316' }
  if (score <= 70) return { label: 'On Track',  color: '#3B82F6' }
  if (score <= 85) return { label: 'Good',      color: '#8B5CF6' }
  return              { label: 'Excellent',  color: '#34D399' }
}

// ── SCORE INFO (alias for compatibility) ────
export const getScoreInfo = getScoreBand

// ── STEP-UP FV ──────────────────────────────
// FV of contributions growing 10% per year (step-up)
export function computeStepUpFV(monthlyPmt, annualReturn, years) {
  const r = annualReturn / 12
  let fv = 0
  for (let k = 0; k < years; k++) {
    const pmt = monthlyPmt * Math.pow(1.10, k)
    const monthsRemaining = (years - k) * 12
    fv += pmt * (Math.pow(1 + r, monthsRemaining) - 1) / r
  }
  return fv
}

// ── MILESTONE AGE ───────────────────────────
// Binary search for the age at which corpus hits a milestone
export function getMilestoneAge(milestone, currentAge, corpus, monthlyPmt, annualReturn) {
  const r = annualReturn / 12
  if (corpus >= milestone) return { age: currentAge, achieved: true }
  let lo = 0, hi = 600
  while (lo < hi) {
    const mid = Math.floor((lo + hi) / 2)
    const fv = corpus * Math.pow(1 + r, mid) +
               monthlyPmt * (Math.pow(1 + r, mid) - 1) / r
    if (fv >= milestone) hi = mid
    else lo = mid + 1
  }
  return { age: Math.round(currentAge + lo / 12), achieved: false }
}

// ── CORE RETIREMENT CALCULATOR ──────────────
// Single source of truth — used by onboarding,
// dashboard, simulator, and what-if scenarios
function resolveLifestyleInputs(data, monthlyIncome) {
  const rawLifestyle = (data?.lifestyle || 'comfortable').toLowerCase()
  const lifestyleConfig = normalizeLifestyleConfig(data?.lifestyleConfig, rawLifestyle)
  const lifestyle = lifestyleConfig.preset
  const lifestyleMultiplier = LIFESTYLE_MULTIPLIERS[lifestyle] || LIFESTYLE_MULTIPLIERS.comfortable
  const modeledMonthlyIncome = Math.max(monthlyIncome, MIN_MODEL_MONTHLY_INCOME)
  const customMonthlySpend = Math.max(0, Number(lifestyleConfig.customMonthlySpend) || 0)
  const useCustomSpend = lifestyleConfig.mode === LIFESTYLE_MODES.CUSTOM && customMonthlySpend > 0
  const monthlySpendToday = useCustomSpend
    ? customMonthlySpend
    : modeledMonthlyIncome * lifestyleMultiplier

  return {
    lifestyle,
    lifestyleConfig,
    lifestyleMode: lifestyleConfig.mode,
    lifestyleMultiplier,
    monthlySpendToday,
  }
}

function normalizeRetirementGoalType(value) {
  return value === 'custom' ? 'custom' : 'preset'
}

export function getRetirementGoalMonthly(userData, options = {}) {
  const goalType = normalizeRetirementGoalType(userData?.retirementGoalType)
  const customGoal = Math.max(0, Number(userData?.customRetirementMonthlyAmount) || 0)

  if (goalType === 'custom' && customGoal > 0) {
    return customGoal
  }

  const presetGoalMonthly = Math.max(0, Number(options.presetGoalMonthly) || 0)
  if (presetGoalMonthly > 0) {
    return presetGoalMonthly
  }

  const requiredCorpus = Math.max(0, Number(options.requiredCorpus) || 0)
  if (requiredCorpus > 0) {
    return (requiredCorpus * RETIREMENT_GOAL_FALLBACK_SWR) / 12
  }

  return 0
}

function projectMonthlyPensionForNpsContribution({
  npsCorpus,
  monthlyContribution,
  npsAnnualReturn,
  monthsToRetirement,
  stepUpRate,
  projectedOtherValue,
}) {
  const projectedNpsValue = computeFutureValueWithAnnualStepUp(
    npsCorpus,
    monthlyContribution,
    npsAnnualReturn / 12,
    monthsToRetirement,
    stepUpRate
  )

  const projectedTotal = projectedNpsValue + Math.max(0, Number(projectedOtherValue) || 0)
  return (projectedTotal * ANNUITY_SPLIT * ANNUITY_RATE) / 12
}

function estimateRequiredMonthlyNpsContributionForGoal({
  goalMonthly,
  currentMonthlyContribution,
  npsCorpus,
  npsAnnualReturn,
  monthsToRetirement,
  stepUpRate,
  projectedOtherValue,
}) {
  const safeGoal = Math.max(0, Number(goalMonthly) || 0)
  const currentMonthly = Math.max(0, Number(currentMonthlyContribution) || 0)

  if (safeGoal <= 0) {
    return currentMonthly
  }

  const currentProjectedPension = projectMonthlyPensionForNpsContribution({
    npsCorpus,
    monthlyContribution: currentMonthly,
    npsAnnualReturn,
    monthsToRetirement,
    stepUpRate,
    projectedOtherValue,
  })

  if (currentProjectedPension >= safeGoal) {
    return currentMonthly
  }

  let low = currentMonthly
  let high = Math.max(1000, currentMonthly || 1000)
  let guard = 0

  while (
    projectMonthlyPensionForNpsContribution({
      npsCorpus,
      monthlyContribution: high,
      npsAnnualReturn,
      monthsToRetirement,
      stepUpRate,
      projectedOtherValue,
    }) < safeGoal &&
    high < 10000000 &&
    guard < 30
  ) {
    high *= 1.6
    guard += 1
  }

  for (let i = 0; i < 50; i++) {
    const mid = (low + high) / 2
    const projectedPension = projectMonthlyPensionForNpsContribution({
      npsCorpus,
      monthlyContribution: mid,
      npsAnnualReturn,
      monthsToRetirement,
      stepUpRate,
      projectedOtherValue,
    })

    if (projectedPension >= safeGoal) {
      high = mid
    } else {
      low = mid
    }
  }

  return Math.ceil(high)
}

function parseAmount(value) {
  return Math.max(0, Number(value) || 0)
}

function normalizeStepUp(value) {
  const raw = Math.max(0, Number(value) || 0)
  if (raw >= 1) {
    return raw / 100
  }
  return raw
}

function computeFutureValue(corpus, monthlyContribution, monthlyRate, months) {
  const baseCorpus = Math.max(0, Number(corpus) || 0)
  const monthly = Math.max(0, Number(monthlyContribution) || 0)

  if (monthlyRate <= 0) {
    return baseCorpus + (monthly * months)
  }

  const corpusFuture = baseCorpus * Math.pow(1 + monthlyRate, months)
  const contributionFuture = monthly > 0
    ? monthly * (Math.pow(1 + monthlyRate, months) - 1) / monthlyRate
    : 0

  return corpusFuture + contributionFuture
}

function computeFutureValueWithAnnualStepUp(corpus, monthlyContribution, monthlyRate, months, annualStepUpRate) {
  const baseCorpus = Math.max(0, Number(corpus) || 0)
  const monthly = Math.max(0, Number(monthlyContribution) || 0)
  const safeMonths = Math.max(0, Number(months) || 0)
  const stepUpRate = Math.max(0, Number(annualStepUpRate) || 0)

  if (stepUpRate <= 0 || monthly <= 0 || safeMonths <= 0) {
    return computeFutureValue(baseCorpus, monthly, monthlyRate, safeMonths)
  }

  if (monthlyRate <= 0) {
    let steppedContribution = monthly
    let contributionFuture = 0
    for (let month = 1; month <= safeMonths; month++) {
      contributionFuture += steppedContribution
      if (month % 12 === 0) {
        steppedContribution *= (1 + stepUpRate)
      }
    }
    return baseCorpus + contributionFuture
  }

  let totalFuture = baseCorpus * Math.pow(1 + monthlyRate, safeMonths)
  let steppedContribution = monthly

  for (let month = 1; month <= safeMonths; month++) {
    const monthsRemaining = safeMonths - month + 1
    totalFuture += steppedContribution * Math.pow(1 + monthlyRate, monthsRemaining)
    if (month % 12 === 0) {
      steppedContribution *= (1 + stepUpRate)
    }
  }

  return totalFuture
}

function resolveRetirementMode(data) {
  return Object.values(RETIREMENT_MODES).includes(data?.retirementMode)
    ? data.retirementMode
    : inferRetirementMode(data)
}

function getPrimaryOtherSchemeConfig(data) {
  return OTHER_SCHEME_CONFIGS.find((scheme) => Boolean(data?.[scheme.toggleField])) || OTHER_SCHEME_CONFIGS[2]
}

function buildOtherContributionBoost(data, amount) {
  const target = getPrimaryOtherSchemeConfig(data)
  return {
    [target.toggleField]: true,
    [target.monthlyField]: parseAmount(data?.[target.monthlyField]) + amount,
  }
}

export function calculateRetirement(data) {
  const age         = parseInt(data.age) || 25
  const retireAge   = parseInt(data.retireAge) || 60
  const years       = Math.max(1, retireAge - age)
  const n           = years * 12   // total months

  const monthlyIncome = Math.max(0, parseFloat(data.monthlyIncome) || 0)
  const retirementMode = resolveRetirementMode(data)
  const includeNps = retirementMode !== RETIREMENT_MODES.NON_NPS_ONLY
  const includeOther = retirementMode !== RETIREMENT_MODES.NPS_ONLY

  const monthlyContribRaw = parseAmount(data.npsContribution)
  const stepUpRate = includeNps ? normalizeStepUp(data.stepUp) : 0
  const monthlyContrib = includeNps
    ? Math.min(monthlyContribRaw, Math.max(0, monthlyIncome))
    : 0

  const npsCorpusRaw = parseAmount(data.npsCorpus)
  const npsCorpus = includeNps ? npsCorpusRaw : 0

  const explicitMode = Object.values(RETIREMENT_MODES).includes(data?.retirementMode)
  const rawOtherSavings = parseAmount(data.totalSavings)
  const legacyOtherSavings = data.addSavings ? rawOtherSavings : 0
  const otherSavings = includeOther ? (explicitMode ? rawOtherSavings : legacyOtherSavings) : 0

  const rawOtherMonthlyContrib = includeOther ? getTotalOtherSchemeMonthlyContribution(data) : 0
  const otherMonthlyContrib = Math.min(Math.max(0, rawOtherMonthlyContrib), Math.max(0, monthlyIncome))
  const totalMonthlyContribution = monthlyContrib + otherMonthlyContrib
  const totalCorpus = npsCorpus + otherSavings

  const equityPct          = parseFloat(data.npsEquity) || 50
  const {
    lifestyle,
    lifestyleConfig,
    lifestyleMode,
    lifestyleMultiplier,
    monthlySpendToday,
  } = resolveLifestyleInputs(data, monthlyIncome)

  const npsAnnualReturn = computeBlendedReturn(equityPct, age)
  const otherAnnualReturn = includeOther ? getOtherSchemeAnnualReturn(data) : OTHER_SCHEME_DEFAULT_RETURN

  const npsWeight = npsCorpus + (monthlyContrib * 12)
  const otherWeight = otherSavings + (otherMonthlyContrib * 12)
  const totalWeight = npsWeight + otherWeight

  const annualReturn = totalWeight > 0
    ? ((npsAnnualReturn * npsWeight) + (otherAnnualReturn * otherWeight)) / totalWeight
    : npsAnnualReturn

  const r = annualReturn / 12

  // ── PROJECTED VALUE ──
  const projectedNpsValue = includeNps
    ? computeFutureValueWithAnnualStepUp(npsCorpus, monthlyContrib, npsAnnualReturn / 12, n, stepUpRate)
    : 0
  const projectedOtherValue = includeOther
    ? computeFutureValue(otherSavings, otherMonthlyContrib, otherAnnualReturn / 12, n)
    : 0
  const projectedValue = projectedNpsValue + projectedOtherValue

  // ── REQUIRED CORPUS ──
  // Inflation-adjusted monthly spend at retirement
  const monthlySpendAtRetirement =
    monthlySpendToday * Math.pow(1 + INFLATION_RATE, years)
  // Required corpus using SWR (on lump sum portion only)
  // Since 40% is annuitized, we need the lump sum (60%) to cover
  // (monthly spend - annuity income) via SWR
  // But we solve for total corpus first, then split
  const annualSpend = monthlySpendAtRetirement * 12
  const requiredCorpus = annualSpend > 0 ? annualSpend / SWR : 0

  // ── SCORE ──
  const readinessRatio = requiredCorpus > 0 ? (projectedValue / requiredCorpus) : 0
  const uncappedScore = Number.isFinite(readinessRatio) ? readinessRatio * 100 : 0
  const scorePrecise = Math.max(0, Math.min(100, Number(uncappedScore.toFixed(1))))
  const score = Math.max(0, Math.min(100, Math.floor(uncappedScore)))

  // ── GAP & MONTHLY CLOSER ──
  const gap = Math.max(0, requiredCorpus - projectedValue)
  const monthlyGap = gap > 0 && r > 0
    ? (gap * r) / (Math.pow(1 + r, n) - 1)
    : 0

  // ── ANNUITY SPLIT ──
  const annuityCorpus        = projectedValue * ANNUITY_SPLIT
  const lumpSumCorpus        = projectedValue * LUMP_SUM_SPLIT
  const monthlyAnnuityIncome = (annuityCorpus * ANNUITY_RATE) / 12

  const retirementGoalMonthly = getRetirementGoalMonthly(data, {
    presetGoalMonthly: monthlySpendAtRetirement,
    requiredCorpus,
  })
  const projectedMonthlyPension = monthlyAnnuityIncome
  const retirementGoalGap = Math.max(0, retirementGoalMonthly - projectedMonthlyPension)
  const requiredMonthlyContributionForGoal = estimateRequiredMonthlyNpsContributionForGoal({
    goalMonthly: retirementGoalMonthly,
    currentMonthlyContribution: monthlyContrib,
    npsCorpus,
    npsAnnualReturn,
    monthsToRetirement: n,
    stepUpRate,
    projectedOtherValue,
  })
  const isRetirementGoalOnTrack =
    retirementGoalGap <= 0 || requiredMonthlyContributionForGoal <= monthlyContrib

  // ── BLENDED RETURN (for display) ──
  const blendedReturn = annualReturn

  return {
    // Inputs (pass-through for convenience)
    age, retireAge, years, monthlyIncome,
    retirementMode,
    monthlyContrib,
    stepUpRate,
    otherMonthlyContrib,
    totalMonthlyContribution,
    totalCorpus,
    npsCorpusUsed: npsCorpus,
    otherSavingsUsed: otherSavings,
    combinedSavingsUsed: totalCorpus,
    equityPct, lifestyle,
    lifestyleMode,
    lifestyleConfig,
    monthlySpendToday,

    // Core outputs
    projectedValue,
    projectedNpsValue,
    projectedOtherValue,
    requiredCorpus,
    score,
    scorePrecise,
    gap,
    monthlyGap,
    monthlySpendAtRetirement,
    readinessRatio,
    uncappedScore,

    // Annuity
    annuityCorpus,
    lumpSumCorpus,
    monthlyAnnuityIncome,
    projectedMonthlyPension,
    retirementGoalMonthly,
    retirementGoalGap,
    requiredMonthlyContributionForGoal,
    isRetirementGoalOnTrack,

    // Meta
    blendedReturn,
    annualReturn,
    npsAnnualReturn,
    otherAnnualReturn,
    lifestyleMultiplier,
    n, r,
  }
}

// ── WHAT-IF SCENARIOS ───────────────────────
export function computeWhatIfScenarios(userData) {
  const base = calculateRetirement(userData)
  const activeMode = base.retirementMode
  const activeLifestyle = normalizeLifestyleConfig(
    userData?.lifestyleConfig,
    userData?.lifestyle || 'comfortable'
  ).preset
  const scenarioLifestyle = activeLifestyle === 'premium'
    ? 'comfortable'
    : activeLifestyle === 'essential'
    ? 'comfortable'
    : 'essential'

  const npsScenarios = [
    {
      id: 'contribute_more',
      title: 'Contribute ₹2,000 more/month to NPS',
      description: 'Increase your retirement flow in NPS',
      overrides: { npsContribution: (parseFloat(userData.npsContribution) || 0) + 2000 },
      score: calculateRetirement({
        ...userData,
        npsContribution: (parseFloat(userData.npsContribution) || 0) + 2000,
      }).score,
    },
    {
      id: 'step_up',
      title: 'Enable 10% annual step-up in NPS',
      description: 'Grow NPS contributions with salary hikes',
      overrides: { stepUp: 0.10 },
      score: calculateRetirement({
        ...userData,
        stepUp: 0.10,
      }).score,
    },
    {
      id: 'max_equity',
      title: `Max NPS equity to ${getMaxEquityPct(parseInt(userData.age) || 30)}%`,
      description: 'Optimize NPS mix for higher long-term return',
      overrides: { npsEquity: getMaxEquityPct(parseInt(userData.age) || 30) },
      score: calculateRetirement({
        ...userData,
        npsEquity: getMaxEquityPct(parseInt(userData.age) || 30),
      }).score,
    },
    {
      id: 'lump_sum_nps',
      title: 'Add ₹1L to NPS corpus',
      description: 'Immediate NPS corpus boost',
      overrides: { npsCorpus: (parseFloat(userData.npsCorpus) || 0) + 100000 },
      score: calculateRetirement({
        ...userData,
        npsCorpus: (parseFloat(userData.npsCorpus) || 0) + 100000,
      }).score,
    },
  ]

  const otherContributionBoost = buildOtherContributionBoost(userData, 2000)
  const otherScenarios = [
    {
      id: 'increase_other_monthly',
      title: 'Invest ₹2,000 more/month in other schemes',
      description: 'Increase SIP/PPF/EPF monthly flow',
      overrides: otherContributionBoost,
      score: calculateRetirement({
        ...userData,
        ...otherContributionBoost,
      }).score,
    },
    {
      id: 'lump_sum_other',
      title: 'Add ₹1L to other savings',
      description: 'Boost your non-NPS savings corpus',
      overrides: {
        addSavings: true,
        totalSavings: (parseFloat(userData.totalSavings) || 0) + 100000,
      },
      score: calculateRetirement({
        ...userData,
        addSavings: true,
        totalSavings: (parseFloat(userData.totalSavings) || 0) + 100000,
      }).score,
    },
  ]

  const commonScenarios = [
    {
      id: 'retire_later',
      title: 'Retire 2 years later',
      description: 'Power of compounding time',
      overrides: { retireAge: (parseInt(userData.retireAge) || 60) + 2 },
      score: calculateRetirement({
        ...userData,
        retireAge: (parseInt(userData.retireAge) || 60) + 2,
      }).score,
    },
    {
      id: 'lifestyle_switch',
      title: activeLifestyle === 'premium'
        ? 'Switch to Comfortable lifestyle'
        : activeLifestyle === 'essential'
        ? 'Switch to Comfortable lifestyle'
        : 'Switch to Essential lifestyle',
      description: 'Adjust standard of living',
      overrides: {
        lifestyle: scenarioLifestyle,
        lifestyleConfig: {
          ...normalizeLifestyleConfig(userData?.lifestyleConfig, activeLifestyle),
          mode: LIFESTYLE_MODES.PRESET,
          preset: scenarioLifestyle,
        },
      },
      score: calculateRetirement({
        ...userData,
        lifestyle: scenarioLifestyle,
        lifestyleConfig: {
          ...normalizeLifestyleConfig(userData?.lifestyleConfig, activeLifestyle),
          mode: LIFESTYLE_MODES.PRESET,
          preset: scenarioLifestyle,
        },
      }).score,
    },
  ]

  const recommendNpsScenario = {
    id: 'start_nps',
    title: 'Start NPS with ₹2,000/month',
    description: 'Government-backed pension layer + tax efficiency',
    overrides: {
      retirementMode: RETIREMENT_MODES.HYBRID,
      npsUsage: 'manual',
      npsContribution: (parseFloat(userData.npsContribution) || 0) + 2000,
    },
    score: calculateRetirement({
      ...userData,
      retirementMode: RETIREMENT_MODES.HYBRID,
      npsUsage: 'manual',
      npsContribution: (parseFloat(userData.npsContribution) || 0) + 2000,
    }).score,
  }

  const scenarios = activeMode === RETIREMENT_MODES.NPS_ONLY
    ? [...npsScenarios, ...commonScenarios]
    : activeMode === RETIREMENT_MODES.NON_NPS_ONLY
    ? [...otherScenarios, ...commonScenarios, recommendNpsScenario]
    : [...npsScenarios.slice(0, 2), ...otherScenarios, ...commonScenarios]

  return scenarios.map(s => ({
    ...s,
    delta: s.score - base.score
  }))
}

function sumAllowedDeductionBlocks(deductionBlocks = {}) {
  return Object.values(deductionBlocks).reduce((sum, value) => sum + Math.max(0, Number(value) || 0), 0)
}

function computeSlabTax(taxableIncome, slabs) {
  let tax = 0
  let prev = 0

  for (const slab of slabs) {
    if (taxableIncome <= prev) break
    const taxable = Math.min(taxableIncome, slab.limit) - prev
    tax += taxable * slab.rate
    prev = slab.limit
  }

  return tax
}

// FY 2026-27 marginal relief for New Regime rebate taper zone.
// For taxable income between 12,00,001 and 12,75,000, final tax payable
// should not exceed income above ₹12,00,000.
export function calculateMarginalRelief(taxableIncome) {
  const ti = Math.max(0, Number(taxableIncome) || 0)

  if (ti <= MARGINAL_RELIEF_START || ti > MARGINAL_RELIEF_END) {
    return {
      applicable: false,
      reliefAmount: 0,
      capAmount: 0,
      taxBeforeRelief: null,
      taxAfterRelief: null,
    }
  }

  const baseTax = computeSlabTax(ti, NEW_REGIME_SLABS)
  const taxBeforeRelief = Math.round(baseTax * (1 + HEALTH_EDUCATION_CESS))
  const capAmount = Math.max(0, Math.round(ti - MARGINAL_RELIEF_START))

  if (taxBeforeRelief <= capAmount) {
    return {
      applicable: false,
      reliefAmount: 0,
      capAmount,
      taxBeforeRelief,
      taxAfterRelief: taxBeforeRelief,
    }
  }

  return {
    applicable: true,
    reliefAmount: taxBeforeRelief - capAmount,
    capAmount,
    taxBeforeRelief,
    taxAfterRelief: capAmount,
  }
}

function computeTaxDetailed(annualIncome, regime = 'new', deductions = 0) {
  const normalizedIncome = Math.max(0, Number(annualIncome) || 0)
  const normalizedDeductions = Math.max(0, Number(deductions) || 0)
  const isNewRegime = regime === 'new'
  const stdDeduction = isNewRegime ? NEW_REGIME_STANDARD_DEDUCTION : OLD_REGIME_STANDARD_DEDUCTION
  const slabs = isNewRegime ? NEW_REGIME_SLABS : OLD_REGIME_SLABS
  const taxableIncome = Math.max(0, normalizedIncome - stdDeduction - normalizedDeductions)
  const baseTax = computeSlabTax(taxableIncome, slabs)

  const rebateLimit = isNewRegime ? NEW_REGIME_87A_LIMIT : OLD_REGIME_87A_LIMIT
  const rebateCap = isNewRegime ? NEW_REGIME_87A_REBATE : OLD_REGIME_87A_REBATE
  const rebateApplied = taxableIncome <= rebateLimit ? Math.min(baseTax, rebateCap) : 0
  const postRebateTax = Math.max(0, baseTax - rebateApplied)

  let taxPayable = Math.round(postRebateTax * (1 + HEALTH_EDUCATION_CESS))
  let marginalReliefApplied = false
  let marginalReliefAmount = 0

  if (isNewRegime && taxableIncome > MARGINAL_RELIEF_START && taxableIncome <= MARGINAL_RELIEF_END) {
    const relief = calculateMarginalRelief(taxableIncome)
    if (relief.applicable) {
      marginalReliefApplied = true
      marginalReliefAmount = relief.reliefAmount
      taxPayable = relief.taxAfterRelief
    }
  }

  return {
    annualIncome: normalizedIncome,
    deductions: normalizedDeductions,
    regime,
    taxableIncome,
    baseTax,
    rebateApplied,
    cessRate: HEALTH_EDUCATION_CESS,
    marginalReliefApplied,
    marginalReliefAmount,
    taxPayable,
  }
}

// ── TAX CALCULATOR ──────────────────────────
export function computeTax(annualIncome, regime = 'new', deductions = 0) {
  return computeTaxDetailed(annualIncome, regime, deductions).taxPayable
}

export function calculateBreakevenDeductions(income) {
  const annualIncome = Math.max(0, Number(income) || 0)
  const targetNewTax = computeTax(annualIncome, 'new', 0)

  if (computeTax(annualIncome, 'old', 0) <= targetNewTax) {
    return 0
  }

  let lo = 0
  let hi = Math.max(annualIncome, 1)

  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2
    const oldTaxAtMid = computeTax(annualIncome, 'old', mid)
    if (oldTaxAtMid <= targetNewTax) {
      hi = mid
    } else {
      lo = mid
    }
  }

  return Math.round(hi)
}

export function calculateTaxLeakage(userData) {
  const annualIncome = (Math.max(0, Number(userData?.monthlyIncome) || 0)) * 12
  const annualContrib = (Math.max(0, Number(userData?.npsContribution) || 0)) * 12
  const regime = userData?.taxRegime === 'old' ? 'old' : 'new'
  const isGovt = typeof userData?.isGovtEmployee === 'boolean'
    ? userData.isGovtEmployee
    : userData?.workContext === 'Government'

  const basicSalaryPct = isGovt ? 0.50 : 0.40
  const basicSalary = annualIncome * basicSalaryPct

  const ccd1Limit = Math.min(basicSalary * (isGovt ? 0.14 : 0.10), 150000)
  const ccd1Used = regime === 'old' ? Math.min(annualContrib, ccd1Limit) : 0
  const ccd1bUsed = regime === 'old' ? Math.min(Math.max(0, annualContrib - ccd1Limit), 50000) : 0

  const ccd2CurrentPct = regime === 'new' ? 0.14 : (isGovt ? 0.14 : 0.10)
  const ccd2CurrentUsed = Math.max(0, Number(userData?.employerNPSContributionAnnual) || 0)
  const ccd2CurrentLimit = basicSalary * ccd2CurrentPct
  const ccd2Current = Math.min(ccd2CurrentUsed, ccd2CurrentLimit)

  const homeLoanCurrent = regime === 'old' ? Math.min(Math.max(0, Number(userData?.homeLoanInterest24b) || 0), 200000) : 0
  const medicalCurrent = regime === 'old' ? Math.min(Math.max(0, Number(userData?.medicalInsurance80D) || 0), 50000) : 0
  const extra80CCurrent = regime === 'old' ? Math.min(Math.max(0, Number(userData?.extra80C) || 0), 150000) : 0

  const currentDeductions = sumAllowedDeductionBlocks({
    ccd1: ccd1Used,
    ccd1b: ccd1bUsed,
    ccd2: ccd2Current,
    homeLoan24b: homeLoanCurrent,
    medical80d: medicalCurrent,
    extra80c: extra80CCurrent,
  })

  const currentTax = computeTax(annualIncome, regime, currentDeductions)

  const optimizedNewDeductions = sumAllowedDeductionBlocks({
    ccd2: basicSalary * 0.14,
  })

  const optimizedOldDeductions = sumAllowedDeductionBlocks({
    ccd1: ccd1Limit,
    ccd1b: 50000,
    ccd2: basicSalary * (isGovt ? 0.14 : 0.10),
    section24b: 200000,
    section80d: 50000,
    section80c: 150000,
  })

  const theoreticalMinTax = Math.min(
    computeTax(annualIncome, 'new', optimizedNewDeductions),
    computeTax(annualIncome, 'old', optimizedOldDeductions)
  )

  const leakage = Math.max(0, currentTax - theoreticalMinTax)

  return {
    currentTax,
    theoreticalMinimumTax: theoreticalMinTax,
    leakage,
  }
}

export function computeTaxSavings(userData) {
  const input = userData || {}
  const n = (value) => Math.max(0, Number(value) || 0)
  const regime = input?.taxRegime === 'old' ? 'old' : 'new'
  const annualIncome = input?.annualIncome ? n(input.annualIncome) : n(input.monthlyIncome) * 12
  const isGovt = typeof input?.isGovtEmployee === 'boolean'
    ? input.isGovtEmployee
    : input?.workContext === 'Government'
  const basicSalaryPct = Math.min(0.8, Math.max(0.2, Number(input?.basicSalaryPct) || (isGovt ? 0.5 : 0.4)))
  const basicSalary = input?.basicSalary ? n(input.basicSalary) : annualIncome * basicSalaryPct
  const employerNpsAnnual = n(input?.employerNPSContributionAnnual)
  const employerNpsMonthlyExplicit = n(input?.npsEmployerMonthly)
  const employerNpsPct = regime === 'new' ? 0.14 : 0.10
  const employerNpsMonthly = employerNpsMonthlyExplicit > 0
    ? employerNpsMonthlyExplicit
    : employerNpsAnnual > 0
    ? employerNpsAnnual / 12
    : input?.hasOptedForEmployerNPS
    ? (annualIncome / 12) * basicSalaryPct * employerNpsPct
    : 0

  const legacyExtra80C = n(input?.extra80C)
  const legacyHomeLoan = n(input?.homeLoanInterest24b)
  const legacyMedical80D = n(input?.medicalInsurance80D)

  const coreInput = {
    grossIncome: annualIncome,
    annualIncome,
    basicSalary,
    npsSelfMonthly: n(input?.npsSelfMonthly || input?.npsContribution),
    npsEmployerMonthly: employerNpsMonthly,
    epfMonthly: n(input?.epfMonthly || input?.epfVpfMonthlyContribution),
    elssMonthly: n(input?.elssMonthly || input?.mfSipMonthlyContribution),
    ppfMonthly: n(input?.ppfMonthly || input?.ppfMonthlyContribution),
    licPremium: n(input?.licPremium || input?.lifeInsurance_80C || legacyExtra80C),
    healthInsuranceSelf: n(input?.healthInsuranceSelf || input?.medicalInsurance_80D || legacyMedical80D),
    healthInsuranceParents: n(input?.healthInsuranceParents),
    homeLoanInterest: n(input?.homeLoanInterest || legacyHomeLoan),
    homeLoanPrincipal: n(input?.homeLoanPrincipal),
    hraReceived: n(input?.hraReceived || input?.houseRentAllowance_HRA),
    rentPaid: n(input?.rentPaid || input?.actualRentPaid),
    isMetroCity: typeof input?.isMetroCity === 'boolean'
      ? input.isMetroCity
      : Boolean(input?.isMetroCityForHRA) || String(input?.cityType || '').toLowerCase().startsWith('metro'),
    age: parseInt(input?.age, 10) || 30,
    isGovtEmployee: isGovt,
    ltaDeclared: n(input?.ltaDeclared || input?.leaveTravelAllowance_LTA),
    ltaEntitled: n(input?.ltaEntitled || input?.leaveTravelAllowance_LTA),
  }

  const shared = computeTaxSavingsCore(coreInput)
  const withoutNps = computeTaxSavingsCore({
    ...coreInput,
    npsSelfMonthly: 0,
    npsEmployerMonthly: 0,
  })

  const deductionByLabel = (label, regimeKey) => {
    const row = (shared.deductionBreakdown || []).find((d) => d.label === label)
    return Math.max(0, Number(row?.[regimeKey]) || 0)
  }

  const oldCcd2Pct = 0.10
  const newCcd2Pct = 0.14
  const ccd1Limit = Math.min(basicSalary * 0.10, 150000)
  const ccd1Used = deductionByLabel('NPS 80CCD(1)', 'old')
  const ccd1bLimit = 50000
  const ccd1bUsed = deductionByLabel('NPS 80CCD(1B)', 'old')
  const section24bUsed = deductionByLabel('Home Loan Interest 24b', 'old')
  const section80dUsed = deductionByLabel('Health Insurance 80D', 'old')
  const section80cUsed = deductionByLabel('Section 80C', 'old')

  const oldTaxDetails = {
    taxableIncome: shared.old.taxableIncome,
    taxPayable: shared.old.totalTax,
    marginalReliefApplied: false,
  }
  const newTaxDetails = {
    taxableIncome: shared.new.taxableIncome,
    taxPayable: shared.new.totalTax,
    marginalReliefApplied: false,
  }

  const taxWithNPS = regime === 'new' ? shared.new.totalTax : shared.old.totalTax
  const taxWithoutNPS = regime === 'new' ? withoutNps.new.totalTax : withoutNps.old.totalTax
  const recommendedRegime = shared.recommendedRegime === 'OLD' ? 'old' : 'new'
  const potentialSavings = Math.max(0, Number(shared.annualTaxSaving) || 0)
  const taxLeakage = Math.max(0, (shared.leakages || []).reduce((sum, item) => sum + (Number(item.potentialSaving) || 0), 0))

  return {
    oldTax: shared.old.totalTax,
    newTax: shared.new.totalTax,
    recommendedRegime,
    breakevenPoint: calculateBreakevenDeductions(annualIncome),
    taxLeakage,
    potentialSavings,
    potentialSaving: potentialSavings,
    marginalReliefApplied: false,

    annualIncome,
    basicSalary,
    regime,
    ccd1: { limit: ccd1Limit, used: ccd1Used, missed: Math.max(0, ccd1Limit - ccd1Used) },
    ccd1b: { limit: ccd1bLimit, used: ccd1bUsed, missed: Math.max(0, ccd1bLimit - ccd1bUsed) },
    ccd2: {
      potential: basicSalary * (regime === 'new' ? newCcd2Pct : oldCcd2Pct),
      limitOld: basicSalary * oldCcd2Pct,
      limitNew: basicSalary * newCcd2Pct,
    },
    section24b: { limit: regime === 'old' ? 200000 : 0, used: section24bUsed },
    section80d: { limit: regime === 'old' ? 50000 : 0, used: section80dUsed },
    section80c: { limit: regime === 'old' ? 150000 : 0, used: section80cUsed },
    taxWithNPS,
    taxWithoutNPS,
    taxSaved: taxWithoutNPS - taxWithNPS,
    oldTaxDetails,
    newTaxDetails,
    theoreticalMinimumTax: Math.min(shared.old.totalTax, shared.new.totalTax),
  }
}

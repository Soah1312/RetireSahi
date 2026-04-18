export const RETIREMENT_MODES = {
  NPS_ONLY: 'nps_only',
  NON_NPS_ONLY: 'non_nps_only',
  HYBRID: 'hybrid',
};

// Baseline policy assumptions used for retirement modeling.
// These are intentionally conservative and can be updated in future policy releases.
export const SCHEME_ASSUMPTION_BASIS = 'Policy baseline FY2026';
export const OTHER_SCHEME_DEFAULT_RETURN = 0.08;
export const ASSUMED_RETURN_MIN_PCT = 3;
export const ASSUMED_RETURN_MAX_PCT = 18;

export const OTHER_SCHEME_CONFIGS = [
  {
    id: 'ppf',
    label: 'PPF',
    toggleField: 'usesPPF',
    monthlyField: 'ppfMonthlyContribution',
    assumptionField: 'ppfAssumedReturnPct',
    assumptionLabel: 'Govt rate assumption',
    annualReturn: 0.071,
  },
  {
    id: 'epf_vpf',
    label: 'EPF / VPF',
    toggleField: 'usesEPFVPF',
    monthlyField: 'epfVpfMonthlyContribution',
    assumptionField: 'epfVpfAssumedReturnPct',
    assumptionLabel: 'Declared EPF baseline',
    annualReturn: 0.0825,
  },
  {
    id: 'mf_sip',
    label: 'Mutual Funds (SIP)',
    toggleField: 'usesMFSIP',
    monthlyField: 'mfSipMonthlyContribution',
    assumptionField: 'mfSipAssumedReturnPct',
    assumptionLabel: 'Diversified equity SIP baseline',
    annualReturn: 0.105,
  },
  {
    id: 'stocks_etf',
    label: 'Stocks / ETF',
    toggleField: 'usesStocksETF',
    monthlyField: 'stocksEtfMonthlyContribution',
    assumptionField: 'stocksEtfAssumedReturnPct',
    assumptionLabel: 'Long-run equity baseline',
    annualReturn: 0.11,
  },
  {
    id: 'fd_rd',
    label: 'FD / RD',
    toggleField: 'usesFDRD',
    monthlyField: 'fdRdMonthlyContribution',
    assumptionField: 'fdRdAssumedReturnPct',
    assumptionLabel: 'Bank deposit baseline',
    annualReturn: 0.0675,
  },
  {
    id: 'other_custom',
    label: 'Other Scheme',
    toggleField: 'usesOtherScheme',
    monthlyField: 'otherSchemeMonthlyContribution',
    assumptionField: 'otherSchemeAssumedReturnPct',
    assumptionLabel: 'Conservative default assumption',
    annualReturn: OTHER_SCHEME_DEFAULT_RETURN,
  },
];

export function formatAnnualReturnPct(rate) {
  return `${(Math.max(0, Number(rate) || 0) * 100).toFixed(2)}%`;
}

export function normalizeAssumedReturnPct(value, fallbackRate) {
  const parsed = Number(value);
  const fallbackPct = (Math.max(0, Number(fallbackRate) || 0) * 100);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return Number(fallbackPct.toFixed(2));
  }

  return Number(
    Math.max(ASSUMED_RETURN_MIN_PCT, Math.min(ASSUMED_RETURN_MAX_PCT, parsed)).toFixed(2)
  );
}

export function getSchemeAnnualReturn(data = {}, scheme) {
  const useCustomAssumptions = Boolean(data?.customSchemeAssumptionsEnabled);
  if (!useCustomAssumptions || !scheme?.assumptionField) {
    return scheme?.annualReturn || OTHER_SCHEME_DEFAULT_RETURN;
  }

  const assumedPct = normalizeAssumedReturnPct(data?.[scheme.assumptionField], scheme.annualReturn);
  return assumedPct / 100;
}

export function getSchemeAssumedReturnPct(data = {}, scheme) {
  const annualRate = getSchemeAnnualReturn(data, scheme);
  return Number((annualRate * 100).toFixed(2));
}

function parseAmount(value) {
  return Math.max(0, Number(value) || 0);
}

export function getTotalOtherSchemeMonthlyContribution(data = {}) {
  return OTHER_SCHEME_CONFIGS.reduce((sum, scheme) => {
    const enabled = Boolean(data?.[scheme.toggleField]);
    if (!enabled) return sum;
    return sum + parseAmount(data?.[scheme.monthlyField]);
  }, 0);
}

export function getOtherSchemeAnnualReturn(data = {}) {
  const selected = OTHER_SCHEME_CONFIGS.filter((scheme) => data?.[scheme.toggleField]);
  if (selected.length === 0) {
    return data?.customSchemeAssumptionsEnabled
      ? getSchemeAnnualReturn(data, OTHER_SCHEME_CONFIGS[OTHER_SCHEME_CONFIGS.length - 1])
      : OTHER_SCHEME_DEFAULT_RETURN;
  }

  const totalContribution = selected.reduce(
    (sum, scheme) => sum + parseAmount(data?.[scheme.monthlyField]),
    0
  );

  if (totalContribution <= 0) {
    const equalWeight = 1 / selected.length;
    return selected.reduce((sum, scheme) => sum + (getSchemeAnnualReturn(data, scheme) * equalWeight), 0);
  }

  return selected.reduce((sum, scheme) => {
    const weight = parseAmount(data?.[scheme.monthlyField]) / totalContribution;
    return sum + (getSchemeAnnualReturn(data, scheme) * weight);
  }, 0);
}

export function inferRetirementMode(data = {}) {
  const npsCorpus = parseAmount(data?.npsCorpus);
  const npsContrib = parseAmount(data?.npsContribution);
  const hasNpsUsage = data?.npsUsage && data?.npsUsage !== 'none';
  const hasNps = hasNpsUsage || npsCorpus > 0 || npsContrib > 0;

  const hasOtherSavings = parseAmount(data?.totalSavings) > 0;
  const hasSchemes = getTotalOtherSchemeMonthlyContribution(data) > 0;
  const hasOther = hasOtherSavings || hasSchemes;

  if (hasNps && hasOther) return RETIREMENT_MODES.HYBRID;
  if (hasNps) return RETIREMENT_MODES.NPS_ONLY;
  return RETIREMENT_MODES.NON_NPS_ONLY;
}

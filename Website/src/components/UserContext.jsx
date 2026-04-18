import { createContext, useContext } from 'react';
import { createDefaultLifestyleConfig, normalizeLifestyleConfig } from '../constants/lifestyleConfig.js';
import { RETIREMENT_MODES, inferRetirementMode } from '../constants/investmentSchemes.js';

export const UserContext = createContext();

export const INITIAL_USER_DATA = {
  firstName: '',
  age: '',
  workContext: '',
  monthlyIncome: '',
  retirementMode: '',
  npsUsage: '',
  npsContribution: '',
  npsCorpus: '',
  npsEquity: 50,
  retireAge: 60,
  lifestyle: '',
  lifestyleConfig: createDefaultLifestyleConfig('comfortable'),
  addSavings: false,
  totalSavings: '',
  usesPPF: false,
  ppfMonthlyContribution: '',
  usesEPFVPF: false,
  epfVpfMonthlyContribution: '',
  usesMFSIP: false,
  mfSipMonthlyContribution: '',
  usesStocksETF: false,
  stocksEtfMonthlyContribution: '',
  usesFDRD: false,
  fdRdMonthlyContribution: '',
  usesOtherScheme: false,
  otherSchemeMonthlyContribution: '',
  customSchemeAssumptionsEnabled: false,
  ppfAssumedReturnPct: 7.1,
  epfVpfAssumedReturnPct: 8.25,
  mfSipAssumedReturnPct: 10.5,
  stocksEtfAssumedReturnPct: 11,
  fdRdAssumedReturnPct: 6.75,
  otherSchemeAssumedReturnPct: 8,
  taxRegime: 'new',
  homeLoanInterest: 0,
  lifeInsurance_80C: 0,
  elss_ppf_80C: 0,
  medicalInsurance_80D: 0,
  educationLoanInterest_80E: 0,
  houseRentAllowance_HRA: 0,
  actualRentPaid: 0,
  leaveTravelAllowance_LTA: 0,
  isGovtEmployee: false,
  basicSalaryPct: 0.4,
  hasOptedForEmployerNPS: false,
  employerNPSAmount: 0,
};

export const withInitialUserData = (userData) => {
  const merged = {
    ...INITIAL_USER_DATA,
    ...(userData || {}),
  };

  const fallbackLifestyle = merged.lifestyle?.trim()?.toLowerCase() || 'comfortable';
  const knownMode = Object.values(RETIREMENT_MODES).includes(merged.retirementMode)
    ? merged.retirementMode
    : inferRetirementMode(merged);

  return {
    ...merged,
    retirementMode: knownMode,
    lifestyle: fallbackLifestyle,
    lifestyleConfig: normalizeLifestyleConfig(merged.lifestyleConfig, fallbackLifestyle),
  };
};

export const useUser = () => {
  const context = useContext(UserContext);
  if (!context) throw new Error('useUser must be used within a DashboardLayout');
  return context;
};

import type { IncomeStream } from '../types';
import { v4 as uuidv4 } from 'uuid';

// US federal tax brackets, standard deductions, capital gains brackets, and
// RMD table/divisor are defined canonically in src/countries/usa/constants.ts.
// Re-exported here so existing imports throughout the app continue to work.
export {
  TAX_BRACKETS_MFJ,
  TAX_BRACKETS_SINGLE,
  STANDARD_DEDUCTION_MFJ,
  STANDARD_DEDUCTION_SINGLE,
  CAPITAL_GAINS_BRACKETS_MFJ,
  CAPITAL_GAINS_BRACKETS_SINGLE,
  RMD_START_AGE,
  RMD_TABLE,
  getRMDDivisor,
} from '../countries/usa/constants';

// Chart colors
export const CHART_COLORS = {
  pretax: '#3b82f6', // blue
  roth: '#10b981', // green
  taxable: '#f59e0b', // amber
  hsa: '#8b5cf6', // purple
  tax: '#ef4444', // red
  socialSecurity: '#6366f1', // indigo
  spending: '#0d9488', // teal
  pension: '#ec4899',          // pink
  otherIncome: '#f97316',      // orange
  taxFreeIncome: '#06b6d4',    // cyan
  retirementIncome: '#0ea5e9', // sky
};

// Default values for new app state
export const DEFAULT_PROFILE = {
  country: 'US' as const,
  currentAge: 35,
  retirementAge: 65,
  lifeExpectancy: 90,
  region: 'CA', // California
  filingStatus: 'married_filing_jointly' as const,
  stateTaxRate: 0.05,
};

export const DEFAULT_ASSUMPTIONS = {
  inflationRate: 0.03,
  safeWithdrawalRate: 0.04,
  retirementReturnRate: 0.05,
};

export const DEFAULT_INCOME_STREAMS: IncomeStream[] = [
  {
    id: uuidv4(),
    name: 'Social Security',
    monthlyAmount: 2500,
    startAge: 67,
    taxTreatment: 'social_security',
  },
];

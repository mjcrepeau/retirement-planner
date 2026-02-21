import { TaxBracket, RMDEntry } from '../types';
import type { IncomeStream } from '../types';
import { v4 as uuidv4 } from 'uuid';

// 2024 Federal Tax Brackets - Married Filing Jointly
export const TAX_BRACKETS_MFJ: TaxBracket[] = [
  { min: 0, max: 23200, rate: 0.10 },
  { min: 23200, max: 94300, rate: 0.12 },
  { min: 94300, max: 201050, rate: 0.22 },
  { min: 201050, max: 383900, rate: 0.24 },
  { min: 383900, max: 487450, rate: 0.32 },
  { min: 487450, max: 731200, rate: 0.35 },
  { min: 731200, max: Infinity, rate: 0.37 },
];

// 2024 Federal Tax Brackets - Single
export const TAX_BRACKETS_SINGLE: TaxBracket[] = [
  { min: 0, max: 11600, rate: 0.10 },
  { min: 11600, max: 47150, rate: 0.12 },
  { min: 47150, max: 100525, rate: 0.22 },
  { min: 100525, max: 191950, rate: 0.24 },
  { min: 191950, max: 243725, rate: 0.32 },
  { min: 243725, max: 609350, rate: 0.35 },
  { min: 609350, max: Infinity, rate: 0.37 },
];

// 2024 Standard Deductions
export const STANDARD_DEDUCTION_MFJ = 29200;
export const STANDARD_DEDUCTION_SINGLE = 14600;

// Long-term capital gains rates (2024)
export const CAPITAL_GAINS_BRACKETS_MFJ: TaxBracket[] = [
  { min: 0, max: 94050, rate: 0 },
  { min: 94050, max: 583750, rate: 0.15 },
  { min: 583750, max: Infinity, rate: 0.20 },
];

export const CAPITAL_GAINS_BRACKETS_SINGLE: TaxBracket[] = [
  { min: 0, max: 47025, rate: 0 },
  { min: 47025, max: 518900, rate: 0.15 },
  { min: 518900, max: Infinity, rate: 0.20 },
];

// RMD starts at age 73 (SECURE 2.0 Act)
export const RMD_START_AGE = 73;

// IRS Uniform Lifetime Table (simplified version)
export const RMD_TABLE: RMDEntry[] = [
  { age: 73, divisor: 26.5 },
  { age: 74, divisor: 25.5 },
  { age: 75, divisor: 24.6 },
  { age: 76, divisor: 23.7 },
  { age: 77, divisor: 22.9 },
  { age: 78, divisor: 22.0 },
  { age: 79, divisor: 21.1 },
  { age: 80, divisor: 20.2 },
  { age: 81, divisor: 19.4 },
  { age: 82, divisor: 18.5 },
  { age: 83, divisor: 17.7 },
  { age: 84, divisor: 16.8 },
  { age: 85, divisor: 16.0 },
  { age: 86, divisor: 15.2 },
  { age: 87, divisor: 14.4 },
  { age: 88, divisor: 13.7 },
  { age: 89, divisor: 12.9 },
  { age: 90, divisor: 12.2 },
  { age: 91, divisor: 11.5 },
  { age: 92, divisor: 10.8 },
  { age: 93, divisor: 10.1 },
  { age: 94, divisor: 9.5 },
  { age: 95, divisor: 8.9 },
  { age: 96, divisor: 8.4 },
  { age: 97, divisor: 7.8 },
  { age: 98, divisor: 7.3 },
  { age: 99, divisor: 6.8 },
  { age: 100, divisor: 6.4 },
  { age: 101, divisor: 6.0 },
  { age: 102, divisor: 5.6 },
  { age: 103, divisor: 5.2 },
  { age: 104, divisor: 4.9 },
  { age: 105, divisor: 4.6 },
  { age: 106, divisor: 4.3 },
  { age: 107, divisor: 4.1 },
  { age: 108, divisor: 3.9 },
  { age: 109, divisor: 3.7 },
  { age: 110, divisor: 3.5 },
  { age: 111, divisor: 3.4 },
  { age: 112, divisor: 3.3 },
  { age: 113, divisor: 3.1 },
  { age: 114, divisor: 3.0 },
  { age: 115, divisor: 2.9 },
  { age: 116, divisor: 2.8 },
  { age: 117, divisor: 2.7 },
  { age: 118, divisor: 2.5 },
  { age: 119, divisor: 2.3 },
  { age: 120, divisor: 2.0 },
];

export function getRMDDivisor(age: number): number {
  if (age < RMD_START_AGE) return 0;
  const entry = RMD_TABLE.find(e => e.age === age);
  if (entry) return entry.divisor;
  // For ages beyond the table, use the last value
  if (age > 120) return 2.0;
  return 0;
}

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

import type { TaxBracket, RMDEntry } from '../../types';

// The tax year these US federal constants reflect. Update this alongside the
// brackets/deductions below when refreshing to a new tax year.
export const TAX_DATA_YEAR = 2026;

// 2026 Federal Tax Brackets - Married Filing Jointly
export const TAX_BRACKETS_MFJ: TaxBracket[] = [
  { min: 0, max: 24800, rate: 0.10 },
  { min: 24800, max: 100800, rate: 0.12 },
  { min: 100800, max: 211400, rate: 0.22 },
  { min: 211400, max: 403550, rate: 0.24 },
  { min: 403550, max: 512450, rate: 0.32 },
  { min: 512450, max: 768700, rate: 0.35 },
  { min: 768700, max: Infinity, rate: 0.37 },
];

// 2026 Federal Tax Brackets - Single
export const TAX_BRACKETS_SINGLE: TaxBracket[] = [
  { min: 0, max: 12400, rate: 0.10 },
  { min: 12400, max: 50400, rate: 0.12 },
  { min: 50400, max: 105700, rate: 0.22 },
  { min: 105700, max: 201775, rate: 0.24 },
  { min: 201775, max: 256225, rate: 0.32 },
  { min: 256225, max: 640600, rate: 0.35 },
  { min: 640600, max: Infinity, rate: 0.37 },
];

// 2026 Standard Deductions (reflects One Big Beautiful Bill Act increases)
export const STANDARD_DEDUCTION_MFJ = 32200;
export const STANDARD_DEDUCTION_SINGLE = 16100;

// Long-term capital gains rates (2026)
export const CAPITAL_GAINS_BRACKETS_MFJ: TaxBracket[] = [
  { min: 0, max: 98900, rate: 0 },
  { min: 98900, max: 613700, rate: 0.15 },
  { min: 613700, max: Infinity, rate: 0.20 },
];

export const CAPITAL_GAINS_BRACKETS_SINGLE: TaxBracket[] = [
  { min: 0, max: 49450, rate: 0 },
  { min: 49450, max: 545500, rate: 0.15 },
  { min: 545500, max: Infinity, rate: 0.20 },
];

// RMD starts at age 73 (SECURE 2.0 Act)
export const RMD_START_AGE = 73;

// IRS Uniform Lifetime Table
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

/**
 * Get the IRS Uniform Lifetime Table divisor for a given age
 */
export function getRMDDivisor(age: number): number {
  if (age < RMD_START_AGE) return 0;
  const entry = RMD_TABLE.find(e => e.age === age);
  if (entry) return entry.divisor;
  // For ages beyond the table, use the last value
  if (age > 120) return 2.0;
  return 0;
}

// US States
export const US_STATES = [
  { code: 'AL', name: 'Alabama' },
  { code: 'AK', name: 'Alaska' },
  { code: 'AZ', name: 'Arizona' },
  { code: 'AR', name: 'Arkansas' },
  { code: 'CA', name: 'California' },
  { code: 'CO', name: 'Colorado' },
  { code: 'CT', name: 'Connecticut' },
  { code: 'DE', name: 'Delaware' },
  { code: 'FL', name: 'Florida' },
  { code: 'GA', name: 'Georgia' },
  { code: 'HI', name: 'Hawaii' },
  { code: 'ID', name: 'Idaho' },
  { code: 'IL', name: 'Illinois' },
  { code: 'IN', name: 'Indiana' },
  { code: 'IA', name: 'Iowa' },
  { code: 'KS', name: 'Kansas' },
  { code: 'KY', name: 'Kentucky' },
  { code: 'LA', name: 'Louisiana' },
  { code: 'ME', name: 'Maine' },
  { code: 'MD', name: 'Maryland' },
  { code: 'MA', name: 'Massachusetts' },
  { code: 'MI', name: 'Michigan' },
  { code: 'MN', name: 'Minnesota' },
  { code: 'MS', name: 'Mississippi' },
  { code: 'MO', name: 'Missouri' },
  { code: 'MT', name: 'Montana' },
  { code: 'NE', name: 'Nebraska' },
  { code: 'NV', name: 'Nevada' },
  { code: 'NH', name: 'New Hampshire' },
  { code: 'NJ', name: 'New Jersey' },
  { code: 'NM', name: 'New Mexico' },
  { code: 'NY', name: 'New York' },
  { code: 'NC', name: 'North Carolina' },
  { code: 'ND', name: 'North Dakota' },
  { code: 'OH', name: 'Ohio' },
  { code: 'OK', name: 'Oklahoma' },
  { code: 'OR', name: 'Oregon' },
  { code: 'PA', name: 'Pennsylvania' },
  { code: 'RI', name: 'Rhode Island' },
  { code: 'SC', name: 'South Carolina' },
  { code: 'SD', name: 'South Dakota' },
  { code: 'TN', name: 'Tennessee' },
  { code: 'TX', name: 'Texas' },
  { code: 'UT', name: 'Utah' },
  { code: 'VT', name: 'Vermont' },
  { code: 'VA', name: 'Virginia' },
  { code: 'WA', name: 'Washington' },
  { code: 'WV', name: 'West Virginia' },
  { code: 'WI', name: 'Wisconsin' },
  { code: 'WY', name: 'Wyoming' },
  { code: 'DC', name: 'District of Columbia' },
];

import { RMD_TABLE, RMD_START_AGE, getRMDStartAge } from './constants';

/**
 * Get RMD divisor for a given age (IRS Uniform Lifetime Table lookup).
 * Gated at the earliest possible RMD age; the caller applies the
 * birth-year-specific start age via calculateRMD.
 */
export function getRMDDivisor(age: number): number {
  if (age < RMD_START_AGE) return 0;
  const entry = RMD_TABLE.find(e => e.age === age);
  if (entry) return entry.divisor;
  // For ages beyond the table, use the last value
  if (age > 120) return 2.0;
  return 0;
}

/**
 * Calculate Required Minimum Distribution.
 *
 * `birthYear` determines the start age under SECURE 2.0 (73 for those born
 * before 1960, 75 for 1960 or later). When omitted, the earliest start age
 * (73) is used.
 */
export function calculateRMD(
  age: number,
  balance: number,
  accountType: string,
  birthYear?: number
): number {
  // RMDs only apply to traditional (pretax) accounts
  if (!isTraditionalAccount(accountType)) return 0;
  const startAge = birthYear !== undefined ? getRMDStartAge(birthYear) : RMD_START_AGE;
  if (age < startAge) return 0;
  if (balance <= 0) return 0;

  const divisor = getRMDDivisor(age);
  if (divisor === 0) return 0;

  return balance / divisor;
}

/**
 * Check if account type is traditional (subject to RMD)
 */
function isTraditionalAccount(accountType: string): boolean {
  return accountType === 'traditional_401k' || accountType === 'traditional_ira';
}

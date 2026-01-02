import { RMD_TABLE, RMD_START_AGE } from './constants';

/**
 * Get RMD divisor for a given age
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
 * Calculate Required Minimum Distribution
 */
export function calculateRMD(age: number, balance: number, accountType: string): number {
  // RMDs only apply to traditional (pretax) accounts
  if (!isTraditionalAccount(accountType)) return 0;
  if (age < RMD_START_AGE) return 0;
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

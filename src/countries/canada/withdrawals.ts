import { RRIF_MINIMUM_TABLE, RRIF_START_AGE } from './constants';

/**
 * Get RRIF minimum withdrawal percentage for a given age
 */
export function getRRIFMinimumPercentage(age: number): number {
  if (age < RRIF_START_AGE) return 0;

  const entry = RRIF_MINIMUM_TABLE.find(e => e.age === age);
  if (entry) return entry.minimumPercentage;

  // For ages beyond the table (95+), use the maximum percentage
  if (age >= 95) return 0.20; // 20%

  return 0;
}

/**
 * Calculate RRIF minimum withdrawal
 */
export function calculateRRIFMinimum(age: number, balance: number, accountType: string): number {
  // RRIF minimums only apply to RRIF and RRSP accounts (after age 71)
  if (accountType !== 'rrif' && accountType !== 'rrsp') return 0;
  if (age < RRIF_START_AGE) return 0;
  if (balance <= 0) return 0;

  const percentage = getRRIFMinimumPercentage(age);
  return balance * percentage;
}

/**
 * Check if RRSP must be converted to RRIF
 */
export function mustConvertRRSPToRRIF(age: number): boolean {
  return age >= RRIF_START_AGE;
}

/**
 * Check if account type is subject to RRIF minimums
 */
export function isRRIFAccount(accountType: string): boolean {
  return accountType === 'rrif' || accountType === 'rrsp';
}

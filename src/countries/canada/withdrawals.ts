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
 * Calculate RRIF minimum withdrawal.
 *
 * Applies to RRSP/RRIF (RRSP modeled as converted to RRIF at 71) and to
 * LIRA/LIF, which must likewise convert by 71 and follow the same minimum
 * table. LIF withdrawal MAXIMUMS are not modeled.
 */
export function calculateRRIFMinimum(age: number, balance: number, accountType: string): number {
  if (!isRRIFAccount(accountType)) return 0;
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
 * Check if account type is subject to RRIF-style minimums after age 71.
 * LIRA/LIF must convert to a LIF by 71 and follow the same minimum table.
 */
export function isRRIFAccount(accountType: string): boolean {
  return (
    accountType === 'rrif' ||
    accountType === 'rrsp' ||
    accountType === 'lif' ||
    accountType === 'lira'
  );
}

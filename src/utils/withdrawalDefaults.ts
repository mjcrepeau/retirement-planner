import type { Account } from '../types';
import type { CountryConfig } from '../countries';

/**
 * Get the default withdrawal start age for an account
 *
 * This applies smart defaults based on account type:
 * - Traditional accounts default to penalty-free age (60 for US)
 * - Other accounts default to retirement age
 * - All defaults are capped at RMD age if applicable
 *
 * @param account - The account to get default for
 * @param retirementAge - User's planned retirement age
 * @param countryConfig - Country configuration
 * @param birthYear - User's birth year; determines the RMD start age
 *   (US: 73 if born before 1960, 75 otherwise; Canada: 71)
 * @returns Default withdrawal start age
 */
export function getDefaultWithdrawalAge(
  account: Account,
  retirementAge: number,
  countryConfig: CountryConfig,
  birthYear: number
): number {
  const penaltyInfo = countryConfig.getPenaltyInfo(account.type);

  // Get RMD age for this account type (if applicable)
  // Check if account requires RMDs by seeing if getMinimumWithdrawal returns > 0 at RMD age
  let rmdAge: number | undefined;
  if (countryConfig.isTraditionalAccount(account.type)) {
    const testAge = countryConfig.getRMDStartAge(birthYear);
    const testRmd = countryConfig.getMinimumWithdrawal(testAge, 100000, account.type, birthYear);
    if (testRmd > 0) {
      rmdAge = testAge;
    }
  }

  // For accounts with penalties, default to penalty-free age
  if (penaltyInfo.appliesToAccountType) {
    // Round up penalty age (59.5 -> 60 to avoid confusion)
    const penaltyFreeAge = Math.ceil(penaltyInfo.penaltyAge);
    return rmdAge ? Math.min(penaltyFreeAge, rmdAge) : penaltyFreeAge;
  }

  // For no-penalty accounts, default to retirement age
  return rmdAge ? Math.min(retirementAge, rmdAge) : retirementAge;
}

/**
 * Get the maximum allowed withdrawal age for an account
 * (enforces RMD constraint)
 *
 * @param account - The account to check
 * @param lifeExpectancy - User's life expectancy
 * @param countryConfig - Country configuration
 * @param birthYear - User's birth year; determines the RMD start age
 * @returns Maximum withdrawal age
 */
export function getMaxWithdrawalAge(
  account: Account,
  lifeExpectancy: number,
  countryConfig: CountryConfig,
  birthYear: number
): number {
  // Check if this account type requires RMDs
  if (countryConfig.isTraditionalAccount(account.type)) {
    const rmdAge = countryConfig.getRMDStartAge(birthYear);
    const testRmd = countryConfig.getMinimumWithdrawal(rmdAge, 100000, account.type, birthYear);
    if (testRmd > 0) {
      return rmdAge; // Cannot delay withdrawal past RMD age
    }
  }

  // Otherwise, can delay until life expectancy
  return lifeExpectancy;
}

/**
 * Approximate birth year from the user's current age. Off by at most one
 * year (depending on whether their birthday has passed), which only matters
 * for the RMD-age boundary cohort (born ~1959/1960).
 */
export function birthYearFromAge(currentAge: number): number {
  return new Date().getFullYear() - currentAge;
}

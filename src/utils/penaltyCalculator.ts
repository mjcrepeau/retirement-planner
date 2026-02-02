import type { CountryConfig } from '../countries';
import type { EarlyWithdrawalPenalty } from '../types';

/**
 * Represents a withdrawal from an account for penalty calculation
 */
export interface AccountWithdrawal {
  accountId: string;
  accountName: string;
  accountType: string;
  amount: number;
}

/**
 * Calculate early withdrawal penalties for a list of withdrawals
 *
 * @param withdrawals - Array of withdrawals to check for penalties
 * @param currentAge - Age at time of withdrawal
 * @param countryConfig - Country configuration with penalty rules
 * @returns Array of penalties that apply
 */
export function calculatePenalties(
  withdrawals: AccountWithdrawal[],
  currentAge: number,
  countryConfig: CountryConfig
): EarlyWithdrawalPenalty[] {
  const penalties: EarlyWithdrawalPenalty[] = [];

  for (const withdrawal of withdrawals) {
    const penaltyInfo = countryConfig.getPenaltyInfo(withdrawal.accountType);

    // Only calculate penalty if it applies to this account type and age
    if (penaltyInfo.appliesToAccountType && currentAge < penaltyInfo.penaltyAge) {
      const penaltyAmount = countryConfig.calculateEarlyWithdrawalPenalty(
        withdrawal.amount,
        withdrawal.accountType,
        currentAge
      );

      if (penaltyAmount > 0) {
        penalties.push({
          amount: penaltyAmount,
          accountId: withdrawal.accountId,
          accountName: withdrawal.accountName,
        });
      }
    }
  }

  return penalties;
}

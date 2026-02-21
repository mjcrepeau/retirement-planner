import { useMemo } from 'react';
import { Account, Profile, Assumptions, AccumulationResult, RetirementResult, IncomeStream } from '../types';
import { calculateAccumulation } from '../utils/projections';
import { calculateWithdrawals } from '../utils/withdrawals';
import type { CountryConfig } from '../countries';

interface UseRetirementCalcResult {
  accumulation: AccumulationResult;
  retirement: RetirementResult;
}

export function useRetirementCalc(
  accounts: Account[],
  profile: Profile,
  assumptions: Assumptions,
  countryConfig: CountryConfig,
  incomeStreams: IncomeStream[]
): UseRetirementCalcResult {
  const accumulation = useMemo(() => {
    if (accounts.length === 0) {
      return {
        yearlyBalances: [],
        finalBalances: {},
        totalAtRetirement: 0,
        breakdownByGroup: {},
      };
    }
    return calculateAccumulation(accounts, profile, countryConfig);
  }, [accounts, profile, countryConfig]);

  const retirement = useMemo(() => {
    if (accounts.length === 0 || accumulation.totalAtRetirement === 0) {
      return {
        yearlyWithdrawals: [],
        portfolioDepletionAge: null,
        lifetimeTaxesPaid: 0,
        sustainableMonthlyWithdrawal: 0,
        sustainableAnnualWithdrawal: 0,
        accountDepletionAges: {},
      };
    }
    return calculateWithdrawals(accounts, profile, assumptions, accumulation, countryConfig, incomeStreams);
  }, [accounts, profile, assumptions, accumulation, countryConfig, incomeStreams]);

  return { accumulation, retirement };
}

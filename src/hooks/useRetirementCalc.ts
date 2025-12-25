import { useMemo } from 'react';
import { Account, Profile, Assumptions, AccumulationResult, RetirementResult } from '../types';
import { calculateAccumulation } from '../utils/projections';
import { calculateWithdrawals } from '../utils/withdrawals';

interface UseRetirementCalcResult {
  accumulation: AccumulationResult;
  retirement: RetirementResult;
}

export function useRetirementCalc(
  accounts: Account[],
  profile: Profile,
  assumptions: Assumptions
): UseRetirementCalcResult {
  const accumulation = useMemo(() => {
    if (accounts.length === 0) {
      return {
        yearlyBalances: [],
        finalBalances: {},
        totalAtRetirement: 0,
        breakdownByTaxTreatment: {
          pretax: 0,
          roth: 0,
          taxable: 0,
          hsa: 0,
        },
      };
    }
    return calculateAccumulation(accounts, profile);
  }, [accounts, profile]);

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
    return calculateWithdrawals(accounts, profile, assumptions, accumulation);
  }, [accounts, profile, assumptions, accumulation]);

  return { accumulation, retirement };
}

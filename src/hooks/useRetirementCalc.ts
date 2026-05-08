import { useMemo } from 'react';
import {
  Account,
  Profile,
  Assumptions,
  AccumulationResult,
  RetirementResult,
  IncomeStream,
  ConversionPlan,
} from '../types';
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
  incomeStreams: IncomeStream[],
  conversionPlans: ConversionPlan[] = [],
): UseRetirementCalcResult {
  const accumulation = useMemo(() => {
    if (accounts.length === 0) {
      return {
        yearlyBalances: [],
        finalBalances: {},
        totalAtRetirement: 0,
        breakdownByGroup: {},
        conversionsByYear: [],
        lifetimeConversionTaxCost: 0,
      };
    }
    return calculateAccumulation(accounts, profile, countryConfig, assumptions, conversionPlans);
  }, [accounts, profile, countryConfig, assumptions, conversionPlans]);

  const retirement = useMemo(() => {
    if (accounts.length === 0 || accumulation.totalAtRetirement === 0) {
      return {
        yearlyWithdrawals: [],
        portfolioDepletionAge: null,
        lifetimeTaxesPaid: 0,
        sustainableMonthlyWithdrawal: 0,
        sustainableAnnualWithdrawal: 0,
        accountDepletionAges: {},
        lifetimeTaxDeltaFromConversion: 0,
      };
    }

    // Primary pass — drives every visible chart, table, summary
    const primary = calculateWithdrawals(
      accounts, profile, assumptions, accumulation, countryConfig, incomeStreams, conversionPlans,
    );

    // Shadow pass — same simulation with no plans, used only for the lifetime delta
    let lifetimeTaxDeltaFromConversion = 0;
    if (conversionPlans.length > 0) {
      const shadowAccumulation = calculateAccumulation(
        accounts, profile, countryConfig, assumptions, [],
      );
      const shadowRetirement = calculateWithdrawals(
        accounts, profile, assumptions, shadowAccumulation, countryConfig, incomeStreams, [],
      );
      lifetimeTaxDeltaFromConversion =
        (primary.lifetimeTaxesPaid + accumulation.lifetimeConversionTaxCost)
        - shadowRetirement.lifetimeTaxesPaid;
    }

    return { ...primary, lifetimeTaxDeltaFromConversion };
  }, [accounts, profile, assumptions, accumulation, countryConfig, incomeStreams, conversionPlans]);

  return { accumulation, retirement };
}

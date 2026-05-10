import {
  Account,
  Profile,
  Assumptions,
  AccumulationResult,
  YearlyAccountBalance,
  ConversionPlan,
  is401k,
} from '../types';
import type { CountryConfig } from '../countries';
import {
  applyConversionsForYear,
  calculateConversionTaxDelta,
} from './conversions';
import { FEDERAL_BRACKET_INFLATION_RATIO } from './constants';

/**
 * Calculate employer match for accounts that support it (401k, employer RRSP)
 */
function calculateEmployerMatch(account: Account): number {
  const supportsMatch = is401k(account.type) || account.type === 'employer_rrsp';

  if (!supportsMatch || !account.employerMatchPercent || !account.employerMatchLimit) {
    return 0;
  }

  // Match is the lesser of:
  // 1. The match percent times the contribution
  // 2. The match limit
  const matchAmount = account.annualContribution * account.employerMatchPercent;
  return Math.min(matchAmount, account.employerMatchLimit);
}

/**
 * Project account growth during accumulation phase
 */
export function calculateAccumulation(
  accounts: Account[],
  profile: Profile,
  countryConfig: CountryConfig,
  assumptions?: Assumptions,
  conversionPlans: ConversionPlan[] = [],
): AccumulationResult {
  // Fallback to 0 keeps the legacy 3-arg signature working for tests that don't
  // need conversion math; production callers always pass assumptions.
  const inflationRate = assumptions?.inflationRate ?? 0;
  const yearsToRetirement = profile.retirementAge - profile.currentAge;
  const currentYear = new Date().getFullYear();

  // Initialize balances
  const balances: Record<string, number> = {};
  const contributions: Record<string, number> = {};

  accounts.forEach(account => {
    balances[account.id] = account.balance;
    contributions[account.id] = account.annualContribution;
  });

  const yearlyBalances: YearlyAccountBalance[] = [];
  const conversionsByYear: AccumulationResult['conversionsByYear'] = [];
  let lifetimeConversionTaxCost = 0;

  // Record initial state (year 0)
  yearlyBalances.push({
    age: profile.currentAge,
    year: currentYear,
    balances: { ...balances },
    totalBalance: Object.values(balances).reduce((sum, b) => sum + b, 0),
    contributions: { ...contributions },
  });

  // Project each year
  for (let i = 1; i <= yearsToRetirement; i++) {
    const age = profile.currentAge + i;
    const year = currentYear + i;
    const yearsFromNow = i;

    accounts.forEach(account => {
      const currentBalance = balances[account.id];
      const currentContribution = contributions[account.id];

      // 1. Apply investment return to existing balance
      const balanceAfterReturn = currentBalance * (1 + account.returnRate);

      // 2. Add contribution (with employer match if applicable)
      const employerMatch = calculateEmployerMatch({
        ...account,
        annualContribution: currentContribution,
      });
      const totalContribution = currentContribution + employerMatch;

      // Update balance
      balances[account.id] = balanceAfterReturn + totalContribution;

      // 3. Grow contribution for next year
      contributions[account.id] = currentContribution * (1 + account.contributionGrowthRate);
    });

    // End-of-year conversions — only fire BEFORE retirement age.
    // The retirement loop owns conversions at age >= retirementAge to avoid
    // double-counting at the accumulation/retirement boundary.
    let totalConvertedThisYear = 0;
    if (age < profile.retirementAge) {
      const conversionResult = applyConversionsForYear({
        age,
        yearsFromNow,
        plans: conversionPlans,
        balances,
        inflationRate,
      });
      totalConvertedThisYear = conversionResult.totalConvertedThisYear;
    }

    if (totalConvertedThisYear > 0) {
      // Project nominal income for this year
      const incomeForYear = (profile.annualIncome ?? 0) *
        Math.pow(1 + (profile.incomeGrowthRate ?? 0), yearsFromNow);
      // US federal brackets are partially inflation-indexed (50% of CPI/year).
      // Same model as the retirement-side tax calc, anchored at currentAge.
      const bracketInflationMultiplier = Math.pow(
        1 + FEDERAL_BRACKET_INFLATION_RATIO * inflationRate,
        yearsFromNow,
      );
      const taxDelta = calculateConversionTaxDelta({
        incomeForYear,
        conversionTotalForYear: totalConvertedThisYear,
        filingStatus: profile.filingStatus ?? 'single',
        stateTaxRate: profile.stateTaxRate ?? 0,
        bracketInflationMultiplier,
      });
      conversionsByYear.push({ age, year, amount: totalConvertedThisYear, taxDelta });
      lifetimeConversionTaxCost += taxDelta;
    }

    const totalBalance = Object.values(balances).reduce((sum, b) => sum + b, 0);

    yearlyBalances.push({
      age,
      year,
      balances: { ...balances },
      totalBalance,
      contributions: { ...contributions },
    });
  }

  // Calculate breakdown by country-specific groupings
  const breakdownByGroup: Record<string, number> = {};
  const accountGroupings = countryConfig.getAccountGroupings();

  // Initialize all groups to 0
  accountGroupings.forEach(group => {
    breakdownByGroup[group.id] = 0;
  });

  // Sum up balances for each group
  accounts.forEach(account => {
    const accountType = account.type;
    // Find which group this account belongs to
    const group = accountGroupings.find(g => g.accountTypes.includes(accountType));
    if (group) {
      breakdownByGroup[group.id] += balances[account.id];
    }
  });

  return {
    yearlyBalances,
    finalBalances: { ...balances },
    totalAtRetirement: Object.values(balances).reduce((sum, b) => sum + b, 0),
    breakdownByGroup,
    conversionsByYear,
    lifetimeConversionTaxCost,
  };
}

/**
 * Get the balance of an account at a specific age
 */
export function getBalanceAtAge(
  result: AccumulationResult,
  accountId: string,
  age: number
): number {
  const yearData = result.yearlyBalances.find(y => y.age === age);
  if (!yearData) return 0;
  return yearData.balances[accountId] || 0;
}

/**
 * Calculate total contributions made over accumulation phase
 */
export function calculateTotalContributions(
  accounts: Account[],
  profile: Profile
): Record<string, number> {
  const yearsToRetirement = profile.retirementAge - profile.currentAge;
  const totals: Record<string, number> = {};

  accounts.forEach(account => {
    let totalContribution = 0;
    let yearlyContribution = account.annualContribution;

    for (let i = 0; i < yearsToRetirement; i++) {
      const employerMatch = calculateEmployerMatch({
        ...account,
        annualContribution: yearlyContribution,
      });
      totalContribution += yearlyContribution + employerMatch;
      yearlyContribution *= (1 + account.contributionGrowthRate);
    }

    totals[account.id] = totalContribution;
  });

  return totals;
}

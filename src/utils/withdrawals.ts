import {
  Account,
  Profile,
  Assumptions,
  AccumulationResult,
  RetirementResult,
  YearlyWithdrawal,
  getTaxTreatment,
  isTraditional,
} from '../types';
import {
  calculateTotalFederalTax,
  calculateStateTax,
  getStandardDeduction,
} from './taxes';
import { getRMDDivisor, RMD_START_AGE } from './constants';

interface AccountState {
  id: string;
  type: Account['type'];
  balance: number;
  costBasis: number; // For taxable accounts, tracks original investment
}

/**
 * Calculate Required Minimum Distribution for traditional accounts
 */
function calculateRMD(age: number, traditionalBalance: number): number {
  if (age < RMD_START_AGE) return 0;
  const divisor = getRMDDivisor(age);
  if (divisor <= 0) return 0;
  return traditionalBalance / divisor;
}

/**
 * Simulate retirement withdrawals with tax-optimized strategy
 */
export function calculateWithdrawals(
  accounts: Account[],
  profile: Profile,
  assumptions: Assumptions,
  accumulationResult: AccumulationResult
): RetirementResult {
  const retirementYears = profile.lifeExpectancy - profile.retirementAge;
  const currentYear = new Date().getFullYear();
  const retirementStartYear = currentYear + (profile.retirementAge - profile.currentAge);

  // Initialize account states with final balances from accumulation
  const accountStates: AccountState[] = accounts.map(account => ({
    id: account.id,
    type: account.type,
    balance: accumulationResult.finalBalances[account.id] || 0,
    // For taxable accounts, estimate cost basis as original balance + contributions
    // (simplified: assume 50% of balance is gains)
    costBasis: getTaxTreatment(account.type) === 'taxable'
      ? (accumulationResult.finalBalances[account.id] || 0) * 0.5
      : 0,
  }));

  // Calculate initial target spending based on safe withdrawal rate
  const totalPortfolio = accumulationResult.totalAtRetirement;
  let targetSpending = totalPortfolio * assumptions.safeWithdrawalRate;

  const yearlyWithdrawals: YearlyWithdrawal[] = [];
  let lifetimeTaxesPaid = 0;
  let portfolioDepletionAge: number | null = null;
  const accountDepletionAges: Record<string, number | null> = {};

  accounts.forEach(account => {
    accountDepletionAges[account.id] = null;
  });

  for (let i = 0; i <= retirementYears; i++) {
    const age = profile.retirementAge + i;
    const year = retirementStartYear + i;

    // Check if portfolio is depleted
    const totalRemaining = accountStates.reduce((sum, acc) => sum + acc.balance, 0);
    if (totalRemaining <= 0 && portfolioDepletionAge === null) {
      portfolioDepletionAge = age;
    }

    // Calculate Social Security income
    let socialSecurityIncome = 0;
    if (
      profile.socialSecurityBenefit &&
      profile.socialSecurityStartAge &&
      age >= profile.socialSecurityStartAge
    ) {
      // Adjust SS for inflation from today to that year
      const yearsFromNow = age - profile.currentAge;
      socialSecurityIncome = profile.socialSecurityBenefit *
        Math.pow(1 + assumptions.inflationRate, yearsFromNow);
    }

    // Calculate RMD for traditional accounts
    const traditionalBalance = accountStates
      .filter(acc => isTraditional(acc.type))
      .reduce((sum, acc) => sum + acc.balance, 0);
    const rmdAmount = calculateRMD(age, traditionalBalance);

    // Tax-optimized withdrawal strategy
    const withdrawals = performTaxOptimizedWithdrawal(
      accountStates,
      targetSpending,
      rmdAmount,
      socialSecurityIncome,
      profile,
      accountDepletionAges,
      age
    );

    // Apply investment returns to remaining balances
    accountStates.forEach(acc => {
      acc.balance *= (1 + assumptions.retirementReturnRate);
    });

    // Calculate taxes
    const ordinaryIncome = withdrawals.traditionalWithdrawal + socialSecurityIncome * 0.85; // 85% of SS taxable
    const capitalGains = withdrawals.taxableGains;

    const federalTax = calculateTotalFederalTax(
      ordinaryIncome,
      capitalGains,
      profile.filingStatus
    );
    const stateTax = calculateStateTax(
      ordinaryIncome + capitalGains - getStandardDeduction(profile.filingStatus),
      profile.stateTaxRate
    );
    const totalTax = federalTax + stateTax;
    lifetimeTaxesPaid += totalTax;

    const grossWithdrawal = withdrawals.total;
    const grossIncome = grossWithdrawal + socialSecurityIncome;
    const afterTaxIncome = grossIncome - totalTax;

    // Record the year's data
    const remainingBalances: Record<string, number> = {};
    accountStates.forEach(acc => {
      remainingBalances[acc.id] = acc.balance;
    });

    yearlyWithdrawals.push({
      age,
      year,
      withdrawals: withdrawals.byAccount,
      remainingBalances,
      totalWithdrawal: grossWithdrawal,
      socialSecurityIncome,
      grossIncome,
      federalTax,
      stateTax,
      totalTax,
      afterTaxIncome,
      targetSpending,
      rmdAmount,
      totalRemainingBalance: accountStates.reduce((sum, acc) => sum + acc.balance, 0),
    });

    // Inflate target spending for next year
    targetSpending *= (1 + assumptions.inflationRate);
  }

  // Calculate sustainable withdrawal amounts in today's dollars
  const sustainableAnnualWithdrawal = totalPortfolio * assumptions.safeWithdrawalRate;
  const sustainableMonthlyWithdrawal = sustainableAnnualWithdrawal / 12;

  return {
    yearlyWithdrawals,
    portfolioDepletionAge,
    lifetimeTaxesPaid,
    sustainableMonthlyWithdrawal,
    sustainableAnnualWithdrawal,
    accountDepletionAges,
  };
}

interface WithdrawalResult {
  total: number;
  traditionalWithdrawal: number;
  rothWithdrawal: number;
  taxableWithdrawal: number;
  taxableGains: number;
  hsaWithdrawal: number;
  byAccount: Record<string, number>;
}

/**
 * Perform tax-optimized withdrawal strategy:
 * 1. Take required RMDs from traditional accounts
 * 2. Fill low tax brackets with additional traditional withdrawals
 * 3. Use Roth for remaining needs (tax-free)
 * 4. Use taxable if more is needed
 */
function performTaxOptimizedWithdrawal(
  accountStates: AccountState[],
  targetSpending: number,
  rmdAmount: number,
  socialSecurityIncome: number,
  profile: Profile,
  accountDepletionAges: Record<string, number | null>,
  age: number
): WithdrawalResult {
  const result: WithdrawalResult = {
    total: 0,
    traditionalWithdrawal: 0,
    rothWithdrawal: 0,
    taxableWithdrawal: 0,
    taxableGains: 0,
    hsaWithdrawal: 0,
    byAccount: {},
  };

  accountStates.forEach(acc => {
    result.byAccount[acc.id] = 0;
  });

  // How much do we need after Social Security?
  let remainingNeed = Math.max(0, targetSpending - socialSecurityIncome);

  // Get account groups
  const traditionalAccounts = accountStates.filter(acc => isTraditional(acc.type));
  const rothAccounts = accountStates.filter(acc =>
    getTaxTreatment(acc.type) === 'roth'
  );
  const taxableAccounts = accountStates.filter(acc =>
    getTaxTreatment(acc.type) === 'taxable'
  );
  const hsaAccounts = accountStates.filter(acc =>
    getTaxTreatment(acc.type) === 'hsa'
  );

  // Step 1: Take RMDs from traditional accounts (required)
  let rmdRemaining = rmdAmount;
  for (const acc of traditionalAccounts) {
    if (rmdRemaining <= 0) break;
    const withdrawal = Math.min(rmdRemaining, acc.balance);
    acc.balance -= withdrawal;
    result.byAccount[acc.id] += withdrawal;
    result.traditionalWithdrawal += withdrawal;
    result.total += withdrawal;
    rmdRemaining -= withdrawal;
    remainingNeed = Math.max(0, remainingNeed - withdrawal);

    if (acc.balance <= 0 && accountDepletionAges[acc.id] === null) {
      accountDepletionAges[acc.id] = age;
    }
  }

  // Step 2: Fill up to 12% bracket with additional traditional withdrawals
  // (Standard deduction + 12% bracket gives good tax efficiency)
  const standardDeduction = getStandardDeduction(profile.filingStatus);
  const bracket12Max = profile.filingStatus === 'married_filing_jointly' ? 94300 : 47150;
  const targetOrdinaryIncome = standardDeduction + bracket12Max;
  const currentOrdinaryIncome = result.traditionalWithdrawal + socialSecurityIncome * 0.85;
  const roomIn12Bracket = Math.max(0, targetOrdinaryIncome - currentOrdinaryIncome);

  // Withdraw additional from traditional if we have room and need the money
  const additionalTraditional = Math.min(roomIn12Bracket, remainingNeed);
  let additionalRemaining = additionalTraditional;

  for (const acc of traditionalAccounts) {
    if (additionalRemaining <= 0) break;
    const withdrawal = Math.min(additionalRemaining, acc.balance);
    acc.balance -= withdrawal;
    result.byAccount[acc.id] += withdrawal;
    result.traditionalWithdrawal += withdrawal;
    result.total += withdrawal;
    additionalRemaining -= withdrawal;
    remainingNeed -= withdrawal;

    if (acc.balance <= 0 && accountDepletionAges[acc.id] === null) {
      accountDepletionAges[acc.id] = age;
    }
  }

  // Step 3: Use Roth accounts for remaining needs (tax-free)
  for (const acc of rothAccounts) {
    if (remainingNeed <= 0) break;
    const withdrawal = Math.min(remainingNeed, acc.balance);
    acc.balance -= withdrawal;
    result.byAccount[acc.id] += withdrawal;
    result.rothWithdrawal += withdrawal;
    result.total += withdrawal;
    remainingNeed -= withdrawal;

    if (acc.balance <= 0 && accountDepletionAges[acc.id] === null) {
      accountDepletionAges[acc.id] = age;
    }
  }

  // Step 4: Use taxable accounts if still need more
  for (const acc of taxableAccounts) {
    if (remainingNeed <= 0) break;
    const withdrawal = Math.min(remainingNeed, acc.balance);

    // Calculate gains portion (simplified: proportional to balance vs cost basis)
    const gainRatio = acc.costBasis > 0 ? Math.max(0, 1 - acc.costBasis / acc.balance) : 0.5;
    const gains = withdrawal * gainRatio;

    acc.balance -= withdrawal;
    // Reduce cost basis proportionally
    if (acc.balance > 0) {
      acc.costBasis *= (acc.balance / (acc.balance + withdrawal));
    } else {
      acc.costBasis = 0;
    }

    result.byAccount[acc.id] += withdrawal;
    result.taxableWithdrawal += withdrawal;
    result.taxableGains += gains;
    result.total += withdrawal;
    remainingNeed -= withdrawal;

    if (acc.balance <= 0 && accountDepletionAges[acc.id] === null) {
      accountDepletionAges[acc.id] = age;
    }
  }

  // Step 5: Use HSA as last resort (treat as tax-free for medical)
  for (const acc of hsaAccounts) {
    if (remainingNeed <= 0) break;
    const withdrawal = Math.min(remainingNeed, acc.balance);
    acc.balance -= withdrawal;
    result.byAccount[acc.id] += withdrawal;
    result.hsaWithdrawal += withdrawal;
    result.total += withdrawal;
    remainingNeed -= withdrawal;

    if (acc.balance <= 0 && accountDepletionAges[acc.id] === null) {
      accountDepletionAges[acc.id] = age;
    }
  }

  return result;
}

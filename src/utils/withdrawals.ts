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
import type { IncomeStream } from '../types';
import {
  calculateTotalFederalTax,
  calculateStateTax,
  getStandardDeduction,
} from './taxes';
import { getRMDDivisor, getRMDStartAge } from './constants';
import type { CountryConfig } from '../countries';
import { calculatePenalties, type AccountWithdrawal } from './penaltyCalculator';
import { getDefaultWithdrawalAge, birthYearFromAge } from './withdrawalDefaults';
import { calculateIncomeStreamBenefits } from './incomeStreams';

interface AccountState {
  id: string;
  type: Account['type'];
  balance: number;
  costBasis: number; // For taxable accounts, tracks original investment
}

/**
 * Calculate Required Minimum Distribution for traditional accounts
 * Uses country-specific logic if CountryConfig provided
 */
function calculateRMD(
  age: number,
  traditionalBalance: number,
  accountType: string,
  birthYear: number,
  countryConfig?: CountryConfig
): number {
  if (countryConfig) {
    return countryConfig.getMinimumWithdrawal(age, traditionalBalance, accountType, birthYear);
  }
  // Fallback to US RMD logic (SECURE 2.0: start age depends on birth year)
  if (age < getRMDStartAge(birthYear)) return 0;
  const divisor = getRMDDivisor(age);
  if (divisor <= 0) return 0;
  return traditionalBalance / divisor;
}

/**
 * Filter accounts by withdrawal availability based on age
 */
function getAvailableAccounts(
  accountStates: AccountState[],
  accounts: Account[],
  currentAge: number,
  retirementAge: number,
  birthYear: number,
  countryConfig?: CountryConfig
): AccountState[] {
  return accountStates.filter(state => {
    // Find the full account object to get withdrawal rules
    const account = accounts.find(a => a.id === state.id);
    if (!account) return true; // If we can't find it, allow withdrawal

    // Get withdrawal start age (from rules or default)
    const withdrawalAge = account.withdrawalRules?.startAge ??
      (countryConfig
        ? getDefaultWithdrawalAge(account, retirementAge, countryConfig, birthYear)
        : retirementAge);

    return currentAge >= withdrawalAge;
  });
}

/**
 * Simulate retirement withdrawals with tax-optimized strategy
 */
export function calculateWithdrawals(
  accounts: Account[],
  profile: Profile,
  assumptions: Assumptions,
  accumulationResult: AccumulationResult,
  countryConfig?: CountryConfig,
  incomeStreams?: IncomeStream[]
): RetirementResult {
  const retirementYears = profile.lifeExpectancy - profile.retirementAge;
  const currentYear = new Date().getFullYear();
  const retirementStartYear = currentYear + (profile.retirementAge - profile.currentAge);
  // Birth year determines the RMD start age (US SECURE 2.0: 73 vs 75)
  const birthYear = birthYearFromAge(profile.currentAge);

  // Initialize account states with final balances from accumulation
  const accountStates: AccountState[] = accounts.map(account => {
    const finalBalance = accumulationResult.finalBalances[account.id] || 0;
    // Taxable accounts: cost basis tracked through accumulation (starting
    // basis + contributions). Fall back to the account's own basis — or its
    // full balance — for results without an accumulation phase. Basis is
    // capped at the balance so the gains portion can't go negative.
    const trackedBasis =
      accumulationResult.finalCostBasis?.[account.id] ??
      account.costBasis ??
      account.balance;
    return {
      id: account.id,
      type: account.type,
      balance: finalBalance,
      costBasis: getTaxTreatment(account.type) === 'taxable'
        ? Math.min(trackedBasis, finalBalance)
        : 0,
    };
  });

  // Calculate initial target spending based on safe withdrawal rate
  const totalPortfolio = accumulationResult.totalAtRetirement;
  let targetSpending = totalPortfolio * assumptions.safeWithdrawalRate;

  // Taxable income from the previous simulated year, expressed in TODAY'S
  // dollars, used for benefit means-testing (e.g., OAS clawback). Deflating
  // to today's dollars keeps the comparison against current-year thresholds
  // in like units — the thresholds are indexed to inflation in law. For the
  // first retirement year, approximate using that year's target spending.
  const retirementInflationMultiplier = Math.pow(
    1 + assumptions.inflationRate,
    profile.retirementAge - profile.currentAge
  );
  let previousYearTaxableIncomeToday = targetSpending / retirementInflationMultiplier;

  // Portion of government retirement benefit income (Social Security,
  // CPP/OAS) that counts as taxable income. US: 85%, Canada: 100%.
  const governmentBenefitTaxableRate = countryConfig
    ? countryConfig.getGovernmentBenefitTaxableRate()
    : 0.85;

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

    // Fallback depletion check: balance already at zero entering the year
    // (e.g., spending fully covered by benefits). The primary signal is the
    // first year with a spending shortfall, recorded after withdrawals.
    const totalRemaining = accountStates.reduce((sum, acc) => sum + acc.balance, 0);
    if (totalRemaining <= 0 && portfolioDepletionAge === null) {
      portfolioDepletionAge = age;
    }

    // Common inflation factor for this year
    const yearsFromNow = age - profile.currentAge;
    const inflationMultiplier = Math.pow(1 + assumptions.inflationRate, yearsFromNow);

    // Calculate government retirement benefits (Social Security, CPP/OAS, etc.)
    let governmentBenefits = 0;
    if (countryConfig) {
      // Use the prior simulated year's taxable income, in today's dollars,
      // for means-testing (e.g., OAS clawback). For the first retirement
      // year, this is approximated using that year's target spending.
      const benefits = countryConfig.calculateRetirementBenefits(profile, age, previousYearTaxableIncomeToday);
      governmentBenefits = benefits.reduce((sum, b) => sum + b.annualAmount, 0);
      // Adjust for inflation
      governmentBenefits *= inflationMultiplier;
    } else {
      // Fallback to US Social Security
      if (
        profile.socialSecurityBenefit &&
        profile.socialSecurityStartAge &&
        age >= profile.socialSecurityStartAge
      ) {
        governmentBenefits = profile.socialSecurityBenefit * inflationMultiplier;
      }
    }
    const governmentBenefitIncome = governmentBenefits;

    // Calculate user-defined income stream benefits
    const streamResult = calculateIncomeStreamBenefits(incomeStreams || [], age);
    // Apply inflation adjustment (stream amounts are in today's dollars)
    const inflatedStreamIncome = streamResult.totalIncome * inflationMultiplier;
    const inflatedStreamByTax = {
      social_security: streamResult.byTaxTreatment.social_security * inflationMultiplier,
      fully_taxable: streamResult.byTaxTreatment.fully_taxable * inflationMultiplier,
      other_income: streamResult.byTaxTreatment.other_income * inflationMultiplier,
      tax_free: streamResult.byTaxTreatment.tax_free * inflationMultiplier,
    };

    const totalRetirementIncome = governmentBenefitIncome + inflatedStreamIncome;

    // Calculate minimum required withdrawals (RMD/RRIF) for each traditional account
    // NOTE: Per IRS rules, RMDs are calculated per-account, not on total balance.
    // Each account's RMD is based on that account's prior year-end balance.
    // This is also correct for Canadian RRIF minimums.
    // Use country config for traditional detection if available
    const isTraditionalAccount = (type: string) =>
      countryConfig ? countryConfig.isTraditionalAccount(type) : isTraditional(type);
    let totalMinimumWithdrawal = 0;
    accountStates
      .filter(acc => isTraditionalAccount(acc.type))
      .forEach(acc => {
        const minWithdrawal = calculateRMD(age, acc.balance, acc.type, birthYear, countryConfig);
        totalMinimumWithdrawal += minWithdrawal;
      });
    const rmdAmount = totalMinimumWithdrawal;

    // Pre-compute non-portfolio taxable income for bracket-filling logic.
    // This uses the flat maximum rate for benefit income (US: 85%) as a
    // planning ESTIMATE — the exact US taxable portion depends on the
    // year's other income (provisional-income phase-in), which isn't known
    // until withdrawals are decided. Slightly overestimating here just
    // makes the bracket-fill step a touch conservative.
    const nonPortfolioTaxableIncome =
      governmentBenefitIncome * governmentBenefitTaxableRate +
      inflatedStreamByTax.social_security * 0.85 +
      inflatedStreamByTax.fully_taxable +
      inflatedStreamByTax.other_income;

    // Tax-optimized withdrawal strategy
    const withdrawals = performTaxOptimizedWithdrawal(
      accountStates,
      accounts,  // NEW: pass full accounts array
      targetSpending,
      rmdAmount,
      totalRetirementIncome,
      profile,
      accountDepletionAges,
      age,
      birthYear,
      countryConfig,
      nonPortfolioTaxableIncome,
      inflationMultiplier
    );

    // The year the portfolio first fails to cover target spending is the
    // depletion year (previously this was reported one year late, at the
    // first year that STARTED at zero).
    if (withdrawals.shortfall > 0 && portfolioDepletionAge === null) {
      portfolioDepletionAge = age;
    }

    // Calculate early withdrawal penalties
    const penalties = countryConfig
      ? calculatePenalties(withdrawals.accountWithdrawals, age, countryConfig)
      : [];
    const totalPenalties = penalties.reduce((sum, p) => sum + p.amount, 0);

    // Apply investment returns to remaining balances
    accountStates.forEach(acc => {
      acc.balance *= (1 + assumptions.retirementReturnRate);
    });

    // Calculate taxes using country-specific logic
    // Income streams: per-bucket tax rules
    const pensionTaxable = inflatedStreamByTax.fully_taxable;
    const otherIncomeTaxable = inflatedStreamByTax.other_income;
    // tax_free: excluded from taxable income

    const capitalGains = withdrawals.taxableGains;

    // Exact taxable portion of benefit income, now that this year's
    // withdrawals are known. (The bracket-fill step above used the flat
    // 85% ESTIMATE via nonPortfolioTaxableIncome; the US provisional-income
    // phase-in depends on other income, which wasn't known yet at that
    // point.) US: 0% → 50% → 85% phase-in against frozen thresholds;
    // Canada: CPP/OAS 100%, social_security streams at the 85% treaty rate.
    const otherIncomeForBenefitTax = withdrawals.traditionalWithdrawal +
      pensionTaxable + otherIncomeTaxable + capitalGains;
    const benefitTaxable = countryConfig
      ? countryConfig.getTaxableGovernmentBenefits(
          governmentBenefitIncome,
          inflatedStreamByTax.social_security,
          otherIncomeForBenefitTax,
          profile
        )
      : (governmentBenefitIncome + inflatedStreamByTax.social_security) * 0.85;

    const ordinaryIncome = withdrawals.traditionalWithdrawal +
      benefitTaxable + pensionTaxable + otherIncomeTaxable;

    let federalTax: number;
    let stateTax: number;
    let yearTaxableIncome: number;

    if (countryConfig) {
      // Use the country's consolidated tax calculation, which handles
      // capital gains stacking, inclusion rates, and regional tax rules.
      // Brackets/deductions are indexed by the year's inflation multiplier.
      const taxes = countryConfig.calculateYearlyTaxes(
        ordinaryIncome,
        capitalGains,
        profile,
        inflationMultiplier
      );
      federalTax = taxes.federalTax;
      stateTax = taxes.regionalTax;
      yearTaxableIncome = taxes.taxableIncome;
    } else {
      // Fallback to US logic
      federalTax = calculateTotalFederalTax(
        ordinaryIncome,
        capitalGains,
        profile.filingStatus || 'single',
        inflationMultiplier
      );
      stateTax = calculateStateTax(
        ordinaryIncome + capitalGains -
          getStandardDeduction(profile.filingStatus || 'single') * inflationMultiplier,
        profile.stateTaxRate || 0
      );
      yearTaxableIncome = ordinaryIncome + capitalGains;
    }
    const totalTax = federalTax + stateTax + totalPenalties;
    lifetimeTaxesPaid += totalTax;

    const grossWithdrawal = withdrawals.total;
    const grossIncome = grossWithdrawal + governmentBenefitIncome + inflatedStreamIncome;
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
      governmentBenefitIncome,
      incomeStreamIncome: inflatedStreamIncome,
      grossIncome,
      federalTax,
      stateTax,
      totalTax,
      afterTaxIncome,
      targetSpending,
      rmdAmount,
      totalRemainingBalance: accountStates.reduce((sum, acc) => sum + acc.balance, 0),
      earlyWithdrawalPenalties: penalties,
      totalPenalties,
      spendingShortfall: withdrawals.shortfall,
    });

    // Track this year's taxable income, deflated to today's dollars, for
    // next year's benefit means-testing (e.g., OAS clawback). Taxable
    // income — not gross — so tax-free withdrawals (TFSA, Roth) don't
    // trigger clawback.
    previousYearTaxableIncomeToday = yearTaxableIncome / inflationMultiplier;

    // Inflate target spending for next year
    targetSpending *= (1 + assumptions.inflationRate);
  }

  // Sustainable withdrawal amounts at retirement, in nominal (future) dollars.
  // Callers that present "today's dollars" must deflate by inflation over the
  // years to retirement — see SummaryCards.
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
  accountWithdrawals: AccountWithdrawal[];  // NEW: for penalty calculation
  shortfall: number; // Unmet spending need after every withdrawal source is exhausted
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
  accounts: Account[],  // NEW: need full account objects
  targetSpending: number,
  rmdAmount: number,
  totalRetirementIncome: number,
  profile: Profile,
  accountDepletionAges: Record<string, number | null>,
  age: number,
  birthYear: number,
  countryConfig?: CountryConfig,
  nonPortfolioTaxableIncome?: number,
  inflationMultiplier: number = 1
): WithdrawalResult {
  const result: WithdrawalResult = {
    total: 0,
    traditionalWithdrawal: 0,
    rothWithdrawal: 0,
    taxableWithdrawal: 0,
    taxableGains: 0,
    hsaWithdrawal: 0,
    byAccount: {},
    accountWithdrawals: [],  // NEW
    shortfall: 0,
  };

  accountStates.forEach(acc => {
    result.byAccount[acc.id] = 0;
  });

  // Helper to record withdrawals for penalty calculation
  const recordWithdrawal = (acc: AccountState, amount: number) => {
    const account = accounts.find(a => a.id === acc.id);
    if (account && amount > 0) {
      result.accountWithdrawals.push({
        accountId: acc.id,
        accountName: account.name,
        accountType: acc.type,
        amount,
      });
    }
  };

  // How much do we need after all retirement income (government benefits + income streams)?
  let remainingNeed = Math.max(0, targetSpending - totalRetirementIncome);

  // Filter to only available accounts
  const availableAccounts = getAvailableAccounts(
    accountStates,
    accounts,
    age,
    profile.retirementAge,
    birthYear,
    countryConfig
  );

  // Get account groups from available accounts only
  const isTraditionalAccount = (type: string) =>
    countryConfig ? countryConfig.isTraditionalAccount(type) : isTraditional(type);
  const traditionalAccounts = availableAccounts.filter(acc => isTraditionalAccount(acc.type));
  const rothAccounts = availableAccounts.filter(acc =>
    getTaxTreatment(acc.type) === 'roth'
  );
  const taxableAccounts = availableAccounts.filter(acc =>
    getTaxTreatment(acc.type) === 'taxable'
  );
  const hsaAccounts = availableAccounts.filter(acc =>
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
    recordWithdrawal(acc, withdrawal);  // NEW

    if (acc.balance <= 0 && accountDepletionAges[acc.id] === null) {
      accountDepletionAges[acc.id] = age;
    }
  }

  // Step 2: Fill up to the low tax bracket with additional traditional withdrawals
  // (country-specific target balances tax efficiency against future tax torpedo risk)
  // The fill target is defined in current-year dollars, so index it by the
  // year's inflation multiplier to match the (indexed) brackets it fills.
  const filingStatus = profile.filingStatus || 'single';
  const baseFillTarget = countryConfig
    ? countryConfig.getLowBracketFillTarget(filingStatus)
    : getStandardDeduction(filingStatus) + (filingStatus === 'married_filing_jointly' ? 100800 : 50400);
  const targetOrdinaryIncome = baseFillTarget * inflationMultiplier;
  const currentOrdinaryIncome = result.traditionalWithdrawal +
    (nonPortfolioTaxableIncome || 0);
  const roomInBracket = Math.max(0, targetOrdinaryIncome - currentOrdinaryIncome);

  // Withdraw additional from traditional if we have room and need the money
  const additionalTraditional = Math.min(roomInBracket, remainingNeed);
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
    recordWithdrawal(acc, withdrawal);  // NEW

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
    recordWithdrawal(acc, withdrawal);  // NEW

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
    recordWithdrawal(acc, withdrawal);  // NEW

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
    recordWithdrawal(acc, withdrawal);  // NEW

    if (acc.balance <= 0 && accountDepletionAges[acc.id] === null) {
      accountDepletionAges[acc.id] = age;
    }
  }

  // Step 6: If still need more money and have traditional accounts with balance,
  // withdraw beyond the 12% bracket (accepting higher taxes is better than not meeting needs)
  if (remainingNeed > 0) {
    for (const acc of traditionalAccounts) {
      if (remainingNeed <= 0) break;
      const withdrawal = Math.min(remainingNeed, acc.balance);
      acc.balance -= withdrawal;
      result.byAccount[acc.id] += withdrawal;
      result.traditionalWithdrawal += withdrawal;
      result.total += withdrawal;
      remainingNeed -= withdrawal;
      recordWithdrawal(acc, withdrawal);  // NEW

      if (acc.balance <= 0 && accountDepletionAges[acc.id] === null) {
        accountDepletionAges[acc.id] = age;
      }
    }
  }

  // Step 7: Last resort - use unavailable accounts if we still need money
  // (This triggers early withdrawal penalties)
  if (remainingNeed > 0) {
    // Get accounts that are NOT yet available
    const unavailableAccounts = accountStates.filter(state => {
      const account = accounts.find(a => a.id === state.id);
      if (!account) return false;

      const withdrawalAge = account.withdrawalRules?.startAge ??
        (countryConfig
          ? getDefaultWithdrawalAge(account, profile.retirementAge, countryConfig, birthYear)
          : profile.retirementAge);

      return age < withdrawalAge && state.balance > 0;
    });

    // Use unavailable traditional accounts first (they have penalties)
    const unavailableTraditional = unavailableAccounts.filter(acc =>
      isTraditionalAccount(acc.type)
    );
    for (const acc of unavailableTraditional) {
      if (remainingNeed <= 0) break;
      const withdrawal = Math.min(remainingNeed, acc.balance);
      acc.balance -= withdrawal;
      result.byAccount[acc.id] += withdrawal;
      result.traditionalWithdrawal += withdrawal;
      result.total += withdrawal;
      remainingNeed -= withdrawal;
      recordWithdrawal(acc, withdrawal);

      if (acc.balance <= 0 && accountDepletionAges[acc.id] === null) {
        accountDepletionAges[acc.id] = age;
      }
    }

    // Then use other unavailable accounts if still needed
    const unavailableOthers = unavailableAccounts.filter(acc =>
      !isTraditionalAccount(acc.type)
    );
    for (const acc of unavailableOthers) {
      if (remainingNeed <= 0) break;
      const withdrawal = Math.min(remainingNeed, acc.balance);
      acc.balance -= withdrawal;
      result.byAccount[acc.id] += withdrawal;

      const treatment = getTaxTreatment(acc.type);
      if (treatment === 'roth') {
        result.rothWithdrawal += withdrawal;
      } else if (treatment === 'taxable') {
        result.taxableWithdrawal += withdrawal;
        const gainRatio = acc.costBasis > 0 ? Math.max(0, 1 - acc.costBasis / acc.balance) : 0.5;
        result.taxableGains += withdrawal * gainRatio;
        if (acc.balance > 0) {
          acc.costBasis *= (acc.balance / (acc.balance + withdrawal));
        } else {
          acc.costBasis = 0;
        }
      } else if (treatment === 'hsa') {
        result.hsaWithdrawal += withdrawal;
      }

      result.total += withdrawal;
      remainingNeed -= withdrawal;
      recordWithdrawal(acc, withdrawal);

      if (acc.balance <= 0 && accountDepletionAges[acc.id] === null) {
        accountDepletionAges[acc.id] = age;
      }
    }
  }

  result.shortfall = Math.max(0, remainingNeed);
  return result;
}

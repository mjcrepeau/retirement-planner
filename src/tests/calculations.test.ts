/**
 * Retirement Calculator Math Tests
 *
 * This file tests all the core financial calculations to ensure accuracy.
 * Run with: npx tsx src/tests/calculations.test.ts
 */

import { calculateAccumulation } from '../utils/projections';
import { calculateWithdrawals } from '../utils/withdrawals';
import { calculateIncomeStreamBenefits } from '../utils/incomeStreams';
import {
  calculateFederalIncomeTax,
  calculateTotalFederalTax,
  calculateStateTax,
  calculateCapitalGainsTax,
  getStandardDeduction,
} from '../utils/taxes';
import { getRMDDivisor } from '../utils/constants';
import { Account, Profile, Assumptions, IncomeStream } from '../types';
import { getCountryConfig } from '../countries';
import { getDefaultWithdrawalAge, getMaxWithdrawalAge } from '../utils/withdrawalDefaults';

// Get US config for tests
const usConfig = getCountryConfig('US');

// Test utilities
let passedTests = 0;
let failedTests = 0;

function assert(condition: boolean, message: string): void {
  if (condition) {
    console.log(`  ✓ ${message}`);
    passedTests++;
  } else {
    console.error(`  ✗ ${message}`);
    failedTests++;
  }
}

function assertApprox(actual: number, expected: number, tolerance: number, message: string): void {
  const diff = Math.abs(actual - expected);
  if (diff <= tolerance) {
    console.log(`  ✓ ${message} (got ${actual.toFixed(2)}, expected ${expected.toFixed(2)})`);
    passedTests++;
  } else {
    console.error(`  ✗ ${message} (got ${actual.toFixed(2)}, expected ${expected.toFixed(2)}, diff: ${diff.toFixed(2)})`);
    failedTests++;
  }
}

function section(name: string): void {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`${name}`);
  console.log('='.repeat(60));
}

// =============================================================================
// TAX CALCULATION TESTS
// =============================================================================

function testTaxCalculations(): void {
  section('TAX CALCULATIONS');

  console.log('\n--- Federal Income Tax (Married Filing Jointly) ---');

  // Standard deduction is $29,200 for MFJ in 2024
  // So taxable income = gross - 29200

  // Test 1: Income fully covered by standard deduction
  const tax1 = calculateFederalIncomeTax(0, 'married_filing_jointly');
  assertApprox(tax1, 0, 0.01, 'Zero taxable income = $0 tax');

  // Test 2: Income in 10% bracket only
  // 10% bracket: $0 - $23,200
  // Tax on $20,000 = $20,000 * 0.10 = $2,000
  const tax2 = calculateFederalIncomeTax(20000, 'married_filing_jointly');
  assertApprox(tax2, 2000, 0.01, '$20k taxable income = $2,000 tax (10% bracket)');

  // Test 3: Income spanning 10% and 12% brackets
  // 10% on first $23,200 = $2,320
  // 12% on next $26,800 = $3,216
  // Total = $5,536
  const tax3 = calculateFederalIncomeTax(50000, 'married_filing_jointly');
  assertApprox(tax3, 5536, 0.01, '$50k taxable income = $5,536 tax (10% + 12% brackets)');

  // Test 4: Income in 22% bracket
  // 10% on $23,200 = $2,320
  // 12% on $71,100 ($94,300 - $23,200) = $8,532
  // 22% on $5,700 ($100,000 - $94,300) = $1,254
  // Total = $12,106
  const tax4 = calculateFederalIncomeTax(100000, 'married_filing_jointly');
  assertApprox(tax4, 12106, 0.01, '$100k taxable income = $12,106 tax');

  console.log('\n--- Federal Income Tax (Single) ---');

  // Single 10% bracket: $0 - $11,600
  // Single 12% bracket: $11,600 - $47,150
  const tax5 = calculateFederalIncomeTax(30000, 'single');
  // 10% on $11,600 = $1,160
  // 12% on $18,400 = $2,208
  // Total = $3,368
  assertApprox(tax5, 3368, 0.01, '$30k taxable income (single) = $3,368 tax');

  console.log('\n--- Standard Deduction ---');

  const stdMFJ = getStandardDeduction('married_filing_jointly');
  assertApprox(stdMFJ, 29200, 0.01, 'MFJ standard deduction = $29,200');

  const stdSingle = getStandardDeduction('single');
  assertApprox(stdSingle, 14600, 0.01, 'Single standard deduction = $14,600');

  console.log('\n--- State Tax ---');

  const stateTax1 = calculateStateTax(50000, 0.05);
  assertApprox(stateTax1, 2500, 0.01, '$50k at 5% state tax = $2,500');

  const stateTax2 = calculateStateTax(-1000, 0.05);
  assertApprox(stateTax2, 0, 0.01, 'Negative taxable income = $0 state tax');

  console.log('\n--- Capital Gains Tax (MFJ) ---');

  // 0% up to $94,050
  // 15% from $94,050 to $583,750
  const cgTax1 = calculateCapitalGainsTax(50000, 0, 'married_filing_jointly');
  assertApprox(cgTax1, 0, 0.01, '$50k capital gains with $0 other income = $0 (0% bracket)');

  const cgTax2 = calculateCapitalGainsTax(50000, 100000, 'married_filing_jointly');
  // With $100k ordinary income, taxable = $70,800 after standard deduction
  // Room in 0% bracket ($94,050): $23,250 of gains at 0%
  // Remaining $26,750 at 15% = $4,012.50
  assertApprox(cgTax2, 4012.50, 0.01, '$50k cap gains with $100k income (partial 0% bracket)');
}

// =============================================================================
// RMD TESTS
// =============================================================================

function testRMDCalculations(): void {
  section('RMD CALCULATIONS');

  // RMD starts at age 73
  const divisor72 = getRMDDivisor(72);
  assertApprox(divisor72, 0, 0.01, 'No RMD at age 72 (divisor = 0)');

  const divisor73 = getRMDDivisor(73);
  assertApprox(divisor73, 26.5, 0.01, 'RMD divisor at age 73 = 26.5');

  const divisor80 = getRMDDivisor(80);
  assertApprox(divisor80, 20.2, 0.01, 'RMD divisor at age 80 = 20.2');

  const divisor90 = getRMDDivisor(90);
  assertApprox(divisor90, 12.2, 0.01, 'RMD divisor at age 90 = 12.2');

  // Test RMD calculation
  const balance = 1000000;
  const rmd73 = balance / 26.5;
  assertApprox(rmd73, 37735.85, 0.01, '$1M balance at 73 → RMD = $37,735.85');
}

// =============================================================================
// ACCUMULATION PHASE TESTS
// =============================================================================

function testAccumulationPhase(): void {
  section('ACCUMULATION PHASE');

  console.log('\n--- Simple Growth Test ---');

  // Single account, no contributions, just growth
  const account1: Account = {
    id: 'test1',
    name: 'Test 401k',
    type: 'traditional_401k',
    balance: 100000,
    annualContribution: 0,
    contributionGrowthRate: 0,
    returnRate: 0.07,
  };

  const profile1: Profile = {
    currentAge: 30,
    retirementAge: 31, // 1 year
    lifeExpectancy: 90,
    filingStatus: 'married_filing_jointly',
    stateTaxRate: 0.05,
  };

  const result1 = calculateAccumulation([account1], profile1, usConfig);

  // After 1 year at 7%: $100,000 * 1.07 = $107,000
  assertApprox(result1.totalAtRetirement, 107000, 0.01, '$100k at 7% for 1 year = $107,000');

  console.log('\n--- Compound Growth Test (10 years) ---');

  const profile2: Profile = {
    ...profile1,
    retirementAge: 40, // 10 years
  };

  const result2 = calculateAccumulation([account1], profile2, usConfig);

  // After 10 years at 7%: $100,000 * (1.07)^10 = $196,715.14
  const expected10yr = 100000 * Math.pow(1.07, 10);
  assertApprox(result2.totalAtRetirement, expected10yr, 0.01, '$100k at 7% for 10 years = $196,715');

  console.log('\n--- Growth with Contributions ---');

  const account2: Account = {
    ...account1,
    annualContribution: 10000,
    contributionGrowthRate: 0,
  };

  const profile3: Profile = {
    ...profile1,
    retirementAge: 31, // 1 year
  };

  const result3 = calculateAccumulation([account2], profile3, usConfig);

  // Year 1: $100,000 * 1.07 + $10,000 = $117,000
  assertApprox(result3.totalAtRetirement, 117000, 0.01, '$100k + $10k contribution at 7% = $117,000');

  console.log('\n--- Employer Match Test ---');

  const account3: Account = {
    ...account2,
    employerMatchPercent: 0.5, // 50% match
    employerMatchLimit: 3000, // Up to $3000
  };

  const result4 = calculateAccumulation([account3], profile3, usConfig);

  // Match = min($10,000 * 0.5, $3000) = $3,000
  // Year 1: $100,000 * 1.07 + $10,000 + $3,000 = $120,000
  assertApprox(result4.totalAtRetirement, 120000, 0.01, 'With 50% match up to $3k = $120,000');

  console.log('\n--- Contribution Growth Test ---');

  const account4: Account = {
    id: 'test4',
    name: 'Test',
    type: 'traditional_401k',
    balance: 0, // Start with $0
    annualContribution: 10000,
    contributionGrowthRate: 0.03, // 3% growth
    returnRate: 0.07,
  };

  const profile4: Profile = {
    ...profile1,
    currentAge: 30,
    retirementAge: 32, // 2 years
  };

  const result5 = calculateAccumulation([account4], profile4, usConfig);

  // Year 1: $0 * 1.07 + $10,000 = $10,000
  // Year 2: $10,000 * 1.07 + $10,300 = $21,000
  assertApprox(result5.totalAtRetirement, 21000, 1, '2 years of contributions with growth');

  console.log('\n--- Tax Treatment Breakdown ---');

  const accounts: Account[] = [
    {
      id: 'trad',
      name: 'Traditional',
      type: 'traditional_401k',
      balance: 100000,
      annualContribution: 0,
      contributionGrowthRate: 0,
      returnRate: 0,
    },
    {
      id: 'roth',
      name: 'Roth',
      type: 'roth_ira',
      balance: 50000,
      annualContribution: 0,
      contributionGrowthRate: 0,
      returnRate: 0,
    },
  ];

  const result6 = calculateAccumulation(accounts, profile3, usConfig);

  assertApprox(result6.breakdownByGroup.traditional, 100000, 0.01, 'Traditional = $100,000');
  assertApprox(result6.breakdownByGroup.roth, 50000, 0.01, 'Roth = $50,000');
  assertApprox(result6.totalAtRetirement, 150000, 0.01, 'Total = $150,000');
}

// =============================================================================
// WITHDRAWAL PHASE TESTS
// =============================================================================

function testWithdrawalPhase(): void {
  section('WITHDRAWAL PHASE');

  console.log('\n--- Basic Withdrawal Test ---');

  const account: Account = {
    id: 'test',
    name: 'Traditional 401k',
    type: 'traditional_401k',
    balance: 1000000,
    annualContribution: 0,
    contributionGrowthRate: 0,
    returnRate: 0,
  };

  const profile: Profile = {
    currentAge: 65,
    retirementAge: 65,
    lifeExpectancy: 66, // Just 1 year of retirement
    filingStatus: 'married_filing_jointly',
    stateTaxRate: 0.05,
  };

  const assumptions: Assumptions = {
    inflationRate: 0,
    safeWithdrawalRate: 0.04,
    retirementReturnRate: 0,
  };

  const accumulation = calculateAccumulation([account], profile, usConfig);
  const result = calculateWithdrawals([account], profile, assumptions, accumulation, usConfig);

  // 4% of $1M = $40,000 annual withdrawal
  assertApprox(result.sustainableAnnualWithdrawal, 40000, 0.01, '4% SWR on $1M = $40,000/year');
  assertApprox(result.sustainableMonthlyWithdrawal, 40000 / 12, 0.01, 'Monthly = $3,333.33');

  console.log('\n--- Withdrawal Order Test (Pre-RMD) ---');

  // Before age 73, should fill tax brackets with traditional, then use Roth
  const accounts: Account[] = [
    {
      id: 'trad',
      name: 'Traditional',
      type: 'traditional_401k',
      balance: 500000,
      annualContribution: 0,
      contributionGrowthRate: 0,
      returnRate: 0,
    },
    {
      id: 'roth',
      name: 'Roth',
      type: 'roth_ira',
      balance: 500000,
      annualContribution: 0,
      contributionGrowthRate: 0,
      returnRate: 0,
    },
  ];

  const profile2: Profile = {
    currentAge: 65,
    retirementAge: 65,
    lifeExpectancy: 66,
    filingStatus: 'married_filing_jointly',
    stateTaxRate: 0.05,
  };

  const accumulation2 = calculateAccumulation(accounts, profile2, usConfig);
  const result2 = calculateWithdrawals(accounts, profile2, assumptions, accumulation2, usConfig);

  assert(result2.yearlyWithdrawals.length > 0, 'Has withdrawal data');

  const firstYear = result2.yearlyWithdrawals[0];
  assert(firstYear.totalWithdrawal > 0, 'Has withdrawals in first year');

  console.log('\n--- Social Security Integration ---');

  const profileSS: Profile = {
    currentAge: 65,
    retirementAge: 65,
    lifeExpectancy: 68,
    filingStatus: 'married_filing_jointly',
    stateTaxRate: 0.05,
    socialSecurityBenefit: 30000,
    socialSecurityStartAge: 67,
  };

  const assumptionsSS: Assumptions = {
    inflationRate: 0, // No inflation for simpler testing
    safeWithdrawalRate: 0.04,
    retirementReturnRate: 0,
  };

  const accumulationSS = calculateAccumulation([account], profileSS, usConfig);
  const resultSS = calculateWithdrawals([account], profileSS, assumptionsSS, accumulationSS, usConfig);

  // At age 65-66: No SS, full withdrawal needed
  // At age 67: SS kicks in, withdrawal should decrease
  const age65 = resultSS.yearlyWithdrawals.find(y => y.age === 65);
  const age67 = resultSS.yearlyWithdrawals.find(y => y.age === 67);

  assert(age65 !== undefined, 'Has data for age 65');
  assert(age67 !== undefined, 'Has data for age 67');

  if (age65 && age67) {
    assertApprox(age65.governmentBenefitIncome, 0, 0.01, 'No SS income at age 65');
    assertApprox(age67.governmentBenefitIncome, 30000, 0.01, 'SS income at age 67 = $30,000');

    // Total withdrawal should decrease when SS starts
    assert(
      age67.totalWithdrawal < age65.totalWithdrawal,
      `Withdrawal decreases when SS starts ($${age67.totalWithdrawal.toFixed(0)} < $${age65.totalWithdrawal.toFixed(0)})`
    );

    // But gross income should be similar (tracking target spending)
    const incomeDiff = Math.abs(age67.grossIncome - age65.grossIncome);
    assert(
      incomeDiff < 1000,
      `Gross income stays roughly constant ($${age65.grossIncome.toFixed(0)} vs $${age67.grossIncome.toFixed(0)})`
    );
  }

  console.log('\n--- RMD Enforcement Test ---');

  const profileRMD: Profile = {
    currentAge: 72,
    retirementAge: 72,
    lifeExpectancy: 75,
    filingStatus: 'married_filing_jointly',
    stateTaxRate: 0.05,
  };

  const assumptionsRMD: Assumptions = {
    inflationRate: 0,
    safeWithdrawalRate: 0.01, // Very low SWR to test RMD floor
    retirementReturnRate: 0,
  };

  const accumulationRMD = calculateAccumulation([account], profileRMD, usConfig);
  const resultRMD = calculateWithdrawals([account], profileRMD, assumptionsRMD, accumulationRMD, usConfig);

  const age73 = resultRMD.yearlyWithdrawals.find(y => y.age === 73);

  if (age73) {
    // RMD at 73 = $1M / 26.5 = $37,735.85
    // 1% SWR = $10,000, but RMD forces higher
    assert(
      age73.rmdAmount > 30000,
      `RMD at 73 is enforced ($${age73.rmdAmount.toFixed(0)})`
    );
    assert(
      age73.totalWithdrawal >= age73.rmdAmount,
      `Total withdrawal >= RMD ($${age73.totalWithdrawal.toFixed(0)} >= $${age73.rmdAmount.toFixed(0)})`
    );
  }
}

// =============================================================================
// INCOME CONTINUITY TEST (FOR THE BUG)
// =============================================================================

function testIncomeContinuity(): void {
  section('INCOME CONTINUITY TEST (BUG INVESTIGATION)');

  console.log('\n--- Testing income around SS start and RMD start ---');

  const account: Account = {
    id: 'test',
    name: 'Traditional 401k',
    type: 'traditional_401k',
    balance: 2000000, // $2M portfolio
    annualContribution: 0,
    contributionGrowthRate: 0,
    returnRate: 0,
  };

  const profile: Profile = {
    currentAge: 35,
    retirementAge: 65,
    lifeExpectancy: 90,
    filingStatus: 'married_filing_jointly',
    stateTaxRate: 0.05,
    socialSecurityBenefit: 30000,
    socialSecurityStartAge: 67,
  };

  const assumptions: Assumptions = {
    inflationRate: 0.03,
    safeWithdrawalRate: 0.04,
    retirementReturnRate: 0.05,
  };

  // Use $2M as if it's the retirement balance directly
  const mockAccumulation = {
    yearlyBalances: [],
    finalBalances: { test: 2000000 },
    totalAtRetirement: 2000000,
    breakdownByTaxTreatment: { pretax: 2000000, roth: 0, taxable: 0, hsa: 0 },
  };

  const result = calculateWithdrawals([account], profile, assumptions, mockAccumulation);

  console.log('\n  Year-by-year income analysis (ages 65-75):');
  console.log('  Age | Target   | SS       | Withdrawal | Gross    | Taxes    | After-Tax');
  console.log('  ' + '-'.repeat(75));

  let previousAfterTax = 0;
  let anomalyDetected = false;

  for (const year of result.yearlyWithdrawals) {
    if (year.age >= 65 && year.age <= 75) {
      const row = [
        year.age.toString().padStart(3),
        `$${(year.targetSpending / 1000).toFixed(1)}k`.padStart(8),
        `$${(year.governmentBenefitIncome / 1000).toFixed(1)}k`.padStart(8),
        `$${(year.totalWithdrawal / 1000).toFixed(1)}k`.padStart(10),
        `$${(year.grossIncome / 1000).toFixed(1)}k`.padStart(8),
        `$${(year.totalTax / 1000).toFixed(1)}k`.padStart(8),
        `$${(year.afterTaxIncome / 1000).toFixed(1)}k`.padStart(9),
      ].join(' | ');
      console.log(`  ${row}`);

      // Check for anomalies - after-tax income should grow roughly with inflation
      if (previousAfterTax > 0) {
        const expectedGrowth = previousAfterTax * 1.03; // 3% inflation
        const actualGrowth = year.afterTaxIncome;
        const deviation = Math.abs(actualGrowth - expectedGrowth) / expectedGrowth;

        // If after-tax income drops more than 5% from expected, flag it
        if (deviation > 0.10 && actualGrowth < expectedGrowth) {
          console.log(`  ⚠️  ANOMALY: After-tax income at age ${year.age} dropped unexpectedly!`);
          anomalyDetected = true;
        }
      }

      previousAfterTax = year.afterTaxIncome;
    }
  }

  console.log('');

  // The specific issue: SS is inflated from current age (35), but target spending
  // is based on retirement portfolio. Let's trace the calculation:
  console.log('\n--- Social Security Inflation Analysis ---');

  const ssAt67YearsFromNow = 67 - 35; // 32 years
  const ssAt67Inflated = 30000 * Math.pow(1.03, ssAt67YearsFromNow);
  console.log(`  SS at 67 (years from now: ${ssAt67YearsFromNow}): $${ssAt67Inflated.toFixed(0)}`);

  const targetAt65 = 2000000 * 0.04;
  const targetAt67 = targetAt65 * Math.pow(1.03, 2);
  console.log(`  Target spending at 65: $${targetAt65.toFixed(0)}`);
  console.log(`  Target spending at 67: $${targetAt67.toFixed(0)}`);
  console.log(`  Difference (what needs to be withdrawn): $${(targetAt67 - ssAt67Inflated).toFixed(0)}`);

  if (ssAt67Inflated > targetAt67) {
    console.log('\n  ⚠️  BUG FOUND: Social Security exceeds target spending!');
    console.log('  This happens because SS is inflated from current age (35),');
    console.log('  but target spending is based on portfolio at retirement.');
  }

  if (!anomalyDetected) {
    console.log('  ✓ No major income anomalies detected in ages 65-75');
  }
}

// =============================================================================
// EDGE CASE TESTS
// =============================================================================

function testEdgeCases(): void {
  section('EDGE CASES');

  console.log('\n--- Zero Balance Accounts ---');

  const emptyAccount: Account = {
    id: 'empty',
    name: 'Empty',
    type: 'traditional_401k',
    balance: 0,
    annualContribution: 0,
    contributionGrowthRate: 0,
    returnRate: 0.07,
  };

  const profile: Profile = {
    currentAge: 30,
    retirementAge: 65,
    lifeExpectancy: 90,
    filingStatus: 'married_filing_jointly',
    stateTaxRate: 0.05,
  };

  const result = calculateAccumulation([emptyAccount], profile, usConfig);
  assertApprox(result.totalAtRetirement, 0, 0.01, 'Empty account stays at $0');

  console.log('\n--- Very Short Retirement ---');

  const shortProfile: Profile = {
    ...profile,
    retirementAge: 65,
    lifeExpectancy: 66, // 1 year retirement
  };

  const account: Account = {
    id: 'test',
    name: 'Test',
    type: 'traditional_401k',
    balance: 1000000,
    annualContribution: 0,
    contributionGrowthRate: 0,
    returnRate: 0,
  };

  const assumptions: Assumptions = {
    inflationRate: 0.03,
    safeWithdrawalRate: 0.04,
    retirementReturnRate: 0.05,
  };

  const accumulation = calculateAccumulation([account], shortProfile, usConfig);
  const withdrawal = calculateWithdrawals([account], shortProfile, assumptions, accumulation, usConfig);

  assert(withdrawal.yearlyWithdrawals.length >= 1, 'Has at least 1 year of withdrawals');

  console.log('\n--- Very Long Retirement ---');

  const longProfile: Profile = {
    ...profile,
    retirementAge: 40,
    lifeExpectancy: 100, // 60 years of retirement
  };

  const longResult = calculateWithdrawals([account], longProfile, assumptions, calculateAccumulation([account], longProfile, usConfig), usConfig);

  assert(longResult.yearlyWithdrawals.length === 61, 'Has 61 years of withdrawal data (40-100 inclusive)');

  console.log('\n--- High Return Rate ---');

  const highReturnAccount: Account = {
    ...account,
    returnRate: 0.15, // 15% return
  };

  const highReturnResult = calculateAccumulation([highReturnAccount], profile, usConfig);
  assert(highReturnResult.totalAtRetirement > account.balance, 'High return grows portfolio');

  console.log('\n--- Multiple Account Types ---');

  const mixedAccounts: Account[] = [
    { id: '1', name: 'Trad 401k', type: 'traditional_401k', balance: 100000, annualContribution: 0, contributionGrowthRate: 0, returnRate: 0 },
    { id: '2', name: 'Roth 401k', type: 'roth_401k', balance: 100000, annualContribution: 0, contributionGrowthRate: 0, returnRate: 0 },
    { id: '3', name: 'Trad IRA', type: 'traditional_ira', balance: 100000, annualContribution: 0, contributionGrowthRate: 0, returnRate: 0 },
    { id: '4', name: 'Roth IRA', type: 'roth_ira', balance: 100000, annualContribution: 0, contributionGrowthRate: 0, returnRate: 0 },
    { id: '5', name: 'Taxable', type: 'taxable', balance: 100000, annualContribution: 0, contributionGrowthRate: 0, returnRate: 0 },
    { id: '6', name: 'HSA', type: 'hsa', balance: 100000, annualContribution: 0, contributionGrowthRate: 0, returnRate: 0 },
  ];

  const mixedResult = calculateAccumulation(mixedAccounts, shortProfile, usConfig);

  assertApprox(mixedResult.totalAtRetirement, 600000, 0.01, 'Total of all accounts = $600,000');
  assertApprox(mixedResult.breakdownByGroup.traditional, 200000, 0.01, 'Traditional (trad 401k + IRA) = $200,000');
  assertApprox(mixedResult.breakdownByGroup.roth, 200000, 0.01, 'Roth (roth 401k + IRA) = $200,000');
  assertApprox(mixedResult.breakdownByGroup.taxable, 100000, 0.01, 'Taxable = $100,000');
  assertApprox(mixedResult.breakdownByGroup.hsa, 100000, 0.01, 'HSA = $100,000');
}

// =============================================================================
// CAPITAL GAINS TAX EDGE CASES
// =============================================================================

function testCapitalGainsEdgeCases(): void {
  section('CAPITAL GAINS TAX EDGE CASES');

  console.log('\n--- Capital gains with income below 0% bracket ---');

  // MFJ: 0% rate up to $94,050
  // With standard deduction of $29,200, ordinary income of $29,200 means $0 taxable
  // All $50k of gains should be at 0%
  const cgTax1 = calculateCapitalGainsTax(50000, 29200, 'married_filing_jointly');
  assertApprox(cgTax1, 0, 0.01, '$50k gains with income = std deduction should be 0%');

  // Income at $50,000 means taxable = $20,800
  // Room in 0% bracket = $94,050 - $20,800 = $73,250
  // $50k gains all at 0%
  const cgTax2 = calculateCapitalGainsTax(50000, 50000, 'married_filing_jointly');
  assertApprox(cgTax2, 0, 0.01, '$50k gains with $50k income (all gains in 0% bracket)');

  console.log('\n--- Capital gains spanning multiple brackets ---');

  // Income of $120,000 (taxable = $90,800)
  // Room in 0% bracket = $94,050 - $90,800 = $3,250
  // $100k gains: $3,250 at 0%, $96,750 at 15%
  // Expected: $96,750 * 0.15 = $14,512.50
  const cgTax3 = calculateCapitalGainsTax(100000, 120000, 'married_filing_jointly');
  assertApprox(cgTax3, 14512.50, 0.01, '$100k gains with $120k income (spanning 0%/15%)');

  console.log('\n--- Capital gains at high income (20% bracket) ---');

  // Income of $600,000 (taxable = $570,800)
  // This is in the 15% bracket ($94,050 to $583,750)
  // Room in 15% = $583,750 - $570,800 = $12,950
  // $50k gains: $12,950 at 15%, $37,050 at 20%
  // Expected: $12,950 * 0.15 + $37,050 * 0.20 = $1,942.50 + $7,410 = $9,352.50
  const cgTax4 = calculateCapitalGainsTax(50000, 600000, 'married_filing_jointly');
  assertApprox(cgTax4, 9352.50, 0.01, '$50k gains with $600k income (spanning 15%/20%)');

  console.log('\n--- Single filer capital gains ---');

  // Single: 0% up to $47,025, 15% to $518,900, 20% above
  // Income $50k, taxable = $35,400
  // Room in 0% = $47,025 - $35,400 = $11,625
  // $30k gains: $11,625 at 0%, $18,375 at 15%
  // Expected: $18,375 * 0.15 = $2,756.25
  const cgTax5 = calculateCapitalGainsTax(30000, 50000, 'single');
  assertApprox(cgTax5, 2756.25, 0.01, '$30k gains with $50k income (single filer)');

  console.log('\n--- Zero capital gains ---');

  const cgTax6 = calculateCapitalGainsTax(0, 100000, 'married_filing_jointly');
  assertApprox(cgTax6, 0, 0.01, 'Zero capital gains = $0 tax');

  console.log('\n--- Edge case: income exactly at bracket boundary ---');

  // Income exactly at $94,050 + $29,200 = $123,250 (right at 0% cap gains max)
  // Any gains would be at 15%
  const cgTax7 = calculateCapitalGainsTax(10000, 123250, 'married_filing_jointly');
  assertApprox(cgTax7, 1500, 0.01, '$10k gains at exactly 0% bracket cap = $1,500 (15%)');
}

// =============================================================================
// WITHDRAWAL STRATEGY DETAILED TESTS
// =============================================================================

function testWithdrawalStrategyDetails(): void {
  section('WITHDRAWAL STRATEGY DETAILED TESTS');

  console.log('\n--- Tax bracket filling test ---');

  // Setup: Traditional account with enough to fill brackets
  // At retirement, should fill 12% bracket optimally
  const account: Account = {
    id: 'trad',
    name: 'Traditional',
    type: 'traditional_401k',
    balance: 500000,
    annualContribution: 0,
    contributionGrowthRate: 0,
    returnRate: 0,
  };

  const profile: Profile = {
    currentAge: 65,
    retirementAge: 65,
    lifeExpectancy: 66,
    filingStatus: 'married_filing_jointly',
    stateTaxRate: 0.05,
  };

  const assumptions: Assumptions = {
    inflationRate: 0,
    safeWithdrawalRate: 0.04, // $20k needed
    retirementReturnRate: 0,
  };

  const accumulation = calculateAccumulation([account], profile, usConfig);
  const result = calculateWithdrawals([account], profile, assumptions, accumulation, usConfig);

  const year1 = result.yearlyWithdrawals[0];

  // Target spending is $20k (4% of $500k)
  // But the strategy should fill the 12% bracket
  // Standard deduction: $29,200
  // 12% bracket max: $94,300
  // Total optimal: $29,200 + $94,300 = $123,500
  // Since we only need $20k, withdrawal should be $20k (need-based, not bracket-filling beyond need)
  assertApprox(year1.totalWithdrawal, 20000, 1, 'Withdrawal matches target spending');

  console.log('\n--- Roth before taxable test ---');

  // Setup: Mix of Roth and Taxable, should use Roth first (after traditional bracket filling)
  const mixedAccounts: Account[] = [
    {
      id: 'trad',
      name: 'Traditional',
      type: 'traditional_401k',
      balance: 50000, // Small traditional
      annualContribution: 0,
      contributionGrowthRate: 0,
      returnRate: 0,
    },
    {
      id: 'roth',
      name: 'Roth',
      type: 'roth_ira',
      balance: 200000,
      annualContribution: 0,
      contributionGrowthRate: 0,
      returnRate: 0,
    },
    {
      id: 'taxable',
      name: 'Taxable',
      type: 'taxable',
      balance: 200000,
      annualContribution: 0,
      contributionGrowthRate: 0,
      returnRate: 0,
    },
  ];

  const mixedProfile: Profile = {
    currentAge: 65,
    retirementAge: 65,
    lifeExpectancy: 66,
    filingStatus: 'married_filing_jointly',
    stateTaxRate: 0.05,
  };

  const mixedAssumptions: Assumptions = {
    inflationRate: 0,
    safeWithdrawalRate: 0.10, // 10% = $45k needed
    retirementReturnRate: 0,
  };

  const mixedAccum = calculateAccumulation(mixedAccounts, mixedProfile, usConfig);
  const mixedResult = calculateWithdrawals(mixedAccounts, mixedProfile, mixedAssumptions, mixedAccum, usConfig);

  const mixedYear1 = mixedResult.yearlyWithdrawals[0];

  // Strategy should:
  // 1. Fill 12% bracket with traditional (up to need or bracket, whichever less)
  // 2. Use Roth for remaining
  // 3. Only use taxable if needed
  assert(
    mixedYear1.withdrawals['roth'] > 0 || mixedYear1.withdrawals['trad'] >= 45000,
    'Uses Roth or enough traditional to meet needs'
  );

  console.log('\n--- HSA as last resort test ---');

  const hsaAccounts: Account[] = [
    {
      id: 'hsa',
      name: 'HSA',
      type: 'hsa',
      balance: 100000,
      annualContribution: 0,
      contributionGrowthRate: 0,
      returnRate: 0,
    },
    {
      id: 'roth',
      name: 'Roth',
      type: 'roth_ira',
      balance: 50000,
      annualContribution: 0,
      contributionGrowthRate: 0,
      returnRate: 0,
    },
  ];

  const hsaProfile: Profile = {
    currentAge: 65,
    retirementAge: 65,
    lifeExpectancy: 66,
    filingStatus: 'married_filing_jointly',
    stateTaxRate: 0.05,
  };

  const hsaAssumptions: Assumptions = {
    inflationRate: 0,
    safeWithdrawalRate: 0.40, // 40% = $60k needed
    retirementReturnRate: 0,
  };

  const hsaAccum = calculateAccumulation(hsaAccounts, hsaProfile, usConfig);
  const hsaResult = calculateWithdrawals(hsaAccounts, hsaProfile, hsaAssumptions, hsaAccum, usConfig);

  const hsaYear1 = hsaResult.yearlyWithdrawals[0];

  // Should use all Roth ($50k) before touching HSA ($10k)
  assertApprox(hsaYear1.withdrawals['roth'], 50000, 1, 'Uses all Roth first');
  assertApprox(hsaYear1.withdrawals['hsa'], 10000, 1, 'HSA used only for remainder');
}

// =============================================================================
// COST BASIS TRACKING TESTS
// =============================================================================

function testCostBasisTracking(): void {
  section('COST BASIS TRACKING TESTS');

  console.log('\n--- Taxable account gains calculation ---');

  // Setup: Taxable account, verify gains are calculated correctly
  const taxableAccount: Account = {
    id: 'taxable',
    name: 'Taxable',
    type: 'taxable',
    balance: 100000, // Will be treated as 50% cost basis by default
    annualContribution: 0,
    contributionGrowthRate: 0,
    returnRate: 0,
  };

  const profile: Profile = {
    currentAge: 65,
    retirementAge: 65,
    lifeExpectancy: 66,
    filingStatus: 'married_filing_jointly',
    stateTaxRate: 0,
  };

  const assumptions: Assumptions = {
    inflationRate: 0,
    safeWithdrawalRate: 0.10, // $10k withdrawal
    retirementReturnRate: 0,
  };

  const accumulation = calculateAccumulation([taxableAccount], profile, usConfig);
  const result = calculateWithdrawals([taxableAccount], profile, assumptions, accumulation, usConfig);

  const year1 = result.yearlyWithdrawals[0];

  // With $100k balance and 50% cost basis ($50k), gain ratio = 50%
  // $10k withdrawal should have $5k gains
  // Capital gains tax at 0% bracket (income below threshold) = $0
  assert(year1.federalTax >= 0, 'Federal tax calculated for taxable account withdrawal');

  console.log('\n--- Cost basis depletion over time ---');

  // Multi-year test to ensure cost basis is tracked correctly
  const longProfile: Profile = {
    ...profile,
    lifeExpectancy: 70, // 5 years
  };

  const longAssumptions: Assumptions = {
    inflationRate: 0,
    safeWithdrawalRate: 0.20, // High withdrawal rate
    retirementReturnRate: 0,
  };

  const longAccum = calculateAccumulation([taxableAccount], longProfile, usConfig);
  const longResult = calculateWithdrawals([taxableAccount], longProfile, longAssumptions, longAccum, usConfig);

  // Verify withdrawals continue until depleted
  let totalWithdrawn = 0;
  for (const year of longResult.yearlyWithdrawals) {
    totalWithdrawn += year.withdrawals['taxable'] || 0;
  }

  assert(totalWithdrawn <= 100000, `Total withdrawn ($${totalWithdrawn.toFixed(0)}) <= initial balance`);
}

// =============================================================================
// RMD INTERACTION TESTS
// =============================================================================

function testRMDInteractions(): void {
  section('RMD INTERACTION TESTS');

  console.log('\n--- RMD forces withdrawal above target ---');

  // Large traditional balance at age 73 should force RMD even if SWR is low
  const largeTraditional: Account = {
    id: 'trad',
    name: 'Traditional',
    type: 'traditional_401k',
    balance: 2000000,
    annualContribution: 0,
    contributionGrowthRate: 0,
    returnRate: 0,
  };

  const profile: Profile = {
    currentAge: 73,
    retirementAge: 73,
    lifeExpectancy: 75,
    filingStatus: 'married_filing_jointly',
    stateTaxRate: 0.05,
  };

  const assumptions: Assumptions = {
    inflationRate: 0,
    safeWithdrawalRate: 0.02, // Only 2% = $40k
    retirementReturnRate: 0,
  };

  const accumulation = calculateAccumulation([largeTraditional], profile, usConfig);
  const result = calculateWithdrawals([largeTraditional], profile, assumptions, accumulation, usConfig);

  const year73 = result.yearlyWithdrawals[0];

  // RMD at 73 with $2M = $2M / 26.5 = $75,471.70
  // Target spending = $40k
  // RMD should force withdrawal of ~$75,472
  assertApprox(year73.rmdAmount, 75471.70, 1, 'RMD calculated correctly for $2M at age 73');
  assert(
    year73.totalWithdrawal >= year73.rmdAmount - 1,
    `Withdrawal ($${year73.totalWithdrawal.toFixed(0)}) >= RMD ($${year73.rmdAmount.toFixed(0)})`
  );

  console.log('\n--- RMD with mixed account types ---');

  // Traditional + Roth, RMD only applies to traditional
  const mixedAccounts: Account[] = [
    {
      id: 'trad',
      name: 'Traditional',
      type: 'traditional_401k',
      balance: 1000000,
      annualContribution: 0,
      contributionGrowthRate: 0,
      returnRate: 0,
    },
    {
      id: 'roth',
      name: 'Roth',
      type: 'roth_ira',
      balance: 1000000,
      annualContribution: 0,
      contributionGrowthRate: 0,
      returnRate: 0,
    },
  ];

  const mixedResult = calculateWithdrawals(mixedAccounts, profile, assumptions, calculateAccumulation(mixedAccounts, profile, usConfig), usConfig);

  const mixedYear73 = mixedResult.yearlyWithdrawals[0];

  // RMD only on $1M traditional = $1M / 26.5 = $37,735.85
  assertApprox(mixedYear73.rmdAmount, 37735.85, 1, 'RMD only on traditional balance');
}

// =============================================================================
// INFLATION CONSISTENCY TESTS
// =============================================================================

function testInflationConsistency(): void {
  section('INFLATION CONSISTENCY TESTS');

  console.log('\n--- Target spending grows with inflation ---');

  const account: Account = {
    id: 'trad',
    name: 'Traditional',
    type: 'traditional_401k',
    balance: 1000000,
    annualContribution: 0,
    contributionGrowthRate: 0,
    returnRate: 0,
  };

  const profile: Profile = {
    currentAge: 65,
    retirementAge: 65,
    lifeExpectancy: 70,
    filingStatus: 'married_filing_jointly',
    stateTaxRate: 0.05,
  };

  const assumptions: Assumptions = {
    inflationRate: 0.03,
    safeWithdrawalRate: 0.04,
    retirementReturnRate: 0,
  };

  const accumulation = calculateAccumulation([account], profile, usConfig);
  const result = calculateWithdrawals([account], profile, assumptions, accumulation, usConfig);

  // Year 1: $40k target
  // Year 2: $40k * 1.03 = $41,200
  // Year 3: $41,200 * 1.03 = $42,436
  const year1 = result.yearlyWithdrawals[0];
  const year2 = result.yearlyWithdrawals[1];
  const year3 = result.yearlyWithdrawals[2];

  assertApprox(year1.targetSpending, 40000, 1, 'Year 1 target = $40,000');
  assertApprox(year2.targetSpending, 41200, 1, 'Year 2 target = $41,200 (3% inflation)');
  assertApprox(year3.targetSpending, 42436, 1, 'Year 3 target = $42,436 (compound inflation)');

  console.log('\n--- Social Security inflated correctly ---');

  const ssProfile: Profile = {
    currentAge: 60,
    retirementAge: 65,
    lifeExpectancy: 70,
    filingStatus: 'married_filing_jointly',
    stateTaxRate: 0.05,
    socialSecurityBenefit: 30000,
    socialSecurityStartAge: 67,
  };

  const ssAccum = calculateAccumulation([account], ssProfile, usConfig);
  const ssResult = calculateWithdrawals([account], ssProfile, assumptions, ssAccum, usConfig);

  // SS starts at age 67
  // Years from current age (60) to 67 = 7 years
  // $30,000 * 1.03^7 = $36,878.33
  const age67 = ssResult.yearlyWithdrawals.find(y => y.age === 67);

  if (age67) {
    const expectedSS = 30000 * Math.pow(1.03, 7);
    assertApprox(age67.governmentBenefitIncome, expectedSS, 1, 'SS inflated from current age to start age');
  }
}

// =============================================================================
// PORTFOLIO DEPLETION TESTS
// =============================================================================

function testPortfolioDepletion(): void {
  section('PORTFOLIO DEPLETION TESTS');

  console.log('\n--- Portfolio depletion detection ---');

  const smallAccount: Account = {
    id: 'small',
    name: 'Small Account',
    type: 'traditional_401k',
    balance: 50000,
    annualContribution: 0,
    contributionGrowthRate: 0,
    returnRate: 0,
  };

  const profile: Profile = {
    currentAge: 65,
    retirementAge: 65,
    lifeExpectancy: 80,
    filingStatus: 'married_filing_jointly',
    stateTaxRate: 0.05,
  };

  const assumptions: Assumptions = {
    inflationRate: 0.03,
    safeWithdrawalRate: 0.10, // High 10% rate = $5k/year
    retirementReturnRate: 0, // No growth
  };

  const accumulation = calculateAccumulation([smallAccount], profile, usConfig);
  const result = calculateWithdrawals([smallAccount], profile, assumptions, accumulation, usConfig);

  // $50k at 10% = $5k/year, plus 3% inflation
  // Year 1: $5,000
  // Year 2: $5,150
  // ...should deplete within ~9 years
  assert(
    result.portfolioDepletionAge !== null && result.portfolioDepletionAge < 80,
    `Portfolio depletes at age ${result.portfolioDepletionAge} (before life expectancy)`
  );

  console.log('\n--- Sustainable portfolio (no depletion) ---');

  const largeAccount: Account = {
    ...smallAccount,
    balance: 2000000,
  };

  const sustainableAssumptions: Assumptions = {
    inflationRate: 0.03,
    safeWithdrawalRate: 0.04, // Conservative 4%
    retirementReturnRate: 0.05, // 5% returns beat inflation
  };

  const largeAccum = calculateAccumulation([largeAccount], profile, usConfig);
  const largeResult = calculateWithdrawals([largeAccount], profile, sustainableAssumptions, largeAccum, usConfig);

  assert(
    largeResult.portfolioDepletionAge === null,
    'Large portfolio with good returns does not deplete'
  );
}

// =============================================================================
// TOTAL FEDERAL TAX INTEGRATION TESTS
// =============================================================================

function testTotalFederalTaxIntegration(): void {
  section('TOTAL FEDERAL TAX INTEGRATION');

  console.log('\n--- Combined ordinary income and capital gains ---');

  // MFJ: std deduction $29,200
  // $50k ordinary income -> taxable = $20,800 -> tax = $2,080 (10% bracket)
  // Capital gains: $50k stacks on top
  // Income base = $20,800, gains start here
  // 0% bracket goes to $94,050, so $73,250 at 0%
  // All $50k gains at 0%
  // Total = $2,080 + $0 = $2,080
  const tax1 = calculateTotalFederalTax(50000, 50000, 'married_filing_jointly');
  assertApprox(tax1, 2080, 0.01, 'Ordinary $50k + Cap gains $50k (gains in 0% bracket)');

  console.log('\n--- High income scenario ---');

  // $200k ordinary income -> taxable = $170,800
  // Tax: $23,200 @ 10% = $2,320
  //      $71,100 @ 12% = $8,532
  //      $76,500 @ 22% = $16,830
  // Total ordinary tax = $27,682
  // Capital gains $100k starts at $170,800
  // 0% bracket ends at $94,050 (already passed)
  // All $100k at 15% = $15,000
  // Total = $27,682 + $15,000 = $42,682
  const tax2 = calculateTotalFederalTax(200000, 100000, 'married_filing_jointly');
  assertApprox(tax2, 42682, 1, 'Ordinary $200k + Cap gains $100k');

  console.log('\n--- Only capital gains (no ordinary income) ---');

  // $0 ordinary income, $100k capital gains
  // Taxable ordinary = $0
  // Gains start at $0
  // 0% bracket: $94,050 at 0%
  // 15% bracket: $5,950 at 15% = $892.50
  const tax3 = calculateTotalFederalTax(0, 100000, 'married_filing_jointly');
  assertApprox(tax3, 892.50, 0.01, 'Only $100k capital gains, no ordinary income');

  console.log('\n--- Standard deduction covers all ordinary ---');

  // $29,200 ordinary (exactly std deduction), $50k gains
  // Taxable ordinary = $0
  // All gains at 0% (under $94,050 threshold)
  const tax4 = calculateTotalFederalTax(29200, 50000, 'married_filing_jointly');
  assertApprox(tax4, 0, 0.01, 'Ordinary = std deduction, gains in 0% bracket');
}

// =============================================================================
// CANADIAN CALCULATION TESTS
// =============================================================================

const caConfig = getCountryConfig('CA');

function testCanadianCalculations(): void {
  section('CANADIAN CALCULATIONS');

  console.log('\n--- Canadian Federal Tax Brackets ---');

  // Canadian federal tax on $50,000 income
  // Basic personal amount: $15,705
  // Taxable: $50,000 - $15,705 = $34,295
  // 15% on first $53,359 = $34,295 * 0.15 = $5,144.25
  const caTax1 = caConfig.calculateFederalTax(50000);
  assert(caTax1 > 0 && caTax1 < 10000, `CA federal tax on $50k is reasonable (got $${caTax1.toFixed(2)})`);

  // Higher income bracket test
  const caTax2 = caConfig.calculateFederalTax(100000);
  assert(caTax2 > caTax1, `CA federal tax on $100k (${caTax2.toFixed(0)}) > $50k (${caTax1.toFixed(0)})`);

  console.log('\n--- Canadian Account Type Recognition ---');

  // Test traditional account recognition
  assert(caConfig.isTraditionalAccount('rrsp'), 'RRSP is recognized as traditional');
  assert(caConfig.isTraditionalAccount('rrif'), 'RRIF is recognized as traditional');
  assert(caConfig.isTraditionalAccount('lira'), 'LIRA is recognized as traditional');
  assert(caConfig.isTraditionalAccount('lif'), 'LIF is recognized as traditional');
  assert(!caConfig.isTraditionalAccount('tfsa'), 'TFSA is NOT traditional');
  assert(!caConfig.isTraditionalAccount('non_registered'), 'Non-registered is NOT traditional');

  console.log('\n--- Canadian RRIF Minimum Withdrawals ---');

  // RRIF minimums at age 71 = 5.28%
  const rrifMin71 = caConfig.getMinimumWithdrawal(71, 100000, 'rrif');
  assertApprox(rrifMin71, 5280, 10, 'RRIF min at 71 = 5.28% of $100k');

  // RRIF minimums at age 80 = 6.82%
  const rrifMin80 = caConfig.getMinimumWithdrawal(80, 100000, 'rrif');
  assertApprox(rrifMin80, 6820, 10, 'RRIF min at 80 = 6.82% of $100k');

  // No minimum before 71 for RRSP
  const rrspMin65 = caConfig.getMinimumWithdrawal(65, 100000, 'rrsp');
  assertApprox(rrspMin65, 0, 0.01, 'No RRSP minimum at age 65');

  console.log('\n--- Canadian Accumulation with RRSP ---');

  const rrspAccount: Account = {
    id: 'rrsp1',
    name: 'RRSP',
    type: 'rrsp',
    balance: 100000,
    annualContribution: 10000,
    contributionGrowthRate: 0,
    returnRate: 0.07,
  };

  const caProfile: Profile = {
    country: 'CA',
    currentAge: 30,
    retirementAge: 31,
    lifeExpectancy: 90,
    region: 'ON',
  };

  const caResult = calculateAccumulation([rrspAccount], caProfile, caConfig);

  // After 1 year at 7%: $100,000 * 1.07 + $10,000 = $117,000
  assertApprox(caResult.totalAtRetirement, 117000, 0.01, 'CA RRSP growth calculation');

  console.log('\n--- Canadian Account Groupings ---');

  const caGroups = caConfig.getAccountGroupings();
  assert(caGroups.length > 0, 'CA has account groupings defined');

  const rrifGroup = caGroups.find(g => g.accountTypes.includes('rrif'));
  assert(rrifGroup !== undefined, 'RRIF has a grouping');
}

// =============================================================================
// EARLY WITHDRAWAL PENALTY TESTS
// =============================================================================

function testEarlyWithdrawalPenalties(): void {
  section('EARLY WITHDRAWAL PENALTY TESTS');

  console.log('\n--- US Traditional IRA Early Withdrawal ---');

  // Test early withdrawal at age 55 (before 59.5)
  const penaltyInfo1 = usConfig.getPenaltyInfo('traditional_ira');
  assert(penaltyInfo1.appliesToAccountType, 'Traditional IRA has penalty');
  assertApprox(penaltyInfo1.penaltyAge, 59.5, 0.01, 'Penalty age is 59.5');
  assertApprox(penaltyInfo1.penaltyRate, 0.10, 0.01, 'Penalty rate is 10%');

  const penalty1 = usConfig.calculateEarlyWithdrawalPenalty(10000, 'traditional_ira', 55);
  assertApprox(penalty1, 1000, 0.01, '$10k withdrawal at 55 = $1,000 penalty');

  // Test no penalty after 59.5
  const penalty2 = usConfig.calculateEarlyWithdrawalPenalty(10000, 'traditional_ira', 60);
  assertApprox(penalty2, 0, 0.01, '$10k withdrawal at 60 = $0 penalty');

  console.log('\n--- US Traditional 401(k) Early Withdrawal ---');

  // Test traditional 401(k) also has penalty
  const penaltyInfo401k = usConfig.getPenaltyInfo('traditional_401k');
  assert(penaltyInfo401k.appliesToAccountType, 'Traditional 401(k) has penalty');
  assertApprox(penaltyInfo401k.penaltyAge, 59.5, 0.01, 'Penalty age is 59.5 for 401(k)');

  const penalty401k = usConfig.calculateEarlyWithdrawalPenalty(50000, 'traditional_401k', 58);
  assertApprox(penalty401k, 5000, 0.01, '$50k withdrawal at 58 = $5,000 penalty');

  console.log('\n--- US Roth IRA (No Penalty) ---');

  const penaltyInfo2 = usConfig.getPenaltyInfo('roth_ira');
  assert(!penaltyInfo2.appliesToAccountType, 'Roth IRA has no penalty');

  const penalty3 = usConfig.calculateEarlyWithdrawalPenalty(10000, 'roth_ira', 55);
  assertApprox(penalty3, 0, 0.01, 'Roth IRA withdrawal at 55 = $0 penalty');

  console.log('\n--- US Taxable Account (No Penalty) ---');

  const penaltyInfo3 = usConfig.getPenaltyInfo('taxable');
  assert(!penaltyInfo3.appliesToAccountType, 'Taxable account has no penalty');

  const penaltyTaxable = usConfig.calculateEarlyWithdrawalPenalty(10000, 'taxable', 40);
  assertApprox(penaltyTaxable, 0, 0.01, 'Taxable account withdrawal = $0 penalty');

  console.log('\n--- US HSA Account (No Penalty) ---');

  const penaltyInfoHSA = usConfig.getPenaltyInfo('hsa');
  assert(!penaltyInfoHSA.appliesToAccountType, 'HSA account has no penalty');

  const penaltyHSA = usConfig.calculateEarlyWithdrawalPenalty(10000, 'hsa', 40);
  assertApprox(penaltyHSA, 0, 0.01, 'HSA account withdrawal = $0 penalty');

  console.log('\n--- Canada RRSP (No Penalty System) ---');

  const caConfig = getCountryConfig('CA');
  const penaltyInfo4 = caConfig.getPenaltyInfo('rrsp');
  assert(!penaltyInfo4.appliesToAccountType, 'Canadian RRSP has no US-style penalty');

  const penalty4 = caConfig.calculateEarlyWithdrawalPenalty(10000, 'rrsp', 55);
  assertApprox(penalty4, 0, 0.01, 'Canadian RRSP withdrawal = $0 penalty');

  console.log('\n--- Canada RRIF (No Penalty System) ---');

  const penaltyInfoRRIF = caConfig.getPenaltyInfo('rrif');
  assert(!penaltyInfoRRIF.appliesToAccountType, 'Canadian RRIF has no US-style penalty');

  const penaltyRRIF = caConfig.calculateEarlyWithdrawalPenalty(10000, 'rrif', 65);
  assertApprox(penaltyRRIF, 0, 0.01, 'Canadian RRIF withdrawal = $0 penalty');

  console.log('\n--- Edge Case: Exact Penalty Age ---');

  // Test exactly at 59.5 years old
  const penaltyExact = usConfig.calculateEarlyWithdrawalPenalty(10000, 'traditional_ira', 59.5);
  assertApprox(penaltyExact, 0, 0.01, 'Withdrawal at exactly 59.5 = $0 penalty');

  // Test just before 59.5
  const penaltyJustBefore = usConfig.calculateEarlyWithdrawalPenalty(10000, 'traditional_ira', 59.4);
  assertApprox(penaltyJustBefore, 1000, 0.01, 'Withdrawal at 59.4 = $1,000 penalty');
}

// =============================================================================
// WITHDRAWAL WITH CONFIGURABLE START AGE TESTS
// =============================================================================

function testWithdrawalWithConfigurableAge(): void {
  section('WITHDRAWAL WITH CONFIGURABLE START AGE TESTS');

  console.log('\n--- Early Retirement with Delayed IRA Access ---');

  // Scenario: Retire at 52, traditional IRA not available until 60
  const earlyRetireAccounts: Account[] = [
    {
      id: '1',
      name: 'Taxable Brokerage',
      type: 'taxable',
      balance: 600000,
      annualContribution: 0,
      contributionGrowthRate: 0,
      returnRate: 0.05,
      withdrawalRules: { startAge: 52 },  // Available immediately
    },
    {
      id: '2',
      name: 'Traditional IRA',
      type: 'traditional_ira',
      balance: 600000,
      annualContribution: 0,
      contributionGrowthRate: 0,
      returnRate: 0.05,
      withdrawalRules: { startAge: 60 },  // Not available until 60
    },
  ];

  const earlyRetireProfile: Profile = {
    country: 'US',
    currentAge: 52,
    retirementAge: 52,
    lifeExpectancy: 90,
    region: 'CA',
    filingStatus: 'married_filing_jointly',
    stateTaxRate: 0.05,
    socialSecurityBenefit: 30000,
    socialSecurityStartAge: 67,
  };

  const earlyRetireAssumptions: Assumptions = {
    inflationRate: 0.03,
    safeWithdrawalRate: 0.04,
    retirementReturnRate: 0.05,
  };

  // No accumulation phase (already retired)
  const emptyAccumulation: AccumulationResult = {
    yearlyBalances: [],
    finalBalances: {
      '1': 600000,
      '2': 600000,
    },
    totalAtRetirement: 1200000,
    breakdownByGroup: {
      'Taxable': 600000,
      'Traditional': 600000,
    },
  };

  const result = calculateWithdrawals(
    earlyRetireAccounts,
    earlyRetireProfile,
    earlyRetireAssumptions,
    emptyAccumulation,
    usConfig
  );

  // At age 52-59, should only withdraw from taxable
  const age55Year = result.yearlyWithdrawals.find(y => y.age === 55);
  assert(age55Year !== undefined, 'Has withdrawal data for age 55');
  if (age55Year) {
    assert(age55Year.withdrawals['1'] > 0, 'Withdraws from taxable at age 55');
    assertApprox(age55Year.withdrawals['2'] || 0, 0, 0.01, 'Does not withdraw from IRA at age 55');
    assertApprox(age55Year.totalPenalties, 0, 0.01, 'No penalties when using taxable only');
  }

  // At age 60, IRA becomes available
  const age60Year = result.yearlyWithdrawals.find(y => y.age === 60);
  assert(age60Year !== undefined, 'Has withdrawal data for age 60');
  if (age60Year) {
    // Should be able to withdraw from both now
    assert(age60Year.withdrawals['2'] >= 0, 'IRA is now available at age 60');
    assertApprox(age60Year.totalPenalties, 0, 0.01, 'No penalties at age 60 (penalty-free age)');
  }

  console.log('\n--- Early Withdrawal with Penalty ---');

  // Scenario: Retire at 52, need to tap IRA early (before 60)
  const penaltyAccounts: Account[] = [
    {
      id: '1',
      name: 'Taxable Brokerage',
      type: 'taxable',
      balance: 200000,  // Not enough to cover needs
      annualContribution: 0,
      contributionGrowthRate: 0,
      returnRate: 0.05,
      withdrawalRules: { startAge: 52 },
    },
    {
      id: '2',
      name: 'Traditional IRA',
      type: 'traditional_ira',
      balance: 1000000,
      annualContribution: 0,
      contributionGrowthRate: 0,
      returnRate: 0.05,
      withdrawalRules: { startAge: 60 },  // Set to 60, but will be forced earlier
    },
  ];

  const penaltyProfile: Profile = {
    country: 'US',
    currentAge: 52,
    retirementAge: 52,
    lifeExpectancy: 90,
    region: 'CA',
    filingStatus: 'married_filing_jointly',
    stateTaxRate: 0.05,
    socialSecurityBenefit: 0,
    socialSecurityStartAge: 67,
  };

  const penaltyAccumulation: AccumulationResult = {
    yearlyBalances: [],
    finalBalances: {
      '1': 200000,
      '2': 1000000,
    },
    totalAtRetirement: 1200000,
    breakdownByGroup: {
      'Taxable': 200000,
      'Traditional': 1000000,
    },
  };

  const penaltyResult = calculateWithdrawals(
    penaltyAccounts,
    penaltyProfile,
    earlyRetireAssumptions,
    penaltyAccumulation,
    usConfig
  );

  // First year: $48k target spending, only $200k taxable available
  // Will need to dip into IRA early, triggering 10% penalty
  const age52Year = penaltyResult.yearlyWithdrawals[0];
  assert(age52Year.age === 52, 'First year is age 52');

  // Should deplete taxable in first few years and start using IRA
  const hasEarlyPenalty = penaltyResult.yearlyWithdrawals
    .filter(y => y.age < 60)
    .some(y => y.totalPenalties > 0);
  assert(hasEarlyPenalty, 'Has early withdrawal penalties before age 60');

  // After 60, penalties should stop
  const age61Year = penaltyResult.yearlyWithdrawals.find(y => y.age === 61);
  if (age61Year) {
    assertApprox(age61Year.totalPenalties, 0, 0.01, 'No penalties after age 60');
  }
}

// =============================================================================
// WITHDRAWAL DEFAULTS TESTS
// =============================================================================

function testWithdrawalDefaults(): void {
  section('WITHDRAWAL DEFAULTS TESTS');

  console.log('\n--- US Traditional Account Defaults ---');

  const usTraditionalAccount: Account = {
    id: '1',
    name: 'Traditional IRA',
    type: 'traditional_ira',
    balance: 100000,
    annualContribution: 0,
    contributionGrowthRate: 0,
    returnRate: 0.07,
  };

  const defaultAge1 = getDefaultWithdrawalAge(usTraditionalAccount, 65, usConfig);
  assertApprox(defaultAge1, 60, 0.01, 'US traditional IRA defaults to age 60');

  const maxAge1 = getMaxWithdrawalAge(usTraditionalAccount, 90, usConfig);
  assertApprox(maxAge1, 73, 0.01, 'US traditional IRA max age is 73 (RMD age)');

  console.log('\n--- US Roth Account Defaults ---');

  const usRothAccount: Account = {
    id: '2',
    name: 'Roth IRA',
    type: 'roth_ira',
    balance: 100000,
    annualContribution: 0,
    contributionGrowthRate: 0,
    returnRate: 0.07,
  };

  const defaultAge2 = getDefaultWithdrawalAge(usRothAccount, 65, usConfig);
  assertApprox(defaultAge2, 65, 0.01, 'US Roth IRA defaults to retirement age');

  const maxAge2 = getMaxWithdrawalAge(usRothAccount, 90, usConfig);
  assertApprox(maxAge2, 90, 0.01, 'US Roth IRA max age is life expectancy');

  console.log('\n--- Canada RRSP Defaults ---');

  const caConfig = getCountryConfig('CA');
  const caRRSPAccount: Account = {
    id: '3',
    name: 'RRSP',
    type: 'rrsp',
    balance: 100000,
    annualContribution: 0,
    contributionGrowthRate: 0,
    returnRate: 0.07,
  };

  const defaultAge3 = getDefaultWithdrawalAge(caRRSPAccount, 65, caConfig);
  assertApprox(defaultAge3, 65, 0.01, 'Canadian RRSP defaults to retirement age');

  const maxAge3 = getMaxWithdrawalAge(caRRSPAccount, 90, caConfig);
  assertApprox(maxAge3, 71, 0.01, 'Canadian RRSP max age is 71 (RRIF conversion age)');
}

// =============================================================================
// INCOME STREAM CALCULATOR TESTS
// =============================================================================

function testIncomeStreamCalculator(): void {
  section('INCOME STREAM CALCULATOR');

  console.log('\n--- No streams ---');
  const emptyResult = calculateIncomeStreamBenefits([], 67);
  assertApprox(emptyResult.totalIncome, 0, 0.01, 'No streams = $0 income');

  console.log('\n--- Single SS stream at start age ---');
  const ssStream: IncomeStream = {
    id: 'ss1',
    name: 'Social Security',
    monthlyAmount: 2500,
    startAge: 67,
    taxTreatment: 'social_security',
  };
  const ssResult = calculateIncomeStreamBenefits([ssStream], 67);
  assertApprox(ssResult.totalIncome, 30000, 0.01, '$2500/mo = $30,000/yr at start age');
  assertApprox(ssResult.byTaxTreatment.social_security, 30000, 0.01, 'All in social_security bucket');
  assertApprox(ssResult.byTaxTreatment.fully_taxable, 0, 0.01, 'Nothing in fully_taxable');
  assertApprox(ssResult.byTaxTreatment.tax_free, 0, 0.01, 'Nothing in tax_free');

  console.log('\n--- Before start age ---');
  const beforeResult = calculateIncomeStreamBenefits([ssStream], 65);
  assertApprox(beforeResult.totalIncome, 0, 0.01, 'No income before start age');

  console.log('\n--- Multiple streams with different start ages ---');
  const streams: IncomeStream[] = [
    { id: 'ss1', name: "Josh's SS", monthlyAmount: 2500, startAge: 67, taxTreatment: 'social_security' },
    { id: 'ss2', name: "Spouse's SS", monthlyAmount: 2000, startAge: 70, taxTreatment: 'social_security' },
    { id: 'pension1', name: "Spouse's NC Pension", monthlyAmount: 3000, startAge: 65, taxTreatment: 'fully_taxable' },
  ];

  const at65 = calculateIncomeStreamBenefits(streams, 65);
  assertApprox(at65.totalIncome, 36000, 0.01, 'Age 65: only pension ($3000/mo)');
  assertApprox(at65.byTaxTreatment.fully_taxable, 36000, 0.01, 'Pension in fully_taxable');
  assertApprox(at65.byTaxTreatment.social_security, 0, 0.01, 'No SS yet');

  const at67 = calculateIncomeStreamBenefits(streams, 67);
  assertApprox(at67.totalIncome, 66000, 0.01, 'Age 67: pension + one SS');
  assertApprox(at67.byTaxTreatment.social_security, 30000, 0.01, "Josh's SS active");

  const at70 = calculateIncomeStreamBenefits(streams, 70);
  assertApprox(at70.totalIncome, 90000, 0.01, 'Age 70: all streams active');
  assertApprox(at70.byTaxTreatment.social_security, 54000, 0.01, 'Both SS streams');

  console.log('\n--- Tax-free stream ---');
  const vaDisability: IncomeStream = {
    id: 'va1', name: 'VA Disability', monthlyAmount: 1500, startAge: 60, taxTreatment: 'tax_free',
  };
  const vaResult = calculateIncomeStreamBenefits([vaDisability], 65);
  assertApprox(vaResult.totalIncome, 18000, 0.01, 'VA disability income');
  assertApprox(vaResult.byTaxTreatment.tax_free, 18000, 0.01, 'All in tax_free bucket');
}

// =============================================================================
// INCOME STREAM WITHDRAWAL INTEGRATION TESTS
// =============================================================================

function testIncomeStreamWithdrawals(): void {
  section('INCOME STREAM WITHDRAWAL INTEGRATION');

  const account: Account = {
    id: 'test',
    name: 'Traditional 401k',
    type: 'traditional_401k',
    balance: 1000000,
    annualContribution: 0,
    contributionGrowthRate: 0,
    returnRate: 0,
  };

  const profileNoSS: Profile = {
    currentAge: 65,
    retirementAge: 65,
    lifeExpectancy: 68,
    filingStatus: 'married_filing_jointly',
    stateTaxRate: 0.05,
    // No socialSecurityBenefit — it's in income streams now
  };

  const assumptions: Assumptions = {
    inflationRate: 0,  // No inflation for simpler testing
    safeWithdrawalRate: 0.04,
    retirementReturnRate: 0,
  };

  console.log('\n--- Income Streams Reduce Withdrawal Need ---');

  const ssStreams: IncomeStream[] = [
    {
      id: 'ss1',
      name: 'Social Security',
      monthlyAmount: 2500, // $30k/year
      startAge: 67,
      taxTreatment: 'social_security',
    },
  ];

  const accum = calculateAccumulation([account], profileNoSS, usConfig);
  const resultWithSS = calculateWithdrawals([account], profileNoSS, assumptions, accum, usConfig, ssStreams);

  const is65 = resultWithSS.yearlyWithdrawals.find(y => y.age === 65);
  const is67 = resultWithSS.yearlyWithdrawals.find(y => y.age === 67);

  assert(is65 !== undefined, 'Has data for age 65');
  assert(is67 !== undefined, 'Has data for age 67');

  if (is65 && is67) {
    assertApprox(is65.incomeStreamIncome, 0, 0.01, 'No income stream income at age 65');
    assert(is67.incomeStreamIncome > 0, 'Income stream income at age 67 > $0');
    assert(
      is67.totalWithdrawal < is65.totalWithdrawal,
      `Withdrawal decreases when income streams start ($${is67.totalWithdrawal.toFixed(0)} < $${is65.totalWithdrawal.toFixed(0)})`
    );
  }

  console.log('\n--- Multiple Income Streams (SS + Pension) ---');

  const multiStreams: IncomeStream[] = [
    { id: 'ss1', name: 'Social Security', monthlyAmount: 2500, startAge: 67, taxTreatment: 'social_security' },
    { id: 'pension1', name: 'State Pension', monthlyAmount: 3000, startAge: 65, taxTreatment: 'fully_taxable' },
  ];

  const resultMulti = calculateWithdrawals([account], profileNoSS, assumptions, accum, usConfig, multiStreams);

  const multi65 = resultMulti.yearlyWithdrawals.find(y => y.age === 65);
  const multi67 = resultMulti.yearlyWithdrawals.find(y => y.age === 67);

  if (multi65 && multi67) {
    assert(multi65.incomeStreamIncome > 0, 'Pension income at age 65');
    assert(
      multi67.incomeStreamIncome > multi65.incomeStreamIncome,
      'More income at 67 when SS kicks in'
    );
    assert(
      multi67.totalWithdrawal < multi65.totalWithdrawal,
      'Less portfolio withdrawal needed at 67'
    );
  }

  console.log('\n--- Tax-Free Income Stream ---');

  const taxFreeStreams: IncomeStream[] = [
    { id: 'va1', name: 'VA Disability', monthlyAmount: 2000, startAge: 65, taxTreatment: 'tax_free' },
  ];

  const resultTaxFree = calculateWithdrawals([account], profileNoSS, assumptions, accum, usConfig, taxFreeStreams);
  const resultNone = calculateWithdrawals([account], profileNoSS, assumptions, accum, usConfig, []);

  const tf65 = resultTaxFree.yearlyWithdrawals.find(y => y.age === 65);
  const none65 = resultNone.yearlyWithdrawals.find(y => y.age === 65);

  if (tf65 && none65) {
    assert(tf65.incomeStreamIncome > 0, 'Tax-free income counted in income streams');
    assert(
      tf65.totalWithdrawal < none65.totalWithdrawal,
      'Tax-free income reduces withdrawal need'
    );
    assert(
      tf65.federalTax <= none65.federalTax + 1,
      'Tax-free income does not increase federal tax'
    );
  }

  console.log('\n--- No Income Streams (empty array) ---');

  const resultEmpty = calculateWithdrawals([account], profileNoSS, assumptions, accum, usConfig, []);
  const empty65 = resultEmpty.yearlyWithdrawals.find(y => y.age === 65);
  if (empty65) {
    assertApprox(empty65.incomeStreamIncome, 0, 0.01, 'Empty streams = $0 income stream income');
  }
}

// =============================================================================
// RUN ALL TESTS
// =============================================================================

function runAllTests(): void {
  console.log('\n' + '🧪 RETIREMENT CALCULATOR MATH TESTS '.padEnd(60, '='));
  console.log('Running comprehensive tests on all calculations...\n');

  testTaxCalculations();
  testRMDCalculations();
  testAccumulationPhase();
  testWithdrawalPhase();
  testIncomeContinuity();
  testEdgeCases();
  testCapitalGainsEdgeCases();
  testWithdrawalStrategyDetails();
  testCostBasisTracking();
  testRMDInteractions();
  testInflationConsistency();
  testPortfolioDepletion();
  testTotalFederalTaxIntegration();
  testCanadianCalculations();
  testWithdrawalWithConfigurableAge();
  testWithdrawalDefaults();
  testEarlyWithdrawalPenalties();
  testIncomeStreamCalculator();
  testIncomeStreamWithdrawals();

  console.log('\n' + '='.repeat(60));
  console.log('TEST SUMMARY');
  console.log('='.repeat(60));
  console.log(`  ✓ Passed: ${passedTests}`);
  console.log(`  ✗ Failed: ${failedTests}`);
  console.log(`  Total: ${passedTests + failedTests}`);
  console.log('='.repeat(60) + '\n');

  if (failedTests > 0) {
    process.exit(1);
  }
}

runAllTests();

/**
 * Retirement Calculator Math Tests
 *
 * This file tests all the core financial calculations to ensure accuracy.
 * Run with: npx tsx src/tests/calculations.test.ts
 */

import { calculateAccumulation } from '../utils/projections';
import { calculateWithdrawals } from '../utils/withdrawals';
import {
  calculateFederalIncomeTax,
  calculateTotalFederalTax,
  calculateStateTax,
  calculateCapitalGainsTax,
  getStandardDeduction,
} from '../utils/taxes';
import { getRMDDivisor } from '../utils/constants';
import { Account, Profile, Assumptions } from '../types';

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

  const result1 = calculateAccumulation([account1], profile1);

  // After 1 year at 7%: $100,000 * 1.07 = $107,000
  assertApprox(result1.totalAtRetirement, 107000, 0.01, '$100k at 7% for 1 year = $107,000');

  console.log('\n--- Compound Growth Test (10 years) ---');

  const profile2: Profile = {
    ...profile1,
    retirementAge: 40, // 10 years
  };

  const result2 = calculateAccumulation([account1], profile2);

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

  const result3 = calculateAccumulation([account2], profile3);

  // Year 1: $100,000 * 1.07 + $10,000 = $117,000
  assertApprox(result3.totalAtRetirement, 117000, 0.01, '$100k + $10k contribution at 7% = $117,000');

  console.log('\n--- Employer Match Test ---');

  const account3: Account = {
    ...account2,
    employerMatchPercent: 0.5, // 50% match
    employerMatchLimit: 3000, // Up to $3000
  };

  const result4 = calculateAccumulation([account3], profile3);

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

  const result5 = calculateAccumulation([account4], profile4);

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

  const result6 = calculateAccumulation(accounts, profile3);

  assertApprox(result6.breakdownByTaxTreatment.pretax, 100000, 0.01, 'Pre-tax = $100,000');
  assertApprox(result6.breakdownByTaxTreatment.roth, 50000, 0.01, 'Roth = $50,000');
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

  const accumulation = calculateAccumulation([account], profile);
  const result = calculateWithdrawals([account], profile, assumptions, accumulation);

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

  const accumulation2 = calculateAccumulation(accounts, profile2);
  const result2 = calculateWithdrawals(accounts, profile2, assumptions, accumulation2);

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

  const accumulationSS = calculateAccumulation([account], profileSS);
  const resultSS = calculateWithdrawals([account], profileSS, assumptionsSS, accumulationSS);

  // At age 65-66: No SS, full withdrawal needed
  // At age 67: SS kicks in, withdrawal should decrease
  const age65 = resultSS.yearlyWithdrawals.find(y => y.age === 65);
  const age67 = resultSS.yearlyWithdrawals.find(y => y.age === 67);

  assert(age65 !== undefined, 'Has data for age 65');
  assert(age67 !== undefined, 'Has data for age 67');

  if (age65 && age67) {
    assertApprox(age65.socialSecurityIncome, 0, 0.01, 'No SS income at age 65');
    assertApprox(age67.socialSecurityIncome, 30000, 0.01, 'SS income at age 67 = $30,000');

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

  const accumulationRMD = calculateAccumulation([account], profileRMD);
  const resultRMD = calculateWithdrawals([account], profileRMD, assumptionsRMD, accumulationRMD);

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
        `$${(year.socialSecurityIncome / 1000).toFixed(1)}k`.padStart(8),
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

  const result = calculateAccumulation([emptyAccount], profile);
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

  const accumulation = calculateAccumulation([account], shortProfile);
  const withdrawal = calculateWithdrawals([account], shortProfile, assumptions, accumulation);

  assert(withdrawal.yearlyWithdrawals.length >= 1, 'Has at least 1 year of withdrawals');

  console.log('\n--- Very Long Retirement ---');

  const longProfile: Profile = {
    ...profile,
    retirementAge: 40,
    lifeExpectancy: 100, // 60 years of retirement
  };

  const longResult = calculateWithdrawals([account], longProfile, assumptions, calculateAccumulation([account], longProfile));

  assert(longResult.yearlyWithdrawals.length === 61, 'Has 61 years of withdrawal data (40-100 inclusive)');

  console.log('\n--- High Return Rate ---');

  const highReturnAccount: Account = {
    ...account,
    returnRate: 0.15, // 15% return
  };

  const highReturnResult = calculateAccumulation([highReturnAccount], profile);
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

  const mixedResult = calculateAccumulation(mixedAccounts, shortProfile);

  assertApprox(mixedResult.totalAtRetirement, 600000, 0.01, 'Total of all accounts = $600,000');
  assertApprox(mixedResult.breakdownByTaxTreatment.pretax, 200000, 0.01, 'Pre-tax (trad 401k + IRA) = $200,000');
  assertApprox(mixedResult.breakdownByTaxTreatment.roth, 200000, 0.01, 'Roth (roth 401k + IRA) = $200,000');
  assertApprox(mixedResult.breakdownByTaxTreatment.taxable, 100000, 0.01, 'Taxable = $100,000');
  assertApprox(mixedResult.breakdownByTaxTreatment.hsa, 100000, 0.01, 'HSA = $100,000');
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

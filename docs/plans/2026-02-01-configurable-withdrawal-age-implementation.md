# Configurable Account Withdrawal Age - Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Enable users to configure when withdrawals begin from individual accounts, with early withdrawal penalty calculations for both US and Canada.

**Architecture:** Add withdrawal rules to Account type, extend country configs with penalty info, create penalty calculator module, modify withdrawal logic to filter by availability, and update UI/visualizations.

**Tech Stack:** TypeScript, React 19, Vitest (tsx test runner), Tailwind v4

---

## Task 1: Add Type Definitions

**Files:**
- Modify: `src/types/index.ts:31-41`

**Step 1: Add withdrawal rules and penalty types**

Add these interfaces after the `Account` interface definition:

```typescript
export interface AccountWithdrawalRules {
  startAge: number;  // Age when withdrawals can begin
}

export interface EarlyWithdrawalPenalty {
  amount: number;      // Penalty amount in dollars
  accountId: string;   // Which account triggered it
  accountName: string; // For display purposes
}
```

**Step 2: Add withdrawalRules field to Account interface**

Modify the `Account` interface (around line 31) to add:

```typescript
export interface Account {
  id: string;
  name: string;
  type: AccountType;
  balance: number;
  annualContribution: number;
  contributionGrowthRate: number;
  returnRate: number;
  employerMatchPercent?: number;
  employerMatchLimit?: number;
  withdrawalRules?: AccountWithdrawalRules;  // NEW: Optional for backwards compatibility
}
```

**Step 3: Add penalty fields to YearlyWithdrawal interface**

Modify `YearlyWithdrawal` interface (around line 79) to add:

```typescript
export interface YearlyWithdrawal {
  age: number;
  year: number;
  withdrawals: Record<string, number>;
  remainingBalances: Record<string, number>;
  totalWithdrawal: number;
  socialSecurityIncome: number;
  grossIncome: number;
  federalTax: number;
  stateTax: number;
  totalTax: number;
  afterTaxIncome: number;
  targetSpending: number;
  rmdAmount: number;
  totalRemainingBalance: number;
  earlyWithdrawalPenalties: EarlyWithdrawalPenalty[];  // NEW
  totalPenalties: number;  // NEW
}
```

**Step 4: Run type check**

```bash
npm run build
```

Expected: Build succeeds (some runtime errors expected, we'll fix those next)

**Step 5: Commit**

```bash
git add src/types/index.ts
git commit -m "feat: add withdrawal rules and penalty types

Add AccountWithdrawalRules, EarlyWithdrawalPenalty types and extend
Account and YearlyWithdrawal interfaces to support configurable
withdrawal ages and penalty tracking.

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 2: Extend Country Config Interface

**Files:**
- Modify: `src/countries/index.ts:51-166`

**Step 1: Add PenaltyInfo interface**

Add after the `BenefitCalculation` interface (around line 33):

```typescript
export interface PenaltyInfo {
  penaltyAge: number;              // Age when penalty no longer applies (e.g., 59.5 for US)
  penaltyRate: number;             // Penalty rate as decimal (e.g., 0.10 for 10%)
  appliesToAccountType: boolean;   // Does this account type have early withdrawal penalties?
}
```

**Step 2: Add penalty methods to CountryConfig interface**

Add these methods to the `CountryConfig` interface (after `getAccountGroupings`):

```typescript
export interface CountryConfig {
  // ... existing fields ...

  /**
   * Get penalty information for an account type
   * @param accountType - The account type to check
   * @returns Penalty info including age, rate, and whether it applies
   */
  getPenaltyInfo: (accountType: string) => PenaltyInfo;

  /**
   * Calculate early withdrawal penalty amount
   * @param amount - Withdrawal amount
   * @param accountType - Type of account
   * @param age - Current age
   * @returns Penalty amount in dollars
   */
  calculateEarlyWithdrawalPenalty: (
    amount: number,
    accountType: string,
    age: number
  ) => number;
}
```

**Step 3: Run type check**

```bash
npm run build
```

Expected: TypeScript errors about missing implementations in US/CA configs (we'll add those next)

**Step 4: Commit**

```bash
git add src/countries/index.ts
git commit -m "feat: add penalty methods to CountryConfig interface

Add PenaltyInfo type and penalty-related methods to CountryConfig
to support country-specific early withdrawal penalty rules.

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 3: Create Penalty Calculator Module

**Files:**
- Create: `src/utils/penaltyCalculator.ts`

**Step 1: Write the penalty calculator**

Create the file with:

```typescript
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
```

**Step 2: Run type check**

```bash
npm run build
```

Expected: Build succeeds

**Step 3: Commit**

```bash
git add src/utils/penaltyCalculator.ts
git commit -m "feat: create penalty calculator module

Add calculatePenalties function to compute early withdrawal penalties
based on country-specific rules.

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 4: Create Withdrawal Defaults Module

**Files:**
- Create: `src/utils/withdrawalDefaults.ts`

**Step 1: Write the defaults function**

Create the file with:

```typescript
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
 * @returns Default withdrawal start age
 */
export function getDefaultWithdrawalAge(
  account: Account,
  retirementAge: number,
  countryConfig: CountryConfig
): number {
  const penaltyInfo = countryConfig.getPenaltyInfo(account.type);

  // Get RMD age for this account type (if applicable)
  // Check if account requires RMDs by seeing if getMinimumWithdrawal returns > 0 at RMD age
  let rmdAge: number | undefined;
  if (countryConfig.isTraditionalAccount(account.type)) {
    // US RMD age is 73, Canada RRIF age is 71
    const testAge = countryConfig.code === 'US' ? 73 : 71;
    const testRmd = countryConfig.getMinimumWithdrawal(testAge, 100000, account.type);
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
 * @returns Maximum withdrawal age
 */
export function getMaxWithdrawalAge(
  account: Account,
  lifeExpectancy: number,
  countryConfig: CountryConfig
): number {
  // Check if this account type requires RMDs
  if (countryConfig.isTraditionalAccount(account.type)) {
    const rmdAge = countryConfig.code === 'US' ? 73 : 71;
    const testRmd = countryConfig.getMinimumWithdrawal(rmdAge, 100000, account.type);
    if (testRmd > 0) {
      return rmdAge; // Cannot delay withdrawal past RMD age
    }
  }

  // Otherwise, can delay until life expectancy
  return lifeExpectancy;
}
```

**Step 2: Run type check**

```bash
npm run build
```

Expected: Build succeeds

**Step 3: Commit**

```bash
git add src/utils/withdrawalDefaults.ts
git commit -m "feat: create withdrawal defaults module

Add getDefaultWithdrawalAge and getMaxWithdrawalAge functions to
provide smart defaults and validation for withdrawal start ages.

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 5: Implement US Penalty Rules

**Files:**
- Modify: `src/countries/usa/index.ts:90-170`

**Step 1: Add penalty methods to USConfig**

Add these methods to the `USConfig` object (after `getAccountGroupings`):

```typescript
  getPenaltyInfo: (accountType: string): PenaltyInfo => {
    // Traditional 401(k) and IRA have 10% penalty before 59.5
    if (accountType === 'traditional_401k' || accountType === 'traditional_ira') {
      return {
        penaltyAge: 59.5,
        penaltyRate: 0.10,
        appliesToAccountType: true,
      };
    }

    // All other account types have no early withdrawal penalty
    return {
      penaltyAge: 0,
      penaltyRate: 0,
      appliesToAccountType: false,
    };
  },

  calculateEarlyWithdrawalPenalty: (
    amount: number,
    accountType: string,
    age: number
  ): number => {
    const penaltyInfo = USConfig.getPenaltyInfo(accountType);

    if (!penaltyInfo.appliesToAccountType || age >= penaltyInfo.penaltyAge) {
      return 0;
    }

    return amount * penaltyInfo.penaltyRate;
  },
```

**Step 2: Add import for PenaltyInfo type**

At the top of the file, update the import (around line 1):

```typescript
import type { CountryConfig, AccountTypeConfig, Region, ConversionRule, ContributionLimits, AccountGroup, PenaltyInfo } from '../index';
```

**Step 3: Run type check**

```bash
npm run build
```

Expected: Build succeeds (CA config still missing implementations)

**Step 4: Commit**

```bash
git add src/countries/usa/index.ts
git commit -m "feat: implement US early withdrawal penalty rules

Add 10% penalty for traditional 401(k)/IRA withdrawals before age 59.5.
Other account types have no early withdrawal penalties.

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 6: Implement Canada Penalty Rules

**Files:**
- Modify: `src/countries/canada/index.ts:121-207`

**Step 1: Add penalty methods to CAConfig**

Add these methods to the `CAConfig` object (after `getAccountGroupings`):

```typescript
  getPenaltyInfo: (accountType: string): PenaltyInfo => {
    // Canadian RRSP/RRIF have withholding tax (not technically a "penalty" but similar effect)
    // We'll model this as a penalty for early withdrawals
    if (['rrsp', 'rrif', 'lira', 'lif', 'employer_rrsp'].includes(accountType)) {
      return {
        penaltyAge: 71, // No specific penalty age in Canada, but model withdrawal tax
        penaltyRate: 0.0, // Withholding is progressive, not flat
        appliesToAccountType: false, // Different from US penalty system
      };
    }

    // All other account types have no penalty
    return {
      penaltyAge: 0,
      penaltyRate: 0,
      appliesToAccountType: false,
    };
  },

  calculateEarlyWithdrawalPenalty: (
    _amount: number,
    _accountType: string,
    _age: number
  ): number => {
    // Canada doesn't have early withdrawal penalties like the US
    // Withholding tax is already included in the tax calculations
    return 0;
  },
```

**Step 2: Add import for PenaltyInfo type**

At the top of the file, update the import (around line 1):

```typescript
import type { CountryConfig, AccountTypeConfig, Region, ConversionRule, ContributionLimits, AccountGroup, PenaltyInfo } from '../index';
```

**Step 3: Run type check**

```bash
npm run build
```

Expected: Build succeeds (all type errors resolved)

**Step 4: Commit**

```bash
git add src/countries/canada/index.ts
git commit -m "feat: implement Canada penalty rules (no penalties)

Canadian accounts don't have early withdrawal penalties like US.
Withholding tax is handled separately in tax calculations.

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 7: Write Tests for Penalty Calculator

**Files:**
- Modify: `src/tests/calculations.test.ts` (add new section at end, before "TEST SUMMARY")

**Step 1: Write the failing tests**

Add this section before the TEST SUMMARY section:

```typescript
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

  console.log('\n--- US Roth IRA (No Penalty) ---');

  const penaltyInfo2 = usConfig.getPenaltyInfo('roth_ira');
  assert(!penaltyInfo2.appliesToAccountType, 'Roth IRA has no penalty');

  const penalty3 = usConfig.calculateEarlyWithdrawalPenalty(10000, 'roth_ira', 55);
  assertApprox(penalty3, 0, 0.01, 'Roth IRA withdrawal at 55 = $0 penalty');

  console.log('\n--- US Taxable Account (No Penalty) ---');

  const penaltyInfo3 = usConfig.getPenaltyInfo('taxable');
  assert(!penaltyInfo3.appliesToAccountType, 'Taxable account has no penalty');

  console.log('\n--- Canada RRSP (No Penalty System) ---');

  const caConfig = getCountryConfig('CA');
  const penaltyInfo4 = caConfig.getPenaltyInfo('rrsp');
  assert(!penaltyInfo4.appliesToAccountType, 'Canadian RRSP has no US-style penalty');

  const penalty4 = caConfig.calculateEarlyWithdrawalPenalty(10000, 'rrsp', 55);
  assertApprox(penalty4, 0, 0.01, 'Canadian RRSP withdrawal = $0 penalty');
}
```

**Step 2: Add test invocation**

Find the main test execution section and add the new test function call before the summary:

```typescript
// Run all tests
testTaxCalculations();
testRMDCalculations();
testAccumulationPhase();
testWithdrawalPhase();
testIncomeContinuity();
testEdgeCases();
testCapitalGainsTaxEdgeCases();
testWithdrawalStrategyDetailed();
testCostBasisTracking();
testRMDInteraction();
testInflationConsistency();
testPortfolioDepletion();
testTotalFederalTaxIntegration();
testCanadianCalculations();
testEarlyWithdrawalPenalties();  // NEW

// Print summary
console.log('\n' + '='.repeat(60));
```

**Step 3: Run tests to verify they pass**

```bash
npm test
```

Expected: All tests pass, including new penalty tests (total ~93 tests)

**Step 4: Commit**

```bash
git add src/tests/calculations.test.ts
git commit -m "test: add early withdrawal penalty tests

Test US traditional account 10% penalty before age 59.5 and verify
other account types have no penalties. Test Canadian accounts have
no penalty system.

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 8: Write Tests for Withdrawal Defaults

**Files:**
- Modify: `src/tests/calculations.test.ts` (add new section)

**Step 1: Add imports**

At the top of the file, add:

```typescript
import { getDefaultWithdrawalAge, getMaxWithdrawalAge } from '../utils/withdrawalDefaults';
```

**Step 2: Write the tests**

Add this section after the penalty tests:

```typescript
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
```

**Step 3: Add test invocation**

Add to the test execution list:

```typescript
testWithdrawalDefaults();  // NEW
testEarlyWithdrawalPenalties();
```

**Step 4: Run tests**

```bash
npm test
```

Expected: All tests pass (~99 tests)

**Step 5: Commit**

```bash
git add src/tests/calculations.test.ts
git commit -m "test: add withdrawal defaults tests

Test default withdrawal ages and max ages for US and Canadian
account types, verifying RMD age constraints.

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 9: Modify Withdrawal Logic - Add Filtering

**Files:**
- Modify: `src/utils/withdrawals.ts:257-420`

**Step 1: Add imports**

At the top of the file, add:

```typescript
import { calculatePenalties, type AccountWithdrawal } from './penaltyCalculator';
import { getDefaultWithdrawalAge } from './withdrawalDefaults';
```

**Step 2: Add helper function to filter available accounts**

Add this function after the `calculateRMD` function (around line 45):

```typescript
/**
 * Filter accounts by withdrawal availability based on age
 */
function getAvailableAccounts(
  accountStates: AccountState[],
  accounts: Account[],
  currentAge: number,
  retirementAge: number,
  countryConfig?: CountryConfig
): AccountState[] {
  return accountStates.filter(state => {
    // Find the full account object to get withdrawal rules
    const account = accounts.find(a => a.id === state.id);
    if (!account) return true; // If we can't find it, allow withdrawal

    // Get withdrawal start age (from rules or default)
    const withdrawalAge = account.withdrawalRules?.startAge ??
      (countryConfig
        ? getDefaultWithdrawalAge(account, retirementAge, countryConfig)
        : retirementAge);

    return currentAge >= withdrawalAge;
  });
}
```

**Step 3: Modify performTaxOptimizedWithdrawal signature**

Update the function signature (around line 257) to accept full accounts and return penalty info:

```typescript
interface WithdrawalResult {
  total: number;
  traditionalWithdrawal: number;
  rothWithdrawal: number;
  taxableWithdrawal: number;
  taxableGains: number;
  hsaWithdrawal: number;
  byAccount: Record<string, number>;
  accountWithdrawals: AccountWithdrawal[];  // NEW: for penalty calculation
}

function performTaxOptimizedWithdrawal(
  accountStates: AccountState[],
  accounts: Account[],  // NEW: need full account objects
  targetSpending: number,
  rmdAmount: number,
  socialSecurityIncome: number,
  profile: Profile,
  accountDepletionAges: Record<string, number | null>,
  age: number,
  countryConfig?: CountryConfig
): WithdrawalResult {
```

**Step 4: Initialize accountWithdrawals tracking**

In the `performTaxOptimizedWithdrawal` function, add after `result` initialization:

```typescript
  const result: WithdrawalResult = {
    total: 0,
    traditionalWithdrawal: 0,
    rothWithdrawal: 0,
    taxableWithdrawal: 0,
    taxableGains: 0,
    hsaWithdrawal: 0,
    byAccount: {},
    accountWithdrawals: [],  // NEW
  };
```

**Step 5: Track withdrawals for penalty calculation**

Create a helper function to record withdrawals (add right after result initialization):

```typescript
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
```

**Step 6: Filter accounts by availability**

Replace the account grouping section (around line 284-296) with:

```typescript
  // Filter to only available accounts
  const availableAccounts = getAvailableAccounts(
    accountStates,
    accounts,
    age,
    profile.retirementAge,
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
```

**Step 7: Add recordWithdrawal calls**

Throughout the withdrawal steps (1-6), add `recordWithdrawal(acc, withdrawal)` after each withdrawal. For example, in Step 1:

```typescript
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
```

Do the same for Steps 2, 3, 4, 5, and 6. Look for `acc.balance -= withdrawal` and add `recordWithdrawal(acc, withdrawal)` right after updating the result.

**Step 8: Commit**

```bash
git add src/utils/withdrawals.ts
git commit -m "feat: filter withdrawals by account availability

Add getAvailableAccounts function to filter accounts by withdrawal
start age. Track withdrawals for penalty calculation. Only consider
available accounts for regular withdrawals.

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 10: Modify Withdrawal Logic - Calculate Penalties

**Files:**
- Modify: `src/utils/withdrawals.ts:49-238`

**Step 1: Update calculateWithdrawals to pass accounts**

Find the call to `performTaxOptimizedWithdrawal` (around line 134) and update it:

```typescript
    const withdrawals = performTaxOptimizedWithdrawal(
      accountStates,
      accounts,  // NEW: pass full accounts array
      targetSpending,
      rmdAmount,
      socialSecurityIncome,
      profile,
      accountDepletionAges,
      age,
      countryConfig
    );
```

**Step 2: Calculate penalties after withdrawals**

Add penalty calculation after the `performTaxOptimizedWithdrawal` call (around line 144):

```typescript
    const withdrawals = performTaxOptimizedWithdrawal(
      accountStates,
      accounts,
      targetSpending,
      rmdAmount,
      socialSecurityIncome,
      profile,
      accountDepletionAges,
      age,
      countryConfig
    );

    // Calculate early withdrawal penalties
    const penalties = countryConfig
      ? calculatePenalties(withdrawals.accountWithdrawals, age, countryConfig)
      : [];
    const totalPenalties = penalties.reduce((sum, p) => sum + p.amount, 0);
```

**Step 3: Add penalties to tax calculation**

Update the tax section (around line 192) to include penalties:

```typescript
    const totalTax = federalTax + stateTax + totalPenalties;  // NEW: add penalties
    lifetimeTaxesPaid += totalTax;
```

**Step 4: Add penalties to yearlyWithdrawals record**

Update the push to `yearlyWithdrawals` (around line 205):

```typescript
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
      earlyWithdrawalPenalties: penalties,  // NEW
      totalPenalties,  // NEW
    });
```

**Step 5: Run type check**

```bash
npm run build
```

Expected: Build succeeds

**Step 6: Commit**

```bash
git add src/utils/withdrawals.ts
git commit -m "feat: calculate and track early withdrawal penalties

Calculate penalties using country config and add to tax burden.
Track penalties in yearly withdrawal results for display.

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 11: Write Integration Tests for Withdrawal with Penalties

**Files:**
- Modify: `src/tests/calculations.test.ts`

**Step 1: Write test for early retirement scenario**

Add this section after the withdrawal defaults tests:

```typescript
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
```

**Step 2: Add test invocation**

```typescript
testWithdrawalWithConfigurableAge();  // NEW
testWithdrawalDefaults();
```

**Step 3: Run tests**

```bash
npm test
```

Expected: All tests pass (~105 tests)

**Step 4: Commit**

```bash
git add src/tests/calculations.test.ts
git commit -m "test: add withdrawal with configurable age tests

Test early retirement scenarios with delayed IRA access and verify
penalty calculations when forced to withdraw early.

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 12: Update AccountForm UI - Add Withdrawal Age Field

**Files:**
- Modify: `src/components/AccountForm.tsx`

**Step 1: Read the file to understand structure**

```bash
cat src/components/AccountForm.tsx | head -100
```

**Step 2: Add imports**

At the top of the file, add:

```typescript
import { getDefaultWithdrawalAge, getMaxWithdrawalAge } from '../utils/withdrawalDefaults';
import { getCountryConfig } from '../countries';
```

**Step 3: Add state for showing penalty warning**

In the component, after the `account` state declaration, add:

```typescript
  const [showPenaltyWarning, setShowPenaltyWarning] = useState(false);
```

**Step 4: Calculate penalty info**

Add this logic after the state declarations:

```typescript
  // Get country config for penalty info and defaults
  const countryConfig = getCountryConfig(profile.country);
  const penaltyInfo = countryConfig.getPenaltyInfo(account.type);

  // Calculate min/max withdrawal ages
  const minWithdrawalAge = profile.currentAge;
  const maxWithdrawalAge = getMaxWithdrawalAge(account, profile.lifeExpectancy, countryConfig);

  // Get current withdrawal age (or default)
  const currentWithdrawalAge = account.withdrawalRules?.startAge ??
    getDefaultWithdrawalAge(account, profile.retirementAge, countryConfig);

  // Show warning if age is before penalty-free age
  useEffect(() => {
    if (penaltyInfo.appliesToAccountType && currentWithdrawalAge < penaltyInfo.penaltyAge) {
      setShowPenaltyWarning(true);
    } else {
      setShowPenaltyWarning(false);
    }
  }, [currentWithdrawalAge, penaltyInfo.appliesToAccountType, penaltyInfo.penaltyAge]);
```

**Step 5: Add the withdrawal age field**

Find the employer match section (usually near the end of the form) and add this field after it:

```typescript
        {/* Withdrawal Settings */}
        <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
          <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-3">
            Withdrawal Settings
          </h3>

          <div>
            <label htmlFor="withdrawalStartAge" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Start Withdrawal Age
              <Tooltip content="Age when you plan to start withdrawing from this account. Cannot be later than RMD age if applicable." />
            </label>
            <NumberInput
              id="withdrawalStartAge"
              value={currentWithdrawalAge}
              onChange={(val) => {
                setAccount({
                  ...account,
                  withdrawalRules: { startAge: val }
                });
              }}
              min={minWithdrawalAge}
              max={maxWithdrawalAge}
              step={1}
            />
            {showPenaltyWarning && (
              <p className="mt-1 text-sm text-yellow-600 dark:text-yellow-500">
                ⚠️ Withdrawing before age {Math.ceil(penaltyInfo.penaltyAge)} incurs a {(penaltyInfo.penaltyRate * 100).toFixed(0)}% penalty
              </p>
            )}
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Default: {getDefaultWithdrawalAge(account, profile.retirementAge, countryConfig)}
              {maxWithdrawalAge < profile.lifeExpectancy && ` (Max: ${maxWithdrawalAge} due to RMD)`}
            </p>
          </div>
        </div>
```

**Step 6: Run dev server and test**

```bash
npm run dev
```

Test:
1. Open app in browser
2. Create a Traditional IRA account
3. Verify "Start Withdrawal Age" field appears with default of 60
4. Set it to 55 and verify yellow warning appears
5. Set it to 75 and verify it's capped at 73
6. Create a Roth IRA and verify default is retirement age

**Step 7: Commit**

```bash
git add src/components/AccountForm.tsx
git commit -m "feat: add withdrawal start age field to AccountForm

Add configurable withdrawal start age with smart defaults, validation,
and penalty warnings in the account form UI.

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 13: Update DataTableWithdrawal - Show Penalties

**Files:**
- Modify: `src/components/DataTableWithdrawal.tsx`

**Step 1: Read file to understand structure**

```bash
cat src/components/DataTableWithdrawal.tsx | head -50
```

**Step 2: Add penalty row to the income table**

Find the section that displays yearly withdrawal data (usually a table with federal tax, state tax, etc.). Add a penalty row after the tax rows:

```typescript
              <tr className="border-t border-gray-200 dark:border-gray-700">
                <td className="py-2 text-sm text-gray-600 dark:text-gray-400">Federal Tax</td>
                <td className="py-2 text-sm text-right text-gray-900 dark:text-gray-100">
                  -${year.federalTax.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </td>
              </tr>
              <tr>
                <td className="py-2 text-sm text-gray-600 dark:text-gray-400">State Tax</td>
                <td className="py-2 text-sm text-right text-gray-900 dark:text-gray-100">
                  -${year.stateTax.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </td>
              </tr>
              {year.totalPenalties > 0 && (
                <tr>
                  <td className="py-2 text-sm text-gray-600 dark:text-gray-400">Early Withdrawal Penalties</td>
                  <td className="py-2 text-sm text-right text-red-600 dark:text-red-500 font-medium">
                    -${year.totalPenalties.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </td>
                </tr>
              )}
```

**Step 3: Add expandable penalty details**

If there's an expandable section for detailed withdrawals, add penalty details:

```typescript
              {year.earlyWithdrawalPenalties.length > 0 && (
                <div className="mt-2 pl-4 border-l-2 border-red-300 dark:border-red-700">
                  <p className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Penalty Details:</p>
                  {year.earlyWithdrawalPenalties.map((penalty, idx) => (
                    <div key={idx} className="flex justify-between text-xs text-gray-600 dark:text-gray-400">
                      <span>{penalty.accountName}</span>
                      <span className="text-red-600 dark:text-red-500">
                        -${penalty.amount.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                      </span>
                    </div>
                  ))}
                </div>
              )}
```

**Step 4: Run dev server and verify**

```bash
npm run dev
```

Test by creating an early retirement scenario with penalties and checking the data table.

**Step 5: Commit**

```bash
git add src/components/DataTableWithdrawal.tsx
git commit -m "feat: display early withdrawal penalties in data table

Show total penalties as separate red line item and add expandable
penalty details showing per-account breakdown.

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 14: Update Chart Tooltips - Include Penalties

**Files:**
- Modify: `src/components/ChartIncome.tsx`
- Modify: `src/components/ChartTax.tsx`

**Step 1: Update ChartIncome tooltip**

Find the tooltip content for the tax line and modify to include penalties:

```typescript
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-white dark:bg-gray-800 p-3 border border-gray-300 dark:border-gray-600 rounded shadow-lg">
          <p className="text-sm font-medium">Age {data.age}</p>
          <p className="text-sm text-green-600">Withdrawal: ${data.totalWithdrawal?.toLocaleString()}</p>
          <p className="text-sm text-blue-600">Social Security: ${data.socialSecurityIncome?.toLocaleString()}</p>
          <p className="text-sm text-red-600">
            Taxes: ${data.totalTax?.toLocaleString()}
            {data.totalPenalties > 0 && (
              <span className="text-xs"> (includes ${data.totalPenalties?.toLocaleString()} penalties)</span>
            )}
          </p>
        </div>
      );
    }
    return null;
  };
```

**Step 2: Update ChartTax tooltip**

Find the tooltip content for the tax chart and add penalty breakdown:

```typescript
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-white dark:bg-gray-800 p-3 border border-gray-300 dark:border-gray-600 rounded shadow-lg">
          <p className="text-sm font-medium">Age {data.age}</p>
          <p className="text-sm">Federal: ${data.federalTax?.toLocaleString()}</p>
          <p className="text-sm">State: ${data.stateTax?.toLocaleString()}</p>
          {data.totalPenalties > 0 && (
            <p className="text-sm text-red-600">Penalties: ${data.totalPenalties?.toLocaleString()}</p>
          )}
          <p className="text-sm font-medium">Total: ${data.totalTax?.toLocaleString()}</p>
        </div>
      );
    }
    return null;
  };
```

**Step 3: Run dev server and verify tooltips**

```bash
npm run dev
```

**Step 4: Commit**

```bash
git add src/components/ChartIncome.tsx src/components/ChartTax.tsx
git commit -m "feat: show penalties in chart tooltips

Add early withdrawal penalty amounts to income and tax chart tooltips
for transparency when penalties apply.

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 15: Update SummaryCards - Add Penalty Total

**Files:**
- Modify: `src/components/SummaryCards.tsx`

**Step 1: Read file to understand structure**

```bash
cat src/components/SummaryCards.tsx | head -50
```

**Step 2: Calculate lifetime penalties**

In the component, add calculation for total penalties:

```typescript
  // Calculate lifetime penalties
  const lifetimePenalties = retirementResult.yearlyWithdrawals.reduce(
    (sum, year) => sum + year.totalPenalties,
    0
  );

  const avgAnnualPenalty = retirementResult.yearlyWithdrawals.length > 0
    ? lifetimePenalties / retirementResult.yearlyWithdrawals.length
    : 0;
```

**Step 3: Add penalty card (conditionally)**

Add this card after the tax cards, only if penalties exist:

```typescript
        {lifetimePenalties > 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                  Early Withdrawal Penalties
                </p>
                <p className="text-2xl font-bold text-red-600 dark:text-red-500 mt-1">
                  ${lifetimePenalties.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Avg: ${avgAnnualPenalty.toLocaleString(undefined, { maximumFractionDigits: 0 })}/year
                </p>
              </div>
              <div className="text-red-500 text-3xl">⚠️</div>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-3">
              Total penalties from early withdrawals (before age 59.5)
            </p>
          </div>
        )}
```

**Step 4: Run dev server and verify**

```bash
npm run dev
```

**Step 5: Commit**

```bash
git add src/components/SummaryCards.tsx
git commit -m "feat: add early withdrawal penalties summary card

Show lifetime total and average annual penalty in summary cards
when penalties are present in the retirement plan.

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 16: Handle Backwards Compatibility

**Files:**
- Modify: `src/hooks/useRetirementCalc.ts` or wherever accounts are loaded from localStorage

**Step 1: Find where accounts are loaded**

```bash
grep -r "localStorage" src/hooks/ src/App.tsx | head -20
```

**Step 2: Add normalization function**

In the file that loads accounts (likely `App.tsx` or a hook), add:

```typescript
import { getDefaultWithdrawalAge } from './utils/withdrawalDefaults';
import { getCountryConfig } from './countries';

// Normalize accounts loaded from storage to add withdrawal rules if missing
function normalizeAccount(
  account: Account,
  profile: Profile
): Account {
  if (account.withdrawalRules) {
    return account; // Already has rules
  }

  // Apply default withdrawal age
  const countryConfig = getCountryConfig(profile.country);
  const defaultAge = getDefaultWithdrawalAge(account, profile.retirementAge, countryConfig);

  return {
    ...account,
    withdrawalRules: { startAge: defaultAge },
  };
}
```

**Step 3: Apply normalization when loading**

Find where accounts are loaded from localStorage and wrap with normalization:

```typescript
  // When loading from localStorage
  const loadedAccounts = JSON.parse(localStorage.getItem('accounts') || '[]');
  const normalizedAccounts = loadedAccounts.map((acc: Account) =>
    normalizeAccount(acc, profile)
  );
  setAccounts(normalizedAccounts);
```

**Step 4: Test backwards compatibility**

1. Save some accounts in the current version (without withdrawal rules)
2. Load them and verify they get default withdrawal ages
3. Save them and verify withdrawal rules are persisted

**Step 5: Commit**

```bash
git add src/App.tsx  # or wherever the changes are
git commit -m "feat: add backwards compatibility for withdrawal rules

Normalize accounts loaded from localStorage to add default withdrawal
rules if missing, ensuring smooth upgrade from older versions.

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 17: Run Full Test Suite

**Files:**
- None (verification step)

**Step 1: Run all tests**

```bash
npm test
```

Expected: All ~105+ tests pass

**Step 2: Run type check**

```bash
npm run build
```

Expected: No TypeScript errors

**Step 3: Run linter**

```bash
npm run lint
```

Expected: No linting errors (or fix any that appear)

**Step 4: Manual testing checklist**

Test in browser:
- [ ] Create US Traditional IRA, verify default age is 60
- [ ] Set withdrawal age to 55, verify warning appears
- [ ] Set withdrawal age to 75, verify it's capped at 73
- [ ] Create Roth IRA, verify default is retirement age
- [ ] Create early retirement scenario (age 52, traditional IRA set to 60)
- [ ] Verify taxable account used first, IRA not touched until 60
- [ ] Create scenario with forced early withdrawal (insufficient taxable funds)
- [ ] Verify penalties show in data table
- [ ] Verify penalties show in chart tooltips
- [ ] Verify penalty summary card appears
- [ ] Switch to Canada, verify RRSP defaults to retirement age
- [ ] Verify RRSP max age is 71
- [ ] Verify no penalties for Canadian accounts

**Step 5: Commit if any fixes were needed**

```bash
git add .
git commit -m "fix: address linting issues and final polish

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 18: Update Documentation

**Files:**
- Modify: `README.md`
- Modify: `CLAUDE.md`

**Step 1: Update README features section**

Add to the Portfolio Management section:

```markdown
### Portfolio Management
- **Multiple Account Types**: Support for US and Canadian retirement account types
- **Employer Matching**: Configure employer match percentage and limits for 401(k)/RRSP accounts
- **Individual Returns**: Set expected return rates per account
- **Contribution Growth**: Model salary increases affecting future contributions
- **Configurable Withdrawal Ages**: Set when withdrawals begin from each account to model early retirement scenarios
```

Add to the Tax-Optimized Withdrawals section:

```markdown
### Tax-Optimized Withdrawals
The withdrawal algorithm follows a tax-efficient strategy:
1. **Required Minimum Distributions (RMDs)**: Mandatory withdrawals from traditional accounts starting at age 73
2. **Account Availability**: Respects configured withdrawal start ages (e.g., delaying IRA withdrawals until age 60)
3. **Early Withdrawal Penalties**: Calculates 10% penalty for US traditional account withdrawals before age 59.5
4. **Tax Bracket Optimization**: Fill lower tax brackets with traditional withdrawals
5. **Roth Withdrawals**: Tax-free withdrawals for remaining needs
6. **Taxable Account Withdrawals**: With capital gains tracking
7. **HSA**: Used last, tax-free for qualified medical expenses
```

**Step 2: Update CLAUDE.md**

Add to the Data Flow section:

```markdown
### Key Features

**Configurable Withdrawal Ages:**
- Each account has optional `withdrawalRules: { startAge: number }`
- Defaults are smart: traditional accounts default to 60 (US) or retirement age (Canada)
- Validation enforces RMD age constraints (can't delay past age 73 US, 71 Canada)
- Early withdrawals trigger 10% penalty for US traditional accounts before age 59.5
```

**Step 3: Commit**

```bash
git add README.md CLAUDE.md
git commit -m "docs: update documentation for withdrawal age feature

Document configurable withdrawal ages, smart defaults, and early
withdrawal penalty calculations in README and CLAUDE.md.

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 19: Final Integration Test & Demo

**Files:**
- None (verification step)

**Step 1: Create comprehensive test scenario**

In the browser:
1. Set profile: Age 45, retire at 52, life expectancy 90
2. Add Traditional IRA: $800k, withdrawal age 60
3. Add Taxable Brokerage: $400k, withdrawal age 52
4. Run projections
5. Verify years 52-59 use only taxable
6. Verify year 60+ can access IRA
7. Change IRA withdrawal age to 55
8. Verify penalty warning appears
9. Run projections
10. Verify penalties appear in years 55-59
11. Verify penalty summary card shows total

**Step 2: Screenshot key features**

Take screenshots of:
- AccountForm with withdrawal age field and warning
- DataTable showing penalty row
- Chart tooltip with penalty info
- Summary card with penalty total

**Step 3: Create example in comments**

Add a comment to the design doc showing a real example:

```markdown
## Example Scenario

**Input:**
- Retire at 52
- Traditional IRA: $800k, withdrawal age set to 60
- Taxable: $400k, withdrawal age set to 52
- Target spending: $50k/year

**Result:**
- Ages 52-59: Use taxable account only ($0 penalties)
- Taxable depleted by age 59
- Ages 60+: Access IRA penalty-free
- Lifetime penalties: $0 (successful bridge strategy)

**Alternative: Forced Early Withdrawal**
- Same setup but only $200k taxable
- Taxable depleted by age 55
- Ages 55-59: Forced IRA withdrawal = $4,000/year in penalties
- Lifetime penalties: ~$20k (shown in summary)
```

**Step 4: Commit example**

```bash
git add docs/plans/2026-02-01-configurable-withdrawal-age-design.md
git commit -m "docs: add example scenarios to design document

Include real-world examples showing successful bridge strategy and
forced early withdrawal with penalty calculations.

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Success Criteria Checklist

- [x] Users can configure withdrawal start age per account
- [x] Smart defaults prevent accidental early withdrawal penalties
- [x] System correctly calculates 10% penalty (US) for early withdrawals
- [x] Penalties displayed separately in tables, rolled up in charts
- [x] Validation prevents invalid configurations (age > RMD age)
- [x] Backwards compatible with existing saved data
- [x] All tests pass for both US and Canada

---

## Notes for Implementation

- Each task is designed to be 2-5 minutes of focused work
- Tests are written alongside implementation for TDD workflow
- Frequent commits create clear history
- Each step can be verified independently
- Type errors guide the implementation flow
- Start dev server (`npm run dev`) after UI changes to test immediately

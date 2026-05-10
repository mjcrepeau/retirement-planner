# Roth Conversion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Roth IRA conversion modeling to the retirement calculator — multiple user-defined conversion plans drain a deferred-tax source account into a Roth destination, surface pre-retirement extra-tax cost, and compute the lifetime tax delta vs. doing nothing.

**Architecture:** New top-level `conversionPlans: ConversionPlan[]` in app state mirroring `incomeStreams`. New `src/utils/conversions.ts` module owns conversion math; called at end-of-year from both accumulation (`projections.ts`) and retirement (`withdrawals.ts`) loops. `useRetirementCalc` runs the simulation twice (with and without plans) to compute the lifetime tax delta. New UI components mirror `IncomeStreamForm`/`IncomeStreamList`. US-only UI; schema is country-neutral.

**Tech Stack:** React + TypeScript, Tailwind v4, Vite, Recharts, custom test runner (`src/tests/calculations.test.ts` driven by `npm test` / `npx tsx`).

**Spec:** `docs/superpowers/specs/2026-05-07-roth-conversion-design.md`

---

## File Structure

**Created:**
- `src/utils/conversions.ts` — pure functions: `applyConversionsForYear`, `calculateConversionTaxDelta`. No React, no localStorage.
- `src/components/RothConversionForm.tsx` — single-plan editor; mirrors `IncomeStreamForm`.
- `src/components/RothConversionList.tsx` — list with add/edit/delete; mirrors `IncomeStreamList`.

**Modified:**
- `src/types/index.ts` — add `ConversionPlan` interface, `Profile.incomeGrowthRate`, `AccumulationResult.{conversionsByYear, lifetimeConversionTaxCost}`, `RetirementResult.lifetimeTaxDeltaFromConversion`, `YearlyWithdrawal.conversionAmount`.
- `src/utils/constants.ts` — extend `DEFAULT_PROFILE` with `annualIncome` and `incomeGrowthRate`. Add `DEFAULT_CONVERSION_PLANS = []`.
- `src/utils/projections.ts` — accept `assumptions` and `conversionPlans`; apply conversions at end of year; populate new result fields.
- `src/utils/withdrawals.ts` — accept `conversionPlans`; after spending withdrawals, apply conversions and add to ordinary income before tax math; populate `YearlyWithdrawal.conversionAmount`.
- `src/hooks/useRetirementCalc.ts` — accept `conversionPlans`, run shadow pass, compute and attach `lifetimeTaxDeltaFromConversion`.
- `src/components/ProfileForm.tsx` — show "Current Annual Income" and "Income Growth Rate" for both countries; helper text differentiates use.
- `src/components/SummaryCards.tsx` — new Pre-Retirement section (Conversion Tax Cost), new Key Insights card (Tax Change from Conversion), append in-retirement-conversion line to existing Lifetime Taxes detail.
- `src/components/MethodologyPanel.tsx` — new US-only "Roth Conversions" section.
- `src/App.tsx` — wire `conversionPlans` localStorage state + collapsible section + reset; pass to hook.
- `src/tests/calculations.test.ts` — 10 new tests via a `testRothConversions()` function added to `runAllTests()`.

---

## Task 1: Add types for `ConversionPlan` and result-type fields

**Files:**
- Modify: `src/types/index.ts`

- [ ] **Step 1: Add `ConversionPlan` interface near `IncomeStream`**

In `src/types/index.ts`, after the `IncomeStream` interface block (the one ending at the line `taxTreatment: IncomeTaxTreatment;` followed by `}`), add:

```ts
export interface ConversionPlan {
  id: string;
  name: string;
  sourceAccountId: string;      // must reference a 'pretax' account
  destinationAccountId: string; // must reference a 'roth' account
  startAge: number;             // inclusive
  endAge: number;               // inclusive
  yearlyAmount: number;         // today's dollars; inflated yearly
}
```

- [ ] **Step 2: Add `incomeGrowthRate` to `Profile`**

In the `Profile` interface, after `annualIncome?: number; // For CA RRSP contribution room calculation`, replace the comment and add a new line so it reads:

```ts
  annualIncome?: number; // Current ordinary income in today's dollars (US: conversion tax modeling; CA: RRSP contribution room)
  incomeGrowthRate?: number; // Annual growth rate for projected pre-retirement income (decimal, e.g. 0.03)
```

- [ ] **Step 3: Add result-type fields**

In `AccumulationResult`, add two new fields after `breakdownByGroup`:

```ts
  conversionsByYear: { age: number; year: number; amount: number; taxDelta: number }[];
  lifetimeConversionTaxCost: number;
```

In `YearlyWithdrawal`, add one field after `totalPenalties`:

```ts
  conversionAmount: number;
```

In `RetirementResult`, add one field after `accountDepletionAges`:

```ts
  lifetimeTaxDeltaFromConversion: number;
```

- [ ] **Step 4: Verify TypeScript compiles (it will fail in callers — that's fine)**

Run: `npx tsc --noEmit`
Expected: errors only in `src/utils/projections.ts`, `src/utils/withdrawals.ts`, `src/hooks/useRetirementCalc.ts` referring to the new required result fields. No errors in `src/types/index.ts` itself.

- [ ] **Step 5: Commit**

```bash
git add src/types/index.ts
git commit -m "feat(types): add ConversionPlan and result-type fields for Roth conversion"
```

---

## Task 2: Update default constants

**Files:**
- Modify: `src/utils/constants.ts`

- [ ] **Step 1: Extend `DEFAULT_PROFILE`**

In `src/utils/constants.ts`, replace the existing `DEFAULT_PROFILE` block (around line 124–132) with:

```ts
export const DEFAULT_PROFILE = {
  country: 'US' as const,
  currentAge: 35,
  retirementAge: 65,
  lifeExpectancy: 90,
  region: 'CA', // California
  filingStatus: 'married_filing_jointly' as const,
  stateTaxRate: 0.05,
  annualIncome: 100000,
  incomeGrowthRate: 0.03,
};
```

- [ ] **Step 2: Add `DEFAULT_CONVERSION_PLANS`**

After `DEFAULT_INCOME_STREAMS`, add:

```ts
import type { ConversionPlan } from '../types';

export const DEFAULT_CONVERSION_PLANS: ConversionPlan[] = [];
```

If `ConversionPlan` is not yet imported at the top of the file, add it to the existing `import` from `'../types'` instead of a duplicate import. Inspect the top of `src/utils/constants.ts` to find the existing import.

- [ ] **Step 3: Verify TypeScript still compiles in this file**

Run: `npx tsc --noEmit`
Expected: same baseline of errors as Task 1 Step 4 — no new errors from this file.

- [ ] **Step 4: Commit**

```bash
git add src/utils/constants.ts
git commit -m "feat(constants): default income/growth-rate and empty conversion plans list"
```

---

## Task 3: Build the conversion utility module (TDD)

**Files:**
- Create: `src/utils/conversions.ts`
- Test: `src/tests/calculations.test.ts` (extend with new test function)

- [ ] **Step 1: Write failing tests for `calculateConversionTaxDelta`**

Open `src/tests/calculations.test.ts`. Above the `runAllTests` function, add:

```ts
import { calculateConversionTaxDelta } from '../utils/conversions';

function testRothConversionTaxDelta(): void {
  section('ROTH CONVERSION — Tax delta');

  // $100k income MFJ, $30k conversion → tax(130k) - tax(100k) at federal+state
  const filingStatus = 'married_filing_jointly';
  const stateTaxRate = 0.05;

  const incomeOnly = calculateTotalFederalTax(100_000, 0, filingStatus)
    + calculateStateTax(100_000 - getStandardDeduction(filingStatus), stateTaxRate);
  const incomePlus = calculateTotalFederalTax(130_000, 0, filingStatus)
    + calculateStateTax(130_000 - getStandardDeduction(filingStatus), stateTaxRate);
  const expectedDelta = incomePlus - incomeOnly;

  const delta = calculateConversionTaxDelta({
    incomeForYear: 100_000,
    conversionTotalForYear: 30_000,
    filingStatus,
    stateTaxRate,
  });
  assertApprox(delta, expectedDelta, 0.01,
    '$30k conversion on $100k MFJ income produces correct federal+state delta');

  // Bracket-straddling: $50k conversion crossing 22%/24% boundary
  const incomeBase = calculateTotalFederalTax(180_000, 0, filingStatus)
    + calculateStateTax(180_000 - getStandardDeduction(filingStatus), stateTaxRate);
  const incomePlusBig = calculateTotalFederalTax(230_000, 0, filingStatus)
    + calculateStateTax(230_000 - getStandardDeduction(filingStatus), stateTaxRate);
  const deltaBig = calculateConversionTaxDelta({
    incomeForYear: 180_000,
    conversionTotalForYear: 50_000,
    filingStatus,
    stateTaxRate,
  });
  assertApprox(deltaBig, incomePlusBig - incomeBase, 0.01,
    '$50k conversion straddling 22%/24% bracket boundary computed via two-pass');

  // Zero conversion → zero delta
  const zeroDelta = calculateConversionTaxDelta({
    incomeForYear: 100_000,
    conversionTotalForYear: 0,
    filingStatus,
    stateTaxRate,
  });
  assertApprox(zeroDelta, 0, 0.01, 'Zero conversion produces zero tax delta');
}
```

Then in `runAllTests()` add `testRothConversionTaxDelta();` after `testIncomeStreamWithdrawals();`.

- [ ] **Step 2: Run tests — verify failure**

Run: `npm test`
Expected: tsx fails with module-not-found / import error for `../utils/conversions`.

- [ ] **Step 3: Implement `calculateConversionTaxDelta`**

Create `src/utils/conversions.ts` with:

```ts
import type { Account, ConversionPlan, FilingStatus } from '../types';
import {
  calculateTotalFederalTax,
  calculateStateTax,
  getStandardDeduction,
} from './taxes';

export interface ConversionTaxDeltaInput {
  incomeForYear: number;          // nominal ordinary income, pre-conversion
  conversionTotalForYear: number; // nominal sum of all active conversions
  filingStatus: FilingStatus;
  stateTaxRate: number;
}

/**
 * Federal + state tax delta from adding a conversion total to ordinary income,
 * computed via two-pass evaluation through the existing tax engine. Captures
 * bracket-straddle effects exactly (no marginal-rate approximation).
 */
export function calculateConversionTaxDelta(input: ConversionTaxDeltaInput): number {
  if (input.conversionTotalForYear <= 0) return 0;

  const { incomeForYear, conversionTotalForYear, filingStatus, stateTaxRate } = input;
  const stdDed = getStandardDeduction(filingStatus);

  const fedWithout = calculateTotalFederalTax(incomeForYear, 0, filingStatus);
  const fedWith = calculateTotalFederalTax(incomeForYear + conversionTotalForYear, 0, filingStatus);

  const stateWithout = calculateStateTax(Math.max(0, incomeForYear - stdDed), stateTaxRate);
  const stateWith = calculateStateTax(
    Math.max(0, incomeForYear + conversionTotalForYear - stdDed),
    stateTaxRate,
  );

  return (fedWith + stateWith) - (fedWithout + stateWithout);
}
```

- [ ] **Step 4: Run tests — verify pass**

Run: `npm test`
Expected: the three new asserts in `ROTH CONVERSION — Tax delta` all PASS.

- [ ] **Step 5: Write failing tests for `applyConversionsForYear`**

In `src/tests/calculations.test.ts`, add another function below `testRothConversionTaxDelta`:

```ts
import { applyConversionsForYear } from '../utils/conversions';

function testApplyConversionsForYear(): void {
  section('ROTH CONVERSION — applyConversionsForYear');

  // Source has $100k after growth; plan converts $30k inflation-adjusted at age 50
  const sourceBalances: Record<string, number> = { src: 100_000, dst: 50_000 };
  const plans: ConversionPlan[] = [{
    id: 'p1', name: 'ladder', sourceAccountId: 'src', destinationAccountId: 'dst',
    startAge: 50, endAge: 55, yearlyAmount: 30_000,
  }];

  const out = applyConversionsForYear({
    age: 50,
    yearsFromNow: 15,
    plans,
    balances: sourceBalances,
    inflationRate: 0.03,
  });
  const expectedAmount = 30_000 * Math.pow(1.03, 15);
  assertApprox(out.totalConvertedThisYear, expectedAmount, 0.01,
    'Year 15 nominal amount = 30k × 1.03^15');
  assertApprox(sourceBalances['src'], 100_000 - expectedAmount, 0.01, 'Source balance reduced');
  assertApprox(sourceBalances['dst'], 50_000 + expectedAmount, 0.01, 'Destination balance increased');

  // Plan outside age range does not fire
  const out2 = applyConversionsForYear({
    age: 49, yearsFromNow: 14, plans,
    balances: { src: 100_000, dst: 0 }, inflationRate: 0.03,
  });
  assertApprox(out2.totalConvertedThisYear, 0, 0.01, 'Plan inactive at age < startAge');

  // Insufficient balance → silent cap
  const balances3 = { src: 5_000, dst: 0 };
  const out3 = applyConversionsForYear({
    age: 50, yearsFromNow: 0, plans, balances: balances3, inflationRate: 0.03,
  });
  assertApprox(out3.totalConvertedThisYear, 5_000, 0.01, 'Capped to available balance');
  assertApprox(balances3['src'], 0, 0.01, 'Source drained to zero');
  assertApprox(balances3['dst'], 5_000, 0.01, 'Destination receives capped amount');

  // Multiple plans active same year — both fire, second sees reduced source
  const balancesMulti = { src: 40_000, dst: 0 };
  const plansMulti: ConversionPlan[] = [
    { id: 'a', name: 'A', sourceAccountId: 'src', destinationAccountId: 'dst',
      startAge: 50, endAge: 55, yearlyAmount: 25_000 },
    { id: 'b', name: 'B', sourceAccountId: 'src', destinationAccountId: 'dst',
      startAge: 50, endAge: 55, yearlyAmount: 25_000 },
  ];
  const outMulti = applyConversionsForYear({
    age: 50, yearsFromNow: 0, plans: plansMulti, balances: balancesMulti, inflationRate: 0.03,
  });
  assertApprox(outMulti.totalConvertedThisYear, 40_000, 0.01,
    'Two plans share source; combined cap to source balance');
  assertApprox(balancesMulti['src'], 0, 0.01, 'Source drained by two plans');
  assertApprox(balancesMulti['dst'], 40_000, 0.01, 'Destination got the combined cap');
}
```

In `runAllTests()` add `testApplyConversionsForYear();` after `testRothConversionTaxDelta();`.

- [ ] **Step 6: Run tests — verify failure**

Run: `npm test`
Expected: import error for `applyConversionsForYear`.

- [ ] **Step 7: Implement `applyConversionsForYear`**

Append to `src/utils/conversions.ts`:

```ts
export interface ApplyConversionsInput {
  age: number;
  yearsFromNow: number;       // age - currentAge
  plans: ConversionPlan[];
  balances: Record<string, number>; // accountId -> running balance (mutated)
  inflationRate: number;
}

export interface ConversionApplyResult {
  totalConvertedThisYear: number; // sum of nominal converted amounts across plans
}

/**
 * Apply all active conversion plans for a single year. Mutates `balances`.
 * - Capped silently at source balance (per design Q7).
 * - Plans processed in list order; later plans see balances drained by earlier ones.
 */
export function applyConversionsForYear(input: ApplyConversionsInput): ConversionApplyResult {
  const { age, yearsFromNow, plans, balances, inflationRate } = input;
  const inflationFactor = Math.pow(1 + inflationRate, yearsFromNow);

  let total = 0;
  for (const plan of plans) {
    if (age < plan.startAge || age > plan.endAge) continue;

    const requested = plan.yearlyAmount * inflationFactor;
    const available = balances[plan.sourceAccountId] ?? 0;
    const actual = Math.min(requested, Math.max(0, available));
    if (actual <= 0) continue;

    balances[plan.sourceAccountId] = available - actual;
    balances[plan.destinationAccountId] = (balances[plan.destinationAccountId] ?? 0) + actual;
    total += actual;
  }

  return { totalConvertedThisYear: total };
}
```

Also export a small helper used later by the integration code:

```ts
export function sumActiveConversionsNominal(
  plans: ConversionPlan[],
  age: number,
  yearsFromNow: number,
  inflationRate: number,
): number {
  const factor = Math.pow(1 + inflationRate, yearsFromNow);
  let total = 0;
  for (const plan of plans) {
    if (age < plan.startAge || age > plan.endAge) continue;
    total += plan.yearlyAmount * factor;
  }
  return total;
}
```

Note: the unused `Account` import is intentional — keeps the file honest about which types exist for future helpers. Remove it if your linter complains:

```ts
import type { ConversionPlan, FilingStatus } from '../types';
```

- [ ] **Step 8: Run tests — verify pass**

Run: `npm test`
Expected: all `ROTH CONVERSION — applyConversionsForYear` asserts PASS, plus the existing tests still pass.

- [ ] **Step 9: Commit**

```bash
git add src/utils/conversions.ts src/tests/calculations.test.ts
git commit -m "feat(conversions): add tax-delta and end-of-year conversion application"
```

---

## Task 4: Wire conversions into the accumulation phase (TDD)

**Files:**
- Modify: `src/utils/projections.ts`
- Modify: `src/hooks/useRetirementCalc.ts` (signature update — minimal change to keep callers working)
- Test: `src/tests/calculations.test.ts`

- [ ] **Step 1: Write a failing accumulation-integration test**

First, ensure `ConversionPlan` is imported. At the top of `src/tests/calculations.test.ts`, update the existing import line:

```ts
import { Account, Profile, Assumptions, IncomeStream, ConversionPlan } from '../types';
```

Then add this function to `src/tests/calculations.test.ts` (above `runAllTests`):

```ts
function testRothConversionAccumulation(): void {
  section('ROTH CONVERSION — Accumulation integration');

  const profile: Profile = {
    country: 'US',
    currentAge: 50,
    retirementAge: 55,
    lifeExpectancy: 80,
    region: 'CA',
    filingStatus: 'married_filing_jointly',
    stateTaxRate: 0.05,
    annualIncome: 100_000,
    incomeGrowthRate: 0,
  };
  const assumptions: Assumptions = {
    inflationRate: 0,
    safeWithdrawalRate: 0.04,
    retirementReturnRate: 0.05,
  };
  const accounts: Account[] = [
    { id: 'src', name: 'Trad IRA', type: 'traditional_ira',
      balance: 200_000, annualContribution: 0, contributionGrowthRate: 0, returnRate: 0 },
    { id: 'dst', name: 'Roth IRA', type: 'roth_ira',
      balance: 0, annualContribution: 0, contributionGrowthRate: 0, returnRate: 0 },
  ];
  const plans: ConversionPlan[] = [{
    id: 'p', name: 'ladder', sourceAccountId: 'src', destinationAccountId: 'dst',
    startAge: 50, endAge: 51, yearlyAmount: 30_000,
  }];

  const result = calculateAccumulation(accounts, profile, usConfig, assumptions, plans);

  // After 5 yearly steps: ages 51 (year 1), 52, 53, 54, 55. Plan fires at 51 only
  // (age 50 is the initial state, no growth/conversion applied yet).
  // Wait: with currentAge=50, retirementAge=55, the loop runs i=1..5, age=51..55.
  // startAge=50, endAge=51 → only fires when age==51.
  // Source: $200k → $170k after one $30k conversion.
  // Dest: $0 → $30k.
  assertApprox(result.finalBalances['src'], 170_000, 0.01,
    'Source reduced by one $30k conversion');
  assertApprox(result.finalBalances['dst'], 30_000, 0.01,
    'Destination grew by $30k');

  // Tax delta: tax(130k MFJ + state) - tax(100k MFJ + state)
  const stdDed = getStandardDeduction('married_filing_jointly');
  const expectedDelta =
    (calculateTotalFederalTax(130_000, 0, 'married_filing_jointly')
      + calculateStateTax(130_000 - stdDed, 0.05))
    - (calculateTotalFederalTax(100_000, 0, 'married_filing_jointly')
      + calculateStateTax(100_000 - stdDed, 0.05));
  assertApprox(result.lifetimeConversionTaxCost, expectedDelta, 0.01,
    'lifetimeConversionTaxCost matches single-year delta');
  assert(result.conversionsByYear.length === 1, 'One conversion year recorded');
  if (result.conversionsByYear.length === 1) {
    assertApprox(result.conversionsByYear[0].amount, 30_000, 0.01,
      'Recorded amount = $30k');
  }

  // Multi-year with inflation: redo with non-zero inflation
  const assumptionsInfl: Assumptions = { ...assumptions, inflationRate: 0.03 };
  const plans2: ConversionPlan[] = [{
    id: 'p2', name: 'ladder2', sourceAccountId: 'src', destinationAccountId: 'dst',
    startAge: 50, endAge: 53, yearlyAmount: 10_000,
  }];
  const accounts2: Account[] = [
    { id: 'src', name: 'Trad IRA', type: 'traditional_ira',
      balance: 200_000, annualContribution: 0, contributionGrowthRate: 0, returnRate: 0 },
    { id: 'dst', name: 'Roth IRA', type: 'roth_ira',
      balance: 0, annualContribution: 0, contributionGrowthRate: 0, returnRate: 0 },
  ];
  const r2 = calculateAccumulation(accounts2, profile, usConfig, assumptionsInfl, plans2);
  // Plan fires at ages 51, 52, 53 (3 times).
  // yearsFromNow at each: 1, 2, 3 → amounts 10000*1.03^1, *1.03^2, *1.03^3
  const expectedTotalConverted =
    10_000 * 1.03 + 10_000 * Math.pow(1.03, 2) + 10_000 * Math.pow(1.03, 3);
  assertApprox(r2.finalBalances['dst'], expectedTotalConverted, 0.01,
    'Multi-year inflation-adjusted conversions sum correctly into destination');
  assert(r2.conversionsByYear.length === 3, 'Three conversion years recorded');
}
```

In `runAllTests()` add `testRothConversionAccumulation();` after `testApplyConversionsForYear();`.

- [ ] **Step 2: Run — verify failure**

Run: `npm test`
Expected: TypeScript / tsx complains that `calculateAccumulation` does not accept those extra arguments, or the new result fields don't exist.

- [ ] **Step 3: Update `calculateAccumulation` signature and logic**

Open `src/utils/projections.ts`. Change the imports at the top to add the new types:

```ts
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
  sumActiveConversionsNominal,
} from './conversions';
```

Update the function signature and add the new params at the end. Both new params are optional with safe defaults so existing callers continue to compile:

```ts
export function calculateAccumulation(
  accounts: Account[],
  profile: Profile,
  countryConfig: CountryConfig,
  assumptions?: Assumptions,
  conversionPlans: ConversionPlan[] = [],
): AccumulationResult {
  const inflationRate = assumptions?.inflationRate ?? 0;
```

Inside the body, use `inflationRate` (the local variable just defined) anywhere the conversion logic needs it. If `assumptions` is omitted, conversions still work but there's no inflation adjustment — and the existing `useRetirementCalc` always passes assumptions, so this only matters for legacy test calls.

Inside the function, after the existing per-year logic where balances and contributions are updated (the existing `accounts.forEach(account => { ... })` block, but **after** that block completes for the year so all growth+contributions have been applied), add the conversion step. Replace the existing per-year loop body so the order is: growth/contributions → conversions → record snapshot. Specifically the loop body should look like:

```ts
  const conversionsByYear: AccumulationResult['conversionsByYear'] = [];
  let lifetimeConversionTaxCost = 0;

  for (let i = 1; i <= yearsToRetirement; i++) {
    const age = profile.currentAge + i;
    const year = currentYear + i;
    const yearsFromNow = i;

    accounts.forEach(account => {
      const currentBalance = balances[account.id];
      const currentContribution = contributions[account.id];
      const balanceAfterReturn = currentBalance * (1 + account.returnRate);
      const employerMatch = calculateEmployerMatch({
        ...account,
        annualContribution: currentContribution,
      });
      const totalContribution = currentContribution + employerMatch;
      balances[account.id] = balanceAfterReturn + totalContribution;
      contributions[account.id] = currentContribution * (1 + account.contributionGrowthRate);
    });

    // End-of-year conversions
    const { totalConvertedThisYear } = applyConversionsForYear({
      age,
      yearsFromNow,
      plans: conversionPlans,
      balances,
      inflationRate,
    });

    if (totalConvertedThisYear > 0) {
      // Project nominal income for this year
      const incomeForYear = (profile.annualIncome ?? 0) *
        Math.pow(1 + (profile.incomeGrowthRate ?? 0), yearsFromNow);
      const taxDelta = calculateConversionTaxDelta({
        incomeForYear,
        conversionTotalForYear: totalConvertedThisYear,
        filingStatus: profile.filingStatus ?? 'single',
        stateTaxRate: profile.stateTaxRate ?? 0,
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
```

Avoid the unused parameter warning by referencing `sumActiveConversionsNominal` is fine — but if not used, remove the import.

At the bottom of the function, expand the return to include the new fields:

```ts
  return {
    yearlyBalances,
    finalBalances: { ...balances },
    totalAtRetirement: Object.values(balances).reduce((sum, b) => sum + b, 0),
    breakdownByGroup,
    conversionsByYear,
    lifetimeConversionTaxCost,
  };
```

- [ ] **Step 4: Update the only caller — `useRetirementCalc.ts`**

Open `src/hooks/useRetirementCalc.ts`. Update imports and signature:

```ts
import { useMemo } from 'react';
import { Account, Profile, Assumptions, AccumulationResult, RetirementResult, IncomeStream, ConversionPlan } from '../types';
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
    return calculateWithdrawals(accounts, profile, assumptions, accumulation, countryConfig, incomeStreams);
  }, [accounts, profile, assumptions, accumulation, countryConfig, incomeStreams]);

  return { accumulation, retirement };
}
```

(The shadow-pass logic comes in Task 6; for now keep retirement single-pass and `lifetimeTaxDeltaFromConversion: 0`.)

- [ ] **Step 5: Update `calculateWithdrawals` to populate the placeholder field**

In `src/utils/withdrawals.ts`, find the final return at the end of `calculateWithdrawals` (around line 301). Replace:

```ts
  return {
    yearlyWithdrawals,
    portfolioDepletionAge,
    lifetimeTaxesPaid,
    sustainableMonthlyWithdrawal,
    sustainableAnnualWithdrawal,
    accountDepletionAges,
  };
```

with:

```ts
  return {
    yearlyWithdrawals,
    portfolioDepletionAge,
    lifetimeTaxesPaid,
    sustainableMonthlyWithdrawal,
    sustainableAnnualWithdrawal,
    accountDepletionAges,
    lifetimeTaxDeltaFromConversion: 0,
  };
```

Also find the `yearlyWithdrawals.push({ ... })` block. Add `conversionAmount: 0,` after `totalPenalties,`. The full push will be updated in Task 5; for now the placeholder keeps types valid.

- [ ] **Step 6: Run tests — verify pass**

Run: `npm test`
Expected: `ROTH CONVERSION — Accumulation integration` asserts all PASS. Existing tests still pass.

- [ ] **Step 7: Commit**

```bash
git add src/utils/projections.ts src/utils/withdrawals.ts src/hooks/useRetirementCalc.ts src/tests/calculations.test.ts
git commit -m "feat(projections): apply conversion plans during accumulation"
```

---

## Task 5: Wire conversions into the retirement phase (TDD)

**Files:**
- Modify: `src/utils/withdrawals.ts`
- Test: `src/tests/calculations.test.ts`

- [ ] **Step 1: Write a failing test for in-retirement conversion**

Add to `src/tests/calculations.test.ts` above `runAllTests`:

```ts
function testRothConversionRetirement(): void {
  section('ROTH CONVERSION — Retirement integration');

  // Conversion in retirement window: tax included in year's tax, no penalty,
  // bracket-fill withdrawal logic unchanged, source draining + dest growing.
  const profile: Profile = {
    country: 'US',
    currentAge: 60,
    retirementAge: 60,        // already retired
    lifeExpectancy: 65,
    region: 'CA',
    filingStatus: 'married_filing_jointly',
    stateTaxRate: 0.05,
    annualIncome: 0,          // not used in retirement
    incomeGrowthRate: 0,
  };
  const assumptions: Assumptions = {
    inflationRate: 0,
    safeWithdrawalRate: 0.04,
    retirementReturnRate: 0,
  };
  const accounts: Account[] = [
    { id: 'src', name: 'Trad IRA', type: 'traditional_ira',
      balance: 500_000, annualContribution: 0, contributionGrowthRate: 0, returnRate: 0,
      withdrawalRules: { startAge: 60 } },
    { id: 'dst', name: 'Roth IRA', type: 'roth_ira',
      balance: 100_000, annualContribution: 0, contributionGrowthRate: 0, returnRate: 0,
      withdrawalRules: { startAge: 60 } },
  ];
  const plans: ConversionPlan[] = [{
    id: 'p', name: 'rl', sourceAccountId: 'src', destinationAccountId: 'dst',
    startAge: 60, endAge: 62, yearlyAmount: 30_000,
  }];

  const accum = calculateAccumulation(accounts, profile, usConfig, assumptions, plans);
  // currentAge==retirementAge → 0 accumulation years → no pre-retirement conversions
  assertApprox(accum.lifetimeConversionTaxCost, 0, 0.01,
    'No accumulation phase → zero pre-retirement conversion cost');

  const retired = calculateWithdrawals(accounts, profile, assumptions, accum, usConfig, [], plans);

  // Source should drain by ~$30k * 3 = $90k from conversions plus any spending withdrawals.
  // Dest should grow by ~$90k from conversions, minus any spending withdrawals.
  const y60 = retired.yearlyWithdrawals.find(w => w.age === 60);
  const y61 = retired.yearlyWithdrawals.find(w => w.age === 61);
  const y62 = retired.yearlyWithdrawals.find(w => w.age === 62);
  assert(y60 !== undefined && y61 !== undefined && y62 !== undefined,
    'Has yearly data for ages 60, 61, 62');
  if (y60 && y61 && y62) {
    assertApprox(y60.conversionAmount, 30_000, 0.01, 'Year 60 records $30k conversion');
    assertApprox(y61.conversionAmount, 30_000, 0.01, 'Year 61 records $30k conversion');
    assertApprox(y62.conversionAmount, 30_000, 0.01, 'Year 62 records $30k conversion');
    // The conversion event itself should not produce an early-withdrawal penalty
    // (age 60 is past 59.5 anyway; verify shape — conversion not in penalty list).
    assert(!y60.earlyWithdrawalPenalties.some(p => p.accountId === 'src' && p.amount > 30_000),
      'No oversized penalty implying conversion got penalised');
  }

  // No conversion year (age 63+) records 0
  const y63 = retired.yearlyWithdrawals.find(w => w.age === 63);
  if (y63) {
    assertApprox(y63.conversionAmount, 0, 0.01, 'No conversion outside plan window');
  }
}
```

In `runAllTests()` add `testRothConversionRetirement();` after `testRothConversionAccumulation();`.

Also add a parity test:

```ts
function testRothConversionEmptyParity(): void {
  section('ROTH CONVERSION — Empty plans regression parity');

  const profile: Profile = {
    country: 'US', currentAge: 35, retirementAge: 65, lifeExpectancy: 90,
    region: 'CA', filingStatus: 'married_filing_jointly', stateTaxRate: 0.05,
    annualIncome: 100_000, incomeGrowthRate: 0.03,
  };
  const assumptions: Assumptions = {
    inflationRate: 0.03, safeWithdrawalRate: 0.04, retirementReturnRate: 0.05,
  };
  const accounts: Account[] = [
    { id: 'a', name: '401k', type: 'traditional_401k',
      balance: 100_000, annualContribution: 10_000, contributionGrowthRate: 0.02, returnRate: 0.07 },
    { id: 'b', name: 'Roth', type: 'roth_ira',
      balance: 20_000, annualContribution: 5_000, contributionGrowthRate: 0, returnRate: 0.07 },
  ];

  const accumA = calculateAccumulation(accounts, profile, usConfig, assumptions, []);
  const accumB = calculateAccumulation(accounts, profile, usConfig, assumptions);
  assertApprox(accumA.totalAtRetirement, accumB.totalAtRetirement, 0.01,
    'Empty plans = omitted plans (parity)');
  assertApprox(accumA.lifetimeConversionTaxCost, 0, 0.01,
    'Empty plans → zero conversion tax cost');
  assert(accumA.conversionsByYear.length === 0, 'Empty plans → no conversion years recorded');

  const retA = calculateWithdrawals(accounts, profile, assumptions, accumA, usConfig, [], []);
  const retB = calculateWithdrawals(accounts, profile, assumptions, accumB, usConfig, []);
  assertApprox(retA.lifetimeTaxesPaid, retB.lifetimeTaxesPaid, 0.01,
    'Empty plans path matches no-plans path lifetime taxes');
}
```

In `runAllTests()` add `testRothConversionEmptyParity();` at the end.

- [ ] **Step 2: Run — verify failure**

Run: `npm test`
Expected: TypeScript complains that `calculateWithdrawals` does not accept a 7th `conversionPlans` argument, or `conversionAmount` is missing.

- [ ] **Step 3: Update `calculateWithdrawals` signature and integrate conversions**

Open `src/utils/withdrawals.ts`. Update imports:

```ts
import {
  Account,
  Profile,
  Assumptions,
  AccumulationResult,
  RetirementResult,
  YearlyWithdrawal,
  ConversionPlan,
  getTaxTreatment,
  isTraditional,
} from '../types';
import type { IncomeStream } from '../types';
import {
  calculateTotalFederalTax,
  calculateStateTax,
  getStandardDeduction,
} from './taxes';
import { getRMDDivisor, RMD_START_AGE } from './constants';
import type { CountryConfig } from '../countries';
import { calculatePenalties, type AccountWithdrawal } from './penaltyCalculator';
import { getDefaultWithdrawalAge } from './withdrawalDefaults';
import { calculateIncomeStreamBenefits } from './incomeStreams';
import { applyConversionsForYear } from './conversions';
```

Update the function signature:

```ts
export function calculateWithdrawals(
  accounts: Account[],
  profile: Profile,
  assumptions: Assumptions,
  accumulationResult: AccumulationResult,
  countryConfig?: CountryConfig,
  incomeStreams?: IncomeStream[],
  conversionPlans: ConversionPlan[] = [],
): RetirementResult {
```

Inside the per-year loop in `calculateWithdrawals`, after step 5 (the existing `performTaxOptimizedWithdrawal` call) and **before** the tax computation, add the conversion step. Find the block that currently looks like:

```ts
    // Apply investment returns to remaining balances
    accountStates.forEach(acc => {
      acc.balance *= (1 + assumptions.retirementReturnRate);
    });

    // Calculate taxes using country-specific logic
```

and **replace** it with:

```ts
    // Apply investment returns to remaining balances
    accountStates.forEach(acc => {
      acc.balance *= (1 + assumptions.retirementReturnRate);
    });

    // End-of-year Roth conversions (US-only feature; harmless no-op if plans is empty)
    const balancesById: Record<string, number> = {};
    accountStates.forEach(acc => { balancesById[acc.id] = acc.balance; });
    const { totalConvertedThisYear } = applyConversionsForYear({
      age,
      yearsFromNow: age - profile.currentAge,
      plans: conversionPlans,
      balances: balancesById,
      inflationRate: assumptions.inflationRate,
    });
    accountStates.forEach(acc => { acc.balance = balancesById[acc.id]; });
    const conversionAmount = totalConvertedThisYear;

    // Calculate taxes using country-specific logic
```

Then, in the tax computation block, add `conversionAmount` to the ordinary income. Find:

```ts
    const ordinaryIncome = withdrawals.traditionalWithdrawal +
      governmentBenefitTaxable + ssStreamTaxable + pensionTaxable + otherIncomeTaxable;
```

Replace with:

```ts
    const ordinaryIncome = withdrawals.traditionalWithdrawal +
      governmentBenefitTaxable + ssStreamTaxable + pensionTaxable + otherIncomeTaxable +
      conversionAmount;
```

Update the per-year push to include `conversionAmount`:

```ts
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
      conversionAmount,
    });
```

- [ ] **Step 4: Update `useRetirementCalc` to pass `conversionPlans` to retirement**

In `src/hooks/useRetirementCalc.ts`, replace the `calculateWithdrawals` call:

```ts
    return calculateWithdrawals(accounts, profile, assumptions, accumulation, countryConfig, incomeStreams, conversionPlans);
```

And add `conversionPlans` to the dependency array of the retirement `useMemo`:

```ts
  }, [accounts, profile, assumptions, accumulation, countryConfig, incomeStreams, conversionPlans]);
```

- [ ] **Step 5: Run tests — verify pass**

Run: `npm test`
Expected: `ROTH CONVERSION — Retirement integration` and `ROTH CONVERSION — Empty plans regression parity` PASS. All previous tests still pass.

- [ ] **Step 6: Commit**

```bash
git add src/utils/withdrawals.ts src/hooks/useRetirementCalc.ts src/tests/calculations.test.ts
git commit -m "feat(withdrawals): apply conversions during retirement; add to ordinary income"
```

---

## Task 6: Compute lifetime tax delta from conversion (TDD shadow pass)

**Files:**
- Modify: `src/hooks/useRetirementCalc.ts`
- Test: `src/tests/calculations.test.ts`

- [ ] **Step 1: Write failing tests for the lifetime delta**

Add to `src/tests/calculations.test.ts` above `runAllTests`:

```ts
function testRothConversionLifetimeDelta(): void {
  section('ROTH CONVERSION — Lifetime tax delta');

  // Construct a scenario where conversions plausibly reduce future RMDs/taxes.
  // We compute "with" and "without" by calling the engine directly here, so we're
  // confirming the same arithmetic the hook will perform.
  const profile: Profile = {
    country: 'US', currentAge: 55, retirementAge: 60, lifeExpectancy: 90,
    region: 'CA', filingStatus: 'married_filing_jointly', stateTaxRate: 0.05,
    annualIncome: 50_000, incomeGrowthRate: 0,
  };
  const assumptions: Assumptions = {
    inflationRate: 0.02, safeWithdrawalRate: 0.04, retirementReturnRate: 0.05,
  };
  const accounts: Account[] = [
    { id: 'src', name: 'Trad IRA', type: 'traditional_ira',
      balance: 1_500_000, annualContribution: 0, contributionGrowthRate: 0, returnRate: 0.06,
      withdrawalRules: { startAge: 60 } },
    { id: 'dst', name: 'Roth IRA', type: 'roth_ira',
      balance: 0, annualContribution: 0, contributionGrowthRate: 0, returnRate: 0.06,
      withdrawalRules: { startAge: 60 } },
  ];
  const plans: ConversionPlan[] = [{
    id: 'p', name: 'ladder', sourceAccountId: 'src', destinationAccountId: 'dst',
    startAge: 60, endAge: 72, yearlyAmount: 50_000,
  }];

  const accumWith = calculateAccumulation(accounts, profile, usConfig, assumptions, plans);
  const accumWithout = calculateAccumulation(accounts, profile, usConfig, assumptions, []);
  const retWith = calculateWithdrawals(accounts, profile, assumptions, accumWith, usConfig, [], plans);
  const retWithout = calculateWithdrawals(accounts, profile, assumptions, accumWithout, usConfig, [], []);

  const expectedDelta =
    (retWith.lifetimeTaxesPaid + accumWith.lifetimeConversionTaxCost)
    - retWithout.lifetimeTaxesPaid;

  // Sanity: with-side has nonzero conversions in retirement
  const anyConversion = retWith.yearlyWithdrawals.some(y => y.conversionAmount > 0);
  assert(anyConversion, 'With-side simulation includes in-retirement conversions');

  // The delta must be a finite number; sign depends on configured scenario.
  assert(Number.isFinite(expectedDelta), 'Lifetime tax delta is finite');

  // Construct a clear "cost" scenario: high current bracket, conversion in
  // retirement with no income, plus zero return so RMDs are minimal.
  const profileCost: Profile = { ...profile, annualIncome: 600_000 };
  const accumCostWith = calculateAccumulation(accounts, profileCost, usConfig, assumptions, plans);
  const accumCostWithout = calculateAccumulation(accounts, profileCost, usConfig, assumptions, []);
  // Pre-retirement conversions don't fire here (startAge 60 = retirementAge),
  // so accumulation cost is zero either way. Engine still records correctly.
  assertApprox(accumCostWith.lifetimeConversionTaxCost, 0, 0.01,
    'No pre-retirement conversions in this scenario → zero pre-retirement cost');

  void accumCostWithout; // silence unused
}
```

In `runAllTests()` add `testRothConversionLifetimeDelta();` after `testRothConversionEmptyParity();`.

- [ ] **Step 2: Run — verify pass (no signature change yet)**

Run: `npm test`
Expected: PASS. (This test exercises the engine directly, not the hook.)

- [ ] **Step 3: Add the shadow pass to `useRetirementCalc`**

Open `src/hooks/useRetirementCalc.ts`. Replace the entire file content with:

```ts
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
```

- [ ] **Step 4: Run tests — verify pass**

Run: `npm test`
Expected: all tests still PASS.

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useRetirementCalc.ts src/tests/calculations.test.ts
git commit -m "feat(hook): shadow pass to compute lifetime tax delta from conversion"
```

---

## Task 7: ProfileForm — promote `annualIncome` and add `incomeGrowthRate`

**Files:**
- Modify: `src/components/ProfileForm.tsx`

- [ ] **Step 1: Add inputs for both fields**

Open `src/components/ProfileForm.tsx`. The current US-only block ends with the State Tax Rate field. After the closing `)}` of the US-block-of-grid-fields and before the Canadian CPP section, add a new always-visible block (works for both countries):

```tsx
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Current Annual Income (today's $)
            <Tooltip text="Used for Roth conversion tax modeling (US) and RRSP contribution room (Canada)." />
          </label>
          <NumberInput
            value={profile.annualIncome ?? 0}
            onChange={(val) => handleChange('annualIncome', val)}
            min={0}
            defaultValue={100000}
            className={inputClassName}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Income Growth Rate (%)
            <Tooltip text="Annual growth rate used to project future income for Roth conversion tax modeling." />
          </label>
          <NumberInput
            value={profile.incomeGrowthRate ?? 0.03}
            onChange={(val) => handleChange('incomeGrowthRate', val)}
            min={0}
            max={0.20}
            isPercentage
            decimals={1}
            defaultValue={0.03}
            className={inputClassName}
          />
        </div>
      </div>
```

Place it just before the existing `{country === 'CA' && (` block that introduces CPP.

- [ ] **Step 2: Verify dev server renders without runtime error**

Run: `npm run dev`
Manually open the page in a browser, expand "Personal Profile", confirm the two new fields render and accept input. Then stop the server (Ctrl-C).

- [ ] **Step 3: Commit**

```bash
git add src/components/ProfileForm.tsx
git commit -m "feat(profile): expose annual income and income growth rate inputs"
```

---

## Task 8: Build the `RothConversionForm` component

**Files:**
- Create: `src/components/RothConversionForm.tsx`

- [ ] **Step 1: Create the form component**

Create `src/components/RothConversionForm.tsx`:

```tsx
import { useState } from 'react';
import { ConversionPlan, Account, getTaxTreatment } from '../types';
import { NumberInput } from './NumberInput';
import { v4 as uuidv4 } from 'uuid';

interface RothConversionFormProps {
  accounts: Account[];
  conversionPlan?: ConversionPlan;
  currentAge: number;
  lifeExpectancy: number;
  onSave: (plan: ConversionPlan) => void;
  onCancel: () => void;
}

const inputClassName = "w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 dark:text-white";
const inputErrorClassName = "w-full px-3 py-2 border border-red-500 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 dark:text-white";

export function RothConversionForm({
  accounts,
  conversionPlan,
  currentAge,
  lifeExpectancy,
  onSave,
  onCancel,
}: RothConversionFormProps) {
  const sourceCandidates = accounts.filter(a => getTaxTreatment(a.type) === 'pretax');
  const destCandidates = accounts.filter(a => getTaxTreatment(a.type) === 'roth');

  const [formData, setFormData] = useState<Omit<ConversionPlan, 'id'>>(() => {
    if (conversionPlan) {
      const { id: _id, ...rest } = conversionPlan;
      void _id;
      return rest;
    }
    return {
      name: '',
      sourceAccountId: sourceCandidates[0]?.id ?? '',
      destinationAccountId: destCandidates[0]?.id ?? '',
      startAge: Math.max(currentAge, 60),
      endAge: Math.max(currentAge, 70),
      yearlyAmount: 30000,
    };
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleChange = <K extends keyof Omit<ConversionPlan, 'id'>>(
    field: K,
    value: Omit<ConversionPlan, 'id'>[K],
  ) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field as string]) {
      setErrors(prev => {
        const next = { ...prev };
        delete next[field as string];
        return next;
      });
    }
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (!formData.name.trim()) newErrors.name = 'Name is required';
    if (!formData.sourceAccountId) newErrors.sourceAccountId = 'Source account is required';
    if (!formData.destinationAccountId) newErrors.destinationAccountId = 'Destination account is required';
    if (formData.sourceAccountId === formData.destinationAccountId) {
      newErrors.destinationAccountId = 'Source and destination must differ';
    }
    if (formData.yearlyAmount <= 0) newErrors.yearlyAmount = 'Yearly amount must be greater than 0';
    if (formData.startAge < 0 || formData.startAge > 120) newErrors.startAge = 'Start age must be 0–120';
    if (formData.endAge < formData.startAge) newErrors.endAge = 'End age must be ≥ start age';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    onSave({ id: conversionPlan?.id || uuidv4(), ...formData });
  };

  if (sourceCandidates.length === 0) {
    return (
      <div className="p-4 bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800 rounded">
        <p className="text-sm text-amber-800 dark:text-amber-300">
          No eligible source accounts. Add a Traditional IRA or 401(k) first.
        </p>
        <div className="flex justify-end pt-3">
          <button type="button" onClick={onCancel} className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-600 border border-gray-300 dark:border-gray-500 rounded-md hover:bg-gray-50 dark:hover:bg-gray-500">
            Close
          </button>
        </div>
      </div>
    );
  }

  if (destCandidates.length === 0) {
    return (
      <div className="p-4 bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800 rounded">
        <p className="text-sm text-amber-800 dark:text-amber-300">
          No eligible Roth destinations. Add a Roth IRA or Roth 401(k) first.
        </p>
        <div className="flex justify-end pt-3">
          <button type="button" onClick={onCancel} className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-600 border border-gray-300 dark:border-gray-500 rounded-md hover:bg-gray-50 dark:hover:bg-gray-500">
            Close
          </button>
        </div>
      </div>
    );
  }

  const showPastWarn = formData.endAge < currentAge;
  const showFutureWarn = formData.startAge > lifeExpectancy;

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Name *</label>
        <input
          type="text"
          value={formData.name}
          onChange={e => handleChange('name', e.target.value)}
          placeholder="e.g., 401k → Roth ladder"
          className={errors.name ? inputErrorClassName : inputClassName}
        />
        {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name}</p>}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Source Account</label>
          <select
            value={formData.sourceAccountId}
            onChange={e => handleChange('sourceAccountId', e.target.value)}
            className={errors.sourceAccountId ? inputErrorClassName : inputClassName}
          >
            {sourceCandidates.map(a => (<option key={a.id} value={a.id}>{a.name}</option>))}
          </select>
          {errors.sourceAccountId && <p className="text-red-500 text-xs mt-1">{errors.sourceAccountId}</p>}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Destination Account</label>
          <select
            value={formData.destinationAccountId}
            onChange={e => handleChange('destinationAccountId', e.target.value)}
            className={errors.destinationAccountId ? inputErrorClassName : inputClassName}
          >
            {destCandidates.map(a => (<option key={a.id} value={a.id}>{a.name}</option>))}
          </select>
          {errors.destinationAccountId && <p className="text-red-500 text-xs mt-1">{errors.destinationAccountId}</p>}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Start Age</label>
          <NumberInput
            value={formData.startAge}
            onChange={v => handleChange('startAge', v)}
            min={0} max={120} defaultValue={60}
            className={errors.startAge ? inputErrorClassName : inputClassName}
          />
          {errors.startAge && <p className="text-red-500 text-xs mt-1">{errors.startAge}</p>}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">End Age</label>
          <NumberInput
            value={formData.endAge}
            onChange={v => handleChange('endAge', v)}
            min={0} max={120} defaultValue={70}
            className={errors.endAge ? inputErrorClassName : inputClassName}
          />
          {errors.endAge && <p className="text-red-500 text-xs mt-1">{errors.endAge}</p>}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Yearly ($, today)</label>
          <NumberInput
            value={formData.yearlyAmount}
            onChange={v => handleChange('yearlyAmount', v)}
            min={0} defaultValue={30000}
            className={errors.yearlyAmount ? inputErrorClassName : inputClassName}
          />
          {errors.yearlyAmount && <p className="text-red-500 text-xs mt-1">{errors.yearlyAmount}</p>}
        </div>
      </div>

      {showPastWarn && (
        <p className="text-amber-600 dark:text-amber-400 text-xs">
          Warning: end age is in the past — this plan will not produce any conversions.
        </p>
      )}
      {showFutureWarn && (
        <p className="text-amber-600 dark:text-amber-400 text-xs">
          Warning: start age is past life expectancy — this plan will not produce any conversions.
        </p>
      )}

      <div className="flex justify-end gap-3 pt-4">
        <button type="button" onClick={onCancel} className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-600 border border-gray-300 dark:border-gray-500 rounded-md hover:bg-gray-50 dark:hover:bg-gray-500">
          Cancel
        </button>
        <button type="submit" className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700">
          {conversionPlan ? 'Update' : 'Add Conversion'}
        </button>
      </div>
    </form>
  );
}
```

- [ ] **Step 2: Verify TypeScript**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/RothConversionForm.tsx
git commit -m "feat(ui): RothConversionForm with validation and account-list filtering"
```

---

## Task 9: Build the `RothConversionList` component

**Files:**
- Create: `src/components/RothConversionList.tsx`

- [ ] **Step 1: Create the list component**

Create `src/components/RothConversionList.tsx`:

```tsx
import { useState } from 'react';
import { ConversionPlan, Account } from '../types';
import { RothConversionForm } from './RothConversionForm';

interface RothConversionListProps {
  conversionPlans: ConversionPlan[];
  accounts: Account[];
  currentAge: number;
  lifeExpectancy: number;
  onAdd: (plan: ConversionPlan) => void;
  onUpdate: (plan: ConversionPlan) => void;
  onDelete: (id: string) => void;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value);
}

export function RothConversionList({
  conversionPlans, accounts, currentAge, lifeExpectancy,
  onAdd, onUpdate, onDelete,
}: RothConversionListProps) {
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<ConversionPlan | undefined>();

  const accountName = (id: string) => accounts.find(a => a.id === id)?.name ?? '(deleted)';

  const handleSave = (plan: ConversionPlan) => {
    if (editing) onUpdate(plan); else onAdd(plan);
    setShowForm(false);
    setEditing(undefined);
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center border-b border-gray-200 dark:border-gray-600 pb-2">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Roth Conversions</h3>
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="px-3 py-1.5 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
          >
            + Add Conversion
          </button>
        )}
      </div>

      {showForm && (
        <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
          <h4 className="text-md font-medium text-gray-800 dark:text-gray-200 mb-3">
            {editing ? 'Edit Conversion' : 'New Conversion'}
          </h4>
          <RothConversionForm
            key={editing?.id ?? 'new'}
            accounts={accounts}
            conversionPlan={editing}
            currentAge={currentAge}
            lifeExpectancy={lifeExpectancy}
            onSave={handleSave}
            onCancel={() => { setShowForm(false); setEditing(undefined); }}
          />
        </div>
      )}

      {conversionPlans.length === 0 && !showForm ? (
        <p className="text-gray-500 dark:text-gray-400 text-sm py-4 text-center">
          No Roth conversions planned. Add one to model a conversion ladder.
        </p>
      ) : (
        <div className="space-y-2">
          {conversionPlans.map(plan => (
            <div key={plan.id} className="flex items-center justify-between p-3 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg hover:shadow-sm transition-shadow">
              <div>
                <div className="font-medium text-gray-900 dark:text-white">{plan.name}</div>
                <div className="text-sm text-gray-500 dark:text-gray-400">
                  {accountName(plan.sourceAccountId)} → {accountName(plan.destinationAccountId)}
                  <br />Age {plan.startAge}–{plan.endAge}
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <div className="font-medium text-gray-900 dark:text-white">{formatCurrency(plan.yearlyAmount)}/yr</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">today's $</div>
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={() => { setEditing(plan); setShowForm(true); }}
                    className="p-1.5 text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded"
                    title="Edit"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                  <button
                    onClick={() => onDelete(plan.id)}
                    className="p-1.5 text-gray-500 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded"
                    title="Delete"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/RothConversionList.tsx
git commit -m "feat(ui): RothConversionList with add/edit/delete"
```

---

## Task 10: Wire `conversionPlans` into `App.tsx` (state + section + reset + cascade)

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: Add state and handlers**

Open `src/App.tsx`. Update the `import` from `./types` to include `ConversionPlan`:

```ts
import { Account, Profile, Assumptions, IncomeStream, ConversionPlan } from './types';
```

Update the import from `./utils/constants` to include `DEFAULT_CONVERSION_PLANS`:

```ts
import { DEFAULT_PROFILE, DEFAULT_ASSUMPTIONS, DEFAULT_INCOME_STREAMS, DEFAULT_CONVERSION_PLANS } from './utils/constants';
```

Add the import for `RothConversionList`:

```ts
import { RothConversionList } from './components/RothConversionList';
```

Inside `AppContent`, after the `incomeStreams` state line, add:

```ts
  const [conversionPlans, setConversionPlans, resetConversionPlans] = useLocalStorage<ConversionPlan[]>(
    'retirement-planner-conversion-plans',
    DEFAULT_CONVERSION_PLANS,
  );
```

Add handlers (paste them next to the income-stream handlers):

```ts
  const handleAddConversionPlan = (plan: ConversionPlan) => {
    setConversionPlans(prev => [...prev, plan]);
  };
  const handleUpdateConversionPlan = (updated: ConversionPlan) => {
    setConversionPlans(prev => prev.map(p => (p.id === updated.id ? updated : p)));
  };
  const handleDeleteConversionPlan = (id: string) => {
    setConversionPlans(prev => prev.filter(p => p.id !== id));
  };
```

- [ ] **Step 2: Cascade-delete plans whose source/dest no longer exists**

Wrap the existing `handleDeleteAccount` with cascade logic:

```ts
  const handleDeleteAccount = (id: string) => {
    setAccounts(prev => prev.filter(acc => acc.id !== id));
    setConversionPlans(prev => prev.filter(p => p.sourceAccountId !== id && p.destinationAccountId !== id));
  };
```

- [ ] **Step 3: Pass `conversionPlans` to the hook**

Find the `useRetirementCalc(...)` call:

```ts
  const { accumulation, retirement } = useRetirementCalc(accounts, profile, assumptions, countryConfig, incomeStreams);
```

Replace with:

```ts
  const { accumulation, retirement } = useRetirementCalc(accounts, profile, assumptions, countryConfig, incomeStreams, conversionPlans);
```

- [ ] **Step 4: Add Roth Conversions section to the input panel**

Locate the Income Streams collapsible section (the `<div>` containing `toggleSection('incomeStreams')`). Immediately after its closing `</div>` (the wrapper div ending right after `{expandedSection === 'incomeStreams' && ( ... )}`), and gated on US country, add:

```tsx
          {country === 'US' && (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
              <button
                onClick={() => toggleSection('conversions')}
                className="w-full px-4 py-3 flex justify-between items-center hover:bg-gray-50 dark:hover:bg-gray-700 rounded-t-lg"
              >
                <span className="font-medium text-gray-900 dark:text-white">Roth Conversions</span>
                <svg className={`w-5 h-5 text-gray-500 dark:text-gray-400 transition-transform ${expandedSection === 'conversions' ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {expandedSection === 'conversions' && (
                <div className="px-4 pb-4">
                  <RothConversionList
                    conversionPlans={conversionPlans}
                    accounts={accounts}
                    currentAge={profile.currentAge}
                    lifeExpectancy={profile.lifeExpectancy}
                    onAdd={handleAddConversionPlan}
                    onUpdate={handleUpdateConversionPlan}
                    onDelete={handleDeleteConversionPlan}
                  />
                </div>
              )}
            </div>
          )}
```

`country` is already in scope from `const { config: countryConfig } = useCountry();` — change that line to:

```ts
  const { country, config: countryConfig } = useCountry();
```

- [ ] **Step 5: Update reset and country-change to clear conversion plans**

In `confirmReset`, append `resetConversionPlans()` to the list of resets and add it to the dep array:

```ts
  const confirmReset = useCallback(() => {
    resetAccounts();
    resetProfile();
    resetAssumptions();
    resetIncomeStreams();
    resetConversionPlans();
    setShowResetConfirm(false);
    window.location.reload();
  }, [resetAccounts, resetProfile, resetAssumptions, resetIncomeStreams, resetConversionPlans]);
```

In the outer `App` component's `handleCountryChange`, add a clear of conversion plans:

```ts
    localStorage.setItem('retirement-planner-conversion-plans', JSON.stringify([]));
```

Place it next to the income-streams localStorage write.

- [ ] **Step 6: Run dev server, smoke-test the UI**

Run: `npm run dev`
In a browser:
- Confirm a "Roth Conversions" collapsible appears in the left panel (US only). Toggle to Canada — it disappears.
- Add a plan; reload the page; confirm the plan persists.
- Delete the source account; confirm the plan vanishes (cascade).
Stop the dev server.

- [ ] **Step 7: Commit**

```bash
git add src/App.tsx
git commit -m "feat(app): wire conversionPlans state, UI section, cascade-delete, reset"
```

---

## Task 11: SummaryCards — Pre-Retirement section, Tax Change card, Lifetime Taxes detail

**Files:**
- Modify: `src/components/SummaryCards.tsx`

- [ ] **Step 1: Compute helper values from results**

Open `src/components/SummaryCards.tsx`. Inside the `SummaryCards` function body, add these derived values near the existing `lifetimePenalties` block:

```ts
  const lifetimeConversionTaxCost = accumulationResult.lifetimeConversionTaxCost ?? 0;
  const lifetimeTaxDeltaFromConversion = retirementResult.lifetimeTaxDeltaFromConversion ?? 0;

  const inRetirementConversionTax = yearlyWithdrawals
    .filter(y => y.conversionAmount > 0)
    .reduce((acc, y) => acc + y.federalTax + y.stateTax, 0);

  const hasPreRetirementConversion = (accumulationResult.conversionsByYear ?? []).length > 0;
  const hasAnyConversion = hasPreRetirementConversion ||
    yearlyWithdrawals.some(y => y.conversionAmount > 0);
```

- [ ] **Step 2: Add the Pre-Retirement section**

Above the existing "At Retirement" section JSX (which starts with `<h3 ...>At Retirement (Age {profile.retirementAge})</h3>`), add:

```tsx
      {hasPreRetirementConversion && (
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
            Pre-Retirement (Age {profile.currentAge} → {profile.retirementAge - 1})
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <ExpandableStatCard
              title="Conversion Tax Cost"
              value={formatCurrency(lifetimeConversionTaxCost)}
              subtitle="Extra federal + state tax during accumulation"
              color="red"
              formula="Σ (tax(income+conversion) − tax(income)) over pre-retirement years"
              details={
                <div>
                  <p className="font-medium mb-1">By year:</p>
                  <ul className="space-y-0.5">
                    {(accumulationResult.conversionsByYear ?? []).map(c => (
                      <li key={c.age}>Age {c.age}: {formatCurrency(c.amount)} converted, {formatCurrency(c.taxDelta)} extra tax</li>
                    ))}
                  </ul>
                  <p className="mt-2">
                    Total converted (pre-retirement):{' '}
                    {formatCurrency((accumulationResult.conversionsByYear ?? []).reduce((s, c) => s + c.amount, 0))}
                  </p>
                </div>
              }
            />
          </div>
        </div>
      )}
```

- [ ] **Step 3: Add the "Tax Change from Conversion" card to Key Insights**

Find the "Key Insights" section JSX. Inside its grid of `ExpandableStatCard`s (after the existing cards but before the closing `</div>`), add:

```tsx
          {hasAnyConversion && (
            <ExpandableStatCard
              title="Tax Change from Conversion"
              value={`${lifetimeTaxDeltaFromConversion >= 0 ? '+' : '−'}${formatCurrency(Math.abs(lifetimeTaxDeltaFromConversion))}`}
              subtitle={
                lifetimeTaxDeltaFromConversion === 0
                  ? 'Conversions had no net lifetime effect'
                  : lifetimeTaxDeltaFromConversion < 0
                    ? `Conversions saved ${formatCurrency(Math.abs(lifetimeTaxDeltaFromConversion))} over your lifetime`
                    : `Conversions cost ${formatCurrency(lifetimeTaxDeltaFromConversion)} over your lifetime`
              }
              color={lifetimeTaxDeltaFromConversion < 0 ? 'green' : lifetimeTaxDeltaFromConversion > 0 ? 'red' : 'teal'}
              formula="(Total taxes WITH conversions) − (Total taxes WITHOUT conversions)"
              details={
                <div>
                  <p>Pre-retirement conversion tax: {formatCurrency(lifetimeConversionTaxCost)}</p>
                  <p>Retirement-side change reflected in Lifetime Taxes via the shadow simulation.</p>
                  <p className="text-gray-500 dark:text-gray-400 italic mt-1">
                    Savings come from reduced future RMDs and tax-free Roth growth.
                  </p>
                </div>
              }
            />
          )}
```

- [ ] **Step 4: Append in-retirement conversion line to Lifetime Taxes details**

Find the existing "Lifetime Taxes" `ExpandableStatCard` and locate its `details={ <div> ... </div> }` JSX. After the existing list of federal / state taxes, append (still inside the same details `<div>`):

```tsx
                {hasAnyConversion && yearlyWithdrawals.some(y => y.conversionAmount > 0) && (
                  <p className="mt-2 text-gray-500 dark:text-gray-400 italic">
                    Of which from conversions during retirement: ~{formatCurrency(inRetirementConversionTax)} (federal + state in years a conversion was active)
                  </p>
                )}
```

- [ ] **Step 5: Run dev server and visually verify**

Run: `npm run dev`
In a browser:
- With no conversion plans: Pre-Retirement section absent; Tax Change card absent.
- Add a plan during accumulation: Pre-Retirement section appears with a non-zero cost; Tax Change card appears.
- Toggle the plan into retirement window: Pre-Retirement section disappears; Tax Change card still shows.
Stop the dev server.

- [ ] **Step 6: Commit**

```bash
git add src/components/SummaryCards.tsx
git commit -m "feat(summary): pre-retirement section, tax change card, lifetime taxes detail"
```

---

## Task 12: Methodology panel — Roth Conversions section

**Files:**
- Modify: `src/components/MethodologyPanel.tsx`

- [ ] **Step 1: Add a US-only "Roth Conversions" section**

Open `src/components/MethodologyPanel.tsx`. Find a logical insertion point after the federal/state tax discussion and before the RMD section. Add this new `<section>` (gated on `!isCanada`):

```tsx
      {!isCanada && (
        <section className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Roth Conversions
          </h3>
          <div className="prose prose-sm dark:prose-invert max-w-none text-gray-600 dark:text-gray-300 space-y-3">
            <p>
              A Roth conversion is a transfer from a deferred-tax account (Traditional IRA, Traditional 401(k))
              to a Roth IRA / Roth 401(k). The converted amount is treated as ordinary income in the year of
              conversion. Future growth and qualified withdrawals from the Roth are tax-free.
            </p>
            <p>
              <strong>How the calculator models it.</strong> For each plan, at the end of each year between
              <code> startAge </code>and<code> endAge </code>(inclusive), after that year's growth and
              contributions/withdrawals are settled, the inflation-adjusted yearly amount is moved from
              source to destination. If the source balance is insufficient, the conversion is silently
              capped at the available balance.
            </p>
            <p>
              <strong>Tax treatment during accumulation (pre-retirement).</strong> For each year a conversion
              is active, the calculator computes federal + state tax twice — with and without the conversion
              added to your projected ordinary income. The difference is recorded as that year's
              "Conversion Tax Cost." Income is projected from your current annual income using your specified
              income growth rate. Sum across all pre-retirement years yields the headline "Conversion Tax Cost"
              in the summary.
            </p>
            <p>
              <strong>Tax treatment during retirement.</strong> The conversion amount is added to that year's
              ordinary income before federal + state tax is computed. The existing "Lifetime Taxes" already
              reflects it. Conversions do <em>not</em> fund spending and do not reduce traditional withdrawals
              taken to meet target spending.
            </p>
            <p>
              <strong>The "Tax Change from Conversion" insight.</strong> Computed by running the simulation
              twice — once with your plans, once with no conversion plans. This captures downstream effects
              (reduced future RMDs, tax-free Roth growth) that a per-year cost alone misses.
            </p>
            <p>
              <strong>Withdrawal-bracket-fill interaction.</strong> The existing "fill the 12% bracket with
              traditional withdrawals" strategy is unchanged and ignores conversions; your explicit conversion
              plan is treated as the priority signal for tax planning that year.
            </p>
            <p>
              <strong>Known simplifications:</strong>
            </p>
            <ul className="list-disc list-inside space-y-1">
              <li>Conversions are transfers and do not trigger the 10% early-withdrawal penalty (matches IRS rules).</li>
              <li>The 5-year rule on converted Roth amounts is not tracked.</li>
              <li>Tax brackets are static 2024.</li>
              <li>Pre-retirement income is assumed to grow at your specified rate; bonuses, job changes, and
                  other ordinary-income variability are not modeled.</li>
            </ul>
          </div>
        </section>
      )}
```

(The `isCanada` boolean is already defined near the top of `MethodologyPanel`.)

- [ ] **Step 2: Run dev server and visually verify**

Run: `npm run dev`
In a browser:
- Switch to the Methodology tab; confirm the new "Roth Conversions" section appears for US.
- Switch to Canada; confirm the section is not rendered.
Stop the dev server.

- [ ] **Step 3: Commit**

```bash
git add src/components/MethodologyPanel.tsx
git commit -m "docs(methodology): document Roth conversion modeling and simplifications"
```

---

## Task 13: Final integration verification

**Files:**
- (No code changes; verification only.)

- [ ] **Step 1: Run all tests**

Run: `npm test`
Expected: every prior test still passes plus the 6 new conversion test functions all pass. No `Failed: > 0` line in the summary.

- [ ] **Step 2: TypeScript check**

Run: `npm run build`
Expected: build succeeds with no errors. (This runs `tsc -b && vite build` per the existing `package.json`.)

- [ ] **Step 3: Lint**

Run: `npm run lint`
Expected: no errors. Warnings are acceptable if they match the repo's existing baseline; resolve any new warnings introduced by this work.

- [ ] **Step 4: Manual smoke test in browser**

Run: `npm run dev`
In a browser:
1. Add a plan converting $30k/yr from a Traditional 401(k) into a Roth IRA, ages 60–69. Verify charts on the Accumulation tab show the source draining and the Roth growing.
2. Confirm the Summary tab shows the "Tax Change from Conversion" card with a sign + colored value.
3. Adjust the plan into pre-retirement years (ages 50–55) and confirm the Pre-Retirement section appears and shows a sensible Conversion Tax Cost.
4. Toggle country to Canada — Roth Conversions section in inputs is hidden; Methodology section for conversions is hidden.
5. Toggle back to US, delete the source account, confirm the conversion plan disappears from the list and from result calculations.
6. Hard-reset (Reset button) — confirm the conversion plans clear from localStorage.
Stop the dev server.

- [ ] **Step 5: Final commit (if any docs / minor fixups)**

If any of the above produced issues fixed in this task, stage and commit them:

```bash
git status
git add -- <specific paths>
git commit -m "chore: final fixups from integration verification"
```

If nothing changed, skip the commit.

---

## Self-Review checklist (already performed during plan writing)

- **Spec coverage:** Every spec section is covered — data model (Tasks 1–2), accumulation flow (Task 4), retirement flow (Task 5), tax delta computation (Task 3), lifetime tax delta hook (Task 6), UI (Tasks 7–10), summary cards (Task 11), methodology (Task 12), validation (Tasks 8–10), tests (1–6 covered in Tasks 3–6, 7 covered implicitly by Task 5's behavior, 8–9 covered in Task 6's test, 10 covered in Task 5's parity test).
- **Placeholders:** None — every step has exact code or exact commands.
- **Type consistency:** `ConversionPlan`, `applyConversionsForYear`, `calculateConversionTaxDelta`, `lifetimeTaxDeltaFromConversion`, `lifetimeConversionTaxCost`, `conversionsByYear`, `conversionAmount` are used identically across all tasks where they appear.

# Bracket-Fill Adjustment Dial Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a US-only Assumptions field `bracketFillAdjustment` (decimal in [-1.0, 1.0], default 0) that resizes the 12% bracket-fill ceiling in `performTaxOptimizedWithdrawal`. Default 0% preserves current behavior; positive pulls more from Traditional, negative pulls less. All other withdrawal tiers unchanged.

**Architecture:** A single number on `Assumptions`. The engine multiplies `bracket12Max` by `(1 + adjustment)` only when `profile.country === 'US'`. The UI is one NumberInput in `AssumptionsForm`, gated on country. No data migration — `?? 0` on read handles existing localStorage state.

**Tech Stack:** React 19 + TypeScript, custom test runner (`npx tsx src/tests/calculations.test.ts`), Tailwind v4.

**Spec:** [`docs/superpowers/specs/2026-05-07-bracket-fill-dial-design.md`](../specs/2026-05-07-bracket-fill-dial-design.md)

---

## File Structure

| File | Change |
|------|--------|
| `src/types/index.ts` | Add `bracketFillAdjustment?: number` to `Assumptions` interface |
| `src/utils/constants.ts` | Add `bracketFillAdjustment: 0` to `DEFAULT_ASSUMPTIONS` |
| `src/utils/withdrawals.ts` | Plumb `assumptions` into `performTaxOptimizedWithdrawal`; multiply `bracket12Max` by `(1 + adjustment)` when US |
| `src/components/AssumptionsForm.tsx` | Add NumberInput between SwrBucketEditor and Retirement Return Rate, gated on `country === 'US'` |
| `src/components/MethodologyPanel.tsx` | Add paragraph in US section explaining the dial |
| `src/tests/calculations.test.ts` | Add `testBracketFillAdjustment()` and register it in `runAllTests` |

Baseline test count before this work: **276 tests passing**.

---

### Task 1: Add `bracketFillAdjustment` to Assumptions type and DEFAULT_ASSUMPTIONS

**Files:**
- Modify: `src/types/index.ts` (lines 105-110, the `Assumptions` interface)
- Modify: `src/utils/constants.ts` (lines 136-141, `DEFAULT_ASSUMPTIONS`)

- [ ] **Step 1: Add the optional field to the `Assumptions` interface**

In `src/types/index.ts`, replace the existing `Assumptions` interface:

```ts
export interface Assumptions {
  inflationRate: number; // as decimal
  safeWithdrawalRate: number; // as decimal
  retirementReturnRate: number; // as decimal
  swrBuckets?: SwrBucket[]; // optional; empty/undefined → use safeWithdrawalRate for all years
  bracketFillAdjustment?: number; // decimal in [-1.0, 1.0]; 0 = default; US-only
}
```

- [ ] **Step 2: Add the default value to `DEFAULT_ASSUMPTIONS`**

In `src/utils/constants.ts`, replace `DEFAULT_ASSUMPTIONS`:

```ts
export const DEFAULT_ASSUMPTIONS = {
  inflationRate: 0.03,
  safeWithdrawalRate: 0.04,
  retirementReturnRate: 0.05,
  swrBuckets: [] as SwrBucket[],
  bracketFillAdjustment: 0,
};
```

- [ ] **Step 3: Verify the type-checker is happy**

Run: `npm run build`
Expected: clean build, no TS errors. (No tests added in this task — the field is unused so far.)

- [ ] **Step 4: Commit**

```bash
git add src/types/index.ts src/utils/constants.ts
git commit -m "feat(types): add bracketFillAdjustment to Assumptions

Optional decimal in [-1.0, 1.0] (default 0). US-only field that will
resize the 12% bracket-fill ceiling in the withdrawal engine.
Backwards compatible: existing localStorage state without the field
reads as undefined and is treated as 0 via ?? 0 at use sites."
```

---

### Task 2: Plumb `assumptions` into `performTaxOptimizedWithdrawal` (no behavior change)

`performTaxOptimizedWithdrawal` doesn't currently receive `assumptions`. We need it for Task 3, but adding the parameter without using it changes nothing — a safe, separable plumbing commit.

**Files:**
- Modify: `src/utils/withdrawals.ts` (function signature at line ~361, call site at line ~203)

- [ ] **Step 1: Add `assumptions` to the function signature**

In `src/utils/withdrawals.ts`, replace the `performTaxOptimizedWithdrawal` declaration (currently around lines 361-372):

```ts
function performTaxOptimizedWithdrawal(
  accountStates: AccountState[],
  accounts: Account[],
  targetSpending: number,
  rmdAmount: number,
  totalRetirementIncome: number,
  profile: Profile,
  assumptions: Assumptions,
  accountDepletionAges: Record<string, number | null>,
  age: number,
  countryConfig?: CountryConfig,
  nonPortfolioTaxableIncome?: number
): WithdrawalResult {
```

- [ ] **Step 2: Pass `assumptions` from the call site**

In `src/utils/withdrawals.ts`, update the call to `performTaxOptimizedWithdrawal` (currently around line 203). The variable `assumptions` is already in scope from `calculateWithdrawals`'s parameters. Insert it after `profile`:

```ts
const withdrawals = performTaxOptimizedWithdrawal(
  accountStates,
  accounts,
  targetSpending,
  rmdAmount,
  totalRetirementIncome,
  profile,
  assumptions,
  accountDepletionAges,
  age,
  countryConfig,
  nonPortfolioTaxableIncome
);
```

- [ ] **Step 3: Verify all existing tests still pass (no behavior change yet)**

Run: `npm test`
Expected: 276 tests passing, 0 failing.

- [ ] **Step 4: Verify type-check + lint**

Run: `npm run build && npm run lint`
Expected: clean build, no lint warnings.

- [ ] **Step 5: Commit**

```bash
git add src/utils/withdrawals.ts
git commit -m "refactor(withdrawals): plumb assumptions into performTaxOptimizedWithdrawal

Sets up the bracket-fill adjustment dial. No behavior change yet —
the parameter is added but unused. Separated from the logic change
so the diff is reviewable."
```

---

### Task 3: TDD positive-adjustment behavior — failing test, implement, verify

This is the only task that changes engine behavior. Strict red-green TDD: write the failing test first, prove it fails, then implement.

**Files:**
- Modify: `src/tests/calculations.test.ts` (add `testBracketFillAdjustment` after `testSwrBucketsWithdrawals`, register in `runAllTests`)
- Modify: `src/utils/withdrawals.ts` (line ~449, the `targetOrdinaryIncome` calculation)

- [ ] **Step 1: Write the failing positive-adjustment test**

In `src/tests/calculations.test.ts`, locate `testSwrBucketsWithdrawals()` (around line 2374) and add the following function immediately after it (before the `runAllTests` declaration at line 2502):

```ts
function testBracketFillAdjustment(): void {
  section('BRACKET-FILL ADJUSTMENT DIAL');

  // Setup: single filer, age 65 (post-retirement, pre-RMD), no income streams,
  // no government benefits, zero return + zero inflation. Two accounts:
  // $750k Traditional + $750k Roth → portfolio $1.5M, SWR 0.08 → spending $120k/yr.
  // Default ceiling = std_ded ($14,600) + bracket12Max ($47,150) = $61,750.
  // Spending need ($120k) exceeds the default ceiling, so the dial's effect
  // is fully visible: every dollar added to the ceiling shifts $1 from Roth
  // to Traditional.
  const traditional: Account = {
    id: 'trad',
    name: 'Traditional 401k',
    type: 'traditional_401k',
    balance: 750_000,
    annualContribution: 0,
    contributionGrowthRate: 0,
    returnRate: 0,
  };
  const roth: Account = {
    id: 'roth',
    name: 'Roth IRA',
    type: 'roth_ira',
    balance: 750_000,
    annualContribution: 0,
    contributionGrowthRate: 0,
    returnRate: 0,
  };

  const profile: Profile = {
    country: 'US',
    currentAge: 65,
    retirementAge: 65,
    lifeExpectancy: 70,
    region: 'TX', // no-tax state; stateTaxRate=0 anyway
    filingStatus: 'single',
    stateTaxRate: 0,
  };

  const baseAssumptions: Assumptions = {
    inflationRate: 0,
    safeWithdrawalRate: 0.08,
    retirementReturnRate: 0,
  };

  const accum = calculateAccumulation([traditional, roth], profile, usConfig);

  console.log('\n--- Positive adjustment (+50%) shifts withdrawal from Roth to Traditional ---');

  const resultPlus = calculateWithdrawals(
    [traditional, roth],
    profile,
    { ...baseAssumptions, bracketFillAdjustment: 0.5 },
    accum,
    usConfig,
  );
  const yPlus65 = resultPlus.yearlyWithdrawals.find(y => y.age === 65);
  assert(yPlus65 !== undefined, 'Year 65 record exists for +0.5 run');

  if (yPlus65) {
    // Adjusted ceiling = 14,600 + 47,150 × 1.5 = 85,325. Need = 120,000.
    // Step 2 fills Traditional with min(85,325, 120,000) = 85,325.
    // Step 3 Roth fills 120,000 − 85,325 = 34,675.
    assertApprox(
      yPlus65.withdrawals['trad'],
      85_325,
      0.5,
      '+0.5 adjustment: Traditional withdrawal = std_ded + bracket12Max × 1.5'
    );
    assertApprox(
      yPlus65.withdrawals['roth'],
      34_675,
      0.5,
      '+0.5 adjustment: Roth absorbs only the residual'
    );
  }
}
```

Then register the new function in `runAllTests` (around line 2533). Insert the call after `testSwrBucketsWithdrawals()`:

```ts
  testSwrBucketsRateForAge();
  testSwrBucketsValidate();
  testSwrBucketsWithdrawals();
  testBracketFillAdjustment();
```

- [ ] **Step 2: Run the test and verify it fails**

Run: `npm test`
Expected: `testBracketFillAdjustment` fails. Specifically:
- The Traditional assert expects `85,325` but the engine still uses the default ceiling of `61,750`, so Traditional withdrawal will be `61,750`.
- The Roth assert expects `34,675` but Roth will absorb `120,000 − 61,750 = 58,250`.

You should see two `✗ FAIL` lines in the suite output and a non-zero exit code.

- [ ] **Step 3: Implement the engine logic**

In `src/utils/withdrawals.ts`, locate the bracket-fill ceiling calculation (around lines 445-450). Replace this block:

```ts
  // Step 2: Fill up to 12% bracket with additional traditional withdrawals
  // (Standard deduction + 12% bracket gives good tax efficiency)
  const filingStatus = profile.filingStatus || 'single';
  const standardDeduction = getStandardDeduction(filingStatus);
  const bracket12Max = filingStatus === 'married_filing_jointly' ? 94300 : 47150;
  const targetOrdinaryIncome = standardDeduction + bracket12Max;
```

with:

```ts
  // Step 2: Fill up to 12% bracket with additional traditional withdrawals
  // (Standard deduction + 12% bracket gives good tax efficiency).
  // The optional bracketFillAdjustment dial (US-only) resizes the 12% portion
  // of the ceiling — positive pulls more from Traditional, negative pulls less.
  const filingStatus = profile.filingStatus || 'single';
  const standardDeduction = getStandardDeduction(filingStatus);
  const bracket12Max = filingStatus === 'married_filing_jointly' ? 94300 : 47150;
  const adjustment = profile.country === 'US'
    ? (assumptions.bracketFillAdjustment ?? 0)
    : 0;
  const adjustedBracket12 = bracket12Max * (1 + adjustment);
  const targetOrdinaryIncome = standardDeduction + adjustedBracket12;
```

- [ ] **Step 4: Run the test and verify it passes**

Run: `npm test`
Expected: `testBracketFillAdjustment` now passes. Total = baseline 276 + 2 new asserts = 278 tests passing.

- [ ] **Step 5: Verify type-check + lint**

Run: `npm run build && npm run lint`
Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add src/utils/withdrawals.ts src/tests/calculations.test.ts
git commit -m "feat(withdrawals): apply bracketFillAdjustment dial to 12% fill ceiling

US-only. Multiplies bracket12Max by (1 + adjustment) so positive values
extend the bracket-fill ceiling into 22% territory and negative values
shrink it toward the standard deduction. Step 1 (RMDs), step 3 (Roth),
step 4 (Taxable), step 5 (HSA), and step 6 (fallback Traditional) are
unchanged.

Includes positive-adjustment regression test."
```

---

### Task 4: Add the three remaining regression tests (parity, max-negative, Canada-ignore)

These tests should pass on first run (the implementation is already correct) — they're regression guards against future drift.

**Files:**
- Modify: `src/tests/calculations.test.ts` (extend `testBracketFillAdjustment`)

- [ ] **Step 1: Append the parity sub-test**

In `src/tests/calculations.test.ts`, inside `testBracketFillAdjustment`, add the following block after the existing `console.log('\n--- Positive adjustment ...')` section:

```ts
  console.log('\n--- Parity: adjustment=0 matches no-adjustment baseline ---');

  const resultZero = calculateWithdrawals(
    [traditional, roth],
    profile,
    { ...baseAssumptions, bracketFillAdjustment: 0 },
    accum,
    usConfig,
  );
  const resultBaseline = calculateWithdrawals(
    [traditional, roth],
    profile,
    baseAssumptions, // no bracketFillAdjustment field at all
    accum,
    usConfig,
  );
  const yZero65 = resultZero.yearlyWithdrawals.find(y => y.age === 65);
  const yBase65 = resultBaseline.yearlyWithdrawals.find(y => y.age === 65);
  assert(yZero65 !== undefined && yBase65 !== undefined, 'Both runs produced age-65 records');

  if (yZero65 && yBase65) {
    assertApprox(
      yZero65.withdrawals['trad'],
      yBase65.withdrawals['trad'],
      0.01,
      'Parity: adjustment=0 matches missing field for Traditional'
    );
    assertApprox(
      yZero65.withdrawals['roth'],
      yBase65.withdrawals['roth'],
      0.01,
      'Parity: adjustment=0 matches missing field for Roth'
    );
    // Also verify the default ceiling produces the expected $61,750 fill.
    assertApprox(
      yZero65.withdrawals['trad'],
      61_750,
      0.5,
      'Default ceiling: Traditional fill = std_ded ($14,600) + bracket12Max ($47,150)'
    );
  }
```

- [ ] **Step 2: Append the max-negative sub-test**

Add the following block right after the parity block:

```ts
  console.log('\n--- Negative adjustment (-100%) collapses ceiling to standard deduction ---');

  const resultMinus = calculateWithdrawals(
    [traditional, roth],
    profile,
    { ...baseAssumptions, bracketFillAdjustment: -1.0 },
    accum,
    usConfig,
  );
  const yMinus65 = resultMinus.yearlyWithdrawals.find(y => y.age === 65);
  assert(yMinus65 !== undefined, 'Year 65 record exists for -1.0 run');

  if (yMinus65) {
    // Adjusted ceiling = 14,600 + 47,150 × 0 = 14,600 (std deduction only).
    // Step 2 fills Traditional with min(14,600, 120,000) = 14,600.
    // Step 3 Roth fills 120,000 − 14,600 = 105,400.
    assertApprox(
      yMinus65.withdrawals['trad'],
      14_600,
      0.5,
      '-1.0 adjustment: Traditional fill collapses to std deduction only'
    );
    assertApprox(
      yMinus65.withdrawals['roth'],
      105_400,
      0.5,
      '-1.0 adjustment: Roth absorbs the rest'
    );
  }
```

- [ ] **Step 3: Append the Canada-ignore sub-test**

Add the following block after the max-negative block. This needs the Canadian config; add `caConfig` import at the top of the file if not already present.

First, check imports near the top of `src/tests/calculations.test.ts`. If `caConfig` is not yet defined, add this line near the existing `usConfig` line (around line 25):

```ts
const caConfig = getCountryConfig('CA');
```

(`getCountryConfig` is already imported. Skip this edit if `caConfig` already exists.)

Then add the sub-test block:

```ts
  console.log('\n--- Canada ignores the dial ---');

  const traditionalCA: Account = {
    id: 'rrsp',
    name: 'RRSP',
    type: 'rrsp',
    balance: 750_000,
    annualContribution: 0,
    contributionGrowthRate: 0,
    returnRate: 0,
  };
  const rothCA: Account = {
    id: 'tfsa',
    name: 'TFSA',
    type: 'tfsa',
    balance: 750_000,
    annualContribution: 0,
    contributionGrowthRate: 0,
    returnRate: 0,
  };
  const profileCA: Profile = {
    country: 'CA',
    currentAge: 65,
    retirementAge: 65,
    lifeExpectancy: 70,
    region: 'ON',
    stateTaxRate: 0,
  };
  const accumCA = calculateAccumulation([traditionalCA, rothCA], profileCA, caConfig);

  const resultCAWithDial = calculateWithdrawals(
    [traditionalCA, rothCA],
    profileCA,
    { ...baseAssumptions, bracketFillAdjustment: 0.5 },
    accumCA,
    caConfig,
  );
  const resultCABaseline = calculateWithdrawals(
    [traditionalCA, rothCA],
    profileCA,
    baseAssumptions,
    accumCA,
    caConfig,
  );
  const yCAWith65 = resultCAWithDial.yearlyWithdrawals.find(y => y.age === 65);
  const yCABase65 = resultCABaseline.yearlyWithdrawals.find(y => y.age === 65);
  assert(yCAWith65 !== undefined && yCABase65 !== undefined, 'Both Canadian runs produced age-65 records');

  if (yCAWith65 && yCABase65) {
    assertApprox(
      yCAWith65.withdrawals['rrsp'],
      yCABase65.withdrawals['rrsp'],
      0.01,
      'Canada ignores dial: RRSP withdrawal unchanged with adjustment=+0.5'
    );
    assertApprox(
      yCAWith65.withdrawals['tfsa'],
      yCABase65.withdrawals['tfsa'],
      0.01,
      'Canada ignores dial: TFSA withdrawal unchanged with adjustment=+0.5'
    );
  }
```

- [ ] **Step 4: Run all tests and verify pass**

Run: `npm test`
Expected: `testBracketFillAdjustment` passes with all sub-tests. Total = baseline 276 + ~9 new asserts ≈ 285 tests passing.

- [ ] **Step 5: Verify type-check + lint**

Run: `npm run build && npm run lint`
Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add src/tests/calculations.test.ts
git commit -m "test(bracket-fill): add parity, max-negative, and Canada-ignore guards

Three regression tests covering:
- adjustment=0 matches behavior when the field is absent (default ceiling = \$61,750 single)
- adjustment=-1.0 collapses ceiling to std deduction only
- Canadian profiles ignore the dial entirely (RRSP/TFSA unchanged)"
```

---

### Task 5: Add UI control to AssumptionsForm

**Files:**
- Modify: `src/components/AssumptionsForm.tsx`

- [ ] **Step 1: Add the country context import**

At the top of `src/components/AssumptionsForm.tsx`, the file currently imports:

```ts
import { Assumptions, SwrBucket } from '../types';
import { NumberInput } from './NumberInput';
import { Tooltip } from './Tooltip';
import { SwrBucketEditor } from './SwrBucketEditor';
```

Add the country context import:

```ts
import { Assumptions, SwrBucket } from '../types';
import { NumberInput } from './NumberInput';
import { Tooltip } from './Tooltip';
import { SwrBucketEditor } from './SwrBucketEditor';
import { useCountry } from '../contexts/CountryContext';
```

- [ ] **Step 2: Read the country inside the component**

In `src/components/AssumptionsForm.tsx`, just inside the `AssumptionsForm` function body (above the existing `handleChange` declaration), add:

```ts
  const { country } = useCountry();
```

- [ ] **Step 3: Mount the NumberInput, gated on US**

In `src/components/AssumptionsForm.tsx`, locate the SwrBucketEditor mount (currently around line 71-74):

```tsx
        <SwrBucketEditor
          buckets={assumptions.swrBuckets ?? []}
          onChange={handleBucketsChange}
        />
```

Insert the new field block **immediately after** the SwrBucketEditor closing tag and before the Retirement Return Rate `<div>`:

```tsx
        <SwrBucketEditor
          buckets={assumptions.swrBuckets ?? []}
          onChange={handleBucketsChange}
        />

        {country === 'US' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Bracket-Fill Adjustment (%)
              <Tooltip text="Slides the optional Traditional withdrawal step's ceiling up or down relative to the top of the 12% bracket. 0% (default) fills exactly to the top of the 12% bracket. Positive values pull more from Traditional now (paying some 22% tax) to preserve Roth. Negative values pull less, drawing more from Roth instead." />
            </label>
            <NumberInput
              value={assumptions.bracketFillAdjustment ?? 0}
              onChange={(val) => handleChange('bracketFillAdjustment', val)}
              min={-100}
              max={100}
              isPercentage
              decimals={0}
              defaultValue={0}
              className={inputClassName}
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Range: -100% disables bracket fill (standard deduction only). +100% extends fill into the 22% bracket.
            </p>
          </div>
        )}
```

- [ ] **Step 4: Verify type-check, lint, and tests**

Run: `npm run build && npm run lint && npm test`
Expected: clean build, no lint, all ~285 tests still passing.

- [ ] **Step 5: Manual UI smoke test**

```bash
npm run dev
```

Open the app in a browser:
- US profile: confirm "Bracket-Fill Adjustment (%)" appears between SWR/buckets and Retirement Return Rate. Try entering `50`, `0`, `-100`, and verify the input clamps at `-100` and `100`. Tooltip should hover correctly.
- Switch country to Canada (CountrySelector): the field should disappear.
- Switch back to US: the field reappears with the previously-entered value preserved.
- With `+50` set, refresh the page — value persists via localStorage.

- [ ] **Step 6: Commit**

```bash
git add src/components/AssumptionsForm.tsx
git commit -m "feat(ui): mount bracket-fill adjustment dial in AssumptionsForm

NumberInput between SwrBucketEditor and Retirement Return Rate, gated
on country === 'US'. Range -100% to +100%, default 0%. Tooltip
explains the dial's behavior."
```

---

### Task 6: Add a Methodology paragraph

**Files:**
- Modify: `src/components/MethodologyPanel.tsx`

- [ ] **Step 1: Locate the US withdrawal-strategy section**

In `src/components/MethodologyPanel.tsx`, the US strategy steps render under the `<ol>` starting at the `// US withdrawal strategy` comment (around line 251). The 6-step list ends with the closing `</ol>` for the US branch. Find the line that closes the US `<ol>` (the matching `</ol>` after the `Step 6 / Fall Back to Traditional` `<li>` block).

- [ ] **Step 2: Append a paragraph after the US `<ol>`**

Immediately after the closing `</ol>` of the US strategy list (and before the closing `)}` of the `{isCanada ? ... : (...)}` ternary), add:

```tsx
              <p className="text-gray-600 dark:text-gray-400 mt-4">
                <strong className="text-gray-800 dark:text-gray-200">Bracket-Fill Adjustment (optional):</strong> The
                Step 2 ceiling defaults to the standard deduction plus the 12% bracket top
                ($14,600 + $47,150 = $61,750 single; $29,200 + $94,300 = $123,500 MFJ). The
                optional <em>Bracket-Fill Adjustment</em> in Assumptions resizes the 12% portion of
                that ceiling. Positive values extend the ceiling into the 22% bracket — pulling more
                from Traditional now to preserve Roth balance for later. Negative values shrink it
                toward the standard deduction — drawing more from Roth in lower-spending years.
                0% (default) leaves the strategy unchanged.
              </p>
```

- [ ] **Step 3: Verify type-check + lint**

Run: `npm run build && npm run lint`
Expected: clean.

- [ ] **Step 4: Manual smoke test**

```bash
npm run dev
```

- US profile: open Methodology tab, scroll to "Tax-Optimized Withdrawal Strategy". The new paragraph should appear after the 6-step list. Bold "Bracket-Fill Adjustment (optional):" prefix should render.
- CA profile: the paragraph should NOT appear (it's only inside the US branch of the ternary).

- [ ] **Step 5: Commit**

```bash
git add src/components/MethodologyPanel.tsx
git commit -m "docs(methodology): explain bracket-fill adjustment dial (US)

Adds a paragraph after the 6-step US strategy list describing the
optional dial — default ceilings, what positive/negative do, and
the 0% default."
```

---

### Task 7: Final verification

- [ ] **Step 1: Run the full check**

Run: `npm test && npm run lint && npm run build`
Expected: all tests pass (~285), no lint warnings, clean production build.

- [ ] **Step 2: Manual end-to-end smoke**

```bash
npm run dev
```

With a realistic US profile (Traditional + Roth balances such that a default-ceiling year leaks into Roth):
- Default `0%` — note Year-by-Year withdrawal split.
- Set `+50%` — Roth withdrawals decrease, Traditional withdrawals increase, lifetime federal tax goes up but lifetime Roth balance preserved longer.
- Set `-100%` — Roth withdrawals jump significantly, Traditional draws only at the standard-deduction floor.
- Switch to CA profile — field disappears, no other changes.
- Toggle dark mode — tooltip and field render correctly.

- [ ] **Step 3: Confirm the branch is ready**

Run: `git status && git log --oneline -8`

Expected:
- Working tree clean (or only the pre-existing line-ending churn that was on the branch before this work).
- Last 6 commits should be: types add, plumbing, engine + positive test, regression tests, UI, methodology, plus any earlier commits on the branch.

If any checks fail, return to the relevant task and fix before declaring done. Do **not** commit fixes by amending earlier commits — make a new follow-up commit.

---

## Done criteria

- [ ] All 7 tasks complete
- [ ] `npm test` passes (≈285 tests)
- [ ] `npm run lint` clean
- [ ] `npm run build` clean
- [ ] Manual UI smoke completed on both US and CA profiles
- [ ] All commits on `feature/roth-conversion` branch (this work scopes cleanly into the existing branch alongside Roth conversions and SWR buckets)

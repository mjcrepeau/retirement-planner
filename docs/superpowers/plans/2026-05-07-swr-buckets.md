# SWR Buckets Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add optional age-range "buckets" to override the global Safe Withdrawal Rate, enabling variable spending across retirement (e.g., higher in early go-go years, lower in later years).

**Architecture:** New `SwrBucket` type nested as an optional `assumptions.swrBuckets` array. New pure utility module `src/utils/swrBuckets.ts` exposes `rateForAge` (lookup with fallback to global SWR) and `validateBuckets` (overlap/range checking). The retirement loop in `withdrawals.ts` replaces its incremental `targetSpending *= (1 + inflation)` pattern with a per-year `const targetSpending = totalPortfolio × rateForAge(age, ...) × (1 + inflation)^yearsFromRetirement` — mathematically identical when buckets are empty (full backwards compat).

**Tech Stack:** React + TypeScript, Tailwind v4, custom test runner via `npm test` (`npx tsx src/tests/calculations.test.ts`).

**Spec:** `docs/superpowers/specs/2026-05-07-swr-buckets-design.md`

---

## File Structure

**Created:**
- `src/utils/swrBuckets.ts` — pure functions: `rateForAge(age, buckets, fallback)`, `validateBuckets(buckets)`. No React, no localStorage.
- `src/components/SwrBucketEditor.tsx` — list/add/edit/delete UI for a `SwrBucket[]`. Mirrors `IncomeStreamList` UX but simpler (3 fields, inline edit only).

**Modified:**
- `src/types/index.ts` — add `SwrBucket` interface; extend `Assumptions.swrBuckets?: SwrBucket[]`.
- `src/utils/constants.ts` — extend `DEFAULT_ASSUMPTIONS` with `swrBuckets: []`.
- `src/utils/withdrawals.ts` — replace `let targetSpending` and `targetSpending *=` lines with a per-year `const` computed via `rateForAge`.
- `src/components/AssumptionsForm.tsx` — add helper-text update on the SWR field; mount `SwrBucketEditor`.
- `src/components/MethodologyPanel.tsx` — extend Withdrawal Phase narrative.
- `src/tests/calculations.test.ts` — six new tests via a `testSwrBuckets()` function added to `runAllTests()`.

---

## Task 1: Add `SwrBucket` type and extend `Assumptions`

**Files:**
- Modify: `src/types/index.ts`

- [ ] **Step 1: Add `SwrBucket` interface**

In `src/types/index.ts`, find the `Assumptions` interface. Immediately above it, add:

```ts
export interface SwrBucket {
  id: string;
  startAge: number;       // inclusive
  endAge: number;         // inclusive
  rate: number;           // decimal, e.g. 0.07 for 7%
}
```

- [ ] **Step 2: Extend `Assumptions`**

In the same file, update the `Assumptions` interface to add the optional `swrBuckets`:

```ts
export interface Assumptions {
  inflationRate: number; // as decimal
  safeWithdrawalRate: number; // as decimal
  retirementReturnRate: number; // as decimal
  swrBuckets?: SwrBucket[]; // optional; empty/undefined → use safeWithdrawalRate for all years
}
```

(Preserve the existing field comments.)

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npx tsc -p tsconfig.app.json --noEmit`
Expected: no errors. (`SwrBucket` is a new type; `swrBuckets` is optional, so existing callers compile.)

- [ ] **Step 4: Commit**

```bash
git add src/types/index.ts
git commit -m "feat(types): add SwrBucket and Assumptions.swrBuckets"
```

---

## Task 2: Update default constants

**Files:**
- Modify: `src/utils/constants.ts`

- [ ] **Step 1: Extend `DEFAULT_ASSUMPTIONS`**

In `src/utils/constants.ts`, find `DEFAULT_ASSUMPTIONS`. Replace it with:

```ts
export const DEFAULT_ASSUMPTIONS = {
  inflationRate: 0.03,
  safeWithdrawalRate: 0.04,
  retirementReturnRate: 0.05,
  swrBuckets: [],
};
```

(The empty array literal is correctly inferred as `never[]`; TypeScript will widen it via the `Assumptions` type at call sites.)

If you see a TypeScript error in callers because `swrBuckets: []` is `never[]` rather than `SwrBucket[]`, switch to:

```ts
import type { SwrBucket } from '../types';

// ... and inside DEFAULT_ASSUMPTIONS:
swrBuckets: [] as SwrBucket[],
```

Inspect the existing imports at the top of `src/utils/constants.ts` first — `SwrBucket` may need to be added to the existing `import type { ... } from '../types'` line.

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc -p tsconfig.app.json --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/utils/constants.ts
git commit -m "feat(constants): default empty swrBuckets in DEFAULT_ASSUMPTIONS"
```

---

## Task 3: Build `swrBuckets` utility module (TDD)

**Files:**
- Create: `src/utils/swrBuckets.ts`
- Test: `src/tests/calculations.test.ts` (extend with new test function)

- [ ] **Step 1: Write failing tests for `rateForAge`**

In `src/tests/calculations.test.ts`, find the existing `import` line:

```ts
import { Account, Profile, Assumptions, IncomeStream } from '../types';
```

(Adjust if the actual import already includes more types.) Update it to include `SwrBucket`:

```ts
import { Account, Profile, Assumptions, IncomeStream, SwrBucket } from '../types';
```

Above the `runAllTests` function, add:

```ts
import { rateForAge, validateBuckets } from '../utils/swrBuckets';

function testSwrBucketsRateForAge(): void {
  section('SWR BUCKETS — rateForAge');

  const buckets: SwrBucket[] = [
    { id: 'a', startAge: 63, endAge: 70, rate: 0.07 },
    { id: 'b', startAge: 71, endAge: 77, rate: 0.06 },
    { id: 'c', startAge: 78, endAge: 90, rate: 0.05 },
  ];
  const fallback = 0.04;

  // Inside-bucket lookups
  assertApprox(rateForAge(63, buckets, fallback), 0.07, 1e-9, 'startAge 63 hits first bucket');
  assertApprox(rateForAge(70, buckets, fallback), 0.07, 1e-9, 'endAge 70 hits first bucket');
  assertApprox(rateForAge(71, buckets, fallback), 0.06, 1e-9, 'startAge 71 hits second bucket');
  assertApprox(rateForAge(77, buckets, fallback), 0.06, 1e-9, 'endAge 77 hits second bucket');
  assertApprox(rateForAge(85, buckets, fallback), 0.05, 1e-9, 'mid third bucket');

  // Outside any bucket → fallback
  assertApprox(rateForAge(60, buckets, fallback), fallback, 1e-9, 'before first bucket → fallback');
  assertApprox(rateForAge(95, buckets, fallback), fallback, 1e-9, 'after last bucket → fallback');

  // Gap year (between buckets)
  const gappy: SwrBucket[] = [
    { id: 'g1', startAge: 63, endAge: 70, rate: 0.07 },
    { id: 'g2', startAge: 75, endAge: 80, rate: 0.05 },
  ];
  assertApprox(rateForAge(72, gappy, fallback), fallback, 1e-9, 'gap year (72) → fallback');

  // Empty buckets list → always fallback
  assertApprox(rateForAge(65, [], fallback), fallback, 1e-9, 'empty buckets → fallback');
}
```

In `runAllTests()`, add `testSwrBucketsRateForAge();` after the last existing test (e.g., after `testIncomeStreamWithdrawals();` or wherever the existing list ends).

- [ ] **Step 2: Run tests — verify failure**

Run: `npm test`
Expected: tsx fails with module-not-found / import error for `../utils/swrBuckets`.

- [ ] **Step 3: Create the utility module with `rateForAge`**

Create `src/utils/swrBuckets.ts`:

```ts
import type { SwrBucket } from '../types';

/**
 * Look up the SWR rate for a given retirement age. Returns the matching bucket's
 * rate if any; otherwise returns the fallback (the global safeWithdrawalRate).
 *
 * Buckets are inclusive on both ends. Buckets are expected to be non-overlapping
 * (enforced at form validation); when overlap exists, the first matching bucket
 * wins.
 */
export function rateForAge(
  age: number,
  buckets: SwrBucket[],
  fallback: number,
): number {
  const match = buckets.find(b => age >= b.startAge && age <= b.endAge);
  return match ? match.rate : fallback;
}
```

- [ ] **Step 4: Run tests — verify rateForAge passes**

Run: `npm test`
Expected: the 9 asserts in `SWR BUCKETS — rateForAge` PASS. The validateBuckets import will still fail at module load until Step 5.

If Step 4 fails because the file imports `validateBuckets` which doesn't exist yet, you can either: (a) split the import into two lines so only `rateForAge` is imported now, or (b) define `validateBuckets` as a stub returning `{ errors: {} }` to keep the import resolvable. Pick (b) for simplicity:

```ts
// Add a stub at the bottom of swrBuckets.ts (will be replaced in Step 7)
export function validateBuckets(_buckets: SwrBucket[]): { errors: Record<number, string[]> } {
  return { errors: {} };
}
```

Re-run `npm test` and confirm `rateForAge` asserts pass.

- [ ] **Step 5: Write failing tests for `validateBuckets`**

In `src/tests/calculations.test.ts`, add another test function below `testSwrBucketsRateForAge`:

```ts
function testSwrBucketsValidate(): void {
  section('SWR BUCKETS — validateBuckets');

  // Empty list → no errors
  const empty = validateBuckets([]);
  assert(Object.keys(empty.errors).length === 0, 'Empty list produces no errors');

  // Valid non-overlapping buckets → no errors
  const valid: SwrBucket[] = [
    { id: 'a', startAge: 63, endAge: 70, rate: 0.07 },
    { id: 'b', startAge: 71, endAge: 77, rate: 0.06 },
    { id: 'c', startAge: 78, endAge: 90, rate: 0.05 },
  ];
  const validResult = validateBuckets(valid);
  assert(Object.keys(validResult.errors).length === 0,
    `Three non-overlapping buckets produce no errors (got ${JSON.stringify(validResult.errors)})`);

  // Inverted range → error on offending bucket index
  const inverted: SwrBucket[] = [
    { id: 'x', startAge: 70, endAge: 63, rate: 0.07 },
  ];
  const invertedResult = validateBuckets(inverted);
  assert(invertedResult.errors[0]?.length > 0, 'Inverted range produces error on index 0');
  assert(
    invertedResult.errors[0].some(e => e.toLowerCase().includes('end age') || e.toLowerCase().includes('endage')),
    'Inverted range error message mentions end age'
  );

  // Overlap → error on both overlapping indices
  const overlap: SwrBucket[] = [
    { id: 'p', startAge: 63, endAge: 70, rate: 0.07 },
    { id: 'q', startAge: 68, endAge: 75, rate: 0.06 },
  ];
  const overlapResult = validateBuckets(overlap);
  assert(overlapResult.errors[0]?.length > 0, 'Overlap reports error on first overlapping bucket');
  assert(overlapResult.errors[1]?.length > 0, 'Overlap reports error on second overlapping bucket');
  assert(
    overlapResult.errors[0].some(e => e.toLowerCase().includes('overlap')),
    'Overlap error message mentions overlap'
  );

  // Single-year bucket is valid
  const singleYear: SwrBucket[] = [
    { id: 's', startAge: 65, endAge: 65, rate: 0.05 },
  ];
  const singleResult = validateBuckets(singleYear);
  assert(Object.keys(singleResult.errors).length === 0, 'Single-year bucket (start==end) is valid');

  // Non-positive rate → error
  const zeroRate: SwrBucket[] = [
    { id: 'z', startAge: 60, endAge: 70, rate: 0 },
  ];
  const zeroResult = validateBuckets(zeroRate);
  assert(zeroResult.errors[0]?.length > 0, 'Rate of 0 produces error');
}
```

In `runAllTests()`, add `testSwrBucketsValidate();` immediately after `testSwrBucketsRateForAge();`.

- [ ] **Step 6: Run tests — verify failure**

Run: `npm test`
Expected: 5 of the new asserts in `SWR BUCKETS — validateBuckets` FAIL (the stub returns no errors).

- [ ] **Step 7: Replace the stub with the real `validateBuckets`**

In `src/utils/swrBuckets.ts`, replace the stub `validateBuckets` with the full implementation:

```ts
export interface BucketValidationResult {
  errors: Record<number, string[]>; // bucket index → error messages
}

/**
 * Validate a list of SwrBuckets. Returns a map from bucket index to error
 * messages. Empty errors object means all buckets are valid.
 *
 * Rules:
 *   - endAge >= startAge per bucket.
 *   - rate > 0 per bucket.
 *   - No two buckets overlap. Buckets [a1,b1] and [a2,b2] overlap iff
 *     a1 <= b2 AND a2 <= b1.
 */
export function validateBuckets(buckets: SwrBucket[]): BucketValidationResult {
  const errors: Record<number, string[]> = {};
  const addError = (index: number, message: string) => {
    if (!errors[index]) errors[index] = [];
    errors[index].push(message);
  };

  // Per-bucket rules
  buckets.forEach((b, i) => {
    if (b.endAge < b.startAge) {
      addError(i, 'End age must be ≥ start age.');
    }
    if (b.rate <= 0) {
      addError(i, 'Rate must be greater than 0.');
    }
  });

  // Pairwise overlap check
  for (let i = 0; i < buckets.length; i++) {
    for (let j = i + 1; j < buckets.length; j++) {
      const a = buckets[i];
      const b = buckets[j];
      // Skip pairs that already have an inverted-range error to avoid noise
      if (a.endAge < a.startAge || b.endAge < b.startAge) continue;
      if (a.startAge <= b.endAge && b.startAge <= a.endAge) {
        addError(i, `Overlaps with bucket #${j + 1} (ages ${b.startAge}–${b.endAge}).`);
        addError(j, `Overlaps with bucket #${i + 1} (ages ${a.startAge}–${a.endAge}).`);
      }
    }
  }

  return { errors };
}
```

(Replace the previous stub `validateBuckets` definition entirely. Keep the `rateForAge` function above it untouched.)

- [ ] **Step 8: Run tests — verify pass**

Run: `npm test`
Expected: all asserts in both `SWR BUCKETS — rateForAge` and `SWR BUCKETS — validateBuckets` PASS. Pre-existing tests still pass.

- [ ] **Step 9: Commit**

```bash
git add src/utils/swrBuckets.ts src/tests/calculations.test.ts
git commit -m "feat(swr-buckets): add rateForAge and validateBuckets utilities"
```

---

## Task 4: Wire buckets into the retirement-phase target-spending calculation (TDD)

**Files:**
- Modify: `src/utils/withdrawals.ts`
- Test: `src/tests/calculations.test.ts`

- [ ] **Step 1: Write failing integration tests**

In `src/tests/calculations.test.ts`, add a third test function below `testSwrBucketsValidate`:

```ts
function testSwrBucketsWithdrawals(): void {
  section('SWR BUCKETS — Withdrawal integration');

  // Common scenario: simple retirement with one source account
  const baseProfile: Profile = {
    country: 'US',
    currentAge: 60,
    retirementAge: 60,
    lifeExpectancy: 75,
    region: 'CA',
    filingStatus: 'married_filing_jointly',
    stateTaxRate: 0.05,
  };
  const baseAssumptions: Assumptions = {
    inflationRate: 0.03,
    safeWithdrawalRate: 0.04,
    retirementReturnRate: 0.05,
  };
  const accounts: Account[] = [
    { id: 'a', name: 'Roth', type: 'roth_ira',
      balance: 500_000, annualContribution: 0, contributionGrowthRate: 0, returnRate: 0.05,
      withdrawalRules: { startAge: 60 } },
  ];
  const accumulation = calculateAccumulation(accounts, baseProfile, usConfig);

  // Test 1: Empty buckets → identical to no buckets at all (regression parity)
  const noBuckets = calculateWithdrawals(accounts, baseProfile, baseAssumptions, accumulation, usConfig);
  const emptyBuckets = calculateWithdrawals(
    accounts, baseProfile, { ...baseAssumptions, swrBuckets: [] }, accumulation, usConfig,
  );
  assertApprox(noBuckets.lifetimeTaxesPaid, emptyBuckets.lifetimeTaxesPaid, 0.01,
    'Empty swrBuckets behaves identically to no swrBuckets');
  for (let i = 0; i < noBuckets.yearlyWithdrawals.length; i++) {
    assertApprox(
      noBuckets.yearlyWithdrawals[i].targetSpending,
      emptyBuckets.yearlyWithdrawals[i].targetSpending,
      0.01,
      `Year ${i}: targetSpending matches between no-buckets and empty-buckets`,
    );
  }

  // Test 2: Single bucket covering full retirement at rate R == setting safeWithdrawalRate to R
  const singleBucketAssumptions: Assumptions = {
    ...baseAssumptions,
    swrBuckets: [{ id: 'all', startAge: 60, endAge: 75, rate: 0.06 }],
  };
  const altSwrAssumptions: Assumptions = { ...baseAssumptions, safeWithdrawalRate: 0.06 };
  const singleBucketRun = calculateWithdrawals(accounts, baseProfile, singleBucketAssumptions, accumulation, usConfig);
  const altSwrRun = calculateWithdrawals(accounts, baseProfile, altSwrAssumptions, accumulation, usConfig);
  for (let i = 0; i < singleBucketRun.yearlyWithdrawals.length; i++) {
    assertApprox(
      singleBucketRun.yearlyWithdrawals[i].targetSpending,
      altSwrRun.yearlyWithdrawals[i].targetSpending,
      0.01,
      `Year ${i}: full-coverage bucket at 6% matches global SWR=6%`,
    );
  }

  // Test 3: Three-bucket scenario — per-year targetSpending matches the formula exactly
  const threeBuckets: SwrBucket[] = [
    { id: 'go', startAge: 60, endAge: 65, rate: 0.07 },
    { id: 'mid', startAge: 66, endAge: 70, rate: 0.06 },
    { id: 'low', startAge: 71, endAge: 75, rate: 0.05 },
  ];
  const threeBucketRun = calculateWithdrawals(
    accounts, baseProfile,
    { ...baseAssumptions, swrBuckets: threeBuckets },
    accumulation, usConfig,
  );
  const initialPortfolio = accumulation.totalAtRetirement;
  for (const year of threeBucketRun.yearlyWithdrawals) {
    const yearsFromRetirement = year.age - baseProfile.retirementAge;
    const inflationFactor = Math.pow(1 + baseAssumptions.inflationRate, yearsFromRetirement);
    const expectedRate =
      year.age <= 65 ? 0.07 :
      year.age <= 70 ? 0.06 :
      0.05;
    const expected = initialPortfolio * expectedRate * inflationFactor;
    assertApprox(year.targetSpending, expected, 0.01,
      `Age ${year.age}: targetSpending = portfolio × ${expectedRate} × (1 + inf)^${yearsFromRetirement}`);
  }

  // Test 4: Gap year — age inside the gap uses the global SWR
  const gappy: SwrBucket[] = [
    { id: 'a', startAge: 60, endAge: 65, rate: 0.07 },
    { id: 'b', startAge: 70, endAge: 75, rate: 0.05 },
  ];
  const gapRun = calculateWithdrawals(
    accounts, baseProfile,
    { ...baseAssumptions, swrBuckets: gappy },
    accumulation, usConfig,
  );
  const gapYear = gapRun.yearlyWithdrawals.find(y => y.age === 67);
  assert(gapYear !== undefined, 'Gap-year scenario contains an age 67 entry');
  if (gapYear) {
    const yearsFromRetirement = 67 - baseProfile.retirementAge;
    const expected = initialPortfolio * baseAssumptions.safeWithdrawalRate
      * Math.pow(1 + baseAssumptions.inflationRate, yearsFromRetirement);
    assertApprox(gapYear.targetSpending, expected, 0.01,
      'Age 67 (in gap) uses global safeWithdrawalRate');
  }

  // Test 5: Boundary inclusivity — startAge and endAge both inside the bucket
  const adjacent: SwrBucket[] = [
    { id: 'x', startAge: 60, endAge: 65, rate: 0.07 },
    { id: 'y', startAge: 66, endAge: 70, rate: 0.06 },
  ];
  const adjRun = calculateWithdrawals(
    accounts, baseProfile,
    { ...baseAssumptions, swrBuckets: adjacent },
    accumulation, usConfig,
  );
  const age65 = adjRun.yearlyWithdrawals.find(y => y.age === 65);
  const age66 = adjRun.yearlyWithdrawals.find(y => y.age === 66);
  if (age65 && age66) {
    const inflFactor65 = Math.pow(1 + baseAssumptions.inflationRate, 65 - 60);
    const inflFactor66 = Math.pow(1 + baseAssumptions.inflationRate, 66 - 60);
    assertApprox(age65.targetSpending, initialPortfolio * 0.07 * inflFactor65, 0.01,
      'Age 65 (endAge) uses first bucket rate (0.07)');
    assertApprox(age66.targetSpending, initialPortfolio * 0.06 * inflFactor66, 0.01,
      'Age 66 (startAge of second) uses second bucket rate (0.06)');
  }
}
```

In `runAllTests()`, add `testSwrBucketsWithdrawals();` immediately after `testSwrBucketsValidate();`.

- [ ] **Step 2: Run — verify failure**

Run: `npm test`
Expected: at least Test 3 fails because the existing engine produces `targetSpending` based only on `safeWithdrawalRate × (1 + inflation)^N`, ignoring `swrBuckets`. Tests 1 and 2 may pass (since current engine ignores the new field), but Test 3's three-bucket scenario will not match.

- [ ] **Step 3: Update `withdrawals.ts` to use `rateForAge` per year**

Open `src/utils/withdrawals.ts`. Add the import for `rateForAge` near the other utility imports (after `import { calculateIncomeStreamBenefits } from './incomeStreams';` or in a similar location):

```ts
import { rateForAge } from './swrBuckets';
```

Find the block at line ~102:

```ts
  // Calculate initial target spending based on safe withdrawal rate
  const totalPortfolio = accumulationResult.totalAtRetirement;
  let targetSpending = totalPortfolio * assumptions.safeWithdrawalRate;
```

Replace with:

```ts
  // Total portfolio at retirement — used as the base for targetSpending
  // each year (with the rate possibly varying by bucket).
  const totalPortfolio = accumulationResult.totalAtRetirement;
```

(Drop the `let targetSpending = ...` line entirely; it becomes a per-iteration `const` below.)

Find the per-year loop (`for (let i = 0; i <= retirementYears; i++) { ... }`). Inside the loop, after `const age = profile.retirementAge + i;` and `const year = retirementStartYear + i;` are computed, but **before** the existing `const totalRemaining = ...` portfolio-depletion check, insert the per-year target spending computation:

```ts
    // Determine this year's targetSpending. Buckets override the global SWR
    // for matching age ranges; uncovered ages fall back to safeWithdrawalRate.
    const yearsFromRetirementForSpending = age - profile.retirementAge;
    const inflationFactorForSpending = Math.pow(
      1 + assumptions.inflationRate,
      yearsFromRetirementForSpending,
    );
    const swrRate = rateForAge(
      age,
      assumptions.swrBuckets ?? [],
      assumptions.safeWithdrawalRate,
    );
    const targetSpending = totalPortfolio * swrRate * inflationFactorForSpending;
```

Note: `targetSpending` is now a `const` (per-iteration) instead of a `let` declared outside the loop.

Find the line at the bottom of the loop:

```ts
    // Inflate target spending for next year
    targetSpending *= (1 + assumptions.inflationRate);
```

**Delete that line entirely.** The per-year `Math.pow` computation handles inflation directly; no incremental update is needed.

- [ ] **Step 4: Run tests — verify pass**

Run: `npm test`
Expected: all 5 sub-tests in `SWR BUCKETS — Withdrawal integration` PASS. Pre-existing tests still pass (parity maintained for the no-buckets path).

- [ ] **Step 5: Commit**

```bash
git add src/utils/withdrawals.ts src/tests/calculations.test.ts
git commit -m "feat(withdrawals): apply per-year SWR via age-range buckets"
```

---

## Task 5: Build the `SwrBucketEditor` component

**Files:**
- Create: `src/components/SwrBucketEditor.tsx`

- [ ] **Step 1: Create the editor component**

Create `src/components/SwrBucketEditor.tsx`:

```tsx
import { useState } from 'react';
import { SwrBucket } from '../types';
import { NumberInput } from './NumberInput';
import { validateBuckets } from '../utils/swrBuckets';
import { v4 as uuidv4 } from 'uuid';

interface SwrBucketEditorProps {
  buckets: SwrBucket[];
  onChange: (buckets: SwrBucket[]) => void;
}

const inputClassName = "w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 dark:text-white";
const inputErrorClassName = "w-full px-3 py-2 border border-red-500 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 dark:text-white";

interface DraftBucket {
  startAge: number;
  endAge: number;
  rate: number;
}

export function SwrBucketEditor({ buckets, onChange }: SwrBucketEditorProps) {
  const [editingId, setEditingId] = useState<string | null>(null); // bucket id or 'new'
  const [draft, setDraft] = useState<DraftBucket>({ startAge: 65, endAge: 75, rate: 0.05 });
  const [draftErrors, setDraftErrors] = useState<string[]>([]);

  const validation = validateBuckets(buckets);

  const startAdd = () => {
    setEditingId('new');
    setDraft({ startAge: 65, endAge: 75, rate: 0.05 });
    setDraftErrors([]);
  };

  const startEdit = (b: SwrBucket) => {
    setEditingId(b.id);
    setDraft({ startAge: b.startAge, endAge: b.endAge, rate: b.rate });
    setDraftErrors([]);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setDraftErrors([]);
  };

  const saveEdit = () => {
    // Build the new buckets array with the draft applied
    const next: SwrBucket[] = editingId === 'new'
      ? [...buckets, { id: uuidv4(), ...draft }]
      : buckets.map(b => b.id === editingId ? { ...b, ...draft } : b);

    // Validate the proposed array
    const result = validateBuckets(next);
    const myIndex = editingId === 'new'
      ? next.length - 1
      : next.findIndex(b => b.id === editingId);
    const myErrors = result.errors[myIndex] ?? [];

    if (myErrors.length > 0) {
      setDraftErrors(myErrors);
      return;
    }

    onChange(next);
    setEditingId(null);
    setDraftErrors([]);
  };

  const deleteBucket = (id: string) => {
    onChange(buckets.filter(b => b.id !== id));
    if (editingId === id) cancelEdit();
  };

  const editorRow = (
    <div className="bg-gray-50 dark:bg-gray-700 p-3 rounded-md space-y-2">
      <div className="grid grid-cols-3 gap-2">
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Start Age</label>
          <NumberInput
            value={draft.startAge}
            onChange={v => setDraft(d => ({ ...d, startAge: v }))}
            min={0} max={120} defaultValue={65}
            className={draftErrors.length > 0 ? inputErrorClassName : inputClassName}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">End Age</label>
          <NumberInput
            value={draft.endAge}
            onChange={v => setDraft(d => ({ ...d, endAge: v }))}
            min={0} max={120} defaultValue={75}
            className={draftErrors.length > 0 ? inputErrorClassName : inputClassName}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Rate (%)</label>
          <NumberInput
            value={draft.rate}
            onChange={v => setDraft(d => ({ ...d, rate: v }))}
            min={0} max={50} isPercentage decimals={1} defaultValue={0.05}
            className={draftErrors.length > 0 ? inputErrorClassName : inputClassName}
          />
        </div>
      </div>
      {draftErrors.length > 0 && (
        <ul className="text-xs text-red-500 space-y-0.5 list-disc list-inside">
          {draftErrors.map((e, i) => <li key={i}>{e}</li>)}
        </ul>
      )}
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={cancelEdit}
          className="px-3 py-1 text-xs font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-600 border border-gray-300 dark:border-gray-500 rounded hover:bg-gray-50 dark:hover:bg-gray-500"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={saveEdit}
          className="px-3 py-1 text-xs font-medium text-white bg-blue-600 rounded hover:bg-blue-700"
        >
          {editingId === 'new' ? 'Add' : 'Save'}
        </button>
      </div>
    </div>
  );

  return (
    <div className="space-y-2">
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          Withdrawal Rate Buckets <span className="text-gray-400 font-normal">(optional)</span>
        </label>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
          Override SWR for specific age ranges. Higher rates in early retirement, lower in later years.
          Uncovered ages use the Safe Withdrawal Rate above.
        </p>
      </div>

      {buckets.length > 0 && (
        <ul className="space-y-1">
          {buckets.map((b, i) => {
            const rowErrors = validation.errors[i] ?? [];
            const isEditing = editingId === b.id;
            return (
              <li key={b.id}>
                {isEditing ? (
                  editorRow
                ) : (
                  <div className={`flex items-center justify-between p-2 rounded-md border text-sm ${rowErrors.length > 0 ? 'bg-red-50 dark:bg-red-900/30 border-red-200 dark:border-red-800' : 'bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600'}`}>
                    <div>
                      <span className="font-medium text-gray-900 dark:text-white">
                        Age {b.startAge}–{b.endAge}
                      </span>
                      <span className="ml-3 text-gray-600 dark:text-gray-300">
                        Rate: {(b.rate * 100).toFixed(1)}%
                      </span>
                      {rowErrors.length > 0 && (
                        <ul className="mt-1 text-xs text-red-600 dark:text-red-400 list-disc list-inside">
                          {rowErrors.map((e, k) => <li key={k}>{e}</li>)}
                        </ul>
                      )}
                    </div>
                    <div className="flex gap-1">
                      <button
                        type="button"
                        onClick={() => startEdit(b)}
                        className="p-1 text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded"
                        title="Edit"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteBucket(b.id)}
                        className="p-1 text-gray-500 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded"
                        title="Delete"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {editingId === 'new' && editorRow}

      {editingId !== 'new' && (
        <button
          type="button"
          onClick={startAdd}
          className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
        >
          + Add Bucket
        </button>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc -p tsconfig.app.json --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/SwrBucketEditor.tsx
git commit -m "feat(ui): SwrBucketEditor with inline add/edit/delete and validation"
```

---

## Task 6: Mount `SwrBucketEditor` in `AssumptionsForm` and update SWR helper text

**Files:**
- Modify: `src/components/AssumptionsForm.tsx`

- [ ] **Step 1: Wire the editor into the form**

Open `src/components/AssumptionsForm.tsx`. Update imports — add `SwrBucket` from types and `SwrBucketEditor` from components:

```ts
import { Assumptions, SwrBucket } from '../types';
import { NumberInput } from './NumberInput';
import { Tooltip } from './Tooltip';
import { SwrBucketEditor } from './SwrBucketEditor';
```

The existing `handleChange` only handles numeric fields. Add a handler for the buckets array. Below the existing `handleChange` definition, add:

```ts
  const handleBucketsChange = (buckets: SwrBucket[]) => {
    onChange({
      ...assumptions,
      swrBuckets: buckets,
    });
  };
```

Find the existing Safe Withdrawal Rate field block (the `<div>` containing `handleChange('safeWithdrawalRate', val)`). Update its helper paragraph from:

```tsx
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Traditional rule: 4%</p>
```

to:

```tsx
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Traditional rule: 4%. Used for retirement years not covered by a bucket below.
          </p>
```

Then, immediately after the closing `</div>` of the Safe Withdrawal Rate field block (and before the Retirement Return Rate field block), add:

```tsx
        <SwrBucketEditor
          buckets={assumptions.swrBuckets ?? []}
          onChange={handleBucketsChange}
        />
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc -p tsconfig.app.json --noEmit`
Expected: no errors.

- [ ] **Step 3: Run tests — confirm no regression**

Run: `npm test 2>&1 | tail -10`
Expected: all tests still pass (UI changes don't affect calc tests).

- [ ] **Step 4: Commit**

```bash
git add src/components/AssumptionsForm.tsx
git commit -m "feat(assumptions): mount SwrBucketEditor and update SWR helper text"
```

---

## Task 7: Methodology panel — document the new behavior

**Files:**
- Modify: `src/components/MethodologyPanel.tsx`

- [ ] **Step 1: Add a paragraph about buckets**

Open `src/components/MethodologyPanel.tsx`. Find the section that explains the Withdrawal Phase / Safe Withdrawal Rate. (Look for existing copy that mentions "safe withdrawal rate" or the SWR concept.) Inside that section's copy block (the `<div className="prose ...">` wrapper or equivalent), append a new paragraph:

```tsx
            <p>
              <strong>Variable SWR via buckets.</strong> The Safe Withdrawal Rate above is a
              single global percentage. To model real-world spending — higher in early
              "go-go" retirement years and lower later — you can define optional
              <em> withdrawal rate buckets</em>, each spanning an age range with its own
              rate. For each retirement year, the calculator looks up the bucket containing
              that age (or falls back to the global SWR if no bucket covers it), then
              computes <code>targetSpending = initialPortfolio × bucketRate × (1 + inflation)^yearsFromRetirement</code>.
              Buckets are inclusive on both ends and may not overlap; gaps between buckets
              are allowed and use the global SWR.
            </p>
```

(Place it logically after the existing SWR explanation. If the SWR explanation is rendered inside a country-conditional, add the paragraph in the same conditional so the documentation matches what the user sees.)

If the file structure has separate paragraphs for SWR and you can't find an obvious anchor, scan with:

```bash
grep -n -i "safe withdrawal\|safeWithdrawalRate\|withdrawal rate" src/components/MethodologyPanel.tsx
```

and place the paragraph immediately after the most relevant SWR-related paragraph.

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc -p tsconfig.app.json --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/MethodologyPanel.tsx
git commit -m "docs(methodology): document SWR buckets behavior"
```

---

## Task 8: Final integration verification

**Files:**
- (No code changes; verification only.)

- [ ] **Step 1: Run all tests**

Run: `npm test`
Expected: every prior test still passes plus the new SWR-buckets tests (`testSwrBucketsRateForAge`, `testSwrBucketsValidate`, `testSwrBucketsWithdrawals`) all pass. No `Failed: > 0` line.

- [ ] **Step 2: TypeScript build**

Run: `npm run build`
Expected: build succeeds with no errors.

- [ ] **Step 3: Lint**

Run: `npm run lint`
Expected: no errors. Warnings are acceptable if they match the repo's existing baseline; resolve any new warnings introduced by this work.

- [ ] **Step 4: Manual smoke test in browser**

Run: `npm run dev`
In a browser:
1. Open the Assumptions section. Confirm the new "Withdrawal Rate Buckets (optional)" subsection renders below the SWR field with helper text.
2. Click "+ Add Bucket". Inline editor row appears with three numeric inputs and Cancel/Add buttons.
3. Add three buckets (e.g., 63–70 at 7%, 71–77 at 6%, 78–90 at 5%). Verify each appears in the list with correct labels.
4. Try to add an overlapping bucket (e.g., 65–72 at 6%). Verify the editor surfaces an overlap error and refuses to save.
5. Try to add an inverted-range bucket (e.g., 70–60). Verify an "End age must be ≥ start age" error appears.
6. Edit an existing bucket; confirm the values persist and the list updates.
7. Delete a bucket; confirm it disappears from the list.
8. Switch to the Retirement tab. Confirm the data table shows different `targetSpending` values for ages in different buckets.
9. Set buckets to empty. Confirm the calculation reverts to single-SWR behavior.
10. Reload the browser. Confirm buckets persist via localStorage.

Stop the dev server when done.

- [ ] **Step 5: Final commit (if any fixups)**

If any of the above produced issues, fix them and commit. If nothing changed, skip the commit.

---

## Self-Review checklist (already performed during plan writing)

**1. Spec coverage:**
- Data model (`SwrBucket`, `Assumptions.swrBuckets`) — Task 1.
- `DEFAULT_ASSUMPTIONS.swrBuckets = []` — Task 2.
- `rateForAge` and `validateBuckets` — Task 3.
- Calculation flow (per-year `targetSpending` via `rateForAge`) — Task 4.
- Validation rules (overlap, range inversion, positive rate) — Task 3 (logic) + Task 5 (form surface).
- UI: bucket list editor inline below SWR field with helper text update — Tasks 5 + 6.
- Methodology paragraph — Task 7.
- All six spec tests — Task 3 covers tests 1, 2, 6; Task 4 covers tests 3, 4, 5 (the third "three-bucket" test from the spec is split into per-year asserts inside the Withdrawal-integration block; gap and boundary cases also in Task 4).
- Equivalence guarantee for empty buckets — verified by Task 4 Test 1 (parity).

**2. Placeholder scan:** None — every step has exact code or exact commands.

**3. Type consistency:** `SwrBucket`, `BucketValidationResult`, `rateForAge`, `validateBuckets`, `SwrBucketEditor`, `handleBucketsChange` are used identically across all tasks where they appear.

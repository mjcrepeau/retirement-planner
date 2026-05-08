# Variable SWR via Age-Range Buckets — Design

**Status:** Approved (ready for implementation plan)
**Date:** 2026-05-07
**Branch:** `feature/swr-buckets` (off `main`; independent of `feature/roth-conversion`)

---

## Summary

Replace the single global Safe Withdrawal Rate with optional age-range "buckets," each specifying its own SWR. Models real retirement spending patterns where early "go-go" years draw at a higher rate (e.g., 7%) and later years taper (e.g., 5%). Buckets are an *override* — uncovered ages fall back to the global `safeWithdrawalRate`, preserving the existing behavior for users who don't opt in.

---

## Decisions log

| Topic | Decision |
|---|---|
| Branch strategy | New branch `feature/swr-buckets` off `main`, independent of `feature/roth-conversion` |
| Coverage gaps | Uncovered ages fall back to `assumptions.safeWithdrawalRate` |
| Overlapping ranges | Validation error in form (blocking save) |
| Default for new users | Empty list — preserves current single-SWR behavior |
| State location | Nested in `Assumptions` (not a top-level array) |
| Spending model | Per-year `targetSpending = totalPortfolio × bucket.rate × (1 + inflation)^yearsFromRetirement`. Each bucket's base is the initial portfolio × rate, computed implicitly via the formula and inflated yearly — same convention as the current single-SWR model. |

---

## Data model

### New type — `SwrBucket`

```ts
export interface SwrBucket {
  id: string;
  startAge: number;       // inclusive
  endAge: number;         // inclusive
  rate: number;           // decimal, e.g. 0.07 for 7%
}
```

### `Assumptions` changes

```ts
export interface Assumptions {
  inflationRate: number;
  safeWithdrawalRate: number;
  retirementReturnRate: number;
  swrBuckets?: SwrBucket[];   // optional; empty/undefined → use safeWithdrawalRate for all years
}
```

`DEFAULT_ASSUMPTIONS.swrBuckets = []`.

---

## Calculation flow

The existing `src/utils/withdrawals.ts` initializes `targetSpending` once and incrementally inflates it each year:

```ts
let targetSpending = totalPortfolio * assumptions.safeWithdrawalRate;
// in loop: targetSpending *= (1 + assumptions.inflationRate);
```

Replace with a per-year, age-keyed computation:

```ts
function rateForAge(age: number, buckets: SwrBucket[], fallback: number): number {
  const match = buckets.find(b => age >= b.startAge && age <= b.endAge);
  return match ? match.rate : fallback;
}

// In the per-year loop, before the existing withdrawal/tax math:
const yearsFromRetirement = age - profile.retirementAge;
const inflationFactor = Math.pow(1 + assumptions.inflationRate, yearsFromRetirement);
const rate = rateForAge(age, assumptions.swrBuckets ?? [], assumptions.safeWithdrawalRate);
const targetSpending = totalPortfolio * rate * inflationFactor;
```

Equivalence guarantee: when `swrBuckets` is empty/undefined, every year's rate is `assumptions.safeWithdrawalRate`, and the math reduces to:

```
totalPortfolio × SWR × (1 + inflation)^yearsFromRetirement
```

This is mathematically identical to the existing `targetSpending *= (1 + inflation)` recurrence (which also produces `initial × (1 + inflation)^N` after N steps). Single-SWR users see no behavior change.

The variable `let targetSpending` is no longer needed — it becomes a per-iteration `const`. Remove the post-loop increment line.

---

## Validation

The bucket list editor enforces:

- `startAge ≤ endAge` per bucket.
- `rate > 0`. Soft warning if `rate > 0.20` (unusual but not blocked).
- `startAge` and `endAge` are integers.
- **No overlapping ranges across buckets** — blocking validation error. Two buckets `[a₁, b₁]` and `[a₂, b₂]` overlap iff `a₁ ≤ b₂ && a₂ ≤ b₁`.

A pure helper `validateBuckets(buckets: SwrBucket[]): { errors: Record<number, string[]> }` is exported from `src/utils/swrBuckets.ts` so the form and tests both use the same logic.

---

## UI

### `src/components/AssumptionsForm.tsx`

Inline list editor below the existing `safeWithdrawalRate` field. No new collapsible section — buckets are a refinement of SWR, so they live with it.

**Layout:**
- Existing "Safe Withdrawal Rate (%)" field, helper text updated to: *"Used for retirement years not covered by a bucket below."*
- New section heading: "Withdrawal Rate Buckets (optional)" with helper text: *"Override SWR for specific age ranges. Higher rates in early retirement, lower in later years."*
- List of existing buckets (each row: `Age X – Y · Rate: Z.Z%` with Edit/Delete buttons).
- Inline editor for add/edit (NumberInputs for startAge, endAge, rate; Save/Cancel buttons).
- "+ Add Bucket" button at the bottom.
- Validation messages displayed inline when overlaps or invalid ranges are detected.

Empty state: no list rendered, just the "+ Add Bucket" button.

### Existing components untouched

No changes to charts, summary cards, or other components — they consume `RetirementResult.yearlyWithdrawals` which already carries `targetSpending` per year.

---

## Methodology panel

`src/components/MethodologyPanel.tsx` — extend the existing Withdrawal Phase explanation. Add a short paragraph (or sub-section) covering:

- Buckets override the global SWR for matching age ranges.
- Each bucket's rate applies to the *initial* portfolio at retirement (not the current balance), inflated yearly by the assumption inflation rate.
- Uncovered ages use the global SWR — buckets are additive overrides.
- Buckets cannot overlap; gaps are allowed.

---

## Tests

Extend `src/tests/calculations.test.ts` with a new `testSwrBuckets()` function, registered in `runAllTests()`.

1. **Empty buckets parity.** With `swrBuckets: []`, run the existing `testWithdrawalPhase`-style scenario; `targetSpending` per year, `lifetimeTaxesPaid`, and `portfolioDepletionAge` match the no-buckets baseline exactly.
2. **Single bucket covering full retirement.** A bucket spanning the entire retirement window at rate R produces target spending identical to setting `safeWithdrawalRate = R` with no buckets.
3. **Three-bucket scenario (the user's example):** ages 63–70 at 7%, 71–77 at 6%, 78–end at 5%, retirementAge=63, lifeExpectancy=90. For each age, `targetSpending == initialPortfolio × bucketRate × (1 + inflation)^(age − 63)`.
4. **Gap year falls back to global SWR.** Buckets at 63–70 and 75–80; age 72 (a gap) uses the global `safeWithdrawalRate`.
5. **Boundary inclusivity.** A bucket with `startAge: 65, endAge: 65` (single-year bucket) fires only when `age == 65`. Buckets at 63–67 and 68–72: age 67 uses the first; age 68 uses the second; no overlap, no double-coverage.
6. **`validateBuckets` helper:**
   - No errors for non-overlapping, sorted-or-unsorted, age-valid input.
   - Reports overlap errors for `[63–70, 68–75]`.
   - Reports inverted-range errors for `[70–63]`.
   - Empty list returns no errors.

---

## Out of scope (deferred)

- Per-bucket inflation overrides (each bucket using its own inflation rate).
- Mid-retirement portfolio rebalancing triggered by bucket transitions.
- Linking buckets to portfolio milestones (e.g., "rate drops when balance hits $X").
- Stochastic SWR (Monte Carlo or path-dependent rates).
- Importing standard rate schedules (e.g., variable percentage withdrawal tables).

---

## File touch list

- `src/types/index.ts` — add `SwrBucket`; extend `Assumptions.swrBuckets?: SwrBucket[]`.
- `src/utils/constants.ts` — extend `DEFAULT_ASSUMPTIONS` with `swrBuckets: []`.
- `src/utils/swrBuckets.ts` (new) — `rateForAge`, `validateBuckets`.
- `src/utils/withdrawals.ts` — replace `targetSpending` initialization and per-year increment with a per-year computation.
- `src/components/AssumptionsForm.tsx` — add bucket list editor and validation surfacing.
- `src/components/MethodologyPanel.tsx` — document the new behavior.
- `src/tests/calculations.test.ts` — six new tests in `testSwrBuckets()`.

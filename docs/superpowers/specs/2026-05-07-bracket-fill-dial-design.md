# Bracket-Fill Adjustment Dial — Design

**Date:** 2026-05-07
**Status:** Approved
**Scope:** US only (Canada deferred)

## Problem

The current US tax-optimized withdrawal strategy fills Traditional withdrawals up to a fixed ceiling — the top of the 12% federal bracket plus the standard deduction (`withdrawals.ts:445-473`). This produces a single deterministic withdrawal mix per year that users cannot tune.

Users may want to:

- **Pull more from Traditional now** to preserve Roth balance for later, accepting some 22%-bracket tax today
- **Pull less from Traditional**, drawing harder on Roth in low-spending years to keep ordinary income below the 12% top

There is currently no dial for this. The user's experiment showed a year drawing $40k from Roth that they wanted reshaped to ~$15k, with the rest coming from Traditional.

## Concept

A single global dial in **Assumptions** that resizes the 12% bracket-fill window only. Every other withdrawal step (RMDs, Roth, Taxable, HSA, fallback Traditional) is unchanged.

```
fillCeiling = standardDeduction + bracket12Max × (1 + bracketFillAdjustment)
```

- **0%** (default): identical to today's behavior
- **Positive** (up to +100%): ceiling extends into the 22% bracket — pulls more Traditional, less Roth
- **Negative** (down to −100%): ceiling shrinks toward standard deduction only — pulls less Traditional, more Roth

Worked example, single filer (std deduction $14,600, 12% top $47,150 — figures from current code at `src/utils/constants.ts:29` and `src/utils/withdrawals.ts:449`):

| Adjustment | Adjusted bracket12Max | Fill ceiling | Effect vs. default |
|------------|----------------------|--------------|--------------------|
| −100%      | $0                   | $14,600      | Bracket-fill effectively disabled |
| −50%       | $23,575              | $38,175      | ≈$23.6k less Traditional, that much more Roth |
| **0% (default)** | **$47,150**     | **$61,750**  | **Current behavior** |
| +50%       | $70,725              | $85,325      | ≈$23.6k more Traditional |
| +100%      | $94,300              | $108,900     | Ceiling extends past the top of the 22% bracket |

## Design

### Data model

In `src/types/index.ts`, extend `Assumptions`:

```ts
export interface Assumptions {
  inflationRate: number;
  safeWithdrawalRate: number;
  retirementReturnRate: number;
  swrBuckets?: SwrBucket[];
  bracketFillAdjustment?: number; // decimal in [-1.0, 1.0]; 0 = default; US-only
}
```

In `src/utils/constants.ts`, extend `DEFAULT_ASSUMPTIONS` with `bracketFillAdjustment: 0`. Optional + nullish-coalesce on read keeps existing localStorage state working without a migration.

### UI

In `AssumptionsForm.tsx`, mount a NumberInput between the SwrBucketEditor and the Retirement Return Rate fields. Gate on `country === 'US'`:

```
Label:   "Bracket-Fill Adjustment (%)"
Tooltip: "Slides the optional Traditional withdrawal step's ceiling up or
          down relative to the top of the 12% bracket. 0% (default) fills
          exactly to the top of the 12% bracket. Positive values pull more
          from Traditional now (paying some 22% tax) to preserve Roth.
          Negative values pull less, drawing more from Roth instead."

NumberInput:
  min={-100} max={100}
  isPercentage decimals={0}
  defaultValue={0}

Helper text: "Range: −100% disables bracket fill (standard deduction only).
              +100% extends fill into the 22% bracket. US only."
```

`isPercentage` means the user enters a whole number (−100 to 100), but the value stored on `Assumptions.bracketFillAdjustment` is a decimal in [−1.0, 1.0], matching the convention already used by SWR, retirement return rate, etc.

For Canadian users the field is hidden entirely; the engine also ignores the value when `profile.country !== 'US'`, so toggling country round-trip is safe.

### Engine integration

The only change to the withdrawal engine is in `performTaxOptimizedWithdrawal` (`src/utils/withdrawals.ts:445-450`):

```ts
const bracket12Max = filingStatus === 'married_filing_jointly' ? 94300 : 47150;
const adjustment = profile.country === 'US'
  ? (assumptions.bracketFillAdjustment ?? 0)
  : 0;
const adjustedBracket12 = bracket12Max * (1 + adjustment);
const targetOrdinaryIncome = standardDeduction + adjustedBracket12;
```

This requires passing `assumptions` (or just the dial value) into `performTaxOptimizedWithdrawal` — the function does not currently receive it. The outer `calculateWithdrawals` already has `assumptions` in scope, so this is a one-line signature change at the call site (`withdrawals.ts:203`).

Steps 1 (RMDs), 3 (Roth), 4 (Taxable), 5 (HSA), and 6 (fallback Traditional) are **unchanged**. Only step 2's ceiling moves.

### Validation & edge cases

- `NumberInput` min/max clamps the input to [−100, 100]; no extra validator needed.
- **At −100%:** ceiling collapses to `standardDeduction`. If RMDs alone already meet or exceed the standard deduction, step 2 contributes $0 (the existing `roomIn12Bracket = max(0, …)` guard handles it).
- **At +100%:** ceiling extends past the top of the 22% bracket into 24% territory (single ceiling ≈ $108,900; 22% top = $100,525). The existing tax calculator handles the higher bracket math correctly — extra dollars are taxed at 22% or 24% as applicable, surfacing naturally in the year's `federalTax`.
- **Country round-trip:** the value is preserved in state when a user switches US→CA→US. Hidden in CA UI, ignored by the CA engine path, restored on return to US.
- **No interaction with conversions:** the bracket-fill ceiling only affects step 2 of `performTaxOptimizedWithdrawal`. Conversions (added in the prior feature) run *after* withdrawals (`withdrawals.ts:227-238`) and add to ordinary income separately. The two features are orthogonal.

### Methodology panel

Add one paragraph to the US section of `MethodologyPanel.tsx` explaining the dial: what it adjusts, what positive/negative mean, and the default ceiling figures ($14,600 + $47,150 = $61,750 single, $29,200 + $94,300 = $123,500 MFJ).

### Tests

New function `testBracketFillAdjustment()` registered in `runAllTests`, asserting:

1. **Parity at 0%:** with `bracketFillAdjustment = 0`, total Traditional/Roth/Taxable withdrawals match the existing baseline test exactly (regression guard).
2. **Positive adjustment:** with `bracketFillAdjustment = 0.5` on a year where spending need exceeds the default ceiling, Traditional withdrawal increases by approximately `bracket12Max × 0.5` and Roth withdrawal decreases by the same amount. The sum (total withdrawal) is unchanged, just redistributed.
3. **Maximum negative:** with `bracketFillAdjustment = -1.0`, step 2 of the strategy contributes at most the standard-deduction room. Roth absorbs the rest of the spending need.
4. **Canada ignores the dial:** running a Canadian profile with `bracketFillAdjustment = 0.5` produces identical totals to running it with the default — the engine path skips the adjustment.

## Defaults / migration

- New `Assumptions` field defaults to `0`.
- Existing localStorage state without the field reads as `undefined` and is treated as `0` via `?? 0` at use sites — no migration required.

## Out of scope (deferred follow-ups)

- **Per-account caps, target % allocation, or priority override.** These were the other three dial options floated during brainstorming. The user chose the bracket-fill resize as the simplest model that gives them the lever they actually need.
- **Canadian equivalent.** Canada's withdrawal tiers don't have a one-to-one analogue of the 12% bracket-fill step; designing a Canadian dial requires its own brainstorm.
- **Age-bucketed adjustments.** If a single global value turns out to be too coarse across a long retirement, a future iteration could let the user vary the dial by age range (mirroring the SWR-buckets feature shipped earlier on this branch).

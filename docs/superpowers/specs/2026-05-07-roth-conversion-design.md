# Roth Conversion Modeling — Design

**Status:** Approved (ready for implementation plan)
**Date:** 2026-05-07
**Scope:** US-only behavior, country-neutral schema (Canada variant deferred)

---

## Summary

Add the ability to model Roth IRA conversions from deferred-tax accounts (Traditional IRA, Traditional 401(k)) within the retirement calculator. Each conversion plan specifies a source account, destination Roth account, start age, end age, and yearly conversion amount in today's dollars. Conversions can occur during accumulation or retirement. The calculator surfaces:

- The extra tax cost during accumulation as a new "Pre-Retirement" summary section.
- The full lifetime tax effect (savings or cost vs. doing nothing) as a new Key Insights card.
- In-retirement conversion taxes folded into the existing Lifetime Taxes number.
- Methodology copy explaining the model.

---

## Decisions log

| # | Question | Decision |
|---|---|---|
| 1 | Country scope | US-only behavior, country-neutral schema |
| 2 | One vs many plans | Multiple plans (`conversionPlans: ConversionPlan[]`) |
| 3 | Source/destination selection | Both explicit references to existing accounts |
| 4 | Conversion amount semantics | Today's dollars, inflated yearly |
| 5 | Pre-retirement income field | Reuse `Profile.annualIncome`, promoted to general use |
| 6 | Pre-retirement income growth | New user-input rate `Profile.incomeGrowthRate` |
| 7 | Insufficient source balance | Cap silently at available balance |
| 8 | State tax in delta | Federal + state, mirroring retirement-phase math |
| 9 | Early-withdrawal penalty on conversion | None (matches IRS treatment) |
| 10 | Bracket-fill interaction in retirement | Bracket-fill ignores conversions; conversion does not fund spending |

---

## Data model

### New type — `ConversionPlan`

```ts
export interface ConversionPlan {
  id: string;
  name: string;                 // user-friendly label, e.g. "401k ladder"
  sourceAccountId: string;      // must reference an account whose treatment is 'pretax'
  destinationAccountId: string; // must reference an account whose treatment is 'roth'
  startAge: number;             // inclusive
  endAge: number;               // inclusive
  yearlyAmount: number;         // today's dollars; inflated yearly
}
```

### `Profile` changes

- `annualIncome` is promoted from CA-only ("RRSP contribution room") to a generally-meaningful "current ordinary income (today's dollars)" field. The form label changes to **"Current Annual Income"** with helper text covering both uses.
- New optional field `incomeGrowthRate?: number` (decimal; default `0.03`). Used to project pre-retirement income year-over-year for the conversion delta.

### `AppState` changes

```ts
interface AppState {
  accounts: Account[];
  profile: Profile;
  assumptions: Assumptions;
  incomeStreams: IncomeStream[];
  conversionPlans: ConversionPlan[];  // new, persisted via useLocalStorage
}
```

LocalStorage key: `retirement-planner-conversion-plans`.

### Result-type additions

- `AccumulationResult.conversionsByYear: { age: number; year: number; amount: number; taxDelta: number }[]`
- `AccumulationResult.lifetimeConversionTaxCost: number` — sum of pre-retirement `taxDelta` only.
- `YearlyWithdrawal.conversionAmount: number` — per-year in-retirement conversion amount; defaults to 0. The conversion's tax cost is already included in the year's `federalTax`/`stateTax` because conversion is added to ordinary income before tax math runs.
- `RetirementResult.lifetimeTaxDeltaFromConversion: number` — net lifetime tax effect of the user's plans, computed by running the simulation twice (see Calculation flow).

---

## Calculation flow

### Accumulation phase (`src/utils/projections.ts`)

For each year of accumulation, in order:

1. Apply investment return to each account's existing balance.
2. Add contributions and any employer match.
3. **(New)** For each `ConversionPlan` where `startAge ≤ age ≤ endAge`:
   - Compute this year's nominal conversion amount: `yearlyAmount × (1 + inflationRate)^(age − currentAge)`.
   - Cap silently at the source account's available balance.
   - Subtract from source balance, add to destination balance.
   - Compute tax delta for this conversion (see "Pre-retirement tax delta") and accumulate into `conversionsByYear` and `lifetimeConversionTaxCost`.
4. Grow contribution amount for next year.

Order matters: growth and contributions are applied first, then conversion at end of year. This matches the requirement that the year's growth on the deferred-tax account is calculated before removing the conversion amount.

### Retirement phase (`src/utils/withdrawals.ts`)

For each retirement year, in order:

1. Apply growth.
2. Compute RMDs.
3. Compute income from streams + government benefits + RMDs.
4. **Bracket-fill traditional withdrawals (unchanged — conversions do not affect this).**
5. Withdraw to fund spending (Roth → taxable → HSA → fallback to traditional).
6. **(New)** For each active `ConversionPlan`:
   - Compute nominal conversion amount with same inflation factor.
   - Cap silently at source balance (after step 5's withdrawals, if source was used for spending).
   - Subtract from source, add to destination.
   - Add the converted amount to the year's ordinary income before tax computation in step 7.
7. Compute federal + state tax on `(ordinaryIncome + conversionAmount, capitalGains)`.
8. Penalty calc — conversion drawdowns are excluded from early-withdrawal penalty checks.

The year's `federalTax` / `stateTax` / `totalTax` therefore already include the conversion's tax cost. `lifetimeTaxesPaid` rolls up naturally — no separate accounting needed for retirement-phase conversions.

When multiple plans share a source account, plans are processed in their list order; each plan's conversion cap-checks against the running balance of the source account.

### Conversion does not fund spending

Per Q10: a conversion is a paper income event for tax purposes. It does not reduce the spending-side traditional withdrawals. The bracket-fill heuristic also does not consider conversions — the user's explicit conversion plan is independent from the calculator's withdrawal heuristics.

---

## Pre-retirement tax delta computation

Per pre-retirement year in which one or more conversions are active:

1. Project the user's nominal ordinary income for that year:
   ```
   incomeForYear = profile.annualIncome × (1 + profile.incomeGrowthRate)^(age − currentAge)
   ```
2. Sum all conversion amounts active that year (already inflated):
   ```
   conversionTotalForYear = Σ activePlan.yearlyAmount × (1 + inflationRate)^(age − currentAge)
   ```
3. Compute taxes twice using the existing tax engine, applying both federal and state:
   ```
   taxWithout = calculateTotalFederalTax(incomeForYear, 0, filingStatus)
              + calculateStateTax(incomeForYear, stateTaxRate)

   taxWith    = calculateTotalFederalTax(incomeForYear + conversionTotalForYear, 0, filingStatus)
              + calculateStateTax(incomeForYear + conversionTotalForYear, stateTaxRate)

   yearTaxDelta = taxWith − taxWithout
   ```
4. If multiple plans contribute to the same year, the delta is computed once on the combined total — bracket-stack effects are captured correctly. The delta is not attributed back to individual plans.

```
lifetimeConversionTaxCost = Σ yearTaxDelta over all pre-retirement years
```

The two-pass approach is used (rather than `marginalRate × amount`) so that conversions straddling a bracket boundary are computed correctly.

For pre-retirement income, capital gains is `0` — pre-retirement capital gains are not modeled in this calculator.

---

## Lifetime tax delta from conversion

A new Key Insights card answers: "Did the conversion strategy save or cost me money over my lifetime?"

`useRetirementCalc` runs the simulation twice:

1. **Primary pass** with the user's plans — produces `primaryAccumulation` and `primaryRetirement`. Drives every existing chart, table, and summary.
2. **Shadow pass** with `conversionPlans = []` — only `shadowRetirement.lifetimeTaxesPaid` is used. (`shadowAccumulation.lifetimeConversionTaxCost` is always 0.)

```
lifetimeTaxDeltaFromConversion =
  (primaryRetirement.lifetimeTaxesPaid + primaryAccumulation.lifetimeConversionTaxCost)
-  shadowRetirement.lifetimeTaxesPaid
```

The hook attaches the computed delta to the returned `retirement.lifetimeTaxDeltaFromConversion` field so the summary cards can read it from a single object.

- Negative → conversions reduced lifetime taxes (typical for early-retirement ladders that drain low-income years and shrink future RMDs).
- Positive → conversions increased lifetime taxes (e.g., user's current bracket > retirement bracket).

Cost: doubles calculation work in `useMemo`. Negligible for realistic horizons.

---

## UI components

### New: `src/components/RothConversionForm.tsx`

Single-plan editor, mirrors `IncomeStreamForm`:

- Name (text)
- Source account (dropdown of accounts where `getTaxTreatment(type) === 'pretax'`)
- Destination account (dropdown of accounts where `getTaxTreatment(type) === 'roth'`)
- Start age (NumberInput)
- End age (NumberInput, must be ≥ startAge)
- Yearly amount in today's dollars (NumberInput, currency formatted)

Inline validation:
- "No eligible source accounts — add a Traditional IRA or 401(k) first" if pretax list is empty.
- "No eligible Roth accounts — add a Roth IRA or Roth 401(k) first" if roth list is empty.
- "End age must be ≥ start age."
- Soft warning (non-blocking) if `endAge < currentAge` or `startAge > lifeExpectancy`.

### New: `src/components/RothConversionList.tsx`

List with add / edit / remove. Mirrors `IncomeStreamList`. Each row shows: name, "Source → Destination", age range, yearly amount. Empty state: "No Roth conversions planned. Add one to model a conversion ladder."

### `src/components/ProfileForm.tsx` changes

- Rename "Annual Income" label to **"Current Annual Income"**, helper text: "Used for retirement contribution room (Canada) and Roth conversion tax modeling (US)."
- New "Income Growth Rate" field (percentage input, default 3%, helper text: "Used to project future income for tax modeling").

### `src/App.tsx` wiring

- Add `conversionPlans` state via `useLocalStorage`.
- Pass `conversionPlans` to `useRetirementCalc`.
- Mount `RothConversionList` after the Income Streams section.

### Country gating

Wrap the `RothConversionList` mount in a `country === 'US'` check. Schema is country-neutral, but UI is hidden for Canada.

---

## Summary card additions

### New section: "Pre-Retirement" (above "At Retirement")

Shown only when `conversionPlans` has at least one plan with `startAge < retirementAge`.

```
Pre-Retirement (Age {currentAge} → {retirementAge - 1})
┌──────────────────────────────────────┐
│ Conversion Tax Cost                  │
│ $XX,XXX                              │
│ Extra federal + state tax paid       │
│ during accumulation                  │
└──────────────────────────────────────┘
```

- Title: "Conversion Tax Cost"
- Value: `formatCurrency(accumulationResult.lifetimeConversionTaxCost)`
- Color: `red`
- Subtitle: "Extra federal + state tax paid during accumulation."
- Expandable details: per-year breakdown — age, conversion amount, tax delta — and total converted dollars.

### New card in "Key Insights": "Tax Change from Conversion"

Shown only when `conversionPlans.length > 0`.

- Title: "Tax Change from Conversion"
- Value: `formatCurrency(retirement.lifetimeTaxDeltaFromConversion)` with explicit sign — `−$X,XXX` (green) when conversions saved taxes, `+$X,XXX` (red) when they cost more.
- Color: `green` if delta < 0, `red` if delta > 0, `teal` if exactly 0.
- Subtitle: dynamic — "Conversions saved $X over your lifetime" or "Conversions cost $X over your lifetime."
- Formula (expanded): `(Total taxes WITH conversions) − (Total taxes WITHOUT conversions)`
- Details: small breakdown — pre-retirement delta + retirement-side delta — and an explanation that savings come from reduced future RMDs and tax-free Roth growth.

### Existing "Lifetime Taxes" card — minor tweak

In its expandable details panel, when conversions exist, append a line: `Of which from conversions during retirement: $X` (the in-retirement portion only — pre-retirement has its own card).

### No changes elsewhere

Total Portfolio card naturally reflects the destination Roth's growth. Charts that already render account-by-account visibly show the source draining and the Roth filling — no chart code changes needed.

---

## Methodology panel updates

`src/components/MethodologyPanel.tsx` gets a new section, US-only, inserted after the existing tax-bracket discussion and before the RMD section.

**New section: "Roth Conversions"** covers:

1. **What a Roth conversion is.** A transfer from a deferred-tax account to a Roth IRA / Roth 401(k); the converted amount is treated as ordinary income in the year of conversion. Future growth and qualified withdrawals from the Roth are tax-free.

2. **How the calculator models it.** End-of-year, post-growth, post-contributions/withdrawals; inflation-adjusted yearly amount moved from source to destination; cap silently if source insufficient.

3. **Tax treatment during accumulation.** Two-pass federal+state delta; income projected from `Profile.annualIncome` using `incomeGrowthRate`; reported as the "Conversion Tax Cost."

4. **Tax treatment during retirement.** Conversion amount is added to that year's ordinary income before tax computation. Existing "Lifetime Taxes" reflects it. Conversion does not fund spending and does not reduce traditional withdrawals.

5. **The "Tax Change from Conversion" insight.** Computed by running the simulation twice — once with plans, once without — capturing downstream effects.

6. **Withdrawal-bracket-fill interaction.** The "fill 12% bracket with traditional withdrawals" strategy is unchanged and ignores conversions; the user's explicit conversion plan is independent.

7. **Known simplifications** (extends the existing block):
   - Conversions are treated as transfers and do not trigger the 10% early-withdrawal penalty (matches IRS rules).
   - The 5-year rule on converted Roth amounts is not tracked.
   - Tax brackets are static 2024.
   - Pre-retirement income is assumed flat-growth at the user-input rate.

For Canada, no methodology changes — the section is hidden.

---

## Validation rules

- `sourceAccountId` must reference an existing account whose treatment is `pretax`. If the source account is deleted, the plan is removed.
- `destinationAccountId` must reference an existing account whose treatment is `roth`. Same delete-cascade.
- `startAge ≤ endAge`.
- `startAge ≥ currentAge` (soft warning if past).
- `yearlyAmount > 0`.
- Source and destination cannot be the same account.

---

## Tests

Extend `src/tests/calculations.test.ts`:

1. **Single pre-retirement plan, single year.** $30k conversion at age 50, $100k MFJ income; assert balance changes and `tax($130k) − tax($100k)` delta.
2. **Multi-year plan with growth and inflation.** Year-2 conversion equals `yearlyAmount × (1 + inflation)`; balances correct; `lifetimeConversionTaxCost` sums correctly.
3. **Bracket-straddling conversion.** Confirms two-pass computation, not marginal-rate approximation.
4. **Multiple plans active in same year.** Combined delta = `tax(income + sum) − tax(income)`.
5. **Source balance insufficient.** Conversion capped at available; source ends at $0; tax delta computed on capped amount.
6. **Conversion in retirement window.**
   - Not included in `lifetimeConversionTaxCost`.
   - Year's `federalTax` / `stateTax` reflects conversion.
   - Bracket-fill traditional withdrawals unchanged.
   - Source draining and dest growing reflected in `yearlyWithdrawals`.
7. **No early-withdrawal penalty on conversion.** Plan with `startAge = 50`; `earlyWithdrawalPenalties` does not include the conversion event.
8. **Lifetime tax delta — savings case.** Configured scenario; assert `lifetimeTaxDeltaFromConversion < 0`.
9. **Lifetime tax delta — cost case.** Configured scenario; assert `lifetimeTaxDeltaFromConversion > 0`.
10. **Empty plans, behavioral parity.** With `conversionPlans = []`, all existing test outputs remain identical (regression guard).

### Manual UI smoke-test

- Add a Traditional IRA + Roth IRA, configure a 5-year ladder, verify charts visibly show source draining and Roth filling.
- Toggle country to Canada — confirm the Roth Conversion section disappears.
- Delete the source account — confirm the plan is removed and the summary cards update.
- Set life expectancy < retirement age — confirm existing "Invalid Age Configuration" warning still surfaces; conversion summary cards behave gracefully.

---

## Edge cases

- `endAge < currentAge` → plan never fires; `lifetimeConversionTaxCost = 0`; no error.
- `startAge > lifeExpectancy` → same.
- Plan exists but source account already deleted → cascade-removed when accounts change.
- All conversion plans during retirement → "Pre-Retirement" summary section is hidden.
- All conversion plans during accumulation → "Tax Change from Conversion" still computes a meaningful delta because retirement-side RMD changes and Roth growth are reflected in the shadow run.

---

## Out of scope (deferred)

- Canadian RRSP-to-TFSA strategy modeling (different tax mechanics; schema is neutral so a future variant can be added without migration).
- Tracking the 5-year rule on converted Roth amounts (consistent with existing Roth simplification).
- Bracket creep / inflation-adjusted tax brackets.
- Modeling pre-retirement capital gains, bonuses, or other income variability.
- Per-plan attribution of the tax delta (we sum across plans active in the same year).

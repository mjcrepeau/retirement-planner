# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev      # Start development server
npm run build    # TypeScript check + production build
npm run lint     # ESLint
npm test         # Run calculation + export tests
```

## Architecture

This is a React retirement planning calculator that projects portfolio growth and simulates tax-optimized withdrawals.

### Core Calculation Flow

1. **Accumulation Phase** (`src/utils/projections.ts`): Projects account growth from current age to retirement using compound interest, annual contributions, contribution growth rates, and employer matching.

2. **Withdrawal Phase** (`src/utils/withdrawals.ts`): Simulates retirement spending with a tax-optimized withdrawal strategy:
   - Takes Required Minimum Distributions (RMDs) from traditional accounts first (age 73+)
   - Fills the tax bracket with additional traditional withdrawals, country-aware: US fills the standard deduction + 12% bracket, Canada fills the federal basic personal amount + first federal bracket
   - Uses Roth accounts (tax-free)
   - Uses taxable accounts (with capital gains tracking)
   - Uses HSA last
   - Falls back to additional traditional withdrawals if needed
   - Final fallback: if all available accounts are exhausted, withdraws from accounts before their configured start age, incurring early-withdrawal penalties (10% for US traditional accounts before age 59.5)

3. **Tax Calculations** (`src/utils/taxes.ts`): Each country exposes a consolidated `calculateYearlyTaxes` that computes federal + regional tax including capital gains (US: 2026 brackets with 0%/15%/20% capital gains rates; Canada: 50% capital gains inclusion stacked on ordinary income). CPP and OAS are modeled as 100% taxable; US Social Security income streams are 85% taxable (maximum portion).

### Data Flow

- `App.tsx` holds state for accounts, profile, and assumptions (persisted to localStorage via `useLocalStorage` hook)
- `useRetirementCalc` hook orchestrates calculations, returning `AccumulationResult` and `RetirementResult`
- Chart components receive results and render visualizations using Recharts

### Key Types (`src/types/index.ts`)

- `Account`: Investment account with balance, contributions, return rate, type (traditional_401k, roth_ira, etc.)
- `Profile`: User info including ages, filing status, Social Security
- `Assumptions`: Economic parameters (inflation, withdrawal rate, retirement return)
- `AccumulationResult` / `RetirementResult`: Yearly projections with balances, withdrawals, taxes

### Key Features

**Configurable Withdrawal Ages:**
- Each account has optional `withdrawalRules: { startAge: number }`
- Defaults are smart: traditional accounts default to 60 (US) or retirement age (Canada)
- Validation enforces RMD age constraints (can't delay past age 73 US, 71 Canada)
- Early withdrawals trigger 10% penalty for US traditional accounts before age 59.5

**Export (`src/utils/export/`):**

Three export paths share one foundation. `tables.ts` turns results into presentation-neutral `ExportTable` objects (columns + rows + metadata); `csv.ts` serializes them for spreadsheets and `PrintReport.tsx` renders the same objects as HTML. Add a column once and both outputs get it.

- **Scenario JSON** (`scenario.ts`): saves/loads all five localStorage keys plus `schemaVersion`. Import validates every field, drops unknown ones, then writes storage and reloads — the same approach country switching uses, so providers re-initialize cleanly. Bump `SCENARIO_SCHEMA_VERSION` on any breaking shape change.
- **CSV**: one button per data-table view, exporting whatever view is active. Header row first (so spreadsheets auto-detect it), metadata after a trailing blank line, raw unformatted numbers, UTF-8 BOM, CRLF.
- **Print report** (`PrintReport.tsx`): mounts off-screen at a fixed 720px (7.5in at 96dpi) because Recharts measures its container and cannot size an element with no layout. Charts must be passed `animate={false}` — Recharts reveals series by animating a clip path from zero width, so an animating chart prints blank. Dark mode is stripped for the duration and restored afterward.

**Nominal vs. real dollars:**

Everything the engine outputs is nominal (future) dollars. `presentValue`/`inflationFactor` in `export/realDollars.ts` are the single conversion point, used by both `SummaryCards` and the exports. Exports carry nominal as the primary columns, a Real column for headline figures, and an `Inflation Factor` column so any other column can be deflated in a spreadsheet. Note that tax brackets are not indexed to inflation in this model, so nominal tax figures include real bracket creep — deflating them gives the present value of dollars paid, not what an indexed-bracket world would charge.

**Known Simplifications (Penalty Calculations):**
- Roth contributions vs earnings not tracked separately. In reality, Roth contributions can be withdrawn penalty-free at any time; only earnings face the 10% penalty before age 59.5.
- HSA non-medical penalty (20% before age 65) not implemented. HSA withdrawals are modeled as penalty-free.
- 5-year rule for Roth accounts not tracked. Account opening dates are not stored.
- FHSA accounts are modeled as traditional/pretax (assumed transferred to RRSP and taxed on withdrawal).

**Known Simplifications (Spending & Income):**
- The spending target is pre-tax; withdrawals are not grossed up to cover taxes.
- RMD/RRIF withdrawals in excess of the spending need are counted as income for that year rather than reinvested.

### Tailwind v4

Uses `@tailwindcss/vite` plugin. Dark mode requires this CSS directive:
```css
@custom-variant dark (&:where(.dark, .dark *));
```

### Chart Components

All chart components accept `isDarkMode` prop for proper axis/legend coloring. Pass from App.tsx which manages dark mode state.

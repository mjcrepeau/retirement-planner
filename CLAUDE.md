# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev      # Start development server
npm run build    # TypeScript check + production build
npm run lint     # ESLint
npm test         # Run calculation tests
```

## Architecture

This is a React retirement planning calculator that projects portfolio growth and simulates tax-optimized withdrawals.

### Core Calculation Flow

1. **Accumulation Phase** (`src/utils/projections.ts`): Projects account growth from current age to retirement using compound interest, annual contributions, contribution growth rates, and employer matching.

2. **Withdrawal Phase** (`src/utils/withdrawals.ts`): Simulates retirement spending with a tax-optimized withdrawal strategy:
   - Takes Required Minimum Distributions (RMDs) from traditional accounts first (age 73+)
   - Fills 12% tax bracket with additional traditional withdrawals
   - Uses Roth accounts (tax-free)
   - Uses taxable accounts (with capital gains tracking)
   - Uses HSA last
   - Falls back to additional traditional withdrawals if needed

3. **Tax Calculations** (`src/utils/taxes.ts`): Computes federal income tax, capital gains tax, and state tax using 2024 brackets.

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

### Tailwind v4

Uses `@tailwindcss/vite` plugin. Dark mode requires this CSS directive:
```css
@custom-variant dark (&:where(.dark, .dark *));
```

### Chart Components

All chart components accept `isDarkMode` prop for proper axis/legend coloring. Pass from App.tsx which manages dark mode state.

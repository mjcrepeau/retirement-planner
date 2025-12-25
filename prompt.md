# Retirement Planning Web App - Project Specification

## Overview

Build a single-page React web application for retirement planning that allows users to model multiple investment accounts, project growth through retirement, and visualize tax-optimized withdrawal strategies.

## Tech Stack

- **Frontend**: React with TypeScript
- **Styling**: Tailwind CSS
- **Charts**: Recharts
- **State Management**: React hooks (useState, useReducer)
- **Build Tool**: Vite
- **No backend required** - all calculations run client-side

## Core Features

### 1. Account Management

Users should be able to add, edit, and remove multiple investment accounts. Each account has:

**Required Fields:**
- Account name (user-defined)
- Account type (dropdown):
  - Traditional 401(k)
  - Roth 401(k)
  - Traditional IRA
  - Roth IRA
  - Taxable Brokerage
  - HSA
- Current balance ($)
- Annual contribution ($)
- Contribution growth rate (% per year) - to model salary increases
- Expected rate of return (% per year)

**Optional Fields (by account type):**
- Employer match percentage (401k only)
- Employer match limit (401k only)

**Tax Treatment (derived from account type):**
- Traditional 401(k)/IRA: Pre-tax contributions, taxed as ordinary income on withdrawal
- Roth 401(k)/IRA: Post-tax contributions, tax-free qualified withdrawals
- Taxable Brokerage: Post-tax contributions, capital gains tax on growth
- HSA: Pre-tax contributions, tax-free for medical (model as tax-free for simplicity)

### 2. User Profile / Assumptions

**Personal Information:**
- Current age
- Planned retirement age
- Life expectancy (or "plan to age")
- Filing status (Single, Married Filing Jointly)
- State of residence (for state tax estimation, can simplify to a single state tax rate %)

**Economic Assumptions:**
- Inflation rate (default: 3%)
- Safe withdrawal rate (default: 4%)
- Expected return during retirement (default: 5%, typically more conservative than accumulation)

**Optional:**
- Estimated Social Security benefit ($ per year, in today's dollars)
- Social Security start age (default: 67)

### 3. Accumulation Phase Projection

Calculate year-by-year growth of each account from current age to retirement age:

```
For each year until retirement:
  For each account:
    1. Apply investment return: balance *= (1 + return_rate)
    2. Add annual contribution (with employer match if applicable)
    3. Increase contribution by growth rate for next year
    4. Cap contributions at IRS limits (optional advanced feature)
```

**Output:**
- Ending balance for each account at retirement
- Total portfolio value at retirement
- Breakdown by tax treatment (pre-tax, post-tax, tax-free)

### 4. Retirement Phase Projection (Tax-Optimized Withdrawals)

Simulate withdrawals from retirement age to life expectancy using a tax-optimized strategy:

**Tax Optimization Strategy (simplified):**

1. Calculate target after-tax spending (based on safe withdrawal rate applied to total portfolio)
2. Each year, withdraw in this order to minimize taxes:
   a. Fill up the standard deduction and low tax brackets with Traditional 401(k)/IRA withdrawals
   b. Supplement with Roth withdrawals (tax-free) to meet remaining spending needs
   c. Use taxable brokerage as needed (preferential capital gains rates)
3. Adjust target spending for inflation each year
4. Apply investment returns to remaining balances

**Tax Calculation (2024 Federal Brackets, Married Filing Jointly):**
```
Standard Deduction: $29,200 (2024 MFJ) - no tax on this amount
10% bracket: $0 - $23,200
12% bracket: $23,200 - $94,300
22% bracket: $94,300 - $201,050
24% bracket: $201,050 - $383,900
32% bracket: $383,900 - $487,450
35% bracket: $487,450 - $731,200
37% bracket: $731,200+
```

For Single filers, use corresponding single brackets.

Add a configurable state tax rate (simple flat percentage).

**Handle RMDs (Required Minimum Distributions):**
- Starting at age 73, Traditional 401(k)/IRA accounts require minimum withdrawals
- RMD = Account Balance / Distribution Period (from IRS Uniform Lifetime Table)
- Simplified: use approximate divisors (age 73: 26.5, age 75: 24.6, age 80: 20.2, etc.)
- If RMD exceeds what's needed for spending, withdraw the RMD anyway (it's required)

**Output:**
- Year-by-year withdrawal amounts from each account
- Annual tax burden
- After-tax spending power
- Remaining balance in each account
- Year when each account is depleted
- Year when total portfolio is depleted

### 5. Visualizations (using Recharts)

**Chart 1: Account Growth (Accumulation Phase)**
- Type: Stacked area chart
- X-axis: Age (current to retirement)
- Y-axis: Balance ($)
- Series: One for each account, stacked to show total
- Color-code by tax treatment (e.g., blue for pre-tax, green for Roth, orange for taxable)

**Chart 2: Portfolio Composition at Retirement**
- Type: Pie or donut chart
- Segments: Each account's ending balance
- Show percentage breakdown by tax treatment

**Chart 3: Retirement Drawdown**
- Type: Stacked area chart
- X-axis: Age (retirement to life expectancy)
- Y-axis: Remaining balance ($)
- Series: One for each account
- Show how each account depletes over time

**Chart 4: Annual Retirement Income**
- Type: Stacked bar chart
- X-axis: Age (retirement to life expectancy)
- Y-axis: Annual income ($)
- Series: 
  - Gross withdrawals (by account type)
  - Taxes paid (negative or separate color)
  - Social Security (if provided)
- Show after-tax spending line overlay

**Chart 5: Tax Burden Over Time**
- Type: Line chart
- X-axis: Age during retirement
- Y-axis: Annual taxes paid ($)
- Optional: Show effective tax rate as secondary y-axis

### 6. Summary Statistics

Display key metrics prominently:

**At Retirement:**
- Total portfolio value
- Breakdown: Pre-tax / Roth / Taxable amounts

**During Retirement:**
- Sustainable annual withdrawal (in today's dollars)
- Sustainable monthly withdrawal (in today's dollars)
- Portfolio longevity (years until depletion)
- Lifetime taxes paid in retirement
- Percentage of income replacement (vs. pre-retirement income, if provided)

**Warnings/Alerts:**
- If portfolio depletes before life expectancy
- If RMDs force higher withdrawals than desired
- If contribution limits exceeded (if implementing limits)

## UI/UX Requirements

### Layout

Use a clean, professional design with:

1. **Header**: App title, brief description
2. **Left Panel or Top Section**: Input forms
   - Collapsible sections for: Accounts, Profile, Assumptions
   - "Add Account" button
   - Clear visual hierarchy
3. **Main Content**: Charts and results
   - Tab navigation between different views (Accumulation, Retirement, Summary)
   - Charts should be responsive
4. **Summary Cards**: Key statistics always visible

### Interaction

- Real-time updates: Charts and calculations update as inputs change
- Input validation: Reasonable ranges, required fields
- Tooltips: Explain less obvious inputs (e.g., "Safe withdrawal rate")
- Sensible defaults: Pre-populate with reasonable assumptions
- Presets: Consider "Quick Start" templates (e.g., "Aggressive Saver", "Conservative")

### Responsive Design

- Works on desktop and tablet
- Mobile: Stack panels vertically, charts remain usable

## Sample Default Values

When the app loads, pre-populate with a sample scenario so users see something meaningful:

```
Profile:
- Current age: 35
- Retirement age: 65
- Life expectancy: 90
- Filing status: Married Filing Jointly
- State tax rate: 5%

Assumptions:
- Inflation: 3%
- Safe withdrawal rate: 4%
- Retirement return: 5%

Accounts:
1. "401(k)" - Traditional 401k
   - Balance: $150,000
   - Annual contribution: $15,000
   - Employer match: 50% up to 6% of salary (assume $100k salary = $3,000 match)
   - Contribution growth: 3%
   - Return: 7%

2. "Roth IRA" - Roth IRA
   - Balance: $40,000
   - Annual contribution: $7,000
   - Contribution growth: 0% (already maxed)
   - Return: 7%
```

## Code Organization

```
src/
├── components/
│   ├── AccountForm.tsx        # Add/edit account modal or form
│   ├── AccountList.tsx        # Display list of accounts
│   ├── ProfileForm.tsx        # User profile inputs
│   ├── AssumptionsForm.tsx    # Economic assumptions
│   ├── ChartAccumulation.tsx  # Growth chart
│   ├── ChartDrawdown.tsx      # Retirement drawdown chart
│   ├── ChartIncome.tsx        # Annual income chart
│   ├── SummaryCards.tsx       # Key statistics display
│   └── Layout.tsx             # Overall app layout
├── hooks/
│   └── useRetirementCalc.ts   # Main calculation logic as a hook
├── utils/
│   ├── projections.ts         # Accumulation phase calculations
│   ├── withdrawals.ts         # Retirement phase calculations
│   ├── taxes.ts               # Tax calculation utilities
│   └── constants.ts           # Tax brackets, limits, etc.
├── types/
│   └── index.ts               # TypeScript interfaces
├── App.tsx
└── main.tsx
```

## Implementation Notes

### Calculation Precision
- Use numbers, not strings, for all calculations
- Round display values to whole dollars
- Handle edge cases: zero balances, zero contributions, negative scenarios

### Performance
- Memoize expensive calculations (useMemo)
- Debounce input changes if needed
- 30-60 years of projections should calculate instantly

### State Structure

```typescript
interface Account {
  id: string;
  name: string;
  type: 'traditional_401k' | 'roth_401k' | 'traditional_ira' | 'roth_ira' | 'taxable' | 'hsa';
  balance: number;
  annualContribution: number;
  contributionGrowthRate: number; // as decimal, e.g., 0.03
  returnRate: number; // as decimal
  employerMatchPercent?: number; // 401k only
  employerMatchLimit?: number; // 401k only
}

interface Profile {
  currentAge: number;
  retirementAge: number;
  lifeExpectancy: number;
  filingStatus: 'single' | 'married_filing_jointly';
  stateTaxRate: number; // as decimal
  socialSecurityBenefit?: number;
  socialSecurityStartAge?: number;
}

interface Assumptions {
  inflationRate: number;
  safeWithdrawalRate: number;
  retirementReturnRate: number;
}
```

### Testing Scenarios

Verify calculations against these scenarios:

1. **Simple case**: One 401k account, no employer match
2. **Roth-heavy**: Mostly Roth savings, verify tax-free withdrawals
3. **Early retirement**: Retire at 50, verify early withdrawal considerations (note: for simplicity, you can ignore early withdrawal penalties, or add a warning)
4. **Long retirement**: Live to 100, verify portfolio longevity
5. **High earner**: Large balances, verify higher tax brackets apply correctly

## Stretch Goals (Optional Enhancements)

If time permits, consider adding:

1. **Roth Conversion Ladder**: Model converting Traditional to Roth in low-income years
2. **Sequence of Returns Risk**: Monte Carlo simulation instead of fixed returns
3. **Contribution Limits**: Enforce IRS limits with warnings
4. **Export/Import**: Save scenarios to JSON, load later
5. **Comparison Mode**: Show two scenarios side-by-side
6. **Print/PDF Report**: Generate a summary report

## Getting Started

1. Initialize project: `npm create vite@latest retirement-planner -- --template react-ts`
2. Install dependencies: `npm install recharts tailwindcss postcss autoprefixer`
3. Configure Tailwind
4. Build out components incrementally:
   - Start with data types and state management
   - Build calculation utilities with console.log testing
   - Add simple UI to verify calculations
   - Add charts once calculations are working
   - Polish UI last

Focus on correctness of calculations first, then visualization, then polish.
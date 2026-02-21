# Retirement Planner

A comprehensive retirement planning calculator that projects portfolio growth, simulates tax-optimized withdrawals, and visualizes your financial future through retirement.

✨Vibe✨ coded with Claude -- check results manually for accuracy.

Hosted at: [https://mjcrepeau.github.io/retirement-planner/](https://mjcrepeau.github.io/retirement-planner/)

![Dashboard showing retirement account totals, income, etc.](screenshots/dashboard.png "Main dashboard")

## Features

### Multi-Country Support
The calculator supports retirement planning for both **United States** and **Canada**:

#### United States
- **Account Types**: Traditional 401(k), Roth 401(k), Traditional IRA, Roth IRA, Taxable Brokerage, HSA
- **Tax System**: Federal income tax brackets, state tax rates, capital gains rates
- **Benefits**: Social Security integration with configurable start age
- **RMDs**: Required Minimum Distributions starting at age 73

#### Canada
- **Account Types**: RRSP, TFSA, RRIF, LIRA, LIF, FHSA, Non-registered, Employer RRSP
- **Tax System**: Federal tax brackets, provincial tax rates by region
- **Benefits**: CPP (Canada Pension Plan) and OAS (Old Age Security)
- **RRIF Minimums**: Mandatory withdrawals starting at age 71

Switching countries automatically resets accounts and profile to country-appropriate defaults.

### Portfolio Management
- **Multiple Account Types**: Support for US and Canadian retirement account types
- **Employer Matching**: Configure employer match percentage and limits for 401(k)/RRSP accounts
- **Individual Returns**: Set expected return rates per account
- **Contribution Growth**: Model salary increases affecting future contributions
- **Configurable Withdrawal Ages**: Set when withdrawals begin from each account to model early retirement scenarios

### Retirement Projections
- **Accumulation Phase**: Project portfolio growth from now until retirement with compound interest and contributions
- **Withdrawal Phase**: Simulate retirement spending with tax-optimized withdrawal strategies
- **Social Security Integration**: Include Social Security benefits starting at your chosen age
- **Inflation Adjustment**: All projections account for inflation over time

### Tax-Optimized Withdrawals
The withdrawal algorithm follows a tax-efficient strategy:
1. **Required Minimum Distributions (RMDs)**: Mandatory withdrawals from traditional accounts starting at age 73
2. **Account Availability**: Respects configured withdrawal start ages (e.g., delaying IRA withdrawals until age 60)
3. **Early Withdrawal Penalties**: Calculates 10% penalty for US traditional account withdrawals before age 59.5
4. **Tax Bracket Optimization**: Fill lower tax brackets with traditional withdrawals
5. **Roth Withdrawals**: Tax-free withdrawals for remaining needs
6. **Taxable Account Withdrawals**: With capital gains tracking
7. **HSA**: Used last, tax-free for qualified medical expenses

### Tax Calculations

#### United States
- 2024 Federal income tax brackets (Single and Married Filing Jointly)
- Long-term capital gains rates with 0%/15%/20% brackets
- State tax rate configuration
- Standard deduction applied automatically
- Social Security taxation (85% taxable)

#### Canada
- 2024 Federal tax brackets with Basic Personal Amount
- Provincial tax rates for all provinces and territories
- Capital gains inclusion rate (50% or 66.67% for gains over $250k)
- CPP/OAS benefit integration

### Visualizations
- **Accumulation Chart**: Stacked area chart showing portfolio growth by account
- **Drawdown Chart**: Portfolio balance through retirement years
- **Income Chart**: Annual retirement income breakdown (withdrawals, Social Security, taxes)
- **Tax Chart**: Tax burden over time
- **Composition Chart**: Pie chart of portfolio allocation by tax treatment

### Screenshots
![Graph showing cash accumulation over working years](screenshots/accumulation.png "Accumulation graph")
![Graph showing account drawdown over retirement years](screenshots/drawdown.png "Drawdown graph")
![Graph showing retirement invome year by year](screenshots/income.png "Income graph")
![Graph showing retirement taxe burden year by year](screenshots/taxes.png "Tax burden graph")
![Table showing yearly income and spending calculations](screenshots/yearly.png "Yearly income table")


### Calculation Transparency
Full visibility into how every number is calculated:

- **Methodology Tab**: Complete reference documentation including:
  - All formulas used in accumulation and withdrawal phases
  - 2024 federal tax brackets (Single and MFJ)
  - Long-term capital gains rate tables
  - IRS Required Minimum Distribution (RMD) table
  - Tax-optimized withdrawal strategy explanation
  - Important assumptions and limitations

- **Year-by-Year Data Tables**: Expandable tables showing detailed projections:
  - *Accumulation Phase*: Summary, per-account balances, and contributions (with employer match)
  - *Withdrawal Phase*: Income & spending, withdrawals by account, remaining balances, and tax details
  - Lifetime totals and color-coded by tax treatment

- **Expandable Summary Cards**: Click any summary metric to see:
  - The formula used to calculate it
  - Step-by-step calculation breakdown
  - Context and explanations for the values

### User Experience
- **Dark Mode**: Toggle between light and dark themes
- **Data Persistence**: All data saved to localStorage automatically
- **Reset Function**: Clear all data and start fresh
- **Responsive Design**: Works on desktop and mobile devices

## Tech Stack

- **React 19** with TypeScript
- **Vite** for fast development and builds
- **Tailwind CSS v4** for styling
- **Recharts** for data visualization
- **UUID** for unique account identifiers

## Getting Started

### Prerequisites
- Node.js 18+
- npm or yarn

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd retirement-planner

# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Run tests
npm test
```

### Docker

```bash
# Build and start in production mode
docker compose up -d --build

# Stop and remove container
docker compose down

# View logs
docker compose logs -f
```

The app will be available at `http://localhost`.

## Project Structure

```
src/
├── components/           # React components
│   ├── AccountForm.tsx           # Form for adding/editing accounts
│   ├── AccountList.tsx           # List of investment accounts
│   ├── AssumptionsForm.tsx       # Economic assumptions input
│   ├── ChartAccumulation.tsx     # Portfolio growth chart
│   ├── ChartComposition.tsx      # Pie chart of allocations
│   ├── ChartDrawdown.tsx         # Retirement drawdown chart
│   ├── ChartIncome.tsx           # Retirement income chart
│   ├── ChartTax.tsx              # Tax burden chart
│   ├── CountrySelector.tsx       # Country switching dropdown
│   ├── DataTableAccumulation.tsx # Year-by-year accumulation data
│   ├── DataTableWithdrawal.tsx   # Year-by-year withdrawal data
│   ├── Layout.tsx                # App layout with header/footer
│   ├── MethodologyPanel.tsx      # Formulas & assumptions reference
│   ├── NumberInput.tsx           # String to number conversion
│   ├── ProfileForm.tsx           # Personal information form
│   ├── SummaryCards.tsx          # Expandable key metrics display
│   └── Tooltip.tsx               # Reusable tooltip component
├── contexts/
│   └── CountryContext.tsx    # Country selection state management
├── countries/                # Country-specific configurations
│   ├── index.ts              # Country config interface & registry
│   ├── usa/                  # United States configuration
│   │   ├── index.ts          # US account types, tax functions
│   │   ├── constants.ts      # US tax brackets, states
│   │   ├── taxes.ts          # US tax calculations
│   │   ├── withdrawals.ts    # US RMD calculations
│   │   └── benefits.ts       # Social Security calculations
│   └── canada/               # Canada configuration
│       ├── index.ts          # CA account types, tax functions
│       ├── constants.ts      # CA tax brackets, provinces
│       ├── taxes.ts          # CA tax calculations
│       ├── withdrawals.ts    # RRIF minimum calculations
│       └── benefits.ts       # CPP/OAS calculations
├── hooks/
│   ├── useLocalStorage.ts    # localStorage persistence hook
│   └── useRetirementCalc.ts  # Main calculation orchestrator
├── types/
│   └── index.ts              # TypeScript type definitions
├── utils/
│   ├── constants.ts          # Tax brackets, RMD tables, defaults
│   ├── projections.ts        # Accumulation phase calculations
│   ├── taxes.ts              # Tax calculation functions
│   └── withdrawals.ts        # Withdrawal phase simulation
├── tests/
│   └── calculations.test.ts  # Comprehensive math tests (US & CA)
├── App.tsx                   # Main application component
├── index.css                 # Tailwind CSS configuration
└── main.tsx                  # Application entry point
```

## How It Works

### Accumulation Phase
For each year until retirement:
1. Apply investment returns to existing balance
2. Add annual contribution (with employer match if applicable)
3. Grow contribution amount by contribution growth rate

### Withdrawal Phase
For each year of retirement:
1. Calculate Required Minimum Distribution (if age 73+)
2. Determine target spending (safe withdrawal rate + inflation)
3. Subtract Social Security income from spending need
4. Withdraw from accounts in tax-optimized order
5. Apply investment returns to remaining balance
6. Calculate federal and state taxes

### Key Assumptions
- Investment returns are applied annually
- Contributions are made at year-end
- RMDs follow the IRS Uniform Lifetime Table
- Social Security benefits grow with inflation
- Tax brackets are 2024 values (not inflation-adjusted)

## Configuration

### Default Values
| Setting | Default |
|---------|---------|
| Current Age | 35 |
| Retirement Age | 65 |
| Life Expectancy | 90 |
| Inflation Rate | 3% |
| Safe Withdrawal Rate | 4% |
| Retirement Return Rate | 5% |
| Social Security Benefit | $30,000/year |
| Social Security Start Age | 67 |

### Account Defaults
| Setting | Default |
|---------|---------|
| Expected Return | 7% |
| Contribution Growth | 3% |

## Testing

The project includes comprehensive tests for all calculations:

```bash
npm test
```

Tests cover:
- Federal and state/provincial tax calculations (US & Canada)
- Capital gains taxation with country-specific rules
- RMD calculations (US) and RRIF minimums (Canada)
- Accumulation phase projections
- Withdrawal phase simulations
- Canadian account type recognition
- Edge cases (zero balances, long retirements, etc.)

**Current test count: 85 tests**

## Credits

### Contributors
- **bwillem** ([@bguenther3](mailto:bguenther3@gmail.com)) - Multi-country support (Canada)
- **Josh Smith** ([smithgotsurf@gmail.com](mailto:smithgotsurf@gmail.com)) - Configurable account withdrawal age

## Disclaimer

This tool provides estimates only and should not be considered financial advice. Tax laws change frequently, and individual circumstances vary. Consult a qualified financial advisor for personalized retirement planning.

## License

MIT

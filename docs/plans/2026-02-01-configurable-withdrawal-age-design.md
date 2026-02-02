# Configurable Account Withdrawal Age - Design Document

**Date:** 2026-02-01
**Status:** Approved

## Overview

Add the ability to configure when withdrawals begin from individual investment accounts. This enables proper early retirement planning by preventing penalty-triggering withdrawals from tax-advantaged accounts before the penalty-free age.

## Problem Statement

Current system begins withdrawing from all accounts immediately at retirement age. For early retirees (e.g., retiring at 52), this triggers 10% early withdrawal penalties on traditional 401(k)/IRA withdrawals before age 59.5. Users need to specify which accounts are available at which ages to create realistic early retirement plans.

## User Story

"I want to retire at 52 with $600k in a brokerage account and $600k in a traditional IRA. I want to configure the IRA to not be touched until age 60, using the brokerage account to bridge the gap until then."

## Design Approach

**Chosen Architecture:** Withdrawal Rules Abstraction

Create withdrawal rules as a separate concern from account details, with dedicated penalty calculation logic. This provides clean separation and extensibility for future withdrawal-related features.

## Data Model

### Type Definitions

```typescript
// src/types/index.ts

interface AccountWithdrawalRules {
  startAge: number;  // Age when withdrawals can begin
}

interface Account {
  // ... existing fields ...
  withdrawalRules?: AccountWithdrawalRules;  // Optional for backwards compatibility
}

interface EarlyWithdrawalPenalty {
  amount: number;      // Penalty amount in dollars
  accountId: string;   // Which account triggered it
  accountName: string; // For display purposes
}

interface RetirementYearResult {
  // ... existing fields ...
  earlyWithdrawalPenalties: EarlyWithdrawalPenalty[];
  totalPenalties: number;
}
```

### Design Decisions

- `withdrawalRules` is optional to maintain backwards compatibility
- Undefined `withdrawalRules` will use smart defaults based on account type
- Penalties tracked per-account for detailed reporting

## Country-Specific Rules

### Country Config Extension

```typescript
// src/countries/index.ts

interface CountryConfig {
  // ... existing fields ...
  getPenaltyInfo: (accountType: AccountType) => PenaltyInfo;
  calculateEarlyWithdrawalPenalty: (
    amount: number,
    accountType: AccountType,
    age: number
  ) => number;
}

interface PenaltyInfo {
  penaltyAge: number;              // Age when penalty no longer applies
  penaltyRate: number;             // e.g., 0.10 for 10%
  appliesToAccountType: boolean;   // Does this account type have penalties?
}
```

### US Penalty Rules

- **Traditional 401(k)/IRA:** 10% penalty before age 59.5
- **Roth accounts:** No penalty on contributions
- **Taxable/HSA:** No penalty
- **Default withdrawal age:** 60 for traditional accounts, retirement age for others

### Canada Penalty Rules

- **RRSP/RRIF:** Withholding tax (10-30% based on amount) + full amount added to income
- **TFSA:** No penalty
- **Non-registered:** No penalty
- **Default withdrawal age:** Retirement age for all account types

## Withdrawal Logic

### New Module: penaltyCalculator.ts

```typescript
// src/utils/penaltyCalculator.ts

export function calculatePenalties(
  withdrawals: AccountWithdrawal[],
  currentAge: number,
  countryConfig: CountryConfig
): EarlyWithdrawalPenalty[] {
  const penalties: EarlyWithdrawalPenalty[] = [];

  for (const withdrawal of withdrawals) {
    const penaltyInfo = countryConfig.getPenaltyInfo(withdrawal.accountType);

    if (penaltyInfo.appliesToAccountType && currentAge < penaltyInfo.penaltyAge) {
      const penaltyAmount = countryConfig.calculateEarlyWithdrawalPenalty(
        withdrawal.amount,
        withdrawal.accountType,
        currentAge
      );

      if (penaltyAmount > 0) {
        penalties.push({
          amount: penaltyAmount,
          accountId: withdrawal.accountId,
          accountName: withdrawal.accountName
        });
      }
    }
  }

  return penalties;
}
```

### Modified Withdrawal Flow

1. **Filter available accounts:** Only consider accounts where `currentAge >= withdrawalRules.startAge`
2. **Attempt withdrawal from available accounts first**
3. **If insufficient funds:** Continue withdrawing from unavailable accounts (with penalties)
4. **Calculate penalties:** Use `penaltyCalculator` for all early withdrawals
5. **Track penalties:** Add to `RetirementYearResult` for display

```typescript
// src/utils/withdrawals.ts

function getAvailableAccounts(
  accounts: Account[],
  currentAge: number
): Account[] {
  return accounts.filter(account => {
    const withdrawalAge = account.withdrawalRules?.startAge
      ?? getDefaultWithdrawalAge(account);
    return currentAge >= withdrawalAge;
  });
}
```

## User Interface

### AccountForm Changes

**New Field:** "Start Withdrawal Age"

**Location:** After contribution fields, in new "Withdrawal Settings" subsection

**Features:**
- Number input with validation
- Tooltip explaining the field and RMD constraint
- Warning message if age is before penalty-free age
- Min value: Current age
- Max value: RMD age (if applicable) or life expectancy

**Example:**
```typescript
<label htmlFor="withdrawalStartAge">
  Start Withdrawal Age
  <Tooltip content="Age when you plan to start withdrawing from this account. Cannot be later than RMD age if applicable." />
</label>
<NumberInput
  id="withdrawalStartAge"
  value={account.withdrawalRules?.startAge ?? getDefaultWithdrawalAge(account)}
  onChange={(val) => setAccount({
    ...account,
    withdrawalRules: { startAge: val }
  })}
  min={profile.currentAge}
  max={getRmdAge(account.type, countryConfig)}
/>
```

### Validation

- **Enforce:** Withdrawal age <= RMD age for applicable accounts
- **Warn:** Withdrawal age < penalty-free age (but allow it)
- **Block:** Withdrawal age < current age

## Visualization

### Data Tables (Detailed View)

**DataTableWithdrawal.tsx:**
- Add "Early Withdrawal Penalties" row showing `totalPenalties`
- Add expandable detail rows showing per-account penalties
- Color penalties in red to distinguish from regular taxes

### Charts (Summary View)

**ChartIncome.tsx & ChartTax.tsx:**
- Roll penalties into "Taxes" line for clean visualization
- Show breakdown in tooltips: "Total Taxes: $X (includes $Y early withdrawal penalties)"

**SummaryCards.tsx:**
- Add "Total Early Withdrawal Penalties" card if any penalties exist in plan
- Show lifetime total and average per year

### Color Coding

- **Tables:** Red text for penalty amounts
- **Charts:** Part of tax color (orange/red)

## Default Values

### Smart Defaults Function

```typescript
// src/utils/withdrawalDefaults.ts

export function getDefaultWithdrawalAge(
  account: Account,
  retirementAge: number,
  countryConfig: CountryConfig
): number {
  const penaltyInfo = countryConfig.getPenaltyInfo(account.type);
  const rmdAge = countryConfig.getRmdAge?.(account.type);

  // For accounts with penalties, default to penalty-free age
  if (penaltyInfo.appliesToAccountType) {
    const penaltyFreeAge = Math.ceil(penaltyInfo.penaltyAge);  // 59.5 -> 60
    return rmdAge ? Math.min(penaltyFreeAge, rmdAge) : penaltyFreeAge;
  }

  // For no-penalty accounts, default to retirement age
  return rmdAge ? Math.min(retirementAge, rmdAge) : retirementAge;
}
```

### Default Values by Account Type

**United States:**
- Traditional 401(k)/IRA: 60 (rounds up 59.5 to avoid confusion)
- Roth 401(k)/IRA: Retirement age
- Taxable: Retirement age
- HSA: Retirement age

**Canada:**
- RRSP/RRIF: Retirement age (but capped at 71 for RMD)
- TFSA: Retirement age
- Non-registered: Retirement age
- FHSA/LIRA/LIF: Retirement age

## Data Migration

### Backwards Compatibility Strategy

Existing accounts in localStorage won't have `withdrawalRules`. Handle gracefully:

```typescript
// When loading accounts, apply defaults on the fly
const normalizedAccount = {
  ...savedAccount,
  withdrawalRules: savedAccount.withdrawalRules ?? {
    startAge: getDefaultWithdrawalAge(
      savedAccount,
      profile.retirementAge,
      countryConfig
    )
  }
};
```

**No explicit migration needed** - defaults applied on load, saved on next user save.

## Testing Strategy

### Unit Tests

- Penalty calculation for US accounts (10% before 59.5)
- Penalty calculation for Canadian accounts (withholding rates)
- Account availability filtering by age
- Smart defaults for each account type
- Validation rules (min/max ages)

### Integration Tests

- Full withdrawal simulation with unavailable accounts
- Penalties properly tracked in `RetirementYearResult`
- Backwards compatibility with accounts lacking `withdrawalRules`

### Edge Cases

- Retire at 52, all accounts unavailable until 60
- Mixed available/unavailable accounts
- Account becomes available mid-retirement
- RMD forcing withdrawal despite higher configured age
- Zero balance in available accounts

## Implementation Phases

### Phase 1: Core Logic
1. Add types to `src/types/index.ts`
2. Create `src/utils/penaltyCalculator.ts`
3. Create `src/utils/withdrawalDefaults.ts`
4. Extend country configs with penalty info
5. Modify withdrawal logic in `src/utils/withdrawals.ts`

### Phase 2: UI
1. Update `AccountForm.tsx` with new field
2. Add validation logic
3. Apply smart defaults on account creation

### Phase 3: Visualization
1. Update `DataTableWithdrawal.tsx` with penalty rows
2. Modify `ChartIncome.tsx` and `ChartTax.tsx` tooltips
3. Add penalty summary card to `SummaryCards.tsx`

### Phase 4: Testing
1. Write unit tests for penalty calculations
2. Write integration tests for withdrawal flow
3. Test backwards compatibility
4. Manual testing of edge cases

## Success Criteria

- Users can configure withdrawal start age per account
- Smart defaults prevent accidental early withdrawal penalties
- System correctly calculates 10% penalty (US) for early withdrawals
- Penalties displayed separately in tables, rolled up in charts
- Validation prevents invalid configurations (age > RMD age)
- Backwards compatible with existing saved data
- All tests pass for both US and Canada

## Future Enhancements (Out of Scope)

- Withdrawal priority/order configuration
- Maximum withdrawal per year limits
- "Bridge account" flagging
- SEPP/72(t) substantially equal periodic payments exception
- Roth conversion ladder modeling

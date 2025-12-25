export type AccountType =
  | 'traditional_401k'
  | 'roth_401k'
  | 'traditional_ira'
  | 'roth_ira'
  | 'taxable'
  | 'hsa';

export type FilingStatus = 'single' | 'married_filing_jointly';

export type TaxTreatment = 'pretax' | 'roth' | 'taxable' | 'hsa';

export interface Account {
  id: string;
  name: string;
  type: AccountType;
  balance: number;
  annualContribution: number;
  contributionGrowthRate: number; // as decimal, e.g., 0.03
  returnRate: number; // as decimal
  employerMatchPercent?: number; // 401k only, as decimal
  employerMatchLimit?: number; // 401k only, dollar amount
}

export interface Profile {
  currentAge: number;
  retirementAge: number;
  lifeExpectancy: number;
  filingStatus: FilingStatus;
  stateTaxRate: number; // as decimal
  socialSecurityBenefit?: number; // annual, in today's dollars
  socialSecurityStartAge?: number;
}

export interface Assumptions {
  inflationRate: number; // as decimal
  safeWithdrawalRate: number; // as decimal
  retirementReturnRate: number; // as decimal
}

export interface YearlyAccountBalance {
  age: number;
  year: number;
  balances: Record<string, number>; // accountId -> balance
  totalBalance: number;
  contributions: Record<string, number>; // accountId -> contribution that year
}

export interface AccumulationResult {
  yearlyBalances: YearlyAccountBalance[];
  finalBalances: Record<string, number>;
  totalAtRetirement: number;
  breakdownByTaxTreatment: {
    pretax: number;
    roth: number;
    taxable: number;
    hsa: number;
  };
}

export interface YearlyWithdrawal {
  age: number;
  year: number;
  withdrawals: Record<string, number>; // accountId -> withdrawal
  remainingBalances: Record<string, number>; // accountId -> remaining balance
  totalWithdrawal: number;
  socialSecurityIncome: number;
  grossIncome: number;
  federalTax: number;
  stateTax: number;
  totalTax: number;
  afterTaxIncome: number;
  targetSpending: number;
  rmdAmount: number;
  totalRemainingBalance: number;
}

export interface RetirementResult {
  yearlyWithdrawals: YearlyWithdrawal[];
  portfolioDepletionAge: number | null; // null if never depletes
  lifetimeTaxesPaid: number;
  sustainableMonthlyWithdrawal: number;
  sustainableAnnualWithdrawal: number;
  accountDepletionAges: Record<string, number | null>; // accountId -> age when depleted
}

export interface AppState {
  accounts: Account[];
  profile: Profile;
  assumptions: Assumptions;
}

// Tax bracket structure
export interface TaxBracket {
  min: number;
  max: number;
  rate: number;
}

// RMD table entry
export interface RMDEntry {
  age: number;
  divisor: number;
}

// Helper function type for getting tax treatment
export function getTaxTreatment(accountType: AccountType): TaxTreatment {
  switch (accountType) {
    case 'traditional_401k':
    case 'traditional_ira':
      return 'pretax';
    case 'roth_401k':
    case 'roth_ira':
      return 'roth';
    case 'taxable':
      return 'taxable';
    case 'hsa':
      return 'hsa';
  }
}

export function getAccountTypeLabel(type: AccountType): string {
  switch (type) {
    case 'traditional_401k':
      return 'Traditional 401(k)';
    case 'roth_401k':
      return 'Roth 401(k)';
    case 'traditional_ira':
      return 'Traditional IRA';
    case 'roth_ira':
      return 'Roth IRA';
    case 'taxable':
      return 'Taxable Brokerage';
    case 'hsa':
      return 'HSA';
  }
}

export function is401k(type: AccountType): boolean {
  return type === 'traditional_401k' || type === 'roth_401k';
}

export function isTraditional(type: AccountType): boolean {
  return type === 'traditional_401k' || type === 'traditional_ira';
}

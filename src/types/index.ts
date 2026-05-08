// Country code
export type CountryCode = 'US' | 'CA';

// US Account Types
export type USAccountType =
  | 'traditional_401k'
  | 'roth_401k'
  | 'traditional_ira'
  | 'roth_ira'
  | 'taxable'
  | 'hsa';

// Canadian Account Types
export type CAAccountType =
  | 'rrsp'
  | 'tfsa'
  | 'rrif'
  | 'lira'
  | 'lif'
  | 'fhsa'
  | 'non_registered'
  | 'employer_rrsp';

// Combined account type (union of all countries)
export type AccountType = USAccountType | CAAccountType;

export type FilingStatus = 'single' | 'married_filing_jointly';

export type TaxTreatment = 'pretax' | 'roth' | 'taxable' | 'hsa';

export type IncomeTaxTreatment = 'social_security' | 'fully_taxable' | 'other_income' | 'tax_free';

export interface IncomeStream {
  id: string;
  name: string;
  monthlyAmount: number;      // in today's dollars
  startAge: number;
  endAge?: number;            // optional: last age income is received
  taxTreatment: IncomeTaxTreatment;
}

export interface ConversionPlan {
  id: string;
  name: string;
  sourceAccountId: string;      // must reference a 'pretax' account
  destinationAccountId: string; // must reference a 'roth' account
  startAge: number;             // inclusive
  endAge: number;               // inclusive; required (unlike IncomeStream.endAge which is optional)
  yearlyAmount: number;         // today's dollars; inflated yearly
}

export interface ConversionYearRecord {
  age: number;
  year: number;
  amount: number;     // nominal converted dollars that year
  taxDelta: number;   // extra federal+state tax that year (always ≥ 0)
}

export interface AccountWithdrawalRules {
  startAge: number;  // Age when withdrawals can begin
}

export interface EarlyWithdrawalPenalty {
  amount: number;      // Penalty amount in dollars
  accountId: string;   // Which account triggered it
  accountName: string; // For display purposes
}

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
  withdrawalRules?: AccountWithdrawalRules;  // Optional for backwards compatibility
}

export interface Profile {
  country: CountryCode;
  currentAge: number;
  retirementAge: number;
  lifeExpectancy: number;
  region: string; // State code (US) or Province code (CA)
  filingStatus?: FilingStatus; // US only
  stateTaxRate?: number; // US only (as decimal), CA uses province
  annualIncome?: number; // Current ordinary income in today's dollars (US: conversion tax modeling; CA: RRSP contribution room)
  incomeGrowthRate?: number; // Annual growth rate for projected pre-retirement income (decimal, e.g. 0.03)
  socialSecurityBenefit?: number; // Canada CPP only; US uses income streams (annual)
  socialSecurityStartAge?: number; // Canada CPP start age; US uses income streams
  secondaryBenefitStartAge?: number; // OAS for CA
  secondaryBenefitAmount?: number; // OAS amount for CA
}

export interface SwrBucket {
  id: string;
  startAge: number;       // inclusive
  endAge: number;         // inclusive
  rate: number;           // decimal, e.g. 0.07 for 7%
}

export interface Assumptions {
  inflationRate: number; // as decimal
  safeWithdrawalRate: number; // as decimal
  retirementReturnRate: number; // as decimal
  swrBuckets?: SwrBucket[]; // optional; empty/undefined → use safeWithdrawalRate for all years
  bracketFillAdjustment?: number; // decimal in [-1.0, 1.0]; 0 = default; US-only
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
  breakdownByGroup: Record<string, number>; // Flexible groupings defined by country
  conversionsByYear: ConversionYearRecord[];
  lifetimeConversionTaxCost: number; // always ≥ 0; sum of pre-retirement taxDelta
}

export interface YearlyWithdrawal {
  age: number;
  year: number;
  withdrawals: Record<string, number>; // accountId -> withdrawal
  remainingBalances: Record<string, number>; // accountId -> remaining balance
  totalWithdrawal: number;
  governmentBenefitIncome: number;  // was socialSecurityIncome — Canada CPP/OAS only
  incomeStreamIncome: number;       // user-defined income streams (SS, pensions, etc.)
  grossIncome: number;
  federalTax: number;
  stateTax: number;
  totalTax: number;
  afterTaxIncome: number;
  targetSpending: number;
  rmdAmount: number;
  totalRemainingBalance: number;
  earlyWithdrawalPenalties: EarlyWithdrawalPenalty[];
  totalPenalties: number;
  conversionAmount: number;
}

export interface RetirementResult {
  yearlyWithdrawals: YearlyWithdrawal[];
  portfolioDepletionAge: number | null; // null if never depletes
  lifetimeTaxesPaid: number;
  sustainableMonthlyWithdrawal: number;
  sustainableAnnualWithdrawal: number;
  accountDepletionAges: Record<string, number | null>; // accountId -> age when depleted
  lifetimeTaxDeltaFromConversion: number;
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
    // US accounts
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
    // Canadian accounts
    case 'rrsp':
    case 'rrif':
    case 'lira':
    case 'lif':
    case 'fhsa':
    case 'employer_rrsp':
      return 'pretax';
    case 'tfsa':
      return 'roth';
    case 'non_registered':
      return 'taxable';
    default:
      return 'taxable';
  }
}

export function getAccountTypeLabel(type: AccountType): string {
  switch (type) {
    // US accounts
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
    // Canadian accounts
    case 'rrsp':
      return 'RRSP';
    case 'tfsa':
      return 'TFSA';
    case 'rrif':
      return 'RRIF';
    case 'lira':
      return 'LIRA';
    case 'lif':
      return 'LIF';
    case 'fhsa':
      return 'FHSA';
    case 'non_registered':
      return 'Non-Registered';
    case 'employer_rrsp':
      return 'Employer RRSP';
    default:
      return type;
  }
}

export function is401k(type: AccountType): boolean {
  return type === 'traditional_401k' || type === 'roth_401k';
}

export function isTraditional(type: string): boolean {
  return type === 'traditional_401k' || type === 'traditional_ira';
}

export function getIncomeTaxTreatmentLabel(treatment: IncomeTaxTreatment): string {
  switch (treatment) {
    case 'social_security':
      return 'Social Security';
    case 'fully_taxable':
      return 'Pension / Annuity';
    case 'other_income':
      return 'Other Income';
    case 'tax_free':
      return 'Tax-Free';
  }
}

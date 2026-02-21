import type { CountryConfig, AccountTypeConfig, Region, ConversionRule, ContributionLimits, AccountGroup, PenaltyInfo } from '../index';
import type { Profile } from '../../types';
import { calculateTotalFederalTax, calculateCapitalGainsTax as calcCapGainsTax } from './taxes';
import { calculateSocialSecurityBenefits } from './benefits';
import { calculateRMD } from './withdrawals';
import { US_STATES } from './constants';
import { CHART_COLORS } from '../../utils/constants';

const US_ACCOUNT_TYPES: AccountTypeConfig[] = [
  {
    type: 'traditional_401k',
    label: 'Traditional 401(k)',
    taxTreatment: 'pretax',
    description: 'Employer-sponsored retirement account with pre-tax contributions',
  },
  {
    type: 'roth_401k',
    label: 'Roth 401(k)',
    taxTreatment: 'roth',
    description: 'Employer-sponsored retirement account with after-tax contributions',
  },
  {
    type: 'traditional_ira',
    label: 'Traditional IRA',
    taxTreatment: 'pretax',
    description: 'Individual retirement account with pre-tax contributions',
  },
  {
    type: 'roth_ira',
    label: 'Roth IRA',
    taxTreatment: 'roth',
    description: 'Individual retirement account with after-tax contributions',
  },
  {
    type: 'taxable',
    label: 'Taxable Brokerage',
    taxTreatment: 'taxable',
    description: 'Standard investment account with capital gains treatment',
  },
  {
    type: 'hsa',
    label: 'HSA',
    taxTreatment: 'hsa',
    description: 'Health Savings Account (triple tax-advantaged)',
  },
];

// Withdrawal priority for USA tax optimization
const USA_WITHDRAWAL_ORDER = [
  'traditional_401k', // RMDs first
  'traditional_ira',
  'taxable', // Then taxable (favorable cap gains)
  'roth_401k', // Preserve Roth
  'roth_ira',
  'hsa', // Preserve HSA last
];

// Account groupings for display purposes
const USA_ACCOUNT_GROUPS: AccountGroup[] = [
  {
    id: 'traditional',
    label: 'Traditional Accounts',
    color: CHART_COLORS.pretax,
    accountTypes: ['traditional_401k', 'traditional_ira'],
    description: 'Pre-tax contributions, taxed on withdrawal',
  },
  {
    id: 'roth',
    label: 'Roth Accounts',
    color: CHART_COLORS.roth,
    accountTypes: ['roth_401k', 'roth_ira'],
    description: 'After-tax contributions, tax-free growth and withdrawals',
  },
  {
    id: 'taxable',
    label: 'Taxable Accounts',
    color: CHART_COLORS.taxable,
    accountTypes: ['taxable'],
    description: 'Taxed on dividends and capital gains',
  },
  {
    id: 'hsa',
    label: 'HSA',
    color: CHART_COLORS.hsa,
    accountTypes: ['hsa'],
    description: 'Triple tax-advantaged health savings',
  },
];

export const USConfig: CountryConfig = {
  code: 'US',
  name: 'United States',
  flag: '🇺🇸',
  currency: 'USD',
  accountTypes: US_ACCOUNT_TYPES,

  calculateFederalTax: (income: number, filingStatus?: string) => {
    return calculateTotalFederalTax(income, 0, filingStatus);
  },

  calculateRegionalTax: (_income: number, _regionCode: string) => {
    // Simplified: use the stateTaxRate from Profile
    // In reality, each state has different brackets
    // For now, this will be handled by passing stateTaxRate directly
    return 0; // Will be calculated separately using Profile.stateTaxRate
  },

  calculateCapitalGainsTax: (
    gains: number,
    ordinaryIncome: number,
    _regionCode: string,
    filingStatus?: string
  ) => {
    return calcCapGainsTax(gains, ordinaryIncome, filingStatus);
  },

  getRegions: (): Region[] => {
    return US_STATES;
  },

  calculateRetirementBenefits: (profile: Profile, currentAge: number, grossIncome: number) => {
    return calculateSocialSecurityBenefits(profile, currentAge, grossIncome);
  },

  getMinimumWithdrawal: (age: number, balance: number, accountType: string) => {
    return calculateRMD(age, balance, accountType);
  },

  getMandatoryConversions: (): ConversionRule[] => {
    // No mandatory conversions in USA (RMDs are withdrawals, not conversions)
    return [];
  },

  getDefaultProfile: () => ({
    currentAge: 35,
    retirementAge: 65,
    lifeExpectancy: 90,
    filingStatus: 'married_filing_jointly' as const,
    stateTaxRate: 0.05,
  }),

  getContributionLimits: (): ContributionLimits => ({
    traditional_401k: 23000, // 2024 limit
    roth_401k: 23000,
    traditional_ira: 7000,
    roth_ira: 7000,
    hsa: 4150, // Individual coverage
  }),

  getWithdrawalOrder: () => USA_WITHDRAWAL_ORDER,

  getAccountTypeLabel: (accountType: string): string => {
    const config = US_ACCOUNT_TYPES.find(a => a.type === accountType);
    return config?.label || accountType;
  },

  isTraditionalAccount: (accountType: string): boolean => {
    return accountType === 'traditional_401k' || accountType === 'traditional_ira';
  },

  supportsEmployerMatch: (accountType: string): boolean => {
    return accountType === 'traditional_401k' || accountType === 'roth_401k';
  },

  getAccountGroupings: (): AccountGroup[] => {
    return USA_ACCOUNT_GROUPS;
  },

  getPenaltyInfo: (accountType: string): PenaltyInfo => {
    const isTraditional = accountType === 'traditional_401k' || accountType === 'traditional_ira';
    return {
      penaltyAge: 59.5,
      penaltyRate: 0.10,
      appliesToAccountType: isTraditional,
    };
  },

  calculateEarlyWithdrawalPenalty: (
    amount: number,
    accountType: string,
    age: number
  ): number => {
    const penaltyInfo = USConfig.getPenaltyInfo(accountType);
    if (age >= penaltyInfo.penaltyAge || !penaltyInfo.appliesToAccountType) {
      return 0;
    }
    return amount * penaltyInfo.penaltyRate;
  },
};

import {
  Account,
  AccumulationResult,
  Assumptions,
  IncomeStream,
  Profile,
  RetirementResult,
  getAccountTypeLabel,
  getIncomeTaxTreatmentLabel,
} from '../../types';
import type { CountryCode } from '../../countries';
import { getEmployerMatch, supportsEmployerMatch } from '../projections';
import { inflationFactor } from './realDollars';
import type { ExportColumn, ExportMeta, ExportRow, ExportTable } from './types';

export type AccumulationTableId = 'summary' | 'balances' | 'contributions';
export type WithdrawalTableId =
  | 'income'
  | 'withdrawals'
  | 'balances'
  | 'taxes'
  | 'incomeStreams';

export function currencyForCountry(country: CountryCode): string {
  return country === 'CA' ? 'CAD' : 'USD';
}

export function buildExportMeta(
  profile: Profile,
  assumptions: Assumptions,
  country: CountryCode,
  now: Date = new Date()
): ExportMeta {
  return {
    generatedAt: now,
    country,
    currency: currencyForCountry(country),
    baseYear: now.getFullYear(),
    profile,
    assumptions,
  };
}

/** Column keys are derived from account/stream ids, which are UUIDs. */
function accountColumns(accounts: Account[], suffix = ''): ExportColumn[] {
  return accounts.map(account => ({
    key: account.id,
    label: `${account.name}${suffix}`,
    type: 'currency' as const,
  }));
}

const AGE_COLUMNS: ExportColumn[] = [
  { key: 'age', label: 'Age', type: 'number' },
  { key: 'year', label: 'Year', type: 'number' },
];

const FACTOR_COLUMN: ExportColumn = {
  key: 'inflationFactor',
  label: 'Inflation Factor',
  type: 'factor',
};

// ---------------------------------------------------------------------------
// Accumulation phase
// ---------------------------------------------------------------------------

export function buildAccumulationTable(
  tableId: AccumulationTableId,
  accounts: Account[],
  result: AccumulationResult,
  meta: ExportMeta
): ExportTable {
  const { inflationRate } = meta.assumptions;
  const currentAge = meta.profile.currentAge;
  const factorFor = (age: number) => inflationFactor(age - currentAge, inflationRate);

  if (tableId === 'summary') {
    const rows: ExportRow[] = result.yearlyBalances.map((yearData, index) => {
      const previousBalance =
        index > 0 ? result.yearlyBalances[index - 1].totalBalance : yearData.totalBalance;
      const contributions = Object.values(yearData.contributions).reduce(
        (sum, value) => sum + value,
        0
      );
      const match = accounts.reduce(
        (sum, account) =>
          sum + getEmployerMatch(account, yearData.contributions[account.id] || 0),
        0
      );
      const totalContributions = contributions + match;
      const factor = factorFor(yearData.age);

      return {
        age: yearData.age,
        year: yearData.year,
        totalBalance: yearData.totalBalance,
        totalBalanceReal: yearData.totalBalance / factor,
        growth: index === 0 ? null : yearData.totalBalance - previousBalance,
        totalContributions,
        totalContributionsReal: totalContributions / factor,
        inflationFactor: factor,
      };
    });

    return {
      id: 'accumulation-summary',
      title: 'Accumulation — Summary',
      columns: [
        ...AGE_COLUMNS,
        { key: 'totalBalance', label: 'Total Balance', type: 'currency' },
        { key: 'totalBalanceReal', label: 'Total Balance (Real)', type: 'currency' },
        { key: 'growth', label: 'Year Growth', type: 'currency' },
        { key: 'totalContributions', label: 'Total Contributions', type: 'currency' },
        {
          key: 'totalContributionsReal',
          label: 'Total Contributions (Real)',
          type: 'currency',
        },
        FACTOR_COLUMN,
      ],
      rows,
      meta,
    };
  }

  if (tableId === 'balances') {
    const rows: ExportRow[] = result.yearlyBalances.map(yearData => {
      const row: ExportRow = {
        age: yearData.age,
        year: yearData.year,
        total: yearData.totalBalance,
        inflationFactor: factorFor(yearData.age),
      };
      accounts.forEach(account => {
        row[account.id] = yearData.balances[account.id] || 0;
      });
      return row;
    });

    return {
      id: 'accumulation-balances',
      title: 'Accumulation — Balances by Account',
      columns: [
        ...AGE_COLUMNS,
        ...accountColumns(accounts),
        { key: 'total', label: 'Total', type: 'currency' },
        FACTOR_COLUMN,
      ],
      rows,
      meta,
    };
  }

  // Contributions: employer match gets its own column so the CSV stays numeric.
  const columns: ExportColumn[] = [
    ...AGE_COLUMNS,
    ...accounts.flatMap<ExportColumn>(account => {
      const own: ExportColumn = {
        key: account.id,
        label: account.name,
        type: 'currency',
      };
      return supportsEmployerMatch(account)
        ? [
            own,
            {
              key: `${account.id}:match`,
              label: `${account.name} (Employer Match)`,
              type: 'currency',
            },
          ]
        : [own];
    }),
    { key: 'total', label: 'Total', type: 'currency' },
    FACTOR_COLUMN,
  ];

  const rows: ExportRow[] = result.yearlyBalances.map(yearData => {
    const row: ExportRow = {
      age: yearData.age,
      year: yearData.year,
      inflationFactor: factorFor(yearData.age),
    };
    let total = 0;
    accounts.forEach(account => {
      const contribution = yearData.contributions[account.id] || 0;
      const match = getEmployerMatch(account, contribution);
      row[account.id] = contribution;
      if (supportsEmployerMatch(account)) {
        row[`${account.id}:match`] = match;
      }
      total += contribution + match;
    });
    row.total = total;
    return row;
  });

  const footer: ExportRow = { age: 'Lifetime Total', year: null, inflationFactor: null };
  let lifetimeTotal = 0;
  accounts.forEach(account => {
    const contributions = result.yearlyBalances.reduce(
      (sum, yearData) => sum + (yearData.contributions[account.id] || 0),
      0
    );
    const match = result.yearlyBalances.reduce(
      (sum, yearData) =>
        sum + getEmployerMatch(account, yearData.contributions[account.id] || 0),
      0
    );
    footer[account.id] = contributions;
    if (supportsEmployerMatch(account)) {
      footer[`${account.id}:match`] = match;
    }
    lifetimeTotal += contributions + match;
  });
  footer.total = lifetimeTotal;

  return {
    id: 'accumulation-contributions',
    title: 'Accumulation — Contributions',
    columns,
    rows,
    footer,
    meta,
  };
}

// ---------------------------------------------------------------------------
// Retirement phase
// ---------------------------------------------------------------------------

/**
 * Allocate a year's total income-stream income back to individual streams,
 * pro-rata by monthly amount. Mirrors the on-screen table: the engine returns
 * only a combined figure per year.
 */
function streamShare(
  stream: IncomeStream,
  age: number,
  totalStreamIncome: number,
  incomeStreams: IncomeStream[]
): number | null {
  const isActive = age >= stream.startAge && (!stream.endAge || age <= stream.endAge);
  if (!isActive) return null;

  const activeMonthly = incomeStreams
    .filter(other => age >= other.startAge && (!other.endAge || age <= other.endAge))
    .reduce((sum, other) => sum + other.monthlyAmount, 0);

  if (activeMonthly === 0) return null;
  return totalStreamIncome * (stream.monthlyAmount / activeMonthly);
}

export function buildWithdrawalTable(
  tableId: WithdrawalTableId,
  accounts: Account[],
  result: RetirementResult,
  incomeStreams: IncomeStream[],
  meta: ExportMeta
): ExportTable {
  const { inflationRate } = meta.assumptions;
  const currentAge = meta.profile.currentAge;
  const factorFor = (age: number) => inflationFactor(age - currentAge, inflationRate);
  const regionalTaxLabel = meta.country === 'CA' ? 'Provincial Tax' : 'State Tax';
  const years = result.yearlyWithdrawals;

  if (tableId === 'income') {
    const rows: ExportRow[] = years.map(yearData => {
      const factor = factorFor(yearData.age);
      return {
        age: yearData.age,
        year: yearData.year,
        targetSpending: yearData.targetSpending,
        targetSpendingReal: yearData.targetSpending / factor,
        totalWithdrawal: yearData.totalWithdrawal,
        retirementIncome: yearData.governmentBenefitIncome + yearData.incomeStreamIncome,
        grossIncome: yearData.grossIncome,
        totalTax: yearData.totalTax,
        afterTaxIncome: yearData.afterTaxIncome,
        afterTaxIncomeReal: yearData.afterTaxIncome / factor,
        shortfall: yearData.spendingShortfall,
        inflationFactor: factor,
      };
    });

    const footer: ExportRow = {
      age: 'Lifetime Total',
      year: null,
      targetSpending: null,
      targetSpendingReal: null,
      totalWithdrawal: years.reduce((sum, y) => sum + y.totalWithdrawal, 0),
      retirementIncome: years.reduce(
        (sum, y) => sum + y.governmentBenefitIncome + y.incomeStreamIncome,
        0
      ),
      grossIncome: years.reduce((sum, y) => sum + y.grossIncome, 0),
      totalTax: result.lifetimeTaxesPaid,
      afterTaxIncome: years.reduce((sum, y) => sum + y.afterTaxIncome, 0),
      afterTaxIncomeReal: years.reduce(
        (sum, y) => sum + y.afterTaxIncome / factorFor(y.age),
        0
      ),
      shortfall: years.reduce((sum, y) => sum + y.spendingShortfall, 0),
      inflationFactor: null,
    };

    return {
      id: 'retirement-income',
      title: 'Retirement — Income & Spending',
      columns: [
        ...AGE_COLUMNS,
        { key: 'targetSpending', label: 'Target Spending', type: 'currency' },
        { key: 'targetSpendingReal', label: 'Target Spending (Real)', type: 'currency' },
        { key: 'totalWithdrawal', label: 'Withdrawals', type: 'currency' },
        { key: 'retirementIncome', label: 'Retirement Income', type: 'currency' },
        { key: 'grossIncome', label: 'Gross Income', type: 'currency' },
        { key: 'totalTax', label: 'Total Taxes', type: 'currency' },
        { key: 'afterTaxIncome', label: 'After-Tax Income', type: 'currency' },
        { key: 'afterTaxIncomeReal', label: 'After-Tax Income (Real)', type: 'currency' },
        { key: 'shortfall', label: 'Spending Shortfall', type: 'currency' },
        FACTOR_COLUMN,
      ],
      rows,
      footer,
      meta,
    };
  }

  if (tableId === 'withdrawals') {
    const rows: ExportRow[] = years.map(yearData => {
      const row: ExportRow = {
        age: yearData.age,
        year: yearData.year,
        rmd: yearData.rmdAmount,
        total: yearData.totalWithdrawal,
        penalties: yearData.totalPenalties,
        inflationFactor: factorFor(yearData.age),
      };
      accounts.forEach(account => {
        row[account.id] = yearData.withdrawals[account.id] || 0;
      });
      return row;
    });

    return {
      id: 'retirement-withdrawals',
      title: 'Retirement — Withdrawals by Account',
      columns: [
        ...AGE_COLUMNS,
        { key: 'rmd', label: 'RMD', type: 'currency' },
        ...accountColumns(accounts),
        { key: 'total', label: 'Total', type: 'currency' },
        { key: 'penalties', label: 'Early Withdrawal Penalties', type: 'currency' },
        FACTOR_COLUMN,
      ],
      rows,
      meta,
    };
  }

  if (tableId === 'balances') {
    const rows: ExportRow[] = years.map(yearData => {
      const factor = factorFor(yearData.age);
      const row: ExportRow = {
        age: yearData.age,
        year: yearData.year,
        total: yearData.totalRemainingBalance,
        totalReal: yearData.totalRemainingBalance / factor,
        inflationFactor: factor,
      };
      accounts.forEach(account => {
        row[account.id] = yearData.remainingBalances[account.id] || 0;
      });
      return row;
    });

    return {
      id: 'retirement-balances',
      title: 'Retirement — Remaining Balances',
      columns: [
        ...AGE_COLUMNS,
        ...accountColumns(accounts),
        { key: 'total', label: 'Total', type: 'currency' },
        { key: 'totalReal', label: 'Total (Real)', type: 'currency' },
        FACTOR_COLUMN,
      ],
      rows,
      meta,
    };
  }

  if (tableId === 'taxes') {
    const rows: ExportRow[] = years.map(yearData => {
      const factor = factorFor(yearData.age);
      return {
        age: yearData.age,
        year: yearData.year,
        grossIncome: yearData.grossIncome,
        federalTax: yearData.federalTax,
        stateTax: yearData.stateTax,
        penalties: yearData.totalPenalties,
        totalTax: yearData.totalTax,
        totalTaxReal: yearData.totalTax / factor,
        effectiveRate:
          yearData.grossIncome > 0 ? yearData.totalTax / yearData.grossIncome : 0,
        inflationFactor: factor,
      };
    });

    const lifetimeGross = years.reduce((sum, y) => sum + y.grossIncome, 0);
    const footer: ExportRow = {
      age: 'Lifetime Total',
      year: null,
      grossIncome: lifetimeGross,
      federalTax: years.reduce((sum, y) => sum + y.federalTax, 0),
      stateTax: years.reduce((sum, y) => sum + y.stateTax, 0),
      penalties: years.reduce((sum, y) => sum + y.totalPenalties, 0),
      totalTax: result.lifetimeTaxesPaid,
      totalTaxReal: years.reduce((sum, y) => sum + y.totalTax / factorFor(y.age), 0),
      effectiveRate: lifetimeGross > 0 ? result.lifetimeTaxesPaid / lifetimeGross : 0,
      inflationFactor: null,
    };

    return {
      id: 'retirement-taxes',
      title: 'Retirement — Tax Details',
      columns: [
        ...AGE_COLUMNS,
        { key: 'grossIncome', label: 'Gross Income', type: 'currency' },
        { key: 'federalTax', label: 'Federal Tax', type: 'currency' },
        { key: 'stateTax', label: regionalTaxLabel, type: 'currency' },
        { key: 'penalties', label: 'Penalties', type: 'currency' },
        { key: 'totalTax', label: 'Total Tax', type: 'currency' },
        { key: 'totalTaxReal', label: 'Total Tax (Real)', type: 'currency' },
        { key: 'effectiveRate', label: 'Effective Rate', type: 'percent' },
        FACTOR_COLUMN,
      ],
      rows,
      footer,
      meta,
    };
  }

  // Income streams
  const hasGovernmentBenefits = years.some(y => y.governmentBenefitIncome > 0);

  const columns: ExportColumn[] = [
    ...AGE_COLUMNS,
    ...incomeStreams.map<ExportColumn>(stream => ({
      key: stream.id,
      label: stream.name,
      type: 'currency',
    })),
    ...(hasGovernmentBenefits
      ? [
          {
            key: 'governmentBenefits',
            label: 'Government Benefits',
            type: 'currency' as const,
          },
        ]
      : []),
    { key: 'total', label: 'Total', type: 'currency' },
    FACTOR_COLUMN,
  ];

  const rows: ExportRow[] = years.map(yearData => {
    const row: ExportRow = {
      age: yearData.age,
      year: yearData.year,
      total: yearData.governmentBenefitIncome + yearData.incomeStreamIncome,
      inflationFactor: factorFor(yearData.age),
    };
    incomeStreams.forEach(stream => {
      row[stream.id] = streamShare(
        stream,
        yearData.age,
        yearData.incomeStreamIncome,
        incomeStreams
      );
    });
    if (hasGovernmentBenefits) {
      row.governmentBenefits = yearData.governmentBenefitIncome;
    }
    return row;
  });

  const footer: ExportRow = { age: 'Lifetime Total', year: null, inflationFactor: null };
  incomeStreams.forEach(stream => {
    footer[stream.id] = years.reduce(
      (sum, yearData) =>
        sum +
        (streamShare(stream, yearData.age, yearData.incomeStreamIncome, incomeStreams) ?? 0),
      0
    );
  });
  if (hasGovernmentBenefits) {
    footer.governmentBenefits = years.reduce(
      (sum, y) => sum + y.governmentBenefitIncome,
      0
    );
  }
  footer.total = years.reduce(
    (sum, y) => sum + y.governmentBenefitIncome + y.incomeStreamIncome,
    0
  );

  return {
    id: 'retirement-income-streams',
    title: 'Retirement — Income Streams',
    columns,
    rows,
    footer,
    meta,
  };
}

// ---------------------------------------------------------------------------
// Plan inputs (print report only)
// ---------------------------------------------------------------------------

export function buildAccountsTable(accounts: Account[], meta: ExportMeta): ExportTable {
  const rows: ExportRow[] = accounts.map(account => ({
    name: account.name,
    type: getAccountTypeLabel(account.type),
    balance: account.balance,
    annualContribution: account.annualContribution,
    contributionGrowthRate: account.contributionGrowthRate,
    returnRate: account.returnRate,
    employerMatch: supportsEmployerMatch(account)
      ? getEmployerMatch(account, account.annualContribution)
      : null,
    withdrawalStartAge: account.withdrawalRules?.startAge ?? null,
  }));

  return {
    id: 'accounts',
    title: 'Investment Accounts',
    columns: [
      { key: 'name', label: 'Account', type: 'text' },
      { key: 'type', label: 'Type', type: 'text' },
      { key: 'balance', label: 'Current Balance', type: 'currency' },
      { key: 'annualContribution', label: 'Annual Contribution', type: 'currency' },
      { key: 'employerMatch', label: 'Employer Match', type: 'currency' },
      { key: 'contributionGrowthRate', label: 'Contribution Growth', type: 'percent' },
      { key: 'returnRate', label: 'Return Rate', type: 'percent' },
      { key: 'withdrawalStartAge', label: 'Withdrawals From Age', type: 'number' },
    ],
    rows,
    meta,
  };
}

export function buildIncomeStreamsTable(
  incomeStreams: IncomeStream[],
  meta: ExportMeta
): ExportTable {
  const rows: ExportRow[] = incomeStreams.map(stream => ({
    name: stream.name,
    monthlyAmount: stream.monthlyAmount,
    annualAmount: stream.monthlyAmount * 12,
    startAge: stream.startAge,
    endAge: stream.endAge ?? null,
    taxTreatment: getIncomeTaxTreatmentLabel(stream.taxTreatment),
  }));

  return {
    id: 'income-streams',
    title: 'Income Streams (in today’s dollars)',
    columns: [
      { key: 'name', label: 'Stream', type: 'text' },
      { key: 'monthlyAmount', label: 'Monthly', type: 'currency' },
      { key: 'annualAmount', label: 'Annual', type: 'currency' },
      { key: 'startAge', label: 'Start Age', type: 'number' },
      { key: 'endAge', label: 'End Age', type: 'number' },
      { key: 'taxTreatment', label: 'Tax Treatment', type: 'text' },
    ],
    rows,
    meta,
  };
}

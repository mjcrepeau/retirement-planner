import { useState } from 'react';
import { Account, AccumulationResult, getTaxTreatment } from '../types';
import { is401k } from '../types';

interface DataTableAccumulationProps {
  accounts: Account[];
  result: AccumulationResult;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value);
}

type ViewMode = 'summary' | 'balances' | 'contributions';

export function DataTableAccumulation({ accounts, result }: DataTableAccumulationProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('summary');

  if (!result.yearlyBalances.length) return null;

  // Calculate employer match for each account/year
  const getEmployerMatch = (account: Account, contribution: number): number => {
    if (!is401k(account.type) || !account.employerMatchPercent || !account.employerMatchLimit) {
      return 0;
    }
    const matchAmount = contribution * account.employerMatchPercent;
    return Math.min(matchAmount, account.employerMatchLimit);
  };

  // Get color class based on tax treatment
  const getColorClass = (accountType: Account['type']): string => {
    const treatment = getTaxTreatment(accountType);
    switch (treatment) {
      case 'pretax': return 'text-blue-600 dark:text-blue-400';
      case 'roth': return 'text-green-600 dark:text-green-400';
      case 'taxable': return 'text-amber-600 dark:text-amber-400';
      case 'hsa': return 'text-purple-600 dark:text-purple-400';
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-4 py-3 flex justify-between items-center hover:bg-gray-50 dark:hover:bg-gray-700 rounded-t-lg"
      >
        <div className="flex items-center gap-2">
          <svg
            className="w-5 h-5 text-gray-500 dark:text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
          <span className="font-medium text-gray-900 dark:text-white">Year-by-Year Data</span>
        </div>
        <svg
          className={`w-5 h-5 text-gray-500 dark:text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isExpanded && (
        <div className="px-4 pb-4">
          {/* View Mode Tabs */}
          <div className="flex gap-2 mb-4 border-b border-gray-200 dark:border-gray-700">
            <button
              onClick={() => setViewMode('summary')}
              className={`px-3 py-2 text-sm font-medium border-b-2 -mb-px ${
                viewMode === 'summary'
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              Summary
            </button>
            <button
              onClick={() => setViewMode('balances')}
              className={`px-3 py-2 text-sm font-medium border-b-2 -mb-px ${
                viewMode === 'balances'
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              Balances by Account
            </button>
            <button
              onClick={() => setViewMode('contributions')}
              className={`px-3 py-2 text-sm font-medium border-b-2 -mb-px ${
                viewMode === 'contributions'
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              Contributions
            </button>
          </div>

          <div className="overflow-x-auto">
            {viewMode === 'summary' && (
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700">
                    <th className="text-left py-2 px-2 font-medium text-gray-700 dark:text-gray-300 sticky left-0 bg-white dark:bg-gray-800">Age</th>
                    <th className="text-left py-2 px-2 font-medium text-gray-700 dark:text-gray-300">Year</th>
                    <th className="text-right py-2 px-2 font-medium text-gray-700 dark:text-gray-300">Total Balance</th>
                    <th className="text-right py-2 px-2 font-medium text-gray-700 dark:text-gray-300">Year Growth</th>
                    <th className="text-right py-2 px-2 font-medium text-gray-700 dark:text-gray-300">Total Contributions</th>
                    <th className="text-right py-2 px-2 font-medium text-red-600 dark:text-red-400">Conversion Tax</th>
                  </tr>
                </thead>
                <tbody>
                  {result.yearlyBalances.map((yearData, index) => {
                    const prevBalance = index > 0 ? result.yearlyBalances[index - 1].totalBalance : yearData.totalBalance;
                    const totalContrib = Object.values(yearData.contributions).reduce((sum, c) => sum + c, 0);
                    const totalMatch = accounts.reduce((sum, acc) => {
                      return sum + getEmployerMatch(acc, yearData.contributions[acc.id] || 0);
                    }, 0);
                    const growth = yearData.totalBalance - prevBalance;
                    const conversionTax = result.conversionsByYear.find(c => c.age === yearData.age)?.taxDelta ?? 0;

                    return (
                      <tr key={yearData.age} className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700/50">
                        <td className="py-2 px-2 font-medium text-gray-900 dark:text-white sticky left-0 bg-white dark:bg-gray-800">{yearData.age}</td>
                        <td className="py-2 px-2 text-gray-600 dark:text-gray-400">{yearData.year}</td>
                        <td className="py-2 px-2 text-right font-mono text-gray-900 dark:text-white">{formatCurrency(yearData.totalBalance)}</td>
                        <td className={`py-2 px-2 text-right font-mono ${growth >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                          {index === 0 ? '-' : (growth >= 0 ? '+' : '') + formatCurrency(growth)}
                        </td>
                        <td className="py-2 px-2 text-right font-mono text-gray-600 dark:text-gray-400">
                          {formatCurrency(totalContrib + totalMatch)}
                        </td>
                        <td className="py-2 px-2 text-right font-mono text-red-600 dark:text-red-400">
                          {conversionTax > 0 ? formatCurrency(conversionTax) : '-'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}

            {viewMode === 'balances' && (
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700">
                    <th className="text-left py-2 px-2 font-medium text-gray-700 dark:text-gray-300 sticky left-0 bg-white dark:bg-gray-800">Age</th>
                    {accounts.map(acc => (
                      <th key={acc.id} className={`text-right py-2 px-2 font-medium ${getColorClass(acc.type)}`}>
                        {acc.name}
                      </th>
                    ))}
                    <th className="text-right py-2 px-2 font-medium text-gray-700 dark:text-gray-300">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {result.yearlyBalances.map((yearData) => (
                    <tr key={yearData.age} className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700/50">
                      <td className="py-2 px-2 font-medium text-gray-900 dark:text-white sticky left-0 bg-white dark:bg-gray-800">{yearData.age}</td>
                      {accounts.map(acc => (
                        <td key={acc.id} className="py-2 px-2 text-right font-mono text-gray-600 dark:text-gray-400">
                          {formatCurrency(yearData.balances[acc.id] || 0)}
                        </td>
                      ))}
                      <td className="py-2 px-2 text-right font-mono font-medium text-gray-900 dark:text-white">
                        {formatCurrency(yearData.totalBalance)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {viewMode === 'contributions' && (
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700">
                    <th className="text-left py-2 px-2 font-medium text-gray-700 dark:text-gray-300 sticky left-0 bg-white dark:bg-gray-800">Age</th>
                    {accounts.map(acc => (
                      <th key={acc.id} className={`text-right py-2 px-2 font-medium ${getColorClass(acc.type)}`}>
                        {acc.name}
                        {is401k(acc.type) && acc.employerMatchPercent ? ' (+Match)' : ''}
                      </th>
                    ))}
                    <th className="text-right py-2 px-2 font-medium text-gray-700 dark:text-gray-300">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {result.yearlyBalances.map((yearData) => {
                    let totalContrib = 0;
                    return (
                      <tr key={yearData.age} className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700/50">
                        <td className="py-2 px-2 font-medium text-gray-900 dark:text-white sticky left-0 bg-white dark:bg-gray-800">{yearData.age}</td>
                        {accounts.map(acc => {
                          const contrib = yearData.contributions[acc.id] || 0;
                          const match = getEmployerMatch(acc, contrib);
                          totalContrib += contrib + match;
                          return (
                            <td key={acc.id} className="py-2 px-2 text-right font-mono text-gray-600 dark:text-gray-400">
                              {formatCurrency(contrib)}
                              {match > 0 && (
                                <span className="text-green-600 dark:text-green-400 text-xs ml-1">
                                  +{formatCurrency(match)}
                                </span>
                              )}
                            </td>
                          );
                        })}
                        <td className="py-2 px-2 text-right font-mono font-medium text-gray-900 dark:text-white">
                          {formatCurrency(totalContrib)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-900">
                    <td className="py-2 px-2 font-medium text-gray-700 dark:text-gray-300 sticky left-0 bg-gray-50 dark:bg-gray-900">Lifetime Total</td>
                    {accounts.map(acc => {
                      const lifetimeContrib = result.yearlyBalances.reduce((sum, year) => {
                        const contrib = year.contributions[acc.id] || 0;
                        const match = getEmployerMatch(acc, contrib);
                        return sum + contrib + match;
                      }, 0);
                      return (
                        <td key={acc.id} className="py-2 px-2 text-right font-mono font-medium text-gray-700 dark:text-gray-300">
                          {formatCurrency(lifetimeContrib)}
                        </td>
                      );
                    })}
                    <td className="py-2 px-2 text-right font-mono font-bold text-gray-900 dark:text-white">
                      {formatCurrency(
                        result.yearlyBalances.reduce((sum, year) => {
                          return sum + accounts.reduce((accSum, acc) => {
                            const contrib = year.contributions[acc.id] || 0;
                            const match = getEmployerMatch(acc, contrib);
                            return accSum + contrib + match;
                          }, 0);
                        }, 0)
                      )}
                    </td>
                  </tr>
                </tfoot>
              </table>
            )}
          </div>

          {/* Legend */}
          <div className="mt-4 flex flex-wrap gap-4 text-xs">
            <div className="flex items-center gap-1">
              <span className="w-3 h-3 rounded bg-blue-500"></span>
              <span className="text-gray-600 dark:text-gray-400">Pre-tax</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="w-3 h-3 rounded bg-green-500"></span>
              <span className="text-gray-600 dark:text-gray-400">Roth</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="w-3 h-3 rounded bg-amber-500"></span>
              <span className="text-gray-600 dark:text-gray-400">Taxable</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="w-3 h-3 rounded bg-purple-500"></span>
              <span className="text-gray-600 dark:text-gray-400">HSA</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

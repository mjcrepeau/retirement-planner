import { useState } from 'react';
import { AccumulationResult, RetirementResult, Profile, Assumptions } from '../types';
import { STANDARD_DEDUCTION_MFJ, STANDARD_DEDUCTION_SINGLE } from '../utils/constants';
import { useCountry } from '../contexts/CountryContext';

interface SummaryCardsProps {
  profile: Profile;
  assumptions: Assumptions;
  accumulationResult: AccumulationResult;
  retirementResult: RetirementResult;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value);
}

function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

interface ExpandableStatCardProps {
  title: string;
  value: string;
  subtitle?: string;
  color?: 'blue' | 'green' | 'amber' | 'red' | 'purple' | 'teal';
  formula?: React.ReactNode;
  details?: React.ReactNode;
}

function ExpandableStatCard({
  title,
  value,
  subtitle,
  color = 'blue',
  formula,
  details
}: ExpandableStatCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const hasDetails = formula || details;

  const colorClasses = {
    blue: 'bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-800',
    green: 'bg-green-50 dark:bg-green-900/30 border-green-200 dark:border-green-800',
    amber: 'bg-amber-50 dark:bg-amber-900/30 border-amber-200 dark:border-amber-800',
    red: 'bg-red-50 dark:bg-red-900/30 border-red-200 dark:border-red-800',
    purple: 'bg-purple-50 dark:bg-purple-900/30 border-purple-200 dark:border-purple-800',
    teal: 'bg-teal-50 dark:bg-teal-900/30 border-teal-200 dark:border-teal-800',
  };

  const valueColors = {
    blue: 'text-blue-700 dark:text-blue-300',
    green: 'text-green-700 dark:text-green-300',
    amber: 'text-amber-700 dark:text-amber-300',
    red: 'text-red-700 dark:text-red-300',
    purple: 'text-purple-700 dark:text-purple-300',
    teal: 'text-teal-700 dark:text-teal-300',
  };

  const expandedBg = {
    blue: 'bg-blue-100/50 dark:bg-blue-900/50',
    green: 'bg-green-100/50 dark:bg-green-900/50',
    amber: 'bg-amber-100/50 dark:bg-amber-900/50',
    red: 'bg-red-100/50 dark:bg-red-900/50',
    purple: 'bg-purple-100/50 dark:bg-purple-900/50',
    teal: 'bg-teal-100/50 dark:bg-teal-900/50',
  };

  return (
    <div className={`rounded-lg border ${colorClasses[color]} overflow-hidden`}>
      <div
        className={`p-4 ${hasDetails ? 'cursor-pointer hover:opacity-90' : ''}`}
        onClick={() => hasDetails && setIsExpanded(!isExpanded)}
      >
        <div className="flex justify-between items-start">
          <p className="text-sm font-medium text-gray-600 dark:text-gray-400">{title}</p>
          {hasDetails && (
            <button
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 p-0.5 -mr-1 -mt-1"
              aria-label={isExpanded ? 'Hide calculation details' : 'Show calculation details'}
            >
              <svg
                className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          )}
        </div>
        <p className={`text-2xl font-bold ${valueColors[color]}`}>{value}</p>
        {subtitle && <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{subtitle}</p>}
      </div>

      {isExpanded && hasDetails && (
        <div className={`px-4 pb-4 pt-2 border-t border-gray-200/50 dark:border-gray-700/50 ${expandedBg[color]}`}>
          {formula && (
            <div className="mb-2">
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Formula:</p>
              <code className="text-xs bg-white/60 dark:bg-gray-800/60 px-2 py-1 rounded block text-gray-700 dark:text-gray-300">
                {formula}
              </code>
            </div>
          )}
          {details && (
            <div className="text-xs text-gray-600 dark:text-gray-400 space-y-1">
              {details}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function SummaryCards({
  profile,
  assumptions,
  accumulationResult,
  retirementResult,
}: SummaryCardsProps) {
  const { country, config: countryConfig } = useCountry();
  const { totalAtRetirement, breakdownByGroup } = accumulationResult;
  const accountGroupings = countryConfig.getAccountGroupings();
  const {
    sustainableMonthlyWithdrawal,
    sustainableAnnualWithdrawal,
    portfolioDepletionAge,
    lifetimeTaxesPaid,
    yearlyWithdrawals,
  } = retirementResult;

  // Validate age configuration
  const hasInvalidAges = profile.lifeExpectancy <= profile.retirementAge ||
    profile.retirementAge <= profile.currentAge;

  const yearsUntilDepletion = portfolioDepletionAge
    ? Math.max(0, portfolioDepletionAge - profile.retirementAge)
    : Math.max(0, profile.lifeExpectancy - profile.retirementAge);

  const portfolioLasts = portfolioDepletionAge
    ? `${yearsUntilDepletion} years (depletes at age ${portfolioDepletionAge})`
    : `${yearsUntilDepletion}+ years (never depletes)`;

  const portfolioStatus = portfolioDepletionAge
    ? portfolioDepletionAge < profile.lifeExpectancy
      ? 'red'
      : 'green'
    : 'green';

  const standardDeduction = profile.filingStatus === 'married_filing_jointly'
    ? STANDARD_DEDUCTION_MFJ
    : STANDARD_DEDUCTION_SINGLE;

  // Calculate some useful derived values for display
  const yearsToRetirement = Math.max(0, profile.retirementAge - profile.currentAge);
  const retirementYears = Math.max(0, profile.lifeExpectancy - profile.retirementAge);

  // Calculate average effective tax rate
  const avgEffectiveTaxRate = yearlyWithdrawals.length > 0
    ? yearlyWithdrawals.reduce((sum, y) => sum + (y.grossIncome > 0 ? y.totalTax / y.grossIncome : 0), 0) / yearlyWithdrawals.length
    : 0;

  // Calculate lifetime penalties
  const lifetimePenalties = yearlyWithdrawals.reduce(
    (sum, year) => sum + year.totalPenalties,
    0
  );

  const avgAnnualPenalty = yearlyWithdrawals.length > 0
    ? lifetimePenalties / yearlyWithdrawals.length
    : 0;

  return (
    <div className="space-y-6">
      {/* Invalid Age Configuration Warning */}
      {hasInvalidAges && (
        <div className="bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <svg className="w-5 h-5 text-amber-600 dark:text-amber-400 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <div>
              <h4 className="font-medium text-amber-800 dark:text-amber-300">Invalid Age Configuration</h4>
              <p className="text-sm text-amber-700 dark:text-amber-400 mt-1">
                Please check your age settings. Current age ({profile.currentAge}) should be less than
                retirement age ({profile.retirementAge}), which should be less than life expectancy ({profile.lifeExpectancy}).
              </p>
            </div>
          </div>
        </div>
      )}

      {/* At Retirement */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
          At Retirement (Age {profile.retirementAge})
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <ExpandableStatCard
            title="Total Portfolio"
            value={formatCurrency(totalAtRetirement)}
            color="blue"
            formula={`Sum of all account balances after ${yearsToRetirement} years of growth`}
            details={
              <div>
                <p className="font-medium mb-1">Breakdown by account type:</p>
                <ul className="space-y-0.5">
                  {accountGroupings.filter(g => breakdownByGroup[g.id] > 0).map(group => (
                    <li key={group.id}>{group.label}: {formatCurrency(breakdownByGroup[group.id] || 0)}</li>
                  ))}
                </ul>
              </div>
            }
          />
          {accountGroupings.filter(g => breakdownByGroup[g.id] > 0).map((group) => {
            const amount = breakdownByGroup[group.id] || 0;
            const percentage = totalAtRetirement > 0 ? (amount / totalAtRetirement) * 100 : 0;
            // Map group colors to card colors
            const colorMap: Record<string, 'blue' | 'green' | 'amber' | 'purple' | 'teal'> = {
              '#3b82f6': 'blue',    // pretax
              '#10b981': 'green',   // roth
              '#f59e0b': 'amber',   // taxable
              '#8b5cf6': 'purple',  // hsa/fhsa
              '#6366f1': 'purple',  // lira/lif
            };
            const cardColor = colorMap[group.color] || 'blue';

            return (
              <ExpandableStatCard
                key={group.id}
                title={group.label}
                value={formatCurrency(amount)}
                subtitle={`${percentage.toFixed(0)}% of portfolio`}
                color={cardColor}
                formula={`Sum of ${group.accountTypes.map(t => countryConfig.getAccountTypeLabel(t)).join(' + ')} balances`}
                details={<p>{group.description}</p>}
              />
            );
          }).slice(0, 3)}
        </div>
      </div>

      {/* During Retirement */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">During Retirement</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <ExpandableStatCard
            title="Monthly Withdrawal"
            value={formatCurrency(sustainableMonthlyWithdrawal)}
            subtitle="In today's dollars"
            color="green"
            formula={`${formatCurrency(totalAtRetirement)} × ${formatPercent(assumptions.safeWithdrawalRate)} ÷ 12`}
            details={
              <div>
                <p className="mb-1">
                  Based on the {formatPercent(assumptions.safeWithdrawalRate)} safe withdrawal rate applied to your
                  {' '}{formatCurrency(totalAtRetirement)} portfolio.
                </p>
                <p>
                  Actual withdrawals will be adjusted for {formatPercent(assumptions.inflationRate)} annual inflation.
                </p>
              </div>
            }
          />
          <ExpandableStatCard
            title="Annual Withdrawal"
            value={formatCurrency(sustainableAnnualWithdrawal)}
            subtitle="In today's dollars"
            color="green"
            formula={`${formatCurrency(totalAtRetirement)} × ${formatPercent(assumptions.safeWithdrawalRate)}`}
            details={
              <div>
                <p className="mb-1">
                  = {formatCurrency(totalAtRetirement)} × {formatPercent(assumptions.safeWithdrawalRate)}
                </p>
                <p className="mb-1">
                  = {formatCurrency(sustainableAnnualWithdrawal)}
                </p>
                <p className="text-gray-500 dark:text-gray-400 italic">
                  This is your initial withdrawal amount. Each year it increases by the inflation rate ({formatPercent(assumptions.inflationRate)}).
                </p>
              </div>
            }
          />
          <ExpandableStatCard
            title="Portfolio Longevity"
            value={portfolioDepletionAge ? `Age ${portfolioDepletionAge}` : 'Never depletes'}
            subtitle={portfolioLasts}
            color={portfolioStatus as 'red' | 'green'}
            formula="Simulated year-by-year until balance reaches $0"
            details={
              <div>
                <p className="mb-1">
                  Simulation runs from age {profile.retirementAge} to {profile.lifeExpectancy} ({retirementYears} years).
                </p>
                <p className="mb-1">
                  Assumes {formatPercent(assumptions.retirementReturnRate)} annual return during retirement.
                </p>
                {portfolioDepletionAge ? (
                  <p className="text-red-600 dark:text-red-400">
                    Portfolio depletes {profile.lifeExpectancy - portfolioDepletionAge} years before life expectancy.
                  </p>
                ) : (
                  <p className="text-green-600 dark:text-green-400">
                    Final balance at age {profile.lifeExpectancy}: {formatCurrency(yearlyWithdrawals[yearlyWithdrawals.length - 1]?.totalRemainingBalance || 0)}
                  </p>
                )}
              </div>
            }
          />
          <ExpandableStatCard
            title="Lifetime Taxes"
            value={formatCurrency(lifetimeTaxesPaid)}
            subtitle="Total taxes in retirement"
            color="purple"
            formula={country === 'CA'
              ? 'Sum of federal + provincial taxes across all retirement years'
              : 'Sum of federal + state taxes across all retirement years'}
            details={
              <div>
                <p className="mb-1">
                  Over {retirementYears} years of retirement:
                </p>
                <ul className="space-y-0.5 mb-2">
                  <li>Federal taxes: {formatCurrency(yearlyWithdrawals.reduce((sum, y) => sum + y.federalTax, 0))}</li>
                  <li>{country === 'CA' ? 'Provincial' : 'State'} taxes: {formatCurrency(yearlyWithdrawals.reduce((sum, y) => sum + y.stateTax, 0))}</li>
                </ul>
                <p>
                  Average effective tax rate: {formatPercent(avgEffectiveTaxRate)}
                </p>
                <p className="text-gray-500 dark:text-gray-400 italic mt-1">
                  Standard deduction: {formatCurrency(standardDeduction)} ({profile.filingStatus === 'married_filing_jointly' ? 'MFJ' : 'Single'})
                </p>
              </div>
            }
          />
          {lifetimePenalties > 0 && (
            <ExpandableStatCard
              title="⚠️ Early Withdrawal Penalties"
              value={formatCurrency(lifetimePenalties)}
              subtitle={`Avg: ${formatCurrency(avgAnnualPenalty)}/year`}
              color="red"
              formula="Sum of all early withdrawal penalties across retirement years"
              details={
                <div>
                  <p className="mb-2">
                    Total penalties from withdrawals before age 59.5 (traditional accounts).
                  </p>
                  <p className="mb-1">
                    Over {retirementYears} years of retirement:
                  </p>
                  <ul className="space-y-0.5 mb-2">
                    <li>Total penalties: {formatCurrency(lifetimePenalties)}</li>
                    <li>Average per year: {formatCurrency(avgAnnualPenalty)}</li>
                    <li>Years with penalties: {yearlyWithdrawals.filter(y => y.totalPenalties > 0).length}</li>
                  </ul>
                  <p className="text-red-600 dark:text-red-400 italic">
                    Consider delaying retirement or using penalty-free withdrawal sources to minimize these costs.
                  </p>
                </div>
              }
            />
          )}
        </div>
      </div>

      {/* Additional Insights */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">Key Insights</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <ExpandableStatCard
            title="Years to Retirement"
            value={`${yearsToRetirement} years`}
            subtitle={`Age ${profile.currentAge} → ${profile.retirementAge}`}
            color="teal"
            details={
              <p>
                Your contributions and investment returns have {yearsToRetirement} years to compound
                before you begin withdrawing.
              </p>
            }
          />
          <ExpandableStatCard
            title="Retirement Duration"
            value={`${retirementYears} years`}
            subtitle={`Age ${profile.retirementAge} → ${profile.lifeExpectancy}`}
            color="teal"
            details={
              <p>
                Your portfolio needs to support withdrawals for {retirementYears} years of retirement.
                Longevity risk is a key factor in retirement planning.
              </p>
            }
          />
          {profile.socialSecurityBenefit && profile.socialSecurityStartAge ? (
            <ExpandableStatCard
              title="Social Security"
              value={formatCurrency(profile.socialSecurityBenefit)}
              subtitle={`Starting at age ${profile.socialSecurityStartAge}`}
              color="teal"
              formula="Annual benefit in today's dollars, adjusted for inflation"
              details={
                <div>
                  <p className="mb-1">
                    Social Security income is assumed to grow with inflation ({formatPercent(assumptions.inflationRate)}/year).
                  </p>
                  <p>
                    85% of Social Security is included as taxable income (maximum taxable portion).
                  </p>
                </div>
              }
            />
          ) : null}
        </div>
      </div>

      {/* Warnings */}
      {portfolioDepletionAge && portfolioDepletionAge < profile.lifeExpectancy && (
        <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <svg className="w-5 h-5 text-red-600 dark:text-red-400 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <div>
              <h4 className="font-medium text-red-800 dark:text-red-300">Portfolio Depletion Warning</h4>
              <p className="text-sm text-red-700 dark:text-red-400 mt-1">
                Your portfolio is projected to deplete at age {portfolioDepletionAge}, which is{' '}
                {profile.lifeExpectancy - portfolioDepletionAge} years before your planned life expectancy.
                Consider increasing savings, reducing withdrawal rate, or adjusting retirement age.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

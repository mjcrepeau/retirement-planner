import { AccumulationResult, RetirementResult, Profile } from '../types';

interface SummaryCardsProps {
  profile: Profile;
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

interface StatCardProps {
  title: string;
  value: string;
  subtitle?: string;
  color?: 'blue' | 'green' | 'amber' | 'red' | 'purple';
}

function StatCard({ title, value, subtitle, color = 'blue' }: StatCardProps) {
  const colorClasses = {
    blue: 'bg-blue-50 border-blue-200',
    green: 'bg-green-50 border-green-200',
    amber: 'bg-amber-50 border-amber-200',
    red: 'bg-red-50 border-red-200',
    purple: 'bg-purple-50 border-purple-200',
  };

  const valueColors = {
    blue: 'text-blue-700',
    green: 'text-green-700',
    amber: 'text-amber-700',
    red: 'text-red-700',
    purple: 'text-purple-700',
  };

  return (
    <div className={`p-4 rounded-lg border ${colorClasses[color]}`}>
      <p className="text-sm font-medium text-gray-600">{title}</p>
      <p className={`text-2xl font-bold ${valueColors[color]}`}>{value}</p>
      {subtitle && <p className="text-xs text-gray-500 mt-1">{subtitle}</p>}
    </div>
  );
}

export function SummaryCards({
  profile,
  accumulationResult,
  retirementResult,
}: SummaryCardsProps) {
  const { totalAtRetirement, breakdownByTaxTreatment } = accumulationResult;
  const {
    sustainableMonthlyWithdrawal,
    sustainableAnnualWithdrawal,
    portfolioDepletionAge,
    lifetimeTaxesPaid,
  } = retirementResult;

  const yearsUntilDepletion = portfolioDepletionAge
    ? portfolioDepletionAge - profile.retirementAge
    : profile.lifeExpectancy - profile.retirementAge;

  const portfolioLasts = portfolioDepletionAge
    ? `${yearsUntilDepletion} years (depletes at age ${portfolioDepletionAge})`
    : `${yearsUntilDepletion}+ years (never depletes)`;

  const portfolioStatus = portfolioDepletionAge
    ? portfolioDepletionAge < profile.lifeExpectancy
      ? 'red'
      : 'green'
    : 'green';

  return (
    <div className="space-y-6">
      {/* At Retirement */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-3">At Retirement (Age {profile.retirementAge})</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard
            title="Total Portfolio"
            value={formatCurrency(totalAtRetirement)}
            color="blue"
          />
          <StatCard
            title="Pre-Tax"
            value={formatCurrency(breakdownByTaxTreatment.pretax)}
            subtitle={`${((breakdownByTaxTreatment.pretax / totalAtRetirement) * 100).toFixed(0)}% of portfolio`}
            color="blue"
          />
          <StatCard
            title="Roth (Tax-Free)"
            value={formatCurrency(breakdownByTaxTreatment.roth)}
            subtitle={`${((breakdownByTaxTreatment.roth / totalAtRetirement) * 100).toFixed(0)}% of portfolio`}
            color="green"
          />
          <StatCard
            title="Taxable + HSA"
            value={formatCurrency(breakdownByTaxTreatment.taxable + breakdownByTaxTreatment.hsa)}
            subtitle={`${(((breakdownByTaxTreatment.taxable + breakdownByTaxTreatment.hsa) / totalAtRetirement) * 100).toFixed(0)}% of portfolio`}
            color="amber"
          />
        </div>
      </div>

      {/* During Retirement */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-3">During Retirement</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard
            title="Monthly Withdrawal"
            value={formatCurrency(sustainableMonthlyWithdrawal)}
            subtitle="In today's dollars"
            color="green"
          />
          <StatCard
            title="Annual Withdrawal"
            value={formatCurrency(sustainableAnnualWithdrawal)}
            subtitle="In today's dollars"
            color="green"
          />
          <StatCard
            title="Portfolio Longevity"
            value={portfolioDepletionAge ? `Age ${portfolioDepletionAge}` : 'Never depletes'}
            subtitle={portfolioLasts}
            color={portfolioStatus}
          />
          <StatCard
            title="Lifetime Taxes"
            value={formatCurrency(lifetimeTaxesPaid)}
            subtitle="Total taxes in retirement"
            color="purple"
          />
        </div>
      </div>

      {/* Warnings */}
      {portfolioDepletionAge && portfolioDepletionAge < profile.lifeExpectancy && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <svg className="w-5 h-5 text-red-600 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <div>
              <h4 className="font-medium text-red-800">Portfolio Depletion Warning</h4>
              <p className="text-sm text-red-700 mt-1">
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

import { Profile, Assumptions } from '../types';
import {
  TAX_BRACKETS_MFJ,
  TAX_BRACKETS_SINGLE,
  STANDARD_DEDUCTION_MFJ,
  STANDARD_DEDUCTION_SINGLE,
  CAPITAL_GAINS_BRACKETS_MFJ,
  CAPITAL_GAINS_BRACKETS_SINGLE,
  RMD_TABLE,
  RMD_START_AGE,
} from '../utils/constants';

interface MethodologyPanelProps {
  profile: Profile;
  assumptions: Assumptions;
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

export function MethodologyPanel({ profile, assumptions }: MethodologyPanelProps) {
  const isMarried = profile.filingStatus === 'married_filing_jointly';
  const taxBrackets = isMarried ? TAX_BRACKETS_MFJ : TAX_BRACKETS_SINGLE;
  const standardDeduction = isMarried ? STANDARD_DEDUCTION_MFJ : STANDARD_DEDUCTION_SINGLE;
  const capitalGainsBrackets = isMarried ? CAPITAL_GAINS_BRACKETS_MFJ : CAPITAL_GAINS_BRACKETS_SINGLE;

  return (
    <div className="space-y-6">
      {/* Overview */}
      <section className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          How This Calculator Works
        </h3>
        <div className="prose prose-sm dark:prose-invert max-w-none text-gray-600 dark:text-gray-300">
          <p>
            This calculator projects your retirement finances in two phases:
          </p>
          <ol className="list-decimal list-inside space-y-2 mt-2">
            <li>
              <strong>Accumulation Phase</strong> (age {profile.currentAge} to {profile.retirementAge}):
              Projects account growth using compound interest, annual contributions, contribution growth, and employer matching.
            </li>
            <li>
              <strong>Withdrawal Phase</strong> (age {profile.retirementAge} to {profile.lifeExpectancy}):
              Simulates tax-optimized withdrawals to meet your spending needs while minimizing lifetime taxes.
            </li>
          </ol>
        </div>
      </section>

      {/* Your Current Assumptions */}
      <section className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Your Current Assumptions
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-3">
            <h4 className="font-medium text-gray-800 dark:text-gray-200">Economic</h4>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-gray-600 dark:text-gray-400">Inflation Rate</dt>
                <dd className="font-mono text-gray-900 dark:text-white">{formatPercent(assumptions.inflationRate)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-600 dark:text-gray-400">Safe Withdrawal Rate</dt>
                <dd className="font-mono text-gray-900 dark:text-white">{formatPercent(assumptions.safeWithdrawalRate)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-600 dark:text-gray-400">Retirement Return Rate</dt>
                <dd className="font-mono text-gray-900 dark:text-white">{formatPercent(assumptions.retirementReturnRate)}</dd>
              </div>
            </dl>
          </div>
          <div className="space-y-3">
            <h4 className="font-medium text-gray-800 dark:text-gray-200">Tax & Personal</h4>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-gray-600 dark:text-gray-400">Filing Status</dt>
                <dd className="font-mono text-gray-900 dark:text-white">
                  {isMarried ? 'Married Filing Jointly' : 'Single'}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-600 dark:text-gray-400">State Tax Rate</dt>
                <dd className="font-mono text-gray-900 dark:text-white">{formatPercent(profile.stateTaxRate || 0)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-600 dark:text-gray-400">Standard Deduction</dt>
                <dd className="font-mono text-gray-900 dark:text-white">{formatCurrency(standardDeduction)}</dd>
              </div>
            </dl>
          </div>
        </div>
      </section>

      {/* Accumulation Phase Formulas */}
      <section className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Accumulation Phase Formulas
        </h3>
        <div className="space-y-4 text-sm">
          <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4">
            <h4 className="font-medium text-gray-800 dark:text-gray-200 mb-2">Annual Balance Growth</h4>
            <code className="text-xs bg-gray-200 dark:bg-gray-700 px-2 py-1 rounded block mb-2 text-gray-800 dark:text-gray-200">
              New Balance = (Previous Balance × (1 + Return Rate)) + Contribution + Employer Match
            </code>
            <p className="text-gray-600 dark:text-gray-400">
              Each year, your existing balance grows by the return rate, then contributions are added.
            </p>
          </div>

          <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4">
            <h4 className="font-medium text-gray-800 dark:text-gray-200 mb-2">Employer Match (401k only)</h4>
            <code className="text-xs bg-gray-200 dark:bg-gray-700 px-2 py-1 rounded block mb-2 text-gray-800 dark:text-gray-200">
              Match = min(Contribution × Match %, Match Limit)
            </code>
            <p className="text-gray-600 dark:text-gray-400">
              Employer matching is capped at the match limit you specify.
            </p>
          </div>

          <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4">
            <h4 className="font-medium text-gray-800 dark:text-gray-200 mb-2">Contribution Growth</h4>
            <code className="text-xs bg-gray-200 dark:bg-gray-700 px-2 py-1 rounded block mb-2 text-gray-800 dark:text-gray-200">
              Next Year Contribution = This Year Contribution × (1 + Growth Rate)
            </code>
            <p className="text-gray-600 dark:text-gray-400">
              Contributions can increase annually to account for salary growth.
            </p>
          </div>
        </div>
      </section>

      {/* Withdrawal Strategy */}
      <section className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Tax-Optimized Withdrawal Strategy
        </h3>
        <div className="space-y-4 text-sm">
          <p className="text-gray-600 dark:text-gray-400">
            The calculator uses a 6-step withdrawal strategy designed to minimize lifetime taxes:
          </p>

          <ol className="space-y-3">
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400 flex items-center justify-center text-xs font-bold">1</span>
              <div>
                <strong className="text-gray-800 dark:text-gray-200">Required Minimum Distributions (RMDs)</strong>
                <p className="text-gray-600 dark:text-gray-400">Starting at age {RMD_START_AGE}, traditional accounts must take RMDs based on IRS life expectancy tables.</p>
              </div>
            </li>
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400 flex items-center justify-center text-xs font-bold">2</span>
              <div>
                <strong className="text-gray-800 dark:text-gray-200">Fill 12% Tax Bracket</strong>
                <p className="text-gray-600 dark:text-gray-400">
                  Additional traditional withdrawals to fill the 12% bracket (up to {formatCurrency(standardDeduction + (isMarried ? 94300 : 47150))} total ordinary income).
                </p>
              </div>
            </li>
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-green-100 dark:bg-green-900 text-green-600 dark:text-green-400 flex items-center justify-center text-xs font-bold">3</span>
              <div>
                <strong className="text-gray-800 dark:text-gray-200">Roth Accounts</strong>
                <p className="text-gray-600 dark:text-gray-400">Tax-free withdrawals for remaining spending needs.</p>
              </div>
            </li>
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-amber-100 dark:bg-amber-900 text-amber-600 dark:text-amber-400 flex items-center justify-center text-xs font-bold">4</span>
              <div>
                <strong className="text-gray-800 dark:text-gray-200">Taxable Accounts</strong>
                <p className="text-gray-600 dark:text-gray-400">Only gains portion is taxed at capital gains rates (often 0% or 15%).</p>
              </div>
            </li>
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-purple-100 dark:bg-purple-900 text-purple-600 dark:text-purple-400 flex items-center justify-center text-xs font-bold">5</span>
              <div>
                <strong className="text-gray-800 dark:text-gray-200">HSA Accounts</strong>
                <p className="text-gray-600 dark:text-gray-400">Used last; assumed tax-free for qualified medical expenses.</p>
              </div>
            </li>
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400 flex items-center justify-center text-xs font-bold">6</span>
              <div>
                <strong className="text-gray-800 dark:text-gray-200">Additional Traditional</strong>
                <p className="text-gray-600 dark:text-gray-400">If more is needed, withdraws from traditional accounts at higher tax brackets.</p>
              </div>
            </li>
          </ol>

          <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 mt-4">
            <h4 className="font-medium text-gray-800 dark:text-gray-200 mb-2">Safe Withdrawal Rate</h4>
            <code className="text-xs bg-gray-200 dark:bg-gray-700 px-2 py-1 rounded block mb-2 text-gray-800 dark:text-gray-200">
              Annual Withdrawal = Portfolio at Retirement × {formatPercent(assumptions.safeWithdrawalRate)}
            </code>
            <p className="text-gray-600 dark:text-gray-400">
              Initial withdrawal amount, adjusted for inflation each year.
            </p>
          </div>
        </div>
      </section>

      {/* Tax Calculations */}
      <section className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Tax Calculations
        </h3>
        <div className="space-y-4 text-sm">
          <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4">
            <h4 className="font-medium text-gray-800 dark:text-gray-200 mb-2">Federal Income Tax</h4>
            <code className="text-xs bg-gray-200 dark:bg-gray-700 px-2 py-1 rounded block mb-2 text-gray-800 dark:text-gray-200">
              Taxable Income = Traditional Withdrawals + (Social Security × 85%) - Standard Deduction
            </code>
            <p className="text-gray-600 dark:text-gray-400">
              Progressive brackets applied to taxable income (see table below).
            </p>
          </div>

          <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4">
            <h4 className="font-medium text-gray-800 dark:text-gray-200 mb-2">Capital Gains Tax</h4>
            <code className="text-xs bg-gray-200 dark:bg-gray-700 px-2 py-1 rounded block mb-2 text-gray-800 dark:text-gray-200">
              Taxable Gains = Withdrawal × (1 - Cost Basis / Balance)
            </code>
            <p className="text-gray-600 dark:text-gray-400">
              Long-term capital gains rates applied; brackets determined by total income.
            </p>
          </div>

          <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4">
            <h4 className="font-medium text-gray-800 dark:text-gray-200 mb-2">State Tax (Simplified)</h4>
            <code className="text-xs bg-gray-200 dark:bg-gray-700 px-2 py-1 rounded block mb-2 text-gray-800 dark:text-gray-200">
              State Tax = (Ordinary Income + Capital Gains - Standard Deduction) × {formatPercent(profile.stateTaxRate || 0)}
            </code>
            <p className="text-gray-600 dark:text-gray-400">
              Flat rate applied to taxable income. Actual state taxes vary by state.
            </p>
          </div>
        </div>
      </section>

      {/* Federal Tax Brackets */}
      <section className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          2024 Federal Tax Brackets ({isMarried ? 'Married Filing Jointly' : 'Single'})
        </h3>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700">
                <th className="text-left py-2 px-3 font-medium text-gray-700 dark:text-gray-300">Taxable Income</th>
                <th className="text-right py-2 px-3 font-medium text-gray-700 dark:text-gray-300">Tax Rate</th>
              </tr>
            </thead>
            <tbody>
              {taxBrackets.map((bracket, index) => (
                <tr key={index} className="border-b border-gray-100 dark:border-gray-800">
                  <td className="py-2 px-3 text-gray-600 dark:text-gray-400">
                    {formatCurrency(bracket.min)} - {bracket.max === Infinity ? 'and above' : formatCurrency(bracket.max)}
                  </td>
                  <td className="py-2 px-3 text-right font-mono text-gray-900 dark:text-white">
                    {formatPercent(bracket.rate)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs text-gray-500 dark:text-gray-500">
          Standard deduction of {formatCurrency(standardDeduction)} is subtracted before applying brackets.
        </p>
      </section>

      {/* Capital Gains Brackets */}
      <section className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          2024 Long-Term Capital Gains Rates ({isMarried ? 'Married Filing Jointly' : 'Single'})
        </h3>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700">
                <th className="text-left py-2 px-3 font-medium text-gray-700 dark:text-gray-300">Total Income</th>
                <th className="text-right py-2 px-3 font-medium text-gray-700 dark:text-gray-300">Capital Gains Rate</th>
              </tr>
            </thead>
            <tbody>
              {capitalGainsBrackets.map((bracket, index) => (
                <tr key={index} className="border-b border-gray-100 dark:border-gray-800">
                  <td className="py-2 px-3 text-gray-600 dark:text-gray-400">
                    {formatCurrency(bracket.min)} - {bracket.max === Infinity ? 'and above' : formatCurrency(bracket.max)}
                  </td>
                  <td className="py-2 px-3 text-right font-mono text-gray-900 dark:text-white">
                    {formatPercent(bracket.rate)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* RMD Table */}
      <section className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Required Minimum Distribution (RMD) Table
        </h3>
        <div className="space-y-3 text-sm">
          <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4">
            <h4 className="font-medium text-gray-800 dark:text-gray-200 mb-2">RMD Formula</h4>
            <code className="text-xs bg-gray-200 dark:bg-gray-700 px-2 py-1 rounded block mb-2 text-gray-800 dark:text-gray-200">
              RMD = Traditional Account Balance / Life Expectancy Divisor
            </code>
            <p className="text-gray-600 dark:text-gray-400">
              RMDs begin at age {RMD_START_AGE} per the SECURE 2.0 Act. The divisor decreases with age, requiring larger withdrawals.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="text-left py-2 px-3 font-medium text-gray-700 dark:text-gray-300">Age</th>
                  <th className="text-right py-2 px-3 font-medium text-gray-700 dark:text-gray-300">Divisor</th>
                  <th className="text-right py-2 px-3 font-medium text-gray-700 dark:text-gray-300">% of Balance</th>
                </tr>
              </thead>
              <tbody>
                {RMD_TABLE.filter((_, i) => i % 5 === 0 || i === RMD_TABLE.length - 1).map((entry) => (
                  <tr key={entry.age} className="border-b border-gray-100 dark:border-gray-800">
                    <td className="py-2 px-3 text-gray-600 dark:text-gray-400">{entry.age}</td>
                    <td className="py-2 px-3 text-right font-mono text-gray-900 dark:text-white">{entry.divisor.toFixed(1)}</td>
                    <td className="py-2 px-3 text-right font-mono text-gray-900 dark:text-white">
                      {((1 / entry.divisor) * 100).toFixed(2)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-500">
            Based on IRS Uniform Lifetime Table. Showing every 5th year; full table used in calculations.
          </p>
        </div>
      </section>

      {/* Important Notes */}
      <section className="bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800 p-6">
        <h3 className="text-lg font-semibold text-amber-800 dark:text-amber-200 mb-4">
          Important Notes & Limitations
        </h3>
        <ul className="space-y-2 text-sm text-amber-700 dark:text-amber-300">
          <li className="flex gap-2">
            <span className="flex-shrink-0">*</span>
            <span>Tax brackets are for 2024 and don't adjust for inflation in future years.</span>
          </li>
          <li className="flex gap-2">
            <span className="flex-shrink-0">*</span>
            <span>Social Security is assumed 85% taxable (maximum taxable portion).</span>
          </li>
          <li className="flex gap-2">
            <span className="flex-shrink-0">*</span>
            <span>Taxable account cost basis is estimated at 50% of the balance at retirement.</span>
          </li>
          <li className="flex gap-2">
            <span className="flex-shrink-0">*</span>
            <span>State tax uses a simplified flat rate; actual state taxes vary significantly.</span>
          </li>
          <li className="flex gap-2">
            <span className="flex-shrink-0">*</span>
            <span>HSA withdrawals are treated as tax-free, assuming qualified medical expenses.</span>
          </li>
          <li className="flex gap-2">
            <span className="flex-shrink-0">*</span>
            <span>Investment returns are applied uniformly; actual returns vary year to year.</span>
          </li>
          <li className="flex gap-2">
            <span className="flex-shrink-0">*</span>
            <span>This calculator is for educational purposes and should not replace professional financial advice.</span>
          </li>
        </ul>
      </section>
    </div>
  );
}

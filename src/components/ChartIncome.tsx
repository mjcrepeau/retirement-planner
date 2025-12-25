import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  ReferenceLine,
} from 'recharts';
import { RetirementResult } from '../types';
import { CHART_COLORS } from '../utils/constants';

interface ChartIncomeProps {
  result: RetirementResult;
}

function formatCurrency(value: number): string {
  if (Math.abs(value) >= 1000000) {
    return `$${(value / 1000000).toFixed(1)}M`;
  }
  if (Math.abs(value) >= 1000) {
    return `$${(value / 1000).toFixed(0)}K`;
  }
  return `$${value.toFixed(0)}`;
}

function formatTooltipValue(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value);
}

export function ChartIncome({ result }: ChartIncomeProps) {
  // Transform data for the chart
  // Show gross income as stacked bars (positive), taxes as separate negative bar
  const chartData = result.yearlyWithdrawals.map(year => ({
    age: year.age,
    withdrawals: year.totalWithdrawal,
    socialSecurity: year.socialSecurityIncome,
    taxes: year.totalTax, // Keep positive for separate display
    afterTax: year.afterTaxIncome,
    gross: year.grossIncome,
    // For the net visualization, we'll show after-tax as a line
  }));

  const CustomTooltip = ({ active, payload, label }: {
    active?: boolean;
    payload?: Array<{ name: string; value: number; color: string; dataKey: string }>;
    label?: number;
  }) => {
    if (!active || !payload) return null;

    const yearData = result.yearlyWithdrawals.find(y => y.age === label);
    if (!yearData) return null;

    return (
      <div className="bg-white p-3 border rounded-lg shadow-lg">
        <p className="font-medium text-gray-900 mb-2">Age {label}</p>
        <div className="space-y-1 text-sm">
          <div className="flex justify-between gap-4">
            <span style={{ color: CHART_COLORS.pretax }}>Withdrawals:</span>
            <span className="font-medium">{formatTooltipValue(yearData.totalWithdrawal)}</span>
          </div>
          {yearData.socialSecurityIncome > 0 && (
            <div className="flex justify-between gap-4">
              <span style={{ color: CHART_COLORS.socialSecurity }}>Social Security:</span>
              <span className="font-medium">{formatTooltipValue(yearData.socialSecurityIncome)}</span>
            </div>
          )}
          <div className="flex justify-between gap-4 border-t pt-1 mt-1">
            <span className="text-gray-600">Gross Income:</span>
            <span className="font-medium">{formatTooltipValue(yearData.grossIncome)}</span>
          </div>
          <div className="flex justify-between gap-4">
            <span style={{ color: CHART_COLORS.tax }}>Taxes:</span>
            <span className="font-medium text-red-600">-{formatTooltipValue(yearData.totalTax)}</span>
          </div>
          <div className="border-t mt-2 pt-2 flex justify-between gap-4 font-semibold">
            <span style={{ color: CHART_COLORS.spending }}>After-Tax Income:</span>
            <span>{formatTooltipValue(yearData.afterTaxIncome)}</span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="w-full h-80">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis
            dataKey="age"
            tick={{ fontSize: 12 }}
            tickLine={{ stroke: '#d1d5db' }}
          />
          <YAxis
            tickFormatter={formatCurrency}
            tick={{ fontSize: 12 }}
            tickLine={{ stroke: '#d1d5db' }}
            width={60}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend wrapperStyle={{ paddingTop: '10px' }} />
          <ReferenceLine y={0} stroke="#9ca3af" />
          {/* Gross income components - stacked bars */}
          <Bar
            dataKey="withdrawals"
            name="Withdrawals"
            stackId="income"
            fill={CHART_COLORS.pretax}
            fillOpacity={0.8}
          />
          <Bar
            dataKey="socialSecurity"
            name="Social Security"
            stackId="income"
            fill={CHART_COLORS.socialSecurity}
            fillOpacity={0.8}
          />
          {/* After-tax income line - the key metric */}
          <Line
            type="monotone"
            dataKey="afterTax"
            name="After-Tax Income"
            stroke={CHART_COLORS.spending}
            strokeWidth={3}
            dot={false}
          />
          {/* Taxes as a separate line for reference */}
          <Line
            type="monotone"
            dataKey="taxes"
            name="Taxes Paid"
            stroke={CHART_COLORS.tax}
            strokeWidth={2}
            strokeDasharray="5 5"
            dot={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

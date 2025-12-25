import {
  ComposedChart,
  Line,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { RetirementResult } from '../types';
import { CHART_COLORS } from '../utils/constants';

interface ChartTaxProps {
  result: RetirementResult;
}

function formatCurrency(value: number): string {
  if (value >= 1000000) {
    return `$${(value / 1000000).toFixed(1)}M`;
  }
  if (value >= 1000) {
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

export function ChartTax({ result }: ChartTaxProps) {
  // Transform data for the chart
  const chartData = result.yearlyWithdrawals.map(year => {
    const effectiveRate = year.grossIncome > 0
      ? (year.totalTax / year.grossIncome) * 100
      : 0;

    return {
      age: year.age,
      federalTax: year.federalTax,
      stateTax: year.stateTax,
      totalTax: year.totalTax,
      effectiveRate,
    };
  });

  const CustomTooltip = ({ active, payload, label }: {
    active?: boolean;
    payload?: Array<{ name: string; value: number; color: string }>;
    label?: number;
  }) => {
    if (!active || !payload) return null;

    const yearData = result.yearlyWithdrawals.find(y => y.age === label);
    if (!yearData) return null;

    const effectiveRate = yearData.grossIncome > 0
      ? ((yearData.totalTax / yearData.grossIncome) * 100).toFixed(1)
      : '0.0';

    return (
      <div className="bg-white p-3 border rounded-lg shadow-lg">
        <p className="font-medium text-gray-900 mb-2">Age {label}</p>
        <div className="space-y-1 text-sm">
          <div className="flex justify-between gap-4">
            <span className="text-blue-600">Federal Tax:</span>
            <span className="font-medium">{formatTooltipValue(yearData.federalTax)}</span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-purple-600">State Tax:</span>
            <span className="font-medium">{formatTooltipValue(yearData.stateTax)}</span>
          </div>
          <div className="border-t mt-2 pt-2">
            <div className="flex justify-between gap-4 font-semibold">
              <span style={{ color: CHART_COLORS.tax }}>Total Tax:</span>
              <span>{formatTooltipValue(yearData.totalTax)}</span>
            </div>
            <div className="flex justify-between gap-4 text-gray-600 mt-1">
              <span>Effective Rate:</span>
              <span>{effectiveRate}%</span>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="w-full h-80">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={chartData} margin={{ top: 10, right: 50, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis
            dataKey="age"
            tick={{ fontSize: 12 }}
            tickLine={{ stroke: '#d1d5db' }}
          />
          <YAxis
            yAxisId="left"
            tickFormatter={formatCurrency}
            tick={{ fontSize: 12 }}
            tickLine={{ stroke: '#d1d5db' }}
            width={60}
          />
          <YAxis
            yAxisId="right"
            orientation="right"
            tickFormatter={(v) => `${v.toFixed(0)}%`}
            tick={{ fontSize: 12 }}
            tickLine={{ stroke: '#d1d5db' }}
            domain={[0, 40]}
            width={50}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend wrapperStyle={{ paddingTop: '10px' }} />
          <Bar
            yAxisId="left"
            dataKey="federalTax"
            name="Federal Tax"
            stackId="tax"
            fill="#3b82f6"
            fillOpacity={0.8}
          />
          <Bar
            yAxisId="left"
            dataKey="stateTax"
            name="State Tax"
            stackId="tax"
            fill="#8b5cf6"
            fillOpacity={0.8}
          />
          <Line
            yAxisId="right"
            type="monotone"
            dataKey="effectiveRate"
            name="Effective Rate"
            stroke={CHART_COLORS.tax}
            strokeWidth={2}
            dot={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

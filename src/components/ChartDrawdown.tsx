import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { Account, RetirementResult, getTaxTreatment } from '../types';
import { CHART_COLORS } from '../utils/constants';

interface ChartDrawdownProps {
  accounts: Account[];
  result: RetirementResult;
  isDarkMode?: boolean;
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

interface TooltipPayload {
  name: string;
  value: number;
  color: string;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: TooltipPayload[];
  label?: number;
  accounts: Account[];
  result: RetirementResult;
}

function CustomTooltip({ active, payload, label, accounts, result }: CustomTooltipProps) {
  if (!active || !payload) return null;

  const yearData = result.yearlyWithdrawals.find(y => y.age === label);
  const total = payload.reduce((sum, entry) => sum + entry.value, 0);

  return (
    <div className="bg-white dark:bg-gray-800 p-3 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg">
      <p className="font-medium text-gray-900 dark:text-white mb-2">Age {label}</p>
      {payload.filter(p => p.value > 0).reverse().map((entry, index) => {
        const account = accounts.find(a => a.id === entry.name);
        return (
          <div key={index} className="flex justify-between gap-4 text-sm">
            <span style={{ color: entry.color }}>{account?.name || entry.name}:</span>
            <span className="font-medium text-gray-900 dark:text-white">{formatTooltipValue(entry.value)}</span>
          </div>
        );
      })}
      <div className="border-t border-gray-200 dark:border-gray-600 mt-2 pt-2 space-y-1 text-sm">
        <div className="flex justify-between gap-4 font-semibold text-gray-900 dark:text-white">
          <span>Total Portfolio:</span>
          <span>{formatTooltipValue(total)}</span>
        </div>
        {yearData && (
          <div className="flex justify-between gap-4 text-gray-600 dark:text-gray-400">
            <span>Annual Withdrawal:</span>
            <span>{formatTooltipValue(yearData.totalWithdrawal)}</span>
          </div>
        )}
      </div>
    </div>
  );
}

export function ChartDrawdown({ accounts, result, isDarkMode = false }: ChartDrawdownProps) {
  // Colors based on dark mode
  const gridColor = isDarkMode ? '#374151' : '#e5e7eb';
  const tickColor = isDarkMode ? '#9ca3af' : '#6b7280';
  const tickLineColor = isDarkMode ? '#4b5563' : '#d1d5db';
  // Transform data for the stacked area chart
  const chartData = result.yearlyWithdrawals.map(year => {
    const dataPoint: Record<string, number | string> = {
      age: year.age,
      total: year.totalRemainingBalance,
    };

    accounts.forEach(account => {
      dataPoint[account.id] = year.remainingBalances[account.id] || 0;
    });

    return dataPoint;
  });

  // Sort accounts by tax treatment for consistent stacking order
  const sortedAccounts = [...accounts].sort((a, b) => {
    const order = { pretax: 0, roth: 1, taxable: 2, hsa: 3 };
    return order[getTaxTreatment(a.type)] - order[getTaxTreatment(b.type)];
  });

  return (
    <div className="w-full h-80 touch-pan-y">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
          <XAxis
            dataKey="age"
            tick={{ fontSize: 12, fill: tickColor }}
            tickLine={{ stroke: tickLineColor }}
            stroke={tickLineColor}
          />
          <YAxis
            tickFormatter={formatCurrency}
            tick={{ fontSize: 12, fill: tickColor }}
            tickLine={{ stroke: tickLineColor }}
            stroke={tickLineColor}
            width={60}
          />
          <Tooltip content={<CustomTooltip accounts={accounts} result={result} />} />
          <Legend
            wrapperStyle={{ paddingTop: '10px' }}
            formatter={(value) => {
              const account = accounts.find(a => a.id === value);
              return <span style={{ color: tickColor }}>{account?.name || value}</span>;
            }}
          />
          {sortedAccounts.map(account => (
            <Area
              key={account.id}
              type="monotone"
              dataKey={account.id}
              name={account.id}
              stackId="1"
              stroke={CHART_COLORS[getTaxTreatment(account.type)]}
              fill={CHART_COLORS[getTaxTreatment(account.type)]}
              fillOpacity={0.6}
            />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

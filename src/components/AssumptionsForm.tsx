import { Assumptions } from '../types';

interface AssumptionsFormProps {
  assumptions: Assumptions;
  onChange: (assumptions: Assumptions) => void;
}

export function AssumptionsForm({ assumptions, onChange }: AssumptionsFormProps) {
  const handleChange = (field: keyof Assumptions, value: number) => {
    onChange({
      ...assumptions,
      [field]: value,
    });
  };

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white border-b border-gray-200 dark:border-gray-600 pb-2">Economic Assumptions</h3>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Inflation Rate (%)
            <span className="text-gray-500 dark:text-gray-400 text-xs ml-1" title="Expected annual inflation rate">
              ⓘ
            </span>
          </label>
          <input
            type="number"
            value={(assumptions.inflationRate * 100).toFixed(1)}
            onChange={(e) => handleChange('inflationRate', (parseFloat(e.target.value) || 0) / 100)}
            min={0}
            max={10}
            step={0.1}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          />
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Historical average: ~3%</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Safe Withdrawal Rate (%)
            <span className="text-gray-500 dark:text-gray-400 text-xs ml-1" title="Percentage of portfolio to withdraw annually in retirement">
              ⓘ
            </span>
          </label>
          <input
            type="number"
            value={(assumptions.safeWithdrawalRate * 100).toFixed(1)}
            onChange={(e) => handleChange('safeWithdrawalRate', (parseFloat(e.target.value) || 0) / 100)}
            min={1}
            max={10}
            step={0.1}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          />
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Traditional rule: 4%</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Retirement Return Rate (%)
            <span className="text-gray-500 dark:text-gray-400 text-xs ml-1" title="Expected annual return during retirement (typically more conservative)">
              ⓘ
            </span>
          </label>
          <input
            type="number"
            value={(assumptions.retirementReturnRate * 100).toFixed(1)}
            onChange={(e) => handleChange('retirementReturnRate', (parseFloat(e.target.value) || 0) / 100)}
            min={0}
            max={15}
            step={0.1}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          />
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Conservative assumption: 5%</p>
        </div>
      </div>
    </div>
  );
}

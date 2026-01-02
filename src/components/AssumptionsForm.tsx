import { Assumptions } from '../types';
import { NumberInput } from './NumberInput';
import { Tooltip } from './Tooltip';

interface AssumptionsFormProps {
  assumptions: Assumptions;
  onChange: (assumptions: Assumptions) => void;
}

const inputClassName = "w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white";

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
            <Tooltip text="Expected annual inflation rate" />
          </label>
          <NumberInput
            value={assumptions.inflationRate}
            onChange={(val) => handleChange('inflationRate', val)}
            min={0}
            max={10}
            isPercentage
            decimals={1}
            defaultValue={0.03}
            className={inputClassName}
          />
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Historical average: ~3%</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Safe Withdrawal Rate (%)
            <Tooltip text="Percentage of portfolio to withdraw annually in retirement" />
          </label>
          <NumberInput
            value={assumptions.safeWithdrawalRate}
            onChange={(val) => handleChange('safeWithdrawalRate', val)}
            min={1}
            max={10}
            isPercentage
            decimals={1}
            defaultValue={0.04}
            className={inputClassName}
          />
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Traditional rule: 4%</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Retirement Return Rate (%)
            <Tooltip text="Expected annual return during retirement (typically more conservative)" />
          </label>
          <NumberInput
            value={assumptions.retirementReturnRate}
            onChange={(val) => handleChange('retirementReturnRate', val)}
            min={0}
            max={15}
            isPercentage
            decimals={1}
            defaultValue={0.05}
            className={inputClassName}
          />
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Conservative assumption: 5%</p>
        </div>
      </div>
    </div>
  );
}

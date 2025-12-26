import { useState, useEffect } from 'react';
import { Account, AccountType, getAccountTypeLabel, is401k } from '../types';
import { v4 as uuidv4 } from 'uuid';

interface AccountFormProps {
  account?: Account;
  onSave: (account: Account) => void;
  onCancel: () => void;
}

const defaultAccount: Omit<Account, 'id'> = {
  name: '',
  type: 'traditional_401k',
  balance: 0,
  annualContribution: 0,
  contributionGrowthRate: 0.03,
  returnRate: 0.07,
};

export function AccountForm({ account, onSave, onCancel }: AccountFormProps) {
  const [formData, setFormData] = useState<Omit<Account, 'id'>>(() => {
    if (account) {
      const { id: _, ...rest } = account;
      return rest;
    }
    return { ...defaultAccount };
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (account) {
      const { id: _, ...rest } = account;
      setFormData(rest);
    }
  }, [account]);

  const handleChange = (field: keyof Omit<Account, 'id'>, value: string | number) => {
    setFormData(prev => ({
      ...prev,
      [field]: value,
    }));
    // Clear error when field is modified
    if (errors[field]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Account name is required';
    }

    if (formData.balance < 0) {
      newErrors.balance = 'Balance cannot be negative';
    }

    if (formData.annualContribution < 0) {
      newErrors.annualContribution = 'Contribution cannot be negative';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) return;

    onSave({
      id: account?.id || uuidv4(),
      ...formData,
    });
  };

  const accountTypes: AccountType[] = [
    'traditional_401k',
    'roth_401k',
    'traditional_ira',
    'roth_ira',
    'taxable',
    'hsa',
  ];

  const show401kFields = is401k(formData.type);

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Account Name *
        </label>
        <input
          type="text"
          value={formData.name}
          onChange={(e) => handleChange('name', e.target.value)}
          placeholder="e.g., Company 401(k)"
          className={`w-full px-3 py-2 border rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 dark:text-white ${
            errors.name ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
          }`}
        />
        {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name}</p>}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Account Type
        </label>
        <select
          value={formData.type}
          onChange={(e) => handleChange('type', e.target.value as AccountType)}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 dark:text-white"
        >
          {accountTypes.map(type => (
            <option key={type} value={type}>
              {getAccountTypeLabel(type)}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Current Balance ($)
          </label>
          <input
            type="number"
            value={formData.balance}
            onChange={(e) => handleChange('balance', parseFloat(e.target.value) || 0)}
            min={0}
            className={`w-full px-3 py-2 border rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 dark:text-white ${
              errors.balance ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
            }`}
          />
          {errors.balance && <p className="text-red-500 text-xs mt-1">{errors.balance}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Annual Contribution ($)
          </label>
          <input
            type="number"
            value={formData.annualContribution}
            onChange={(e) => handleChange('annualContribution', parseFloat(e.target.value) || 0)}
            min={0}
            className={`w-full px-3 py-2 border rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 dark:text-white ${
              errors.annualContribution ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
            }`}
          />
          {errors.annualContribution && (
            <p className="text-red-500 text-xs mt-1">{errors.annualContribution}</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Contribution Growth Rate (%)
            <span className="text-gray-500 dark:text-gray-400 text-xs ml-1" title="Annual increase in contributions (e.g., salary raises)">
              ⓘ
            </span>
          </label>
          <input
            type="number"
            value={(formData.contributionGrowthRate * 100).toFixed(1)}
            onChange={(e) => handleChange('contributionGrowthRate', (parseFloat(e.target.value) || 0) / 100)}
            min={0}
            max={20}
            step={0.1}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 dark:text-white"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Expected Return (%)
          </label>
          <input
            type="number"
            value={(formData.returnRate * 100).toFixed(1)}
            onChange={(e) => handleChange('returnRate', (parseFloat(e.target.value) || 0) / 100)}
            min={0}
            max={20}
            step={0.1}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 dark:text-white"
          />
        </div>
      </div>

      {show401kFields && (
        <div className="border-t border-gray-200 dark:border-gray-600 pt-4 mt-4">
          <h4 className="text-sm font-medium text-gray-800 dark:text-gray-200 mb-3">Employer Match</h4>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Match Percentage (%)
                <span className="text-gray-500 dark:text-gray-400 text-xs ml-1" title="What percent of your contribution does employer match?">
                  ⓘ
                </span>
              </label>
              <input
                type="number"
                value={((formData.employerMatchPercent || 0) * 100).toFixed(0)}
                onChange={(e) => handleChange('employerMatchPercent', (parseFloat(e.target.value) || 0) / 100)}
                min={0}
                max={200}
                step={1}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Match Limit ($)
                <span className="text-gray-500 dark:text-gray-400 text-xs ml-1" title="Maximum annual employer match in dollars">
                  ⓘ
                </span>
              </label>
              <input
                type="number"
                value={formData.employerMatchLimit || 0}
                onChange={(e) => handleChange('employerMatchLimit', parseFloat(e.target.value) || 0)}
                min={0}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 dark:text-white"
              />
            </div>
          </div>
        </div>
      )}

      <div className="flex justify-end gap-3 pt-4">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-600 border border-gray-300 dark:border-gray-500 rounded-md hover:bg-gray-50 dark:hover:bg-gray-500"
        >
          Cancel
        </button>
        <button
          type="submit"
          className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
        >
          {account ? 'Update Account' : 'Add Account'}
        </button>
      </div>
    </form>
  );
}

import { useState } from 'react';
import { Account, AccountType, Profile, getAccountTypeLabel, is401k } from '../types';
import { NumberInput } from './NumberInput';
import { Tooltip } from './Tooltip';
import { v4 as uuidv4 } from 'uuid';
import { useCountry } from '../contexts/CountryContext';
import { getDefaultWithdrawalAge, getMaxWithdrawalAge } from '../utils/withdrawalDefaults';
import { getCountryConfig } from '../countries';

interface AccountFormProps {
  account?: Account;
  profile: Profile;
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

const inputClassName = "w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 dark:text-white";
const inputErrorClassName = "w-full px-3 py-2 border border-red-500 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 dark:text-white";

export function AccountForm({ account, profile, onSave, onCancel }: AccountFormProps) {
  const { config: countryConfig } = useCountry();

  // Initialize form data from account prop (component is re-mounted with key when account changes)
  const [formData, setFormData] = useState<Omit<Account, 'id'>>(() => {
    if (account) {
      const { id: _id, ...rest } = account;
      void _id; // Explicitly mark as intentionally unused
      return rest;
    }
    // Use first account type from country config as default
    const defaultType = countryConfig.accountTypes[0]?.type || 'traditional_401k';
    return { ...defaultAccount, type: defaultType as AccountType };
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  // Get country config for penalty info and defaults
  const fullCountryConfig = getCountryConfig(profile.country);
  const penaltyInfo = fullCountryConfig.getPenaltyInfo(formData.type);

  // Calculate min/max withdrawal ages
  const minWithdrawalAge = profile.currentAge;
  const maxWithdrawalAge = getMaxWithdrawalAge(
    { ...formData, id: account?.id || '' },
    profile.lifeExpectancy,
    fullCountryConfig
  );

  // Get current withdrawal age (or default)
  const currentWithdrawalAge = formData.withdrawalRules?.startAge ??
    getDefaultWithdrawalAge(
      { ...formData, id: account?.id || '' },
      profile.retirementAge,
      fullCountryConfig
    );

  // Derive warning state instead of storing in state
  const showPenaltyWarning = penaltyInfo.appliesToAccountType && currentWithdrawalAge < penaltyInfo.penaltyAge;

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

  // Get account types from country config
  const accountTypes: AccountType[] = countryConfig.accountTypes.map(
    (config) => config.type as AccountType
  );

  // Show employer match fields for 401k or employer RRSP
  const showEmployerMatchFields = is401k(formData.type) || formData.type === 'employer_rrsp';

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
          className={errors.name ? inputErrorClassName : inputClassName}
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
          className={inputClassName}
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
          <NumberInput
            value={formData.balance}
            onChange={(val) => handleChange('balance', val)}
            min={0}
            defaultValue={0}
            className={errors.balance ? inputErrorClassName : inputClassName}
          />
          {errors.balance && <p className="text-red-500 text-xs mt-1">{errors.balance}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Annual Contribution ($)
          </label>
          <NumberInput
            value={formData.annualContribution}
            onChange={(val) => handleChange('annualContribution', val)}
            min={0}
            defaultValue={0}
            className={errors.annualContribution ? inputErrorClassName : inputClassName}
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
            <Tooltip text="Annual increase in contributions (e.g., salary raises)" />
          </label>
          <NumberInput
            value={formData.contributionGrowthRate}
            onChange={(val) => handleChange('contributionGrowthRate', val)}
            min={0}
            max={20}
            isPercentage
            decimals={1}
            defaultValue={0.03}
            className={inputClassName}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Expected Return (%)
          </label>
          <NumberInput
            value={formData.returnRate}
            onChange={(val) => handleChange('returnRate', val)}
            min={0}
            max={20}
            isPercentage
            decimals={1}
            defaultValue={0.07}
            className={inputClassName}
          />
        </div>
      </div>

      {showEmployerMatchFields && (
        <div className="border-t border-gray-200 dark:border-gray-600 pt-4 mt-4">
          <h4 className="text-sm font-medium text-gray-800 dark:text-gray-200 mb-3">
            {is401k(formData.type) ? '401(k) Employer Match' : 'Employer Match'}
          </h4>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Match Percentage (%)
                <Tooltip text="What percent of your contribution does employer match?" />
              </label>
              <NumberInput
                value={formData.employerMatchPercent || 0}
                onChange={(val) => handleChange('employerMatchPercent', val)}
                min={0}
                max={200}
                isPercentage
                decimals={0}
                defaultValue={0}
                className={inputClassName}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Match Limit ($)
                <Tooltip text="Maximum annual employer match in dollars" />
              </label>
              <NumberInput
                value={formData.employerMatchLimit || 0}
                onChange={(val) => handleChange('employerMatchLimit', val)}
                min={0}
                defaultValue={0}
                className={inputClassName}
              />
            </div>
          </div>
        </div>
      )}

      {/* Withdrawal Settings */}
      <div className="border-t border-gray-200 dark:border-gray-600 pt-4 mt-4">
        <h4 className="text-sm font-medium text-gray-800 dark:text-gray-200 mb-3">
          Withdrawal Settings
        </h4>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Start Withdrawal Age
            <Tooltip text="Age when you plan to start withdrawing from this account. Cannot be later than RMD age if applicable." />
          </label>
          <NumberInput
            value={currentWithdrawalAge}
            onChange={(val) => {
              setFormData(prev => ({
                ...prev,
                withdrawalRules: { startAge: val }
              }));
            }}
            min={minWithdrawalAge}
            max={maxWithdrawalAge}
            defaultValue={currentWithdrawalAge}
            className={inputClassName}
          />
          {showPenaltyWarning && (
            <p className="mt-1 text-sm text-yellow-600 dark:text-yellow-500">
              Warning: Withdrawing before age {Math.ceil(penaltyInfo.penaltyAge)} incurs a {(penaltyInfo.penaltyRate * 100).toFixed(0)}% penalty
            </p>
          )}
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            Default: {getDefaultWithdrawalAge(
              { ...formData, id: account?.id || '' },
              profile.retirementAge,
              fullCountryConfig
            )}
            {maxWithdrawalAge < profile.lifeExpectancy && ` (Max: ${maxWithdrawalAge} due to RMD)`}
          </p>
        </div>
      </div>

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

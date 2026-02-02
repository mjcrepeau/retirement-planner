import { useState } from 'react';
import { Account, Profile, getAccountTypeLabel, getTaxTreatment } from '../types';
import { AccountForm } from './AccountForm';
import { CHART_COLORS } from '../utils/constants';

interface AccountListProps {
  accounts: Account[];
  profile: Profile;
  onAdd: (account: Account) => void;
  onUpdate: (account: Account) => void;
  onDelete: (id: string) => void;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value);
}

function getTaxTreatmentColor(type: Account['type']): string {
  const treatment = getTaxTreatment(type);
  return CHART_COLORS[treatment];
}

export function AccountList({ accounts, profile, onAdd, onUpdate, onDelete }: AccountListProps) {
  const [showForm, setShowForm] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | undefined>();

  const handleSave = (account: Account) => {
    if (editingAccount) {
      onUpdate(account);
    } else {
      onAdd(account);
    }
    setShowForm(false);
    setEditingAccount(undefined);
  };

  const handleEdit = (account: Account) => {
    setEditingAccount(account);
    setShowForm(true);
  };

  const handleCancel = () => {
    setShowForm(false);
    setEditingAccount(undefined);
  };

  const totalBalance = accounts.reduce((sum, acc) => sum + acc.balance, 0);

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center border-b border-gray-200 dark:border-gray-600 pb-2">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          Investment Accounts
        </h3>
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="px-3 py-1.5 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
          >
            + Add Account
          </button>
        )}
      </div>

      {showForm && (
        <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
          <h4 className="text-md font-medium text-gray-800 dark:text-gray-200 mb-3">
            {editingAccount ? 'Edit Account' : 'New Account'}
          </h4>
          <AccountForm
            key={editingAccount?.id ?? 'new'}
            account={editingAccount}
            profile={profile}
            onSave={handleSave}
            onCancel={handleCancel}
          />
        </div>
      )}

      {accounts.length === 0 && !showForm ? (
        <p className="text-gray-500 dark:text-gray-400 text-sm py-4 text-center">
          No accounts added yet. Click "Add Account" to get started.
        </p>
      ) : (
        <div className="space-y-2">
          {accounts.map(account => (
            <div
              key={account.id}
              className="flex items-center justify-between p-3 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg hover:shadow-sm transition-shadow"
            >
              <div className="flex items-center gap-3">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: getTaxTreatmentColor(account.type) }}
                />
                <div>
                  <div className="font-medium text-gray-900 dark:text-white">{account.name}</div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">
                    {getAccountTypeLabel(account.type)}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <div className="text-right">
                  <div className="font-medium text-gray-900 dark:text-white">
                    {formatCurrency(account.balance)}
                  </div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">
                    +{formatCurrency(account.annualContribution)}/yr
                  </div>
                </div>

                <div className="flex gap-1">
                  <button
                    onClick={() => handleEdit(account)}
                    className="p-1.5 text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded"
                    title="Edit"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                  <button
                    onClick={() => onDelete(account.id)}
                    className="p-1.5 text-gray-500 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded"
                    title="Delete"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          ))}

          {accounts.length > 0 && (
            <div className="flex justify-between items-center pt-2 border-t border-gray-200 dark:border-gray-600 mt-2">
              <span className="font-medium text-gray-700 dark:text-gray-300">Total</span>
              <span className="font-semibold text-gray-900 dark:text-white">{formatCurrency(totalBalance)}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

import { useState, useCallback, useEffect, useRef } from 'react';
import { Account, Profile, Assumptions, IncomeStream } from './types';
import { DEFAULT_PROFILE, DEFAULT_ASSUMPTIONS, DEFAULT_INCOME_STREAMS } from './utils/constants';
import { STORAGE_KEYS } from './utils/storageKeys';
import {
  buildScenario,
  downloadJson,
  parseScenario,
  scenarioFilename,
  type ScenarioFile,
} from './utils/export';
import { useRetirementCalc } from './hooks/useRetirementCalc';
import { useLocalStorage, useDarkMode } from './hooks/useLocalStorage';
import { CountryProvider, useCountry } from './contexts/CountryContext';
import { getCountryConfig, type CountryCode } from './countries';
import { getDefaultWithdrawalAge } from './utils/withdrawalDefaults';
import { Layout } from './components/Layout';
import { AccountList } from './components/AccountList';
import { ProfileForm } from './components/ProfileForm';
import { AssumptionsForm } from './components/AssumptionsForm';
import { IncomeStreamList } from './components/IncomeStreamList';
import { SummaryCards } from './components/SummaryCards';
import { ChartAccumulation } from './components/ChartAccumulation';
import { ChartDrawdown } from './components/ChartDrawdown';
import { ChartIncome } from './components/ChartIncome';
import { ChartTax } from './components/ChartTax';
import { ChartComposition } from './components/ChartComposition';
import { MethodologyPanel } from './components/MethodologyPanel';
import { DataTableAccumulation } from './components/DataTableAccumulation';
import { DataTableWithdrawal } from './components/DataTableWithdrawal';
import { PrintReport } from './components/PrintReport';
import { v4 as uuidv4 } from 'uuid';

// Default accounts for US
const createUSDefaultAccounts = (): Account[] => [
  {
    id: uuidv4(),
    name: 'Company 401(k)',
    type: 'traditional_401k',
    balance: 150000,
    annualContribution: 15000,
    contributionGrowthRate: 0.03,
    returnRate: 0.07,
    employerMatchPercent: 0.5,
    employerMatchLimit: 3000,
  },
  {
    id: uuidv4(),
    name: 'Roth IRA',
    type: 'roth_ira',
    balance: 40000,
    annualContribution: 7000,
    contributionGrowthRate: 0,
    returnRate: 0.07,
  },
];

// Default accounts for Canada
const createCADefaultAccounts = (): Account[] => [
  {
    id: uuidv4(),
    name: 'Employer RRSP',
    type: 'employer_rrsp',
    balance: 150000,
    annualContribution: 15000,
    contributionGrowthRate: 0.03,
    returnRate: 0.07,
    employerMatchPercent: 0.5,
    employerMatchLimit: 3000,
  },
  {
    id: uuidv4(),
    name: 'TFSA',
    type: 'tfsa',
    balance: 40000,
    annualContribution: 7000,
    contributionGrowthRate: 0,
    returnRate: 0.07,
  },
];

// Get default accounts based on country
const createDefaultAccounts = (country: CountryCode = 'US'): Account[] => {
  return country === 'CA' ? createCADefaultAccounts() : createUSDefaultAccounts();
};

/**
 * Normalize accounts loaded from localStorage to add withdrawal rules if missing
 * This ensures backwards compatibility with accounts saved before withdrawal rules were added
 */
function normalizeAccount(
  account: Account,
  profile: Profile
): Account {
  // If account already has withdrawal rules, return as-is
  if (account.withdrawalRules) {
    return account;
  }

  // Apply default withdrawal age based on account type and country config
  const countryConfig = getCountryConfig(profile.country);
  const defaultAge = getDefaultWithdrawalAge(account, profile.retirementAge, countryConfig);

  return {
    ...account,
    withdrawalRules: { startAge: defaultAge },
  };
}

type TabType = 'accumulation' | 'retirement' | 'summary' | 'methodology';

// Inner app component that uses the country context
function AppContent() {
  // Country context
  const { country, config: countryConfig } = useCountry();

  // Load profile first (needed for account normalization)
  const [profile, setProfile, resetProfile] = useLocalStorage<Profile>(
    'retirement-planner-profile',
    DEFAULT_PROFILE
  );

  // Use localStorage for accounts with normalization
  const [rawAccounts, setRawAccounts, resetAccounts] = useLocalStorage<Account[]>(
    'retirement-planner-accounts',
    createDefaultAccounts()
  );

  // Normalize accounts to add withdrawal rules if missing (backwards compatibility)
  const accounts = rawAccounts.map(account => normalizeAccount(account, profile));

  // Wrapper for setAccounts that saves normalized accounts
  const setAccounts = useCallback((value: Account[] | ((prev: Account[]) => Account[])) => {
    if (typeof value === 'function') {
      setRawAccounts(prev => {
        const updated = value(prev);
        return updated.map(account => normalizeAccount(account, profile));
      });
    } else {
      setRawAccounts(value.map(account => normalizeAccount(account, profile)));
    }
  }, [setRawAccounts, profile]);

  const [assumptions, setAssumptions, resetAssumptions] = useLocalStorage<Assumptions>(
    'retirement-planner-assumptions',
    DEFAULT_ASSUMPTIONS
  );

  const [incomeStreams, setIncomeStreams, resetIncomeStreams] = useLocalStorage<IncomeStream[]>(
    'retirement-planner-income-streams',
    DEFAULT_INCOME_STREAMS
  );

  // One-time migration: pre-Income-Streams US profiles may have legacy
  // socialSecurityBenefit/socialSecurityStartAge values set (those fields are
  // now CPP-only for Canada). Convert any such legacy US Social Security into
  // an income stream so it isn't double-counted with the default SS stream,
  // then clear the legacy fields from the persisted profile.
  useEffect(() => {
    const isUS = profile.country === 'US' || (profile.country === undefined && country === 'US');
    if (!isUS) return;
    if (!profile.socialSecurityBenefit || profile.socialSecurityBenefit <= 0) return;

    const legacyBenefit = profile.socialSecurityBenefit;
    const legacyStartAge = profile.socialSecurityStartAge ?? 67;

    // Use a functional update so the "does a SS stream already exist?" check
    // sees the latest state, even under React strict-mode double-invocation.
    setIncomeStreams(prev => {
      const hasSocialSecurityStream = prev.some(s => s.taxTreatment === 'social_security');
      if (hasSocialSecurityStream) return prev;
      return [
        ...prev,
        {
          id: uuidv4(),
          name: 'Social Security',
          monthlyAmount: legacyBenefit / 12,
          startAge: legacyStartAge,
          taxTreatment: 'social_security',
        },
      ];
    });

    // Clear the legacy fields so this migration only runs once.
    setProfile(prev => {
      if (prev.socialSecurityBenefit === undefined && prev.socialSecurityStartAge === undefined) {
        return prev;
      }
      const next = { ...prev };
      delete next.socialSecurityBenefit;
      delete next.socialSecurityStartAge;
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile.country, profile.socialSecurityBenefit, profile.socialSecurityStartAge, country]);

  // Dark mode
  const [isDarkMode, toggleDarkMode] = useDarkMode();

  // UI state (not persisted)
  const [activeTab, setActiveTab] = useState<TabType>('summary');
  const [expandedSection, setExpandedSection] = useState<string | null>('accounts');
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [pendingImport, setPendingImport] = useState<ScenarioFile | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [isPrinting, setIsPrinting] = useState(false);
  const printGeneratedAt = useRef(new Date());

  const { accumulation, retirement } = useRetirementCalc(accounts, profile, assumptions, countryConfig, incomeStreams);

  const handleAddAccount = (account: Account) => {
    setAccounts(prev => [...prev, account]);
  };

  const handleUpdateAccount = (updatedAccount: Account) => {
    setAccounts(prev =>
      prev.map(acc => (acc.id === updatedAccount.id ? updatedAccount : acc))
    );
  };

  const handleDeleteAccount = (id: string) => {
    setAccounts(prev => prev.filter(acc => acc.id !== id));
  };

  const handleAddIncomeStream = (stream: IncomeStream) => {
    setIncomeStreams(prev => [...prev, stream]);
  };

  const handleUpdateIncomeStream = (updatedStream: IncomeStream) => {
    setIncomeStreams(prev =>
      prev.map(s => (s.id === updatedStream.id ? updatedStream : s))
    );
  };

  const handleDeleteIncomeStream = (id: string) => {
    setIncomeStreams(prev => prev.filter(s => s.id !== id));
  };

  const toggleSection = (section: string) => {
    setExpandedSection(prev => (prev === section ? null : section));
  };

  const handleReset = useCallback(() => {
    setShowResetConfirm(true);
  }, []);

  const confirmReset = useCallback(() => {
    resetAccounts();
    resetProfile();
    resetAssumptions();
    resetIncomeStreams();
    setShowResetConfirm(false);
    // Force reload to get fresh default accounts with new UUIDs
    window.location.reload();
  }, [resetAccounts, resetProfile, resetAssumptions, resetIncomeStreams]);

  const cancelReset = useCallback(() => {
    setShowResetConfirm(false);
  }, []);

  // --- Save / load plan ---------------------------------------------------

  const handleSavePlan = useCallback(() => {
    const now = new Date();
    const scenario = buildScenario(
      {
        country,
        profile: { ...profile, country },
        accounts,
        incomeStreams,
        assumptions,
      },
      now
    );
    downloadJson(scenarioFilename(now), JSON.stringify(scenario, null, 2));
  }, [country, profile, accounts, incomeStreams, assumptions]);

  const handleLoadPlanFile = useCallback(async (file: File) => {
    let text: string;
    try {
      text = await file.text();
    } catch {
      setPendingImport(null);
      setImportError('That file could not be read.');
      return;
    }

    const result = parseScenario(text);
    if (result.ok) {
      setImportError(null);
      setPendingImport(result.scenario);
    } else {
      setPendingImport(null);
      setImportError(result.error);
    }
  }, []);

  const confirmImport = useCallback(() => {
    if (!pendingImport) return;

    // Write the whole persisted state at once, then reload. This is the same
    // approach country switching uses: it guarantees every provider and hook
    // re-initializes from the new data (including account normalization and
    // the country config) rather than trying to sync state in place.
    localStorage.setItem(STORAGE_KEYS.country, pendingImport.country);
    localStorage.setItem(STORAGE_KEYS.profile, JSON.stringify(pendingImport.profile));
    localStorage.setItem(STORAGE_KEYS.accounts, JSON.stringify(pendingImport.accounts));
    localStorage.setItem(
      STORAGE_KEYS.incomeStreams,
      JSON.stringify(pendingImport.incomeStreams)
    );
    localStorage.setItem(
      STORAGE_KEYS.assumptions,
      JSON.stringify(pendingImport.assumptions)
    );

    window.location.reload();
  }, [pendingImport]);

  const cancelImport = useCallback(() => {
    setPendingImport(null);
    setImportError(null);
  }, []);

  // --- Print report -------------------------------------------------------

  const handlePrintReport = useCallback(() => {
    printGeneratedAt.current = new Date();
    setIsPrinting(true);
  }, []);

  // Mount the report, let Recharts measure and draw it, then open the print
  // dialog. Dark mode is stripped for the duration so the report prints on
  // white instead of burning a page of dark backgrounds.
  useEffect(() => {
    if (!isPrinting) return;

    const root = document.documentElement;
    const wasDark = root.classList.contains('dark');
    const restoreDarkMode = () => {
      if (wasDark) root.classList.add('dark');
    };
    if (wasDark) root.classList.remove('dark');

    const timer = window.setTimeout(() => {
      try {
        window.print();
      } finally {
        restoreDarkMode();
        setIsPrinting(false);
      }
    }, 400);

    return () => {
      window.clearTimeout(timer);
      restoreDarkMode();
    };
  }, [isPrinting]);

  const exportActions = {
    onSavePlan: handleSavePlan,
    onLoadPlanFile: handleLoadPlanFile,
    onPrintReport: handlePrintReport,
  };

  const tabs: { id: TabType; label: string }[] = [
    { id: 'summary', label: 'Summary' },
    { id: 'accumulation', label: 'Accumulation Phase' },
    { id: 'retirement', label: 'Retirement Phase' },
    { id: 'methodology', label: 'Methodology' },
  ];

  return (
    <>
    <Layout
      isDarkMode={isDarkMode}
      onToggleDarkMode={toggleDarkMode}
      onReset={handleReset}
      exportActions={exportActions}
    >
      {/* Import Confirmation Modal */}
      {pendingImport && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 max-w-md mx-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              Load this plan?
            </h3>
            <p className="text-gray-600 dark:text-gray-300 mb-3">
              This will replace your current accounts, profile, income streams, and
              assumptions. This action cannot be undone.
            </p>
            <dl className="text-sm bg-gray-50 dark:bg-gray-900 rounded-md p-3 mb-4 space-y-1">
              <div className="flex justify-between gap-4">
                <dt className="text-gray-500 dark:text-gray-400">Country</dt>
                <dd className="text-gray-900 dark:text-white font-medium">
                  {pendingImport.country === 'CA' ? 'Canada' : 'United States'}
                  {pendingImport.country !== country && (
                    <span className="text-amber-600 dark:text-amber-400"> (switching)</span>
                  )}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-gray-500 dark:text-gray-400">Accounts</dt>
                <dd className="text-gray-900 dark:text-white font-medium">
                  {pendingImport.accounts.length}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-gray-500 dark:text-gray-400">Income streams</dt>
                <dd className="text-gray-900 dark:text-white font-medium">
                  {pendingImport.incomeStreams.length}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-gray-500 dark:text-gray-400">Ages</dt>
                <dd className="text-gray-900 dark:text-white font-medium">
                  {pendingImport.profile.currentAge} → {pendingImport.profile.retirementAge}{' '}
                  → {pendingImport.profile.lifeExpectancy}
                </dd>
              </div>
              {pendingImport.exportedAt && (
                <div className="flex justify-between gap-4">
                  <dt className="text-gray-500 dark:text-gray-400">Saved</dt>
                  <dd className="text-gray-900 dark:text-white font-medium">
                    {pendingImport.exportedAt.slice(0, 10)}
                  </dd>
                </div>
              )}
            </dl>
            <div className="flex justify-end gap-3">
              <button
                onClick={cancelImport}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600"
              >
                Cancel
              </button>
              <button
                onClick={confirmImport}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
              >
                Load Plan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Import Error Modal */}
      {importError && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 max-w-md mx-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              Couldn't load that file
            </h3>
            <p className="text-gray-600 dark:text-gray-300 mb-4">{importError}</p>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
              Your current plan has not been changed.
            </p>
            <div className="flex justify-end">
              <button
                onClick={cancelImport}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reset Confirmation Modal */}
      {showResetConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 max-w-md mx-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              Reset All Data?
            </h3>
            <p className="text-gray-600 dark:text-gray-300 mb-4">
              This will clear all your saved accounts, profile settings, income streams, and assumptions.
              This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={cancelReset}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600"
              >
                Cancel
              </button>
              <button
                onClick={confirmReset}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700"
              >
                Reset Everything
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Panel - Inputs */}
        <div className="lg:col-span-1 space-y-4">
          {/* Accounts Section */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
            <button
              onClick={() => toggleSection('accounts')}
              className="w-full px-4 py-3 flex justify-between items-center hover:bg-gray-50 dark:hover:bg-gray-700 rounded-t-lg"
            >
              <span className="font-medium text-gray-900 dark:text-white">Investment Accounts</span>
              <svg
                className={`w-5 h-5 text-gray-500 dark:text-gray-400 transition-transform ${
                  expandedSection === 'accounts' ? 'rotate-180' : ''
                }`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {expandedSection === 'accounts' && (
              <div className="px-4 pb-4">
                <AccountList
                  accounts={accounts}
                  profile={profile}
                  countryConfig={countryConfig}
                  onAdd={handleAddAccount}
                  onUpdate={handleUpdateAccount}
                  onDelete={handleDeleteAccount}
                />
              </div>
            )}
          </div>

          {/* Profile Section */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
            <button
              onClick={() => toggleSection('profile')}
              className="w-full px-4 py-3 flex justify-between items-center hover:bg-gray-50 dark:hover:bg-gray-700 rounded-t-lg"
            >
              <span className="font-medium text-gray-900 dark:text-white">Personal Profile</span>
              <svg
                className={`w-5 h-5 text-gray-500 dark:text-gray-400 transition-transform ${
                  expandedSection === 'profile' ? 'rotate-180' : ''
                }`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {expandedSection === 'profile' && (
              <div className="px-4 pb-4">
                <ProfileForm profile={profile} onChange={setProfile} />
              </div>
            )}
          </div>

          {/* Income Streams Section */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
            <button
              onClick={() => toggleSection('incomeStreams')}
              className="w-full px-4 py-3 flex justify-between items-center hover:bg-gray-50 dark:hover:bg-gray-700 rounded-t-lg"
            >
              <span className="font-medium text-gray-900 dark:text-white">Income Streams</span>
              <svg
                className={`w-5 h-5 text-gray-500 dark:text-gray-400 transition-transform ${
                  expandedSection === 'incomeStreams' ? 'rotate-180' : ''
                }`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {expandedSection === 'incomeStreams' && (
              <div className="px-4 pb-4">
                <IncomeStreamList
                  incomeStreams={incomeStreams}
                  onAdd={handleAddIncomeStream}
                  onUpdate={handleUpdateIncomeStream}
                  onDelete={handleDeleteIncomeStream}
                />
              </div>
            )}
          </div>

          {/* Assumptions Section */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
            <button
              onClick={() => toggleSection('assumptions')}
              className="w-full px-4 py-3 flex justify-between items-center hover:bg-gray-50 dark:hover:bg-gray-700 rounded-t-lg"
            >
              <span className="font-medium text-gray-900 dark:text-white">Economic Assumptions</span>
              <svg
                className={`w-5 h-5 text-gray-500 dark:text-gray-400 transition-transform ${
                  expandedSection === 'assumptions' ? 'rotate-180' : ''
                }`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {expandedSection === 'assumptions' && (
              <div className="px-4 pb-4">
                <AssumptionsForm assumptions={assumptions} onChange={setAssumptions} />
              </div>
            )}
          </div>
        </div>

        {/* Right Panel - Charts and Results */}
        <div className="lg:col-span-2 space-y-6">
          {accounts.length === 0 ? (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-8 text-center">
              <svg
                className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                />
              </svg>
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No Accounts Added</h3>
              <p className="text-gray-500 dark:text-gray-400">
                Add investment accounts to see your retirement projections.
              </p>
            </div>
          ) : (
            <>
              {/* Tab Navigation */}
              <div className="border-b border-gray-200 dark:border-gray-700">
                <nav className="flex space-x-8 overflow-x-auto scrollbar-hide">
                  {tabs.map(tab => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`py-4 px-1 border-b-2 font-medium text-sm whitespace-nowrap ${
                        activeTab === tab.id
                          ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                          : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </nav>
              </div>

              {/* Summary Tab */}
              {activeTab === 'summary' && (
                <div className="space-y-6">
                  <SummaryCards
                    profile={profile}
                    assumptions={assumptions}
                    accumulationResult={accumulation}
                    retirementResult={retirement}
                  />

                  <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                      Portfolio Composition at Retirement
                    </h3>
                    <ChartComposition accounts={accounts} result={accumulation} isDarkMode={isDarkMode} />
                  </div>
                </div>
              )}

              {/* Accumulation Tab */}
              {activeTab === 'accumulation' && (
                <div className="space-y-6">
                  <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                      Account Growth (Age {profile.currentAge} to {profile.retirementAge})
                    </h3>
                    <ChartAccumulation accounts={accounts} result={accumulation} isDarkMode={isDarkMode} />
                  </div>

                  <DataTableAccumulation
                    accounts={accounts}
                    result={accumulation}
                    profile={profile}
                    assumptions={assumptions}
                  />

                  <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                      Portfolio Composition at Retirement
                    </h3>
                    <ChartComposition accounts={accounts} result={accumulation} isDarkMode={isDarkMode} />
                  </div>
                </div>
              )}

              {/* Retirement Tab */}
              {activeTab === 'retirement' && (
                <div className="space-y-6">
                  <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                      Portfolio Drawdown (Age {profile.retirementAge} to {profile.lifeExpectancy})
                    </h3>
                    <ChartDrawdown accounts={accounts} result={retirement} isDarkMode={isDarkMode} />
                  </div>

                  <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                      Annual Retirement Income
                    </h3>
                    <ChartIncome result={retirement} incomeStreams={incomeStreams} isDarkMode={isDarkMode} />
                  </div>

                  <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                      Tax Burden Over Time
                    </h3>
                    <ChartTax result={retirement} isDarkMode={isDarkMode} />
                  </div>

                  <DataTableWithdrawal
                    accounts={accounts}
                    result={retirement}
                    incomeStreams={incomeStreams}
                    profile={profile}
                    assumptions={assumptions}
                  />
                </div>
              )}

              {/* Methodology Tab */}
              {activeTab === 'methodology' && (
                <MethodologyPanel profile={profile} assumptions={assumptions} />
              )}
            </>
          )}
        </div>
      </div>
    </Layout>

    {isPrinting && accounts.length > 0 && (
      <PrintReport
        accounts={accounts}
        profile={profile}
        assumptions={assumptions}
        incomeStreams={incomeStreams}
        accumulation={accumulation}
        retirement={retirement}
        country={country}
        generatedAt={printGeneratedAt.current}
      />
    )}
    </>
  );
}

// Wrapper component that provides the CountryProvider with reset callback
function App() {
  const handleCountryChange = useCallback((newCountry: CountryCode) => {
    // Reset to country-specific defaults
    const countryConfig = getCountryConfig(newCountry);
    const defaultProfile = countryConfig.getDefaultProfile();

    // Clear localStorage and set new defaults
    localStorage.setItem(STORAGE_KEYS.accounts, JSON.stringify(createDefaultAccounts(newCountry)));
    localStorage.setItem(STORAGE_KEYS.profile, JSON.stringify({
      ...DEFAULT_PROFILE,
      ...defaultProfile,
      country: newCountry,
    }));

    // Reset income streams — default SS for US, empty for Canada
    localStorage.setItem(STORAGE_KEYS.incomeStreams,
      JSON.stringify(newCountry === 'US' ? DEFAULT_INCOME_STREAMS : [])
    );

    // Force reload to reinitialize with new country defaults
    window.location.reload();
  }, []);

  return (
    <CountryProvider initialCountry="US" onCountryChange={handleCountryChange}>
      <AppContent />
    </CountryProvider>
  );
}

export default App;

/**
 * localStorage keys used to persist app state.
 *
 * Centralized so that features which write the whole persisted state at once
 * (scenario import, country switching) stay in sync with the individual
 * `useLocalStorage` call sites.
 */
export const STORAGE_KEYS = {
  accounts: 'retirement-planner-accounts',
  profile: 'retirement-planner-profile',
  assumptions: 'retirement-planner-assumptions',
  incomeStreams: 'retirement-planner-income-streams',
  country: 'retirement-planner-country',
} as const;

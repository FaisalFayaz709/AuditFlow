import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { AuthMembership, CurrentUser } from '../../types/api';
import { apiClient, ApiClientError } from '../../lib/api-client';

type CompanyContextValue = {
  currentUser: CurrentUser | null;
  memberships: AuthMembership[];
  activeCompanyId: string;
  activeMembership: AuthMembership | null;
  csrfToken: string | null;
  loadingUser: boolean;
  userError: string | null;
  setActiveCompanyId: (companyId: string) => void;
  refreshUser: () => Promise<void>;
  setCsrfToken: (token: string | null) => void;
};

const CompanyContext = createContext<CompanyContextValue | null>(null);
const ACTIVE_COMPANY_KEY = 'auditflow.activeCompanyId';
const CSRF_TOKEN_KEY = 'auditflow.csrfToken';

function readStored(key: string): string {
  if (typeof window === 'undefined') return '';
  return window.localStorage.getItem(key) ?? '';
}

function writeStored(key: string, value: string | null): void {
  if (typeof window === 'undefined') return;
  if (!value) {
    window.localStorage.removeItem(key);
    return;
  }
  window.localStorage.setItem(key, value);
}

export function CompanyProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [activeCompanyId, setActiveCompanyIdState] = useState(() => readStored(ACTIVE_COMPANY_KEY));
  const [csrfToken, setCsrfTokenState] = useState<string | null>(() => readStored(CSRF_TOKEN_KEY) || null);
  const [loadingUser, setLoadingUser] = useState(true);
  const [userError, setUserError] = useState<string | null>(null);

  async function refreshUser() {
    setLoadingUser(true);
    setUserError(null);
    try {
      const me = await apiClient.get<CurrentUser>('/api/auth/me');
      setCurrentUser(me);
      const activeStillValid = me.memberships.some((membership) => membership.companyId === activeCompanyId);
      if (!activeCompanyId || !activeStillValid) {
        const first = me.memberships.find((membership) => membership.status === 'ACTIVE') ?? me.memberships[0];
        if (first) {
          setActiveCompanyIdState(first.companyId);
          writeStored(ACTIVE_COMPANY_KEY, first.companyId);
        }
      }
    } catch (error) {
      setCurrentUser(null);
      if (error instanceof ApiClientError && error.status === 401) {
        setUserError(null);
      } else {
        setUserError(error instanceof Error ? error.message : 'Unable to load current user.');
      }
    } finally {
      setLoadingUser(false);
    }
  }

  function setActiveCompanyId(companyId: string) {
    setActiveCompanyIdState(companyId);
    writeStored(ACTIVE_COMPANY_KEY, companyId);
  }

  function setCsrfToken(token: string | null) {
    setCsrfTokenState(token);
    writeStored(CSRF_TOKEN_KEY, token);
  }

  useEffect(() => {
    void refreshUser();
    // Load once on boot. Login/register pages call refreshUser after successful auth.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const memberships = currentUser?.memberships ?? [];
  const activeMembership = memberships.find((membership) => membership.companyId === activeCompanyId) ?? null;

  const value = useMemo<CompanyContextValue>(
    () => ({
      currentUser,
      memberships,
      activeCompanyId,
      activeMembership,
      csrfToken,
      loadingUser,
      userError,
      setActiveCompanyId,
      refreshUser,
      setCsrfToken,
    }),
    [activeCompanyId, activeMembership, csrfToken, currentUser, loadingUser, memberships, userError],
  );

  return <CompanyContext.Provider value={value}>{children}</CompanyContext.Provider>;
}

export function useCompanyContext() {
  const value = useContext(CompanyContext);
  if (!value) {
    throw new Error('useCompanyContext must be used inside CompanyProvider');
  }
  return value;
}

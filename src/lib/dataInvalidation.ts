export type DataDomain =
  | 'announcements'
  | 'assignees'
  | 'branding'
  | 'locations'
  | 'permissions'
  | 'users';

type DataInvalidationDetail = {
  domains: DataDomain[];
  at: number;
};

type NavigationDetail = {
  path: string;
  at: number;
};

const DATA_INVALIDATED_EVENT = 'app:data-invalidated';
const NAVIGATION_EVENT = 'app:navigation';

function isBrowser() {
  return typeof window !== 'undefined';
}

function normalizeDomains(domains: DataDomain | DataDomain[]): DataDomain[] {
  const list = Array.isArray(domains) ? domains : [domains];
  return Array.from(new Set(list));
}

export function invalidateData(domains: DataDomain | DataDomain[]) {
  if (!isBrowser()) return;
  const normalized = normalizeDomains(domains);
  if (normalized.length === 0) return;

  window.dispatchEvent(
    new CustomEvent<DataInvalidationDetail>(DATA_INVALIDATED_EVENT, {
      detail: { domains: normalized, at: Date.now() },
    })
  );
}

export function onDataInvalidated(
  domains: DataDomain | DataDomain[],
  handler: (detail: DataInvalidationDetail) => void
) {
  if (!isBrowser()) return () => {};
  const wanted = new Set(normalizeDomains(domains));

  const listener: EventListener = (event) => {
    const detail = (event as CustomEvent<DataInvalidationDetail>).detail;
    if (!detail?.domains?.length) return;
    if (detail.domains.some((domain) => wanted.has(domain))) {
      handler(detail);
    }
  };

  window.addEventListener(DATA_INVALIDATED_EVENT, listener);
  return () => window.removeEventListener(DATA_INVALIDATED_EVENT, listener);
}

export function notifyNavigation(path: string) {
  if (!isBrowser()) return;

  window.dispatchEvent(
    new CustomEvent<NavigationDetail>(NAVIGATION_EVENT, {
      detail: { path, at: Date.now() },
    })
  );
}

export function onNavigation(handler: (detail: NavigationDetail) => void) {
  if (!isBrowser()) return () => {};

  const listener: EventListener = (event) => {
    const detail = (event as CustomEvent<NavigationDetail>).detail;
    if (!detail?.path) return;
    handler(detail);
  };

  window.addEventListener(NAVIGATION_EVENT, listener);
  return () => window.removeEventListener(NAVIGATION_EVENT, listener);
}

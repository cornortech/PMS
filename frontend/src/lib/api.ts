// =====================================================================
// 🔌 One place that talks to the backend.
// - Adds the login token to every request automatically
// - Turns every reply into { ok, status, data, message }
// - Tells the app when the login has expired
// =====================================================================

export const API_BASE = (import.meta.env.VITE_API_URL || 'https://pharmacy-management-system-ni9u.onrender.com').replace(/\/+$/, '');

const KEYS = {
  pharmacyToken: 'authToken',
  staffToken: 'staffToken',
  user: 'user',
  staff: 'staff',
};

export type PharmacyUser = {
  _id: string;
  id: string;
  pharmacyName: string;
  phone?: string;
  email?: string;
  location?: string;
  PanOrVat?: string;
  isAdmin?: boolean;
  isActive?: boolean;
  totalTime?: number;
  remainingTime?: number | null;
};
export type StaffUser = { id: string; staffName?: string; role: string };

const read = (k: string) => {
  try { return localStorage.getItem(k); } catch { return null; }
};
const write = (k: string, v: string | null) => {
  try { v === null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch { /* private mode */ }
};

export const session = {
  pharmacyToken: () => read(KEYS.pharmacyToken),
  staffToken: () => read(KEYS.staffToken),
  user: (): PharmacyUser | null => {
    try { return JSON.parse(read(KEYS.user) || 'null'); } catch { return null; }
  },
  staff: (): StaffUser | null => {
    try { return JSON.parse(read(KEYS.staff) || 'null'); } catch { return null; }
  },
  setPharmacy(token: string, user: PharmacyUser) {
    write(KEYS.pharmacyToken, token);
    write(KEYS.user, JSON.stringify(user));
  },
  setUser(user: PharmacyUser) { write(KEYS.user, JSON.stringify(user)); },
  setStaff(token: string, staff: StaffUser) {
    write(KEYS.staffToken, token);
    write(KEYS.staff, JSON.stringify(staff));
  },
  clearStaff() { write(KEYS.staffToken, null); write(KEYS.staff, null); },
  clearAll() {
    for (const k of Object.values(KEYS)) write(k, null);
    // old keys from the previous version
    for (const k of ['staffRole', 'staffId', 'staffPharmacyName', 'pharmacyUser', 'staffPharmacy']) write(k, null);
  },
};

export type ApiResult<T = any> = { ok: boolean; status: number; data: T; message: string; body: any };

// The staff token is used when a staff member is signed in, otherwise the pharmacy token
const currentToken = () => session.staffToken() || session.pharmacyToken();

export async function api<T = any>(
  path: string,
  options: { method?: string; body?: unknown; token?: string | null; signal?: AbortSignal } = {}
): Promise<ApiResult<T>> {
  const token = options.token === undefined ? currentToken() : options.token;
  let res: Response;
  try {
    res = await fetch(`${API_BASE}/api${path}`, {
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: options.signal,
    });
  } catch (e: any) {
    if (e?.name === 'AbortError') throw e;
    return { ok: false, status: 0, data: null as T, body: null, message: 'Cannot reach the server. Check your internet and try again.' };
  }

  let body: any = null;
  try { body = await res.json(); } catch { /* empty reply */ }

  // Login expired / account blocked → let the app log out cleanly
  if ((res.status === 401 || (res.status === 403 && body?.code === 'SUBSCRIPTION_EXPIRED')) && !path.startsWith('/auth/login') && !path.startsWith('/auth/admin-otp') && !path.startsWith('/staff/login')) {
    window.dispatchEvent(new CustomEvent('argya:session', { detail: { status: res.status, code: body?.code, message: body?.message } }));
  }

  return {
    ok: res.ok && body?.success !== false,
    status: res.status,
    data: (body?.data ?? body) as T,
    body,
    message: body?.message || (res.ok ? '' : `Request failed (${res.status}).`),
  };
}

// The old Patient / EMR screens call fetch() directly with full URLs.
// This adds the login token to those calls too, so they keep working securely.
export function installAuthFetch() {
  const original = window.fetch.bind(window);
  if ((window as any).__argyaFetch) return;
  (window as any).__argyaFetch = true;
  window.fetch = (input: RequestInfo | URL, init: RequestInit = {}) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    if (url.startsWith(API_BASE)) {
      const headers = new Headers(init.headers || (typeof input !== 'string' && !(input instanceof URL) ? input.headers : undefined));
      const token = currentToken();
      if (token && !headers.has('Authorization')) headers.set('Authorization', `Bearer ${token}`);
      if (!headers.has('Content-Type') && typeof init.body === 'string') headers.set('Content-Type', 'application/json'); // never for file uploads (FormData)
      return original(input, { ...init, headers });
    }
    return original(input, init);
  };
}

// A random id so the same bill is never saved twice (double click / slow internet)
export const requestId = () =>
  (crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`).replace(/[^A-Za-z0-9_-]/g, '').slice(0, 40);

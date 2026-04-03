const BASE = '/api';

/** Get stored auth token (JWT or API Key) */
function getAuthToken(): string | null {
  return localStorage.getItem('auth_token');
}

/** Get stored API key */
function getApiKey(): string | null {
  return localStorage.getItem('api_key');
}

/** Build common headers including auth if available */
function buildHeaders(): Record<string, string> {
  const headers: Record<string, string> = {};
  const token = getAuthToken();
  const apiKey = getApiKey();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  if (apiKey) {
    headers['X-API-Key'] = apiKey;
  }
  return headers;
}

async function throwIfBadResponse(res: Response): Promise<void> {
  if (res.ok) return;
  if (res.status === 401) {
    setAuthToken(null);
    const text = await res.text().catch(() => '');
    throw new Error(
      text ? `登录已失效 (${res.status}): ${text}` : '登录已失效，请重新登录',
    );
  }
  const text = await res.text().catch(() => res.statusText);
  throw new Error(`API ${res.status}: ${text}`);
}

export async function apiGet<T>(url: string): Promise<T> {
  const res = await fetch(`${BASE}${url}`, {
    headers: buildHeaders(),
  });
  await throwIfBadResponse(res);
  return res.json();
}

export async function apiPost<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE}${url}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...buildHeaders() },
    body: JSON.stringify(body),
  });
  await throwIfBadResponse(res);
  return res.json();
}

export async function apiPut<T>(url: string, body: unknown = {}): Promise<T> {
  const res = await fetch(`${BASE}${url}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...buildHeaders() },
    body: JSON.stringify(body),
  });
  await throwIfBadResponse(res);
  return res.json();
}

export async function apiDelete(url: string): Promise<void> {
  const res = await fetch(`${BASE}${url}`, {
    method: 'DELETE',
    headers: buildHeaders(),
  });
  await throwIfBadResponse(res);
}

export async function apiPatch<T>(url: string, body: unknown = {}): Promise<T> {
  const res = await fetch(`${BASE}${url}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...buildHeaders() },
    body: JSON.stringify(body),
  });
  await throwIfBadResponse(res);
  return res.json();
}

/** Save auth token to localStorage */
export function setAuthToken(token: string | null) {
  if (token) {
    localStorage.setItem('auth_token', token);
  } else {
    localStorage.removeItem('auth_token');
  }
}

/** Save API key to localStorage */
export function setApiKey(key: string | null) {
  if (key) {
    localStorage.setItem('api_key', key);
  } else {
    localStorage.removeItem('api_key');
  }
}

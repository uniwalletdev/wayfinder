const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

let authToken: string | null = localStorage.getItem('wayfinder_token');

export function setToken(token: string) {
  authToken = token;
  localStorage.setItem('wayfinder_token', token);
}

export function clearToken() {
  authToken = null;
  localStorage.removeItem('wayfinder_token');
}

export function getToken() {
  return authToken;
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (authToken) headers['Authorization'] = `Bearer ${authToken}`;
  const res = await fetch(`${BASE_URL}${path}`, { headers, ...options });
  if (res.status === 401) {
    clearToken();
    window.location.href = '/login';
    throw new Error('Unauthorised');
  }
  if (!res.ok) throw new Error(`API error ${res.status}`);
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'POST', body: JSON.stringify(body) }),
  patch: <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'PATCH', body: JSON.stringify(body) }),
  delete: (path: string) => request<void>(path, { method: 'DELETE' }),
};

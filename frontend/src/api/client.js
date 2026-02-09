import { getApiKey, getApiBaseUrl } from '../lib/storage';

function getHeaders() {
  const key = getApiKey();
  const headers = { 'Content-Type': 'application/json' };
  if (key) headers['X-API-Key'] = key;
  return headers;
}

export async function apiRequest(path, options = {}) {
  const base = getApiBaseUrl().replace(/\/$/, '');
  const url = path.startsWith('http') ? path : `${base}${path.startsWith('/') ? path : '/' + path}`;
  const res = await fetch(url, {
    ...options,
    headers: { ...getHeaders(), ...options.headers },
  });
  if (res.status === 401) {
    const err = new Error('Invalid or missing API key');
    err.status = 401;
    throw err;
  }
  if (!res.ok) {
    const text = await res.text();
    let detail = text;
    try {
      const j = JSON.parse(text);
      detail = j.detail || text;
    } catch (_) {}
    const err = new Error(detail);
    err.status = res.status;
    throw err;
  }
  if (res.status === 204) return null;
  return res.json();
}

export const api = {
  get: (path) => apiRequest(path, { method: 'GET' }),
  post: (path, body) => apiRequest(path, { method: 'POST', body: body ? JSON.stringify(body) : undefined }),
  put: (path, body) => apiRequest(path, { method: 'PUT', body: body ? JSON.stringify(body) : undefined }),
  patch: (path, body) => apiRequest(path, { method: 'PATCH', body: body ? JSON.stringify(body) : undefined }),
  delete: (path) => apiRequest(path, { method: 'DELETE' }),
};

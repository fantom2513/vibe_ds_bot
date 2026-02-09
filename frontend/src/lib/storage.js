const API_KEY_STORAGE = 'voice_bot_api_key';
const API_BASE_URL_STORAGE = 'voice_bot_api_base_url';

export function getApiKey() {
  return localStorage.getItem(API_KEY_STORAGE) || '';
}

export function setApiKey(value) {
  if (value) localStorage.setItem(API_KEY_STORAGE, value);
  else localStorage.removeItem(API_KEY_STORAGE);
}

export function getApiBaseUrl() {
  const fromEnv = import.meta.env.VITE_API_BASE_URL;
  return localStorage.getItem(API_BASE_URL_STORAGE) || fromEnv || 'http://localhost:8000';
}

export function setApiBaseUrl(value) {
  if (value) localStorage.setItem(API_BASE_URL_STORAGE, value);
  else localStorage.removeItem(API_BASE_URL_STORAGE);
}

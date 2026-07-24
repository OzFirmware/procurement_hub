import { CFG } from './config.js';
import { getToken } from './auth.js';

export class ApiError extends Error {}

export async function api(action, payload = {}) {
  if (!CFG.APP_URL) throw new ApiError('APP_URL not configured — edit src/config.js');
  const token = getToken();
  if (!token) throw new ApiError('SIGNED_OUT');
  // No Content-Type header: keeps this a "simple request" (no CORS preflight,
  // which Apps Script cannot answer).
  const res = await fetch(CFG.APP_URL, {
    method: 'POST',
    body: JSON.stringify({ action, token, ...payload })
  });
  if (!res.ok) throw new ApiError('HTTP ' + res.status);
  const data = await res.json();
  if (!data.ok) throw new ApiError(data.error || 'Request failed');
  return data;
}

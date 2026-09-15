import { ERROR_MESSAGE } from './core.js';
let queue = Promise.resolve();
export function api(action, data) {
  const next = queue.then(() => request(action, data)).catch(error => {
    if (typeof error.code === 'string') throw error;
    throw new Error(ERROR_MESSAGE);
  });
  queue = next.catch(() => {});
  return next;
}
async function request(action, data) {
  const response = await fetch('/api/portal', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, data }), signal: AbortSignal.timeout(40000) });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || !result.ok) {
    const error = new Error(result.code === 'LOGIN_FAILED' ? 'Check your username and password.' : ERROR_MESSAGE);
    error.code = result.code;
    throw error;
  }
  return result.data;
}

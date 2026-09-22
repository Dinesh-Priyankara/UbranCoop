import { calculateReceipt, calculateAccounts, dateValue } from '../../src/core.js';
import { hasGoogleSheetsConfig, writeGoogleSheets } from './google-sheets.js';

const json = (body, status, cookies = []) => {
  const headers = new Headers({ 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'" });
  cookies.forEach(c => headers.append('Set-Cookie', c));
  return new Response(JSON.stringify(body), { status, headers });
};
const fail = (code, status, cookies) => json({ ok: false, code }, status, cookies);
const safeText = value => typeof value === 'string'
  ? value.replace(/-----BEGIN[\s\S]*?-----END[^-]*-----/g, '[redacted]').replace(/eyJ[A-Za-z0-9._-]{40,}/g, '[redacted]').slice(0, 300)
  : undefined;
function logServerError(error, action) {
  const details = error?.details || {};
  console.error(JSON.stringify({
    event: 'portal_backend_error',
    action: typeof action === 'string' ? action.slice(0, 64) : 'unknown',
    code: error?.code || error?.message || 'UNEXPECTED',
    stage: error?.stage || 'portal',
    httpStatus: details.httpStatus,
    upstreamCode: safeText(details.upstreamCode),
    upstreamReason: safeText(details.upstreamReason),
    upstreamMessage: safeText(details.upstreamMessage),
    reason: safeText(details.reason),
    format: safeText(details.format),
    errorName: safeText(details.errorName)
  }));
}
function cookie(name, value, age, secure) {
  return `${name}=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${age}${secure ? '; Secure' : ''}`;
}
async function supabase(env, path, options = {}) {
  const res = await fetch(`${env.SUPABASE_URL}/auth/v1/${path}`, { ...options, headers: { apikey: env.SUPABASE_PUBLISHABLE_KEY, 'Content-Type': 'application/json', ...options.headers }, signal: AbortSignal.timeout(12000) });
  const value = await res.json();
  if (!res.ok) throw new Error('AUTH');
  return value;
}
function sessionCookies(session, secure) {
  return [cookie('uc_access', session.access_token, session.expires_in ?? 3600, secure), cookie('uc_refresh', session.refresh_token, 604800, secure)];
}
export async function sheets(env, action, data, user) {
  return writeGoogleSheets(env, action, data, user);
}
export async function onRequest({ request, env }) {
  if (request.method !== 'POST') return fail('METHOD', 405);
  const url = new URL(request.url);
  if (request.headers.get('Origin') !== url.origin || request.headers.get('Sec-Fetch-Site') === 'cross-site') return fail('ORIGIN', 403);
  if (!request.headers.get('Content-Type')?.startsWith('application/json')) return fail('CONTENT_TYPE', 415);
  let cookies = [];
  let requestedAction = 'unknown';
  const secure = url.protocol === 'https:';
  const clear = () => ['uc_access', 'uc_refresh'].map(name => cookie(name, '', 0, secure));
  try {
    const raw = await request.text();
    if (raw.length > 100000) return fail('TOO_LARGE', 413);
    const { action, data = {} } = JSON.parse(raw);
    requestedAction = action;
    if (!env.SUPABASE_URL || !env.SUPABASE_PUBLISHABLE_KEY || !env.AUTH_EMAIL_DOMAIN) return fail('CONFIGURATION', 503);
    const saved = Object.fromEntries((request.headers.get('Cookie') || '').split(';').filter(v => v.includes('=')).map(v => { const i = v.indexOf('='); return [v.slice(0, i).trim(), decodeURIComponent(v.slice(i + 1))]; }));
    if (action === 'login') {
      if (!/^[a-z0-9._-]{1,64}$/i.test(data.username) || typeof data.password !== 'string' || data.password.length > 256) return fail('LOGIN_FAILED', 401);
      try {
        const session = await supabase(env, 'token?grant_type=password', { method: 'POST', body: JSON.stringify({ email: `${data.username.toLowerCase()}@${env.AUTH_EMAIL_DOMAIN}`, password: data.password }) });
        if (session.user?.app_metadata?.staff !== true) return fail('LOGIN_FAILED', 401, clear());
        return json({ ok: true, data: { username: data.username.toLowerCase() } }, 200, sessionCookies(session, secure));
      } catch { return fail('LOGIN_FAILED', 401, clear()); }
    }
    let token = saved.uc_access;
    let user;
    try {
      if (!token) throw new Error('AUTH');
      user = await supabase(env, 'user', { headers: { Authorization: `Bearer ${token}` } });
    } catch {
      if (!saved.uc_refresh) return fail('UNAUTHORIZED', 401, clear());
      try {
        const session = await supabase(env, 'token?grant_type=refresh_token', { method: 'POST', body: JSON.stringify({ refresh_token: saved.uc_refresh }) });
        token = session.access_token;
        user = session.user;
        cookies = sessionCookies(session, secure);
      } catch { return fail('UNAUTHORIZED', 401, clear()); }
    }
    if (user?.app_metadata?.staff !== true) return fail('UNAUTHORIZED', 403, clear());
    if (action === 'logout') {
      const res = await fetch(`${env.SUPABASE_URL}/auth/v1/logout?scope=local`, { method: 'POST', headers: { apikey: env.SUPABASE_PUBLISHABLE_KEY, Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(12000) });
      if (!res.ok) return fail('LOGOUT_FAILED', 502, cookies);
      return json({ ok: true, data: null }, 200, clear());
    }
    if (action === 'session') return json({ ok: true, data: { username: user.email.split('@')[0] } }, 200, cookies);
    if (!hasGoogleSheetsConfig(env)) return fail('CONFIGURATION', 503, cookies);
    let clean;
    try {
      if (['receipts.list', 'accounts.get'].includes(action)) { dateValue(data.date); clean = { date: data.date }; }
      else if (['receipts.create', 'accounts.create'].includes(action)) {
        if (!/^[0-9a-f-]{36}$/i.test(data.requestId || '')) throw new Error('Invalid request');
        clean = { ...(action === 'receipts.create' ? calculateReceipt(data) : calculateAccounts(data)), requestId: data.requestId };
      } else return fail('ACTION', 400, cookies);
    } catch { return fail('VALIDATION', 400, cookies); }
    const result = await sheets(env, action, clean, user);
    return json({ ok: true, data: result }, 200, cookies);
  } catch (error) {
    const locked = error?.message === 'LOCKED' || error?.code === 'LOCKED';
    if (!locked) logServerError(error, requestedAction);
    return fail(locked ? 'LOCKED' : 'SERVER_ERROR', locked ? 409 : 502, cookies);
  }
}

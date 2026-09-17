import { calculateReceipt, calculateAccounts, dateValue, today } from '../../src/core.js';

const HEADERS = {
  Receipts: ['ReceiptID','CreatedDate','CreatedAt','CreatedBy','Username','CustomerName','ContactNumber','PetsJSON','CheckInDate','PickupDate','Nights','LinesJSON','StandardTotal','FinalTotal','PricingVersion','RequestID','RequestHash'],
  'Account Days': ['AccountDayID','Date','OpeningCash','TotalCashIn','TotalCashOut','ExpectedCash','Submitted','SubmittedAt','CreatedBy','Username','RequestID','RequestHash'],
  'Account Transactions': ['TransactionID','AccountDayID','Date','Type','Description','Amount']
};

const SHEET_ID_ENV = {
  Receipts: 'GOOGLE_RECEIPTS_SHEET_ID',
  'Account Days': 'GOOGLE_ACCOUNT_DAYS_SHEET_ID',
  'Account Transactions': 'GOOGLE_ACCOUNT_TRANSACTIONS_SHEET_ID'
};

let tokenCache;
let mutationQueue = Promise.resolve();

const bytesToBase64Url = bytes => {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
};

const textToBase64Url = value => bytesToBase64Url(new TextEncoder().encode(value));

const pemBytes = pem => {
  const body = pem.replace(/\\n/g, '\n').replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\s/g, '');
  if (!body) throw new Error('CONFIGURATION');
  const binary = atob(body);
  return Uint8Array.from(binary, character => character.charCodeAt(0));
};

async function accessToken(env) {
  if (tokenCache?.email === env.GOOGLE_SERVICE_ACCOUNT_EMAIL && tokenCache.expiresAt > Date.now() + 60000) return tokenCache.value;
  const now = Math.floor(Date.now() / 1000);
  const header = textToBase64Url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claim = textToBase64Url(JSON.stringify({
    iss: env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    scope: 'https://www.googleapis.com/auth/spreadsheets',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600
  }));
  const unsigned = `${header}.${claim}`;
  const key = await crypto.subtle.importKey('pkcs8', pemBytes(env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY), { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
  const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(unsigned));
  const assertion = `${unsigned}.${bytesToBase64Url(new Uint8Array(signature))}`;
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion }),
    signal: AbortSignal.timeout(12000)
  });
  const result = await response.json();
  if (!response.ok || typeof result.access_token !== 'string') throw new Error('SHEETS');
  tokenCache = { email: env.GOOGLE_SERVICE_ACCOUNT_EMAIL, value: result.access_token, expiresAt: Date.now() + Number(result.expires_in || 3600) * 1000 };
  return tokenCache.value;
}

async function googleRequest(env, path, options = {}) {
  const token = await accessToken(env);
  const response = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(env.GOOGLE_SHEET_ID)}${path}`, {
    ...options,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...options.headers },
    signal: AbortSignal.timeout(30000)
  });
  const result = await response.json();
  if (!response.ok) throw new Error('SHEETS');
  return result;
}

async function rows(env, name) {
  const range = encodeURIComponent(`'${name.replaceAll("'", "''")}'!A1:${String.fromCharCode(64 + HEADERS[name].length)}`);
  const result = await googleRequest(env, `/values/${range}?majorDimension=ROWS&valueRenderOption=UNFORMATTED_VALUE`);
  const values = result.values || [];
  if (JSON.stringify(values[0] || []) !== JSON.stringify(HEADERS[name])) throw new Error('SHEETS');
  return values.slice(1).map(row => Array.from({ length: HEADERS[name].length }, (_, index) => row[index] ?? ''));
}

const cell = value => ({ userEnteredValue: typeof value === 'number' ? { numberValue: value } : typeof value === 'boolean' ? { boolValue: value } : { stringValue: String(value ?? '') } });

function appendRequest(env, name, values) {
  const sheetId = Number(env[SHEET_ID_ENV[name]]);
  if (!Number.isInteger(sheetId)) throw new Error('CONFIGURATION');
  return { appendCells: { sheetId, rows: values.map(row => ({ values: row.map(cell) })), fields: 'userEnteredValue' } };
}

async function append(env, requests) {
  await googleRequest(env, ':batchUpdate', { method: 'POST', body: JSON.stringify({ requests }) });
}

async function hash(value) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(value)));
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
}

function receiptFrom(row) {
  return { receiptId: row[0], createdDate: row[1], createdAt: row[2], customerName: row[5], contactNumber: row[6], pets: JSON.parse(row[7]), checkInDate: row[8], pickupDate: row[9], nights: row[10], lines: JSON.parse(row[11]), standardTotal: row[12], finalTotal: row[13], pricingVersion: row[14] };
}

function accountFrom(row, transactions) {
  return { accountDayId: row[0], date: row[1], openingCash: row[2], totalCashIn: row[3], totalCashOut: row[4], expectedCash: row[5], submitted: row[6] === true, submittedAt: row[7], transactions: transactions.filter(item => item[1] === row[0]).map(item => ({ type: item[3], description: item[4], amount: item[5] })) };
}

async function execute(env, action, data, user) {
  if (action === 'receipts.list') {
    dateValue(data.date);
    return (await rows(env, 'Receipts')).filter(row => row[1] === data.date).map(receiptFrom);
  }
  if (action === 'accounts.get') {
    dateValue(data.date);
    const day = (await rows(env, 'Account Days')).find(row => row[1] === data.date);
    return day ? accountFrom(day, await rows(env, 'Account Transactions')) : null;
  }
  if (!['receipts.create', 'accounts.create'].includes(action) || !/^[0-9a-f-]{36}$/i.test(data.requestId || '')) throw new Error('SHEETS');
  const requestHash = await hash([user.id, data]);
  const username = user.email.split('@')[0];
  const timestamp = new Date().toISOString();
  const currentDate = today();
  if (action === 'receipts.create') {
    const all = await rows(env, 'Receipts');
    const previous = all.find(row => row[15] === data.requestId);
    if (previous) {
      if (previous[16] !== requestHash) throw new Error('SHEETS');
      return receiptFrom(previous);
    }
    const receipt = calculateReceipt(data);
    const prefix = `UC-${currentDate.replaceAll('-', '')}-`;
    const next = all.filter(row => String(row[0]).startsWith(prefix)).reduce((maximum, row) => Math.max(maximum, Number(String(row[0]).slice(prefix.length)) || 0), 0) + 1;
    const id = `${prefix}${String(next).padStart(3, '0')}`;
    const row = [id,currentDate,timestamp,user.id,username,receipt.customerName,receipt.contactNumber,JSON.stringify(receipt.pets),receipt.checkInDate,receipt.pickupDate,receipt.nights,JSON.stringify(receipt.lines),receipt.standardTotal,receipt.finalTotal,receipt.pricingVersion,data.requestId,requestHash];
    await append(env, [appendRequest(env, 'Receipts', [row])]);
    return receiptFrom(row);
  }
  const all = await rows(env, 'Account Days');
  const previous = all.find(row => row[10] === data.requestId);
  if (previous) {
    if (previous[11] !== requestHash) throw new Error('SHEETS');
    return accountFrom(previous, await rows(env, 'Account Transactions'));
  }
  const account = calculateAccounts(data, currentDate);
  if (all.some(row => row[1] === account.date)) throw new Error('LOCKED');
  const id = `UC-AD-${account.date.replaceAll('-', '')}`;
  const row = [id,account.date,account.openingCash,account.totalCashIn,account.totalCashOut,account.expectedCash,true,timestamp,user.id,username,data.requestId,requestHash];
  const transactions = account.transactions.map((transaction, index) => [`${id}-${index + 1}`,id,account.date,transaction.type,transaction.description,transaction.amount]);
  const requests = [appendRequest(env, 'Account Days', [row])];
  if (transactions.length) requests.push(appendRequest(env, 'Account Transactions', transactions));
  await append(env, requests);
  return { ...account, accountDayId: id, submitted: true, submittedAt: timestamp };
}

export function hasGoogleSheetsConfig(env) {
  return Boolean(env.GOOGLE_SHEET_ID && env.GOOGLE_SERVICE_ACCOUNT_EMAIL && env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY && Object.values(SHEET_ID_ENV).every(name => /^\d+$/.test(String(env[name] || ''))));
}

export function writeGoogleSheets(env, action, data, user) {
  const run = mutationQueue.then(() => execute(env, action, data, user));
  mutationQueue = run.catch(() => {});
  return run;
}

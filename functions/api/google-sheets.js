import { calculateReceipt, calculateAccounts, dateValue, today } from '../../src/core.js';

const HEADERS = {
  Receipts: ['ReceiptID','CreatedDate','CreatedAt','CreatedBy','Username','CustomerName','ContactNumber','PetNames','PetTypes','CheckInDate','PickupDate','Nights','DogCount','DogRate','DogTotal','CatCount','CatRate','CatTotal','BoardingTotal','DiscountReason','DiscountRatePerNight','AdditionalChargeNames','AdditionalChargeAmounts','AdditionalChargesTotal','FinalTotal','PricingVersion','RequestID','RequestHash'],
  'Account Days': ['AccountDayID','Date','OpeningCash','TotalCashIn','TotalCashOut','ExpectedCash','Submitted','SubmittedAt','CreatedBy','Username','RequestID','RequestHash'],
  'Account Transactions': ['TransactionID','AccountDayID','Date','Type','Description','Amount']
};
const LEGACY_RECEIPT_HEADERS = ['ReceiptID','CreatedDate','CreatedAt','CreatedBy','Username','CustomerName','ContactNumber','PetsJSON','CheckInDate','PickupDate','Nights','LinesJSON','StandardTotal','FinalTotal','PricingVersion','RequestID','RequestHash'];
const PRE_DISCOUNT_RECEIPT_HEADERS = ['ReceiptID','CreatedDate','CreatedAt','CreatedBy','Username','CustomerName','ContactNumber','PetNames','PetTypes','CheckInDate','PickupDate','Nights','DogCount','DogRate','DogTotal','CatCount','CatRate','CatTotal','BoardingTotal','AdditionalChargeNames','AdditionalChargeAmounts','AdditionalChargesTotal','FinalTotal','PricingVersion','RequestID','RequestHash'];

const SHEET_ID_ENV = {
  Receipts: 'GOOGLE_RECEIPTS_SHEET_ID',
  'Account Days': 'GOOGLE_ACCOUNT_DAYS_SHEET_ID',
  'Account Transactions': 'GOOGLE_ACCOUNT_TRANSACTIONS_SHEET_ID'
};

let tokenCache;
let mutationQueue = Promise.resolve();

function sheetsError(code, stage, details = {}) {
  const error = new Error(code);
  error.name = 'GoogleSheetsError';
  error.code = code;
  error.stage = stage;
  error.details = details;
  return error;
}

const bytesToBase64Url = bytes => {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
};

const textToBase64Url = value => bytesToBase64Url(new TextEncoder().encode(value));

export const pemBytes = value => {
  let pem = String(value ?? '').trim().replace(/^\uFEFF/, '');
  if (pem.startsWith('{') || (pem.startsWith('"') && pem.endsWith('"'))) {
    try {
      const parsed = JSON.parse(pem);
      pem = typeof parsed === 'string' ? parsed : String(parsed?.private_key ?? '');
    } catch {
      throw sheetsError('SHEETS_CONFIGURATION', 'credentials.private_key_json', { format: 'invalid_json' });
    }
  }
  pem = pem.replace(/\\r\\n/g, '\n').replace(/\\n/g, '\n').replace(/\r/g, '').trim();
  const match = pem.match(/^-----BEGIN PRIVATE KEY-----\n?([A-Za-z0-9+/=\n]+)\n?-----END PRIVATE KEY-----$/);
  if (!match) {
    const format = /^[a-f0-9]{40}$/i.test(pem) ? 'key_id' : 'invalid_pem';
    throw sheetsError('SHEETS_CONFIGURATION', 'credentials.private_key_format', { format, length: pem.length });
  }
  try {
    const binary = atob(match[1].replace(/\s/g, ''));
    return Uint8Array.from(binary, character => character.charCodeAt(0));
  } catch {
    throw sheetsError('SHEETS_CONFIGURATION', 'credentials.private_key_base64', { format: 'invalid_base64' });
  }
};

async function resultJson(response, stage) {
  let result;
  try {
    result = await response.json();
  } catch {
    throw sheetsError('SHEETS_UPSTREAM_RESPONSE', stage, { httpStatus: response.status });
  }
  if (!response.ok) {
    throw sheetsError('SHEETS_UPSTREAM', stage, {
      httpStatus: response.status,
      upstreamCode: result?.error?.status || result?.error,
      upstreamReason: result?.error?.errors?.[0]?.reason,
      upstreamMessage: result?.error?.message || result?.error_description
    });
  }
  return result;
}

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
  let key;
  try {
    key = await crypto.subtle.importKey('pkcs8', pemBytes(env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY), { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
  } catch (error) {
    if (error?.code) throw error;
    throw sheetsError('SHEETS_CONFIGURATION', 'credentials.private_key_import', { errorName: error?.name });
  }
  const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(unsigned));
  const assertion = `${unsigned}.${bytesToBase64Url(new Uint8Array(signature))}`;
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion }),
    signal: AbortSignal.timeout(12000)
  });
  const result = await resultJson(response, 'oauth.token');
  if (typeof result.access_token !== 'string') throw sheetsError('SHEETS_UPSTREAM_RESPONSE', 'oauth.token', { reason: 'missing_access_token' });
  tokenCache = { email: env.GOOGLE_SERVICE_ACCOUNT_EMAIL, value: result.access_token, expiresAt: Date.now() + Number(result.expires_in || 3600) * 1000 };
  return tokenCache.value;
}

async function googleRequest(env, path, stage, options = {}) {
  const token = await accessToken(env);
  const response = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(env.GOOGLE_SHEET_ID)}${path}`, {
    ...options,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...options.headers },
    signal: AbortSignal.timeout(30000)
  });
  return resultJson(response, stage);
}

async function rows(env, name) {
  const range = encodeURIComponent(`'${name.replaceAll("'", "''")}'!A1:${columnName(HEADERS[name].length)}`);
  const result = await googleRequest(env, `/values/${range}?majorDimension=ROWS&valueRenderOption=UNFORMATTED_VALUE`, `sheets.read.${name}`);
  const values = result.values || [];
  const receiptHeaders = JSON.stringify(values[0] || []);
  if (name === 'Receipts' && [JSON.stringify(LEGACY_RECEIPT_HEADERS), JSON.stringify(PRE_DISCOUNT_RECEIPT_HEADERS)].includes(receiptHeaders)) {
    const migrated = values.slice(1).map(receiptHeaders === JSON.stringify(LEGACY_RECEIPT_HEADERS) ? migrateLegacyReceiptRow : migratePreDiscountReceiptRow);
    const sheetId = Number(env[SHEET_ID_ENV.Receipts]);
    await googleRequest(env, ':batchUpdate', 'sheets.schema.migrate.Receipts', { method: 'POST', body: JSON.stringify({ requests: [
      { insertDimension: { range: { sheetId, dimension: 'COLUMNS', startIndex: PRE_DISCOUNT_RECEIPT_HEADERS.length, endIndex: HEADERS.Receipts.length }, inheritFromBefore: true } },
      { updateDimensionProperties: { range: { sheetId, dimension: 'COLUMNS', startIndex: 19, endIndex: 20 }, properties: { pixelSize: 150 }, fields: 'pixelSize' } },
      { updateDimensionProperties: { range: { sheetId, dimension: 'COLUMNS', startIndex: 20, endIndex: 21 }, properties: { pixelSize: 190 }, fields: 'pixelSize' } },
      { updateCells: { start: { sheetId, rowIndex: 0, columnIndex: 0 }, rows: [HEADERS.Receipts, ...migrated].map(row => ({ values: row.map(cell) })), fields: 'userEnteredValue' } }
    ] }) });
    return migrated;
  }
  if (JSON.stringify(values[0] || []) !== JSON.stringify(HEADERS[name])) throw sheetsError('SHEETS_SCHEMA', `sheets.schema.${name}`, { reason: 'header_mismatch' });
  return values.slice(1).map(row => Array.from({ length: HEADERS[name].length }, (_, index) => row[index] ?? ''));
}

const cell = value => ({ userEnteredValue: typeof value === 'number' ? { numberValue: value } : typeof value === 'boolean' ? { boolValue: value } : { stringValue: String(value ?? '') } });
const columnName = count => {
  let value = count, name = '';
  while (value) { value--; name = String.fromCharCode(65 + value % 26) + name; value = Math.floor(value / 26); }
  return name;
};

function appendRequest(env, name, values) {
  const sheetId = Number(env[SHEET_ID_ENV[name]]);
  if (!Number.isInteger(sheetId)) throw sheetsError('SHEETS_CONFIGURATION', `sheets.id.${name}`, { reason: 'invalid_sheet_id' });
  return { appendCells: { sheetId, rows: values.map(row => ({ values: row.map(cell) })), fields: 'userEnteredValue' } };
}

async function append(env, requests) {
  await googleRequest(env, ':batchUpdate', 'sheets.batch_update', { method: 'POST', body: JSON.stringify({ requests }) });
}

async function hash(value) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(value)));
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
}

function receiptFrom(row) {
  const names = String(row[7] || '').split(/\r?\n/).filter(Boolean);
  const types = String(row[8] || '').split(/\r?\n/).filter(Boolean);
  const lines = [['dog',12,13,14],['cat',15,16,17]].filter(([,count]) => Number(row[count])).map(([type,count,rate,total]) => ({ type, count: Number(row[count]), nights: Number(row[11]), rate: Number(row[rate]), total: Number(row[total]) }));
  const chargeNames = String(row[21] || '').split(/\r?\n/).filter(Boolean);
  const chargeAmounts = String(row[22] || '').split(/\r?\n/).filter(Boolean);
  const standardRatePerNight = lines.reduce((sum, line) => sum + line.count * line.rate, 0);
  const standardTotal = lines.reduce((sum, line) => sum + line.total, 0);
  const discountRatePerNight = row[20] === '' || row[20] === undefined ? null : Number(row[20]);
  const boardingTotal = Number(row[18]);
  return { receiptId: row[0], createdDate: row[1], createdAt: row[2], customerName: row[5], contactNumber: row[6], pets: names.map((name, index) => ({ name, type: types[index] || 'dog' })), checkInDate: row[9], pickupDate: row[10], nights: Number(row[11]), lines, standardRatePerNight, standardTotal, discountReason: String(row[19] || ''), discountRatePerNight, discountAmount: standardTotal - boardingTotal, boardingTotal, additionalCharges: chargeNames.map((name, index) => ({ name, amount: Number(chargeAmounts[index] || 0) })), additionalChargesTotal: Number(row[23] || 0), finalTotal: Number(row[24]), pricingVersion: row[25] };
}

function migrateLegacyReceiptRow(row) {
  const pets = JSON.parse(row[7] || '[]');
  const lines = JSON.parse(row[11] || '[]');
  const dog = lines.find(line => line.type === 'dog') || {};
  const cat = lines.find(line => line.type === 'cat') || {};
  return [row[0],row[1],row[2],row[3],row[4],row[5],row[6],pets.map(pet => pet.name).join('\n'),pets.map(pet => pet.type).join('\n'),row[8],row[9],row[10],dog.count || 0,dog.rate || 0,dog.total || 0,cat.count || 0,cat.rate || 0,cat.total || 0,row[12],'','', '', '',0,row[13],row[14],row[15],row[16]];
}

function migratePreDiscountReceiptRow(row) {
  return [...row.slice(0, 19), '', '', ...row.slice(19, 26)];
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
  if (!['receipts.create', 'accounts.create'].includes(action) || !/^[0-9a-f-]{36}$/i.test(data.requestId || '')) throw sheetsError('SHEETS_REQUEST', 'request.validation');
  const requestHash = await hash([user.id, data]);
  const username = user.email.split('@')[0];
  const timestamp = new Date().toISOString();
  const currentDate = today();
  if (action === 'receipts.create') {
    const all = await rows(env, 'Receipts');
    const previous = all.find(row => row[26] === data.requestId);
    if (previous) {
      if (previous[27] !== requestHash) throw sheetsError('SHEETS_REQUEST', 'request.idempotency', { reason: 'request_hash_mismatch' });
      return receiptFrom(previous);
    }
    const receipt = calculateReceipt(data);
    const prefix = `UC-${currentDate.replaceAll('-', '')}-`;
    const next = all.filter(row => String(row[0]).startsWith(prefix)).reduce((maximum, row) => Math.max(maximum, Number(String(row[0]).slice(prefix.length)) || 0), 0) + 1;
    const id = `${prefix}${String(next).padStart(3, '0')}`;
    const dog = receipt.lines.find(line => line.type === 'dog') || {};
    const cat = receipt.lines.find(line => line.type === 'cat') || {};
    const row = [id,currentDate,timestamp,user.id,username,receipt.customerName,receipt.contactNumber,receipt.pets.map(pet => pet.name).join('\n'),receipt.pets.map(pet => pet.type).join('\n'),receipt.checkInDate,receipt.pickupDate,receipt.nights,dog.count || 0,dog.rate || 0,dog.total || 0,cat.count || 0,cat.rate || 0,cat.total || 0,receipt.boardingTotal,receipt.discountReason,receipt.discountRatePerNight ?? '',receipt.additionalCharges.map(charge => charge.name).join('\n'),receipt.additionalCharges.map(charge => charge.amount).join('\n'),receipt.additionalChargesTotal,receipt.finalTotal,receipt.pricingVersion,data.requestId,requestHash];
    await append(env, [appendRequest(env, 'Receipts', [row])]);
    return receiptFrom(row);
  }
  const all = await rows(env, 'Account Days');
  const previous = all.find(row => row[10] === data.requestId);
  if (previous) {
    if (previous[11] !== requestHash) throw sheetsError('SHEETS_REQUEST', 'request.idempotency', { reason: 'request_hash_mismatch' });
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

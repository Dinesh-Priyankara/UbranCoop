// Google Apps Script adapter. Deploy generated Code.gs, with the Sheets advanced service enabled.
const HEADERS = {
  Receipts: ['ReceiptID','CreatedDate','CreatedAt','CreatedBy','Username','CustomerName','ContactNumber','PetsJSON','CheckInDate','PickupDate','Nights','LinesJSON','StandardTotal','FinalTotal','PricingVersion','RequestID','RequestHash'],
  'Account Days': ['AccountDayID','Date','OpeningCash','TotalCashIn','TotalCashOut','ExpectedCash','Submitted','SubmittedAt','CreatedBy','Username','RequestID','RequestHash'],
  'Account Transactions': ['TransactionID','AccountDayID','Date','Type','Description','Amount']
};
function setup() {
  const ss = SpreadsheetApp.openById(PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID'));
  ss.setSpreadsheetTimeZone('Asia/Colombo');
  Object.keys(HEADERS).forEach(name => {
    const sheet = ss.getSheetByName(name) || ss.insertSheet(name);
    if (sheet.getLastRow() === 0) sheet.appendRow(HEADERS[name]);
    else if (JSON.stringify(sheet.getRange(1,1,1,HEADERS[name].length).getValues()[0]) !== JSON.stringify(HEADERS[name])) throw new Error('Header mismatch: ' + name);
    sheet.setFrozenRows(1);
  });
}
function doPost(e) {
  let lock;
  try {
    if (!e.postData || e.postData.contents.length > 150000) throw new Error('SIZE');
    const envelope = JSON.parse(e.postData.contents);
    const props = PropertiesService.getScriptProperties();
    const secret = props.getProperty('SHARED_SECRET');
    if (!secret || secret.length < 32 || typeof envelope.payload !== 'string') throw new Error('CONFIG');
    const expected = Utilities.computeHmacSha256Signature(envelope.payload, secret).map(b => ((b + 256) % 256).toString(16).padStart(2,'0')).join('');
    const signature = String(envelope.signature || '');
    let difference = expected.length ^ signature.length;
    for (let i = 0; i < expected.length; i++) difference |= expected.charCodeAt(i) ^ (signature.charCodeAt(i) || 0);
    if (difference) throw new Error('SIGNATURE');
    const request = JSON.parse(envelope.payload);
    if (!Number.isFinite(request.timestamp) || Math.abs(Date.now() - request.timestamp) > 120000) throw new Error('EXPIRED');
    if (!request.createdBy || !request.username) throw new Error('IDENTITY');
    const ss = SpreadsheetApp.openById(props.getProperty('SPREADSHEET_ID'));
    lock = LockService.getScriptLock();
    lock.waitLock(20000);
    const data = executeRequest(ss, request);
    return output({ ok: true, data });
  } catch (error) {
    return output({ ok: false, code: error.message === 'LOCKED' ? 'LOCKED' : 'ERROR' });
  } finally { if (lock && lock.hasLock()) lock.releaseLock(); }
}
function output(value) { return ContentService.createTextOutput(JSON.stringify(value)).setMimeType(ContentService.MimeType.JSON); }
function rows(ss, name) {
  const sheet = ss.getSheetByName(name);
  if (!sheet) throw new Error('SCHEMA');
  if (JSON.stringify(sheet.getRange(1,1,1,HEADERS[name].length).getValues()[0]) !== JSON.stringify(HEADERS[name])) throw new Error('SCHEMA');
  return sheet.getLastRow() <= 1 ? [] : sheet.getRange(2,1,sheet.getLastRow()-1,HEADERS[name].length).getValues();
}
function appendRequest(ss, name, values) {
  return { appendCells: { sheetId: ss.getSheetByName(name).getSheetId(), rows: values.map(row => ({ values: row.map(v => ({ userEnteredValue: typeof v === 'number' ? { numberValue: v } : typeof v === 'boolean' ? { boolValue: v } : { stringValue: String(v ?? '') } })) })), fields: 'userEnteredValue' } };
}
function receiptFrom(row) {
  return { receiptId: row[0], createdDate: row[1], createdAt: row[2], customerName: row[5], contactNumber: row[6], pets: JSON.parse(row[7]), checkInDate: row[8], pickupDate: row[9], nights: row[10], lines: JSON.parse(row[11]), standardTotal: row[12], finalTotal: row[13], pricingVersion: row[14] };
}
function accountFrom(ss, row) {
  return { accountDayId: row[0], date: row[1], openingCash: row[2], totalCashIn: row[3], totalCashOut: row[4], expectedCash: row[5], submitted: row[6] === true, submittedAt: row[7], transactions: rows(ss, 'Account Transactions').filter(t => t[1] === row[0]).map(t => ({ type: t[3], description: t[4], amount: t[5] })) };
}
function executeRequest(ss, request) {
  const { action, data } = request;
  const currentDate = Utilities.formatDate(new Date(), 'Asia/Colombo', 'yyyy-MM-dd');
  if (action === 'receipts.list') { dateValue(data.date); return rows(ss, 'Receipts').filter(r => r[1] === data.date).map(receiptFrom); }
  if (action === 'accounts.get') { dateValue(data.date); const row = rows(ss, 'Account Days').find(r => r[1] === data.date); return row ? accountFrom(ss, row) : null; }
  if (!['receipts.create','accounts.create'].includes(action) || !/^[0-9a-f-]{36}$/i.test(data.requestId || '')) throw new Error('ACTION');
  // Hash the normalized request, binding retries to the same user and payload.
  const hash = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, JSON.stringify([request.createdBy, data])).map(b => ((b+256)%256).toString(16).padStart(2,'0')).join('');
  const timestamp = new Date().toISOString();
  if (action === 'receipts.create') {
    const all = rows(ss, 'Receipts');
    const previous = all.find(r => r[15] === data.requestId);
    if (previous) { if (previous[16] !== hash) throw new Error('REPLAY'); return receiptFrom(previous); }
    const receipt = calculateReceipt(data);
    const prefix = 'UC-' + currentDate.replace(/-/g,'') + '-';
    const next = all.filter(r => String(r[0]).startsWith(prefix)).reduce((max,r) => Math.max(max, Number(String(r[0]).slice(prefix.length)) || 0), 0) + 1;
    const id = prefix + String(next).padStart(3,'0');
    const row = [id,currentDate,timestamp,request.createdBy,request.username,receipt.customerName,receipt.contactNumber,JSON.stringify(receipt.pets),receipt.checkInDate,receipt.pickupDate,receipt.nights,JSON.stringify(receipt.lines),receipt.standardTotal,receipt.finalTotal,receipt.pricingVersion,data.requestId,hash];
    Sheets.Spreadsheets.batchUpdate({ requests: [appendRequest(ss, 'Receipts', [row])] }, ss.getId());
    return receiptFrom(row);
  }
  const all = rows(ss, 'Account Days');
  const previous = all.find(r => r[10] === data.requestId);
  if (previous) { if (previous[11] !== hash) throw new Error('REPLAY'); return accountFrom(ss, previous); }
  const account = calculateAccounts(data, currentDate);
  if (all.some(r => r[1] === account.date)) throw new Error('LOCKED');
  const id = 'UC-AD-' + account.date.replace(/-/g,'');
  const row = [id,account.date,account.openingCash,account.totalCashIn,account.totalCashOut,account.expectedCash,true,timestamp,request.createdBy,request.username,data.requestId,hash];
  const transactions = account.transactions.map((t,i) => [id+'-'+(i+1),id,account.date,t.type,t.description,t.amount]);
  const requests = [appendRequest(ss, 'Account Days', [row])];
  if (transactions.length) requests.push(appendRequest(ss, 'Account Transactions', transactions));
  // One atomic batch: a submitted day can never be saved without all its transactions.
  Sheets.Spreadsheets.batchUpdate({ requests }, ss.getId());
  return { ...account, accountDayId: id, submitted: true, submittedAt: timestamp };
}

import { today, money, calculateReceipt, calculateAccounts, nightsBetween, rateFor, ERROR_MESSAGE } from './core.js';
import { api } from './api.js';
import { escape as e, icon, brand, button, field, loading, confirmDialog } from './components.js';

const app = document.querySelector('#app');
const blankRows = () => Array.from({ length: 6 }, () => ({ description: '', amount: '' }));
const blankReceipt = () => ({ customerName: '', contactNumber: '', petType: 'dog', dogCount: 1, catCount: 1, dogNames: [''], catNames: [''], checkInDate: today(), pickupDate: '', requestId: crypto.randomUUID() });
const blankAccounts = () => ({ date: today(), openingCash: '', IN: blankRows(), OUT: blankRows(), requestId: crypto.randomUUID() });
let user = null, route = 'home', dirty = false, busy = false, profile = false, tab = 'IN', receipt = blankReceipt(), accounts = blankAccounts(), preview = null, savedPreview = false, historyDate = today(), error = '', status = '', generation = 0;
let data = null, readLoading = false, lastSubmitted = null, accountLoadFailed = false;

function pageTitle() { return ({ home: 'Home', receipt: 'Create Receipt', preview: savedPreview ? 'Receipt' : 'Receipt Preview', receipts: 'Receipt History', accounts: 'Daily Accounts', accountHistory: 'Accounts History' })[route]; }
function activeNav() { return ['receipt','preview','receipts'].includes(route) ? 'receipt' : ['accounts','accountHistory'].includes(route) ? 'accounts' : 'home'; }
function render() {
  if (!user) { renderLogin(); return; }
  app.innerHTML = `<div class="shell"><header class="topbar">${brand()}<div class="profile-wrap"><button type="button" class="icon-button profile-button" data-action="profile" aria-label="Profile" aria-expanded="${profile}">${icon('user')}</button>${profile ? `<div class="profile-popup"><strong>${e(user.username)}</strong><button type="button" data-action="logout">${icon('logout')}Logout</button></div>` : ''}</div></header><main id="main"><div class="page-heading">${route !== 'home' ? `<button class="icon-button" data-action="back" aria-label="Back">${icon('back')}</button>` : ''}<div><p class="eyebrow">STAFF PORTAL</p><h1>${pageTitle()}</h1></div>${route === 'receipt' || route === 'accounts' ? `<button class="history-button" aria-label="History" data-action="${route === 'receipt' ? 'receipts' : 'accountHistory'}">${icon('clock')}<span>History</span></button>` : ''}</div><div id="notice" aria-live="polite">${notice()}</div><div id="page">${page()}</div></main><nav class="bottom-nav" aria-label="Main navigation">${['home','receipt','accounts'].map(name => `<button type="button" data-action="${name}" ${activeNav() === name ? 'aria-current="page"' : ''}>${icon(name)}<span>${name === 'home' ? 'Home' : name === 'receipt' ? 'Receipt' : 'Accounts'}</span></button>`).join('')}</nav></div>`;
  bind();
  if (busy) app.querySelectorAll('input, select, button').forEach(control => { control.disabled = true; });
}
function notice() { return `${error ? `<div class="error" role="alert">${e(error)}</div>` : ''}${status ? `<div class="success" role="status">${e(status)}</div>` : ''}`; }
function updateNotice() { const el = document.querySelector('#notice'); if (el) el.innerHTML = notice(); }
function renderLogin() {
  app.innerHTML = `<main class="login"><div class="login-brand">${brand()}</div><section class="card login-card"><div class="login-pets">${icon('dog')}${icon('cat')}</div><p class="eyebrow">STAFF PORTAL</p><h1>Welcome back</h1><p class="muted">Sign in to your UrbanCoop account.</p><div id="notice" aria-live="polite">${notice()}</div><form id="login-form">${field('Username','username','', 'required autocomplete="username" autocapitalize="none" spellcheck="false" maxlength="64" pattern="[a-zA-Z0-9._-]+"')}${field('Password','password','', 'type="password" required autocomplete="current-password" maxlength="256"')}<button class="button" ${busy ? 'disabled' : ''}>${busy ? 'Signing in...' : 'Sign In'}</button></form></section><p class="login-footer">A little care. A lot of love.</p></main>`;
  document.querySelector('#login-form').addEventListener('submit', async event => {
    event.preventDefault(); if (busy) return;
    const fields = new FormData(event.currentTarget); busy = true; error = ''; const submit = event.currentTarget.querySelector('button'); submit.disabled = true; submit.textContent = 'Signing in...';
    try { user = await api('login', Object.fromEntries(fields)); history.replaceState({ route }, '', `#${route}`); render(); load(); }
    catch (err) { error = err.message || ERROR_MESSAGE; updateNotice(); }
    finally { busy = false; if (!user) { submit.disabled = false; submit.textContent = 'Sign In'; } }
  });
}
function page() {
  if (route === 'home') return `<section class="welcome"><p>${new Intl.DateTimeFormat('en-GB', { dateStyle: 'full', timeZone: 'Asia/Colombo' }).format(new Date())}</p><h2>Hello, ${e(user.username)} <span class="hello-paw">${icon('paw')}</span></h2><span class="muted">Let’s take care of today.</span></section><div class="home-actions"><button class="action-card" data-action="receipt"><span class="action-icon">${icon('receipt')}</span><span><strong>Create Receipt</strong><small>Boarding details &amp; receipts</small></span>${icon('arrow')}</button><button class="action-card" data-action="accounts"><span class="action-icon">${icon('accounts')}</span><span><strong>Daily Accounts</strong><small>Cash in, cash out &amp; balance</small></span>${icon('arrow')}</button></div><section class="card glance"><h2>Today at a Glance</h2>${readLoading ? loading() : data ? `<div class="glance-grid"><div><span>Receipts created</span><strong>${data.receipts.length}</strong></div><div><span>Daily accounts</span><strong class="small-total">${data.account?.submitted ? 'Submitted' : 'Not submitted'}</strong></div></div>` : `<p class="muted">Today’s overview is unavailable.</p>${button('Try Again','reload',true)}`}</section>`;
  if (route === 'receipt') return receiptForm();
  if (route === 'preview') return receiptPreview();
  if (route === 'accounts') return accountsForm();
  return historyPage();
}
function petInputs(type) {
  const count = receipt[`${type}Count`];
  return `<section class="pet-group"><div class="pet-count"><span>${icon(type)} Number of ${receipt.petType === 'mixed' ? `${type}s` : 'Pets'}</span><div class="stepper"><button type="button" data-count="${type}" data-step="-1" aria-label="Remove one ${type}" ${count <= 1 ? 'disabled' : ''}>−</button><output>${count}</output><button type="button" data-count="${type}" data-step="1" aria-label="Add one ${type}" ${count >= 25 ? 'disabled' : ''}>+</button></div></div>${Array.from({ length: count }, (_,i) => field(`${receipt.petType === 'mixed' ? type === 'dog' ? 'Dog' : 'Cat' : 'Pet'} ${count > 1 ? i+1+' ' : ''}Name`, `${type}Name-${i}`, receipt[`${type}Names`][i] || '', 'required maxlength="80" autocomplete="off"')).join('')}</section>`;
}
function receiptForm() {
  return `<form id="receipt-form"><section class="card"><h2>Customer Details</h2>${field('Customer Name','customerName',receipt.customerName,'required maxlength="120" autocomplete="name"')}${field('Contact Number <span class="optional">(optional)</span>','contactNumber',receipt.contactNumber,'type="tel" autocomplete="tel" maxlength="30"')}</section><section class="card"><h2>Boarding Details</h2><label class="field"><span>Pet Type</span><select name="petType">${[['dog','Dog'],['cat','Cat'],['mixed','Dogs & Cats']].map(([value,label]) => `<option value="${value}" ${receipt.petType === value ? 'selected' : ''}>${label}</option>`).join('')}</select></label>${receipt.petType !== 'cat' ? petInputs('dog') : ''}${receipt.petType !== 'dog' ? petInputs('cat') : ''}<div class="date-grid">${field('Check-in Date','checkInDate',receipt.checkInDate,'type="date" required')}${field('Pickup Date','pickupDate',receipt.pickupDate,'type="date" required')}</div><p class="input-hint" id="stay-hint"></p></section><section class="card estimate" id="estimate">${estimate()}</section><button class="button" type="submit">Preview Receipt ${icon('arrow')}</button></form>`;
}
function receiptInput() {
  const pets = ['dog','cat'].flatMap(type => receipt.petType === 'mixed' || receipt.petType === type ? Array.from({ length: receipt[`${type}Count`] }, (_,i) => ({ type, name: receipt[`${type}Names`][i] || '' })) : []);
  return { ...receipt, pets };
}
function estimate() {
  try {
    const nights = nightsBetween(receipt.checkInDate, receipt.pickupDate);
    let total = 0;
    const lines = ['dog','cat'].flatMap(type => {
      if (receipt.petType !== 'mixed' && receipt.petType !== type) return [];
      const count = receipt[`${type}Count`], rate = rateFor(type, count, nights); total += count * rate * nights;
      return `<div class="summary-row"><span>${count} ${type}${count > 1 ? 's' : ''} × ${nights} nights</span><span>${money(rate)} / night</span></div>`;
    }).join('');
    return `<h2>Stay Summary <span class="badge">${nights} nights</span></h2>${lines}<div class="summary-total"><span>Booking Total</span><strong>${money(total)}</strong></div>`;
  } catch { return '<h2>Stay Summary</h2><p class="muted">Choose your stay dates to calculate the total.</p>'; }
}
function receiptPreview() {
  if (!preview) return '';
  const r = preview;
  return `${!savedPreview ? '<p class="preview-hint">Review the details before saving.</p>' : '<p class="preview-hint">Saved receipt · Ready to share with your customer</p>'}<article class="receipt-paper"><div class="receipt-brand">${brand()}</div><div class="receipt-label"><span>BOARDING RECEIPT</span><strong>${e(r.receiptId || 'Preview · Not saved')}</strong></div>${r.createdDate ? `<p class="receipt-date">${e(r.createdDate)}</p>` : ''}<div class="receipt-customer"><small>CUSTOMER</small><h2>${e(r.customerName)}</h2>${r.contactNumber ? `<p>${e(r.contactNumber)}</p>` : ''}</div><div class="receipt-pets">${r.pets.map(p => `<span>${icon(p.type)}${e(p.name)}</span>`).join('')}</div><div class="receipt-dates"><div><small>CHECK-IN</small><strong>${e(r.checkInDate)}</strong></div><div><small>PICKUP</small><strong>${e(r.pickupDate)}</strong></div><div><small>STAY</small><strong>${r.nights} nights</strong></div></div><div class="receipt-lines">${r.lines.map(line => `<div><p><strong>${line.count} ${line.type}${line.count > 1 ? 's' : ''}</strong><small>${money(line.rate)} × ${line.count} × ${line.nights} nights</small></p><strong>${money(line.total)}</strong></div>`).join('')}</div><div class="receipt-total"><span>Total</span><strong>${money(r.finalTotal)}</strong></div><footer>${icon('paw')}<p>Thank you for choosing UrbanCoop.</p><small>A happy stay for your best friend.</small></footer></article><div class="preview-actions">${savedPreview ? `${button('Home','home',true)}${button('New Receipt','newReceipt')}` : `${button('Edit Details','editReceipt',true)}${button(busy ? 'Saving...' : 'Save & Finish','saveReceipt',false,busy ? 'disabled' : '')}`}</div>`;
}
function accountInput() { return { date: accounts.date, openingCash: accounts.openingCash, requestId: accounts.requestId, transactions: ['IN','OUT'].flatMap(type => accounts[type].filter(r => r.description.trim() || r.amount !== '').map(r => ({ ...r, type }))) }; }
function accountSummary(value) {
  const a = value || (() => {
    const sum = type => accounts[type].reduce((total, row) => total + (Number.isFinite(Number(row.amount)) ? Math.round(Number(row.amount) * 100) : 0), 0) / 100;
    const openingCash = Number(accounts.openingCash) || 0;
    return { openingCash, totalCashIn: sum('IN'), totalCashOut: sum('OUT'), expectedCash: Math.round((openingCash + sum('IN') - sum('OUT')) * 100) / 100 };
  })();
  return `<h2>Daily Summary</h2><div class="summary-row"><span>Opening Cash</span><strong>${money(a.openingCash)}</strong></div><div class="summary-row"><span>Total Cash In</span><strong>${money(a.totalCashIn)}</strong></div><div class="summary-row"><span>Total Cash Out</span><strong class="cash-out">− ${money(a.totalCashOut)}</strong></div><div class="expected"><span>Expected Cash in Hand</span><strong>${money(a.expectedCash)}</strong></div>`;
}
function accountsForm() {
  const datePicker = `<section class="card">${field('Date','date',accounts.date,`type="date" required max="${today()}"`)}</section>`;
  if (readLoading) return datePicker + loading();
  if (accountLoadFailed) return datePicker + `<section class="card"><p class="muted">Unable to check this day’s account record.</p>${button('Try Again','reload',true)}</section>`;
  if (lastSubmitted && lastSubmitted.date === accounts.date) return datePicker + `<section class="card"><span class="badge">${icon('check')} Submitted · Read-only</span><h2>${e(lastSubmitted.date)}</h2><p>This day’s accounts have been submitted.</p>${button('View Day Record', 'viewSubmitted')}</section>`;
  return `<form id="accounts-form"><section class="card"><div class="date-grid">${field('Date','date',accounts.date,`type="date" required max="${today()}"`)}${field('Opening Cash (Rs.)','openingCash',accounts.openingCash,'type="number" min="0" max="999999999" step="0.01" inputmode="decimal" required placeholder="0.00"')}</div></section><section class="card transactions"><div class="segmented" role="tablist" aria-label="Transaction type"><button type="button" role="tab" aria-selected="${tab === 'IN'}" data-tab="IN">Cash In</button><button type="button" role="tab" aria-selected="${tab === 'OUT'}" data-tab="OUT">Cash Out</button></div><div class="transaction-head"><span>Description</span><span>Amount (Rs.)</span><span></span></div><div role="tabpanel" aria-label="Cash ${tab === 'IN' ? 'In' : 'Out'}">${accounts[tab].map((row,i) => `<div class="transaction-row"><input aria-label="${tab === 'IN' ? 'Cash In' : 'Cash Out'} row ${i+1} description" name="description-${i}" value="${e(row.description)}" placeholder="Description" maxlength="200"><input aria-label="Row ${i+1} amount" name="amount-${i}" value="${e(row.amount)}" placeholder="0.00" type="number" min="0.01" max="999999999" step="0.01" inputmode="decimal"><button class="icon-button danger-text" type="button" data-remove="${i}" aria-label="Remove row ${i+1}">${icon('trash')}</button></div>`).join('')}</div>${button('+ Add More Rows','addRows',true)}</section><section class="card" id="account-summary">${accountSummary()}</section><button type="submit" class="button" ${busy ? 'disabled' : ''}>${busy ? 'Submitting...' : 'Save Day Record'}</button></form>`;
}
function historyPage() {
  const picker = `<section class="card history-picker">${field('Choose a date','historyDate',historyDate,`type="date" required max="${today()}"`)}${button('Show Records','reload',false,readLoading ? 'disabled' : '')}</section>`;
  if (readLoading) return picker + loading();
  if (data === null || (route === 'receipts' && !data.length)) return picker + `<section class="card empty">${icon(route === 'receipts' ? 'receipt' : 'accounts')}<h2>${route === 'receipts' ? 'No receipts found' : 'No account record'}</h2><p class="muted">${error ? 'Unable to load this date. Please try again.' : 'Choose another date to view saved records.'}</p></section>`;
  if (route === 'receipts') return picker + `<div class="history-list">${data.map((r,i) => `<button class="card history-item" data-receipt="${i}"><span class="history-paw">${icon('paw')}</span><span><strong>${e(r.pets.map(p => p.name).join(', '))}</strong><span>${e(r.customerName)}</span><small>${e(r.receiptId)}</small></span><strong>${money(r.finalTotal)}</strong></button>`).join('')}</div>`;
  const sections = ['IN','OUT'].map(type => {
    const transactions = data.transactions.filter(t => t.type === type).map(t => `<div class="summary-row"><span>${e(t.description)}</span><strong>${money(t.amount)}</strong></div>`).join('');
    return `<section class="card"><h2>Cash ${type === 'IN' ? 'In' : 'Out'}</h2>${transactions || '<p class="muted">No transactions.</p>'}</section>`;
  }).join('');
  return picker + `<section class="card"><div class="section-heading"><h2>${e(data.date)}</h2><span class="badge">${icon('check')} Submitted</span></div><p class="muted">This record is read-only.</p>${accountSummary(data)}</section>${sections}`;
}
function bind() {
  app.querySelectorAll('[data-action]').forEach(el => el.addEventListener('click', () => action(el.dataset.action)));
  app.querySelectorAll('[data-count]').forEach(el => el.addEventListener('click', () => { const type = el.dataset.count; receipt[`${type}Count`] += Number(el.dataset.step); dirty = true; receipt.requestId = crypto.randomUUID(); render(); }));
  app.querySelectorAll('[data-tab]').forEach(el => {
    el.tabIndex = el.dataset.tab === tab ? 0 : -1;
    el.addEventListener('click', () => { if (busy) return; tab = el.dataset.tab; render(); app.querySelector(`[data-tab="${tab}"]`)?.focus(); });
    el.addEventListener('keydown', event => {
      if (busy || !['ArrowLeft','ArrowRight','Home','End'].includes(event.key)) return;
      event.preventDefault(); tab = event.key === 'Home' ? 'IN' : event.key === 'End' ? 'OUT' : tab === 'IN' ? 'OUT' : 'IN'; render(); app.querySelector(`[data-tab="${tab}"]`)?.focus();
    });
  });
  app.querySelectorAll('[data-remove]').forEach(el => el.addEventListener('click', () => { accounts[tab].splice(Number(el.dataset.remove), 1); dirty = true; accounts.requestId = crypto.randomUUID(); render(); }));
  app.querySelectorAll('[data-receipt]').forEach(el => el.addEventListener('click', () => { preview = data[Number(el.dataset.receipt)]; savedPreview = true; navigate('preview'); }));
  app.querySelector('[name="historyDate"]')?.addEventListener('change', event => { historyDate = event.target.value; load(); });
  const rf = app.querySelector('#receipt-form');
  rf?.addEventListener('input', event => {
    const { name, value } = event.target;
    const match = name.match(/^(dog|cat)Name-(\d+)$/);
    if (match) receipt[`${match[1]}Names`][Number(match[2])] = value; else receipt[name] = value;
    dirty = true; receipt.requestId = crypto.randomUUID();
    document.querySelector('#estimate').innerHTML = estimate();
    const pickup = rf.elements.pickupDate;
    let message = '';
    if (receipt.pickupDate && receipt.checkInDate) try { nightsBetween(receipt.checkInDate, receipt.pickupDate); } catch (err) { message = err.message; }
    pickup.setCustomValidity(message); document.querySelector('#stay-hint').textContent = message;
  });
  rf?.elements.petType.addEventListener('change', () => render());
  rf?.addEventListener('submit', event => { event.preventDefault(); try { preview = calculateReceipt(receiptInput()); savedPreview = false; error = ''; navigate('preview', true); } catch (err) { error = err.message; updateNotice(); } });
  const af = app.querySelector('#accounts-form');
  if (route === 'accounts') app.querySelector('[name="date"]')?.addEventListener('change', async event => {
    const selected = event.target.value;
    if (selected === accounts.date) return;
    if (!event.target.checkValidity()) return;
    if (dirty && !await confirmDialog('Discard unsaved changes?', 'Stay','Discard',true)) { event.target.value = accounts.date; return; }
    accounts = { ...blankAccounts(), date: selected }; dirty = false; error = ''; await load();
  });
  af?.addEventListener('input', event => {
    const { name, value } = event.target;
    if (name === 'date') return;
    const match = name.match(/^(description|amount)-(\d+)$/);
    if (match) accounts[tab][Number(match[2])][match[1]] = value; else accounts[name] = value;
    dirty = true; accounts.requestId = crypto.randomUUID();
    document.querySelector('#account-summary').innerHTML = accountSummary();
  });
  af?.addEventListener('submit', async event => {
    event.preventDefault(); if (busy) return;
    let clean;
    try { clean = calculateAccounts(accountInput()); }
    catch (err) { error = err.message; updateNotice(); return; }
    if (!await confirmDialog("Once submitted, this day's account record cannot be changed. Do you want to submit?", 'Cancel','Yes, Submit')) return;
    await run(async () => {
      lastSubmitted = await api('accounts.create', { ...clean, requestId: accounts.requestId });
      dirty = false; historyDate = accounts.date; accounts = blankAccounts(); status = 'Day record submitted.'; route = 'accountHistory'; history.pushState({ route }, '', '#accountHistory'); data = lastSubmitted; generation++;
    });
  });
}
async function action(name) {
  if (busy) return;
  if (name === 'profile') { profile = !profile; render(); return; }
  if (name === 'reload') { await load(); return; }
  if (name === 'logout') {
    if (dirty && !await confirmDialog('Discard unsaved changes?', 'Stay','Discard',true)) return;
    await run(async () => { await api('logout'); user = null; route = 'home'; dirty = false; profile = false; receipt = blankReceipt(); accounts = blankAccounts(); preview = null; data = null; error = ''; status = ''; generation++; }); return;
  }
  if (name === 'addRows') { if (accounts.IN.length + accounts.OUT.length >= 200) return; accounts[tab].push(...Array.from({ length: Math.min(3,200-accounts.IN.length-accounts.OUT.length) }, () => ({ description: '', amount: '' }))); render(); return; }
  if (name === 'editReceipt') { navigate('receipt', true); return; }
  if (name === 'saveReceipt') {
    await run(async () => { preview = await api('receipts.create', { ...receiptInput(), requestId: receipt.requestId }); savedPreview = true; dirty = false; receipt = blankReceipt(); status = 'Receipt saved.'; }); return;
  }
  if (name === 'newReceipt') { navigate('receipt'); return; }
  if (name === 'viewSubmitted') { historyDate = lastSubmitted.date; navigate('accountHistory'); return; }
  if (name === 'back') { navigate(route === 'preview' && !savedPreview ? 'receipt' : route === 'preview' && savedPreview ? 'receipts' : 'home', route === 'preview' && !savedPreview); return; }
  navigate(name);
}
async function navigate(next, preserve = false, fromPop = false) {
  if (busy || (route === next && !fromPop)) return;
  if (dirty && !preserve) {
    if (!await confirmDialog('Discard unsaved changes?', 'Stay','Discard',true)) return false;
    dirty = false; receipt = blankReceipt(); accounts = blankAccounts();
  }
  route = next; error = ''; status = ''; profile = false; data = null; readLoading = false; generation++;
  if (!fromPop) history.pushState({ route }, '', `#${route}`);
  render(); window.scrollTo(0, 0); load(); return true;
}
async function load() {
  if (!user || !['home','receipts','accountHistory','accounts'].includes(route)) return;
  const own = ++generation, current = route, date = route === 'accounts' ? accounts.date : historyDate;
  readLoading = true; error = ''; accountLoadFailed = false; render();
  try {
    // Serialize reads so a rotating auth refresh cookie cannot race another request.
    const result = current === 'home' ? { receipts: await api('receipts.list', { date: today() }), account: await api('accounts.get', { date: today() }) } : await api(current === 'receipts' ? 'receipts.list' : 'accounts.get', { date });
    if (own === generation) { data = result; if (current === 'accounts') lastSubmitted = result; }
  } catch (err) { if (own === generation) { error = err.message || ERROR_MESSAGE; data = null; if (current === 'accounts') accountLoadFailed = true; if (err.code === 'UNAUTHORIZED') user = null; } }
  finally { if (own === generation) { readLoading = false; render(); } }
}
async function run(fn) {
  if (busy) return;
  busy = true; error = ''; status = ''; render();
  try { await fn(); }
  catch (err) {
    if (err.code === 'LOCKED') { lastSubmitted = { date: accounts.date }; dirty = false; error = 'This day has already been submitted. Open its saved record.'; }
    else { error = err.message || ERROR_MESSAGE; if (err.code === 'UNAUTHORIZED') user = null; }
  } finally { busy = false; render(); }
}
window.addEventListener('beforeunload', event => { if (dirty || busy) { event.preventDefault(); event.returnValue = ''; } });
window.addEventListener('popstate', async event => {
  const next = event.state?.route || 'home';
  if (!['home','receipt','accounts','receipts','accountHistory','preview'].includes(next)) return;
  if (next === 'preview' && !preview) { history.replaceState({ route }, '', `#${route}`); return; }
  if (busy) { history.pushState({ route }, '', `#${route}`); return; }
  const old = route;
  const changed = await navigate(next, false, true);
  if (!changed) history.pushState({ route: old }, '', `#${old}`);
});
document.addEventListener('keydown', event => { if (event.key === 'Escape' && profile) { profile = false; render(); document.querySelector('.profile-button')?.focus(); } });
document.addEventListener('click', event => { if (profile && !event.target.closest('.profile-wrap')) { profile = false; render(); } });

app.innerHTML = loading();
try { user = await api('session'); }
catch (err) { if (err.code !== 'UNAUTHORIZED') error = err.message || ERROR_MESSAGE; }
history.replaceState({ route: 'home' }, '', '#home');
render();
if (user) load();

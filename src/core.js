export const ERROR_MESSAGE = 'Something went wrong. Please try again. If the issue continues, contact Admin.';
export const money = value => `Rs. ${Number(value).toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
export function today(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Colombo', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
  const p = Object.fromEntries(parts.map(x => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day}`;
}
export function dateValue(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error('Choose a valid date.');
  const n = Date.parse(`${value}T00:00:00Z`);
  if (!Number.isFinite(n) || new Date(n).toISOString().slice(0, 10) !== value) throw new Error('Choose a valid date.');
  return n;
}
export function nightsBetween(checkIn, pickup) {
  const nights = (dateValue(pickup) - dateValue(checkIn)) / 86400000;
  if (nights < 1) throw new Error('Pickup must be after check-in.');
  if (nights > 3650) throw new Error('Stay cannot exceed 3,650 nights.');
  return nights;
}
export function rateFor(type, count, nights) {
  if (!['dog', 'cat'].includes(type) || !Number.isInteger(count) || count < 1 || count > 50 || !Number.isInteger(nights) || nights < 1 || nights > 3650) throw new Error('Invalid boarding details.');
  if (type === 'dog') return nights >= 30 ? 1850 : count === 1 ? (nights <= 3 ? 3000 : nights <= 6 ? 2500 : 2000) : nights <= 3 ? 2500 : 2000;
  return count === 1 ? (nights <= 3 ? 2000 : 1500) : nights <= 4 ? 1850 : 1500;
}
export function textValue(value, label, max = 120, optional = false) {
  if (typeof value !== 'string' || value.trim().length > max || (!optional && !value.trim())) throw new Error(`Enter ${label}.`);
  return value.trim();
}
export function calculateReceipt(input) {
  const customerName = textValue(input.customerName, 'customer name');
  const contactNumber = textValue(input.contactNumber ?? '', 'a valid contact number', 30, true);
  if (contactNumber && !/^[+\d\s().-]{5,30}$/.test(contactNumber)) throw new Error('Enter a valid contact number.');
  const nights = nightsBetween(input.checkInDate, input.pickupDate);
  if (!Array.isArray(input.pets) || input.pets.length < 1 || input.pets.length > 50) throw new Error('Add between 1 and 50 pets.');
  const pets = input.pets.map(p => ({ type: ['dog', 'cat'].includes(p.type) ? p.type : (() => { throw new Error('Choose dog or cat.'); })(), name: textValue(p.name, 'each pet name', 80) }));
  const lines = ['dog', 'cat'].flatMap(type => {
    const count = pets.filter(p => p.type === type).length;
    if (!count) return [];
    const rate = rateFor(type, count, nights);
    return [{ type, count, nights, rate, total: count * nights * rate }];
  });
  const standardTotal = lines.reduce((sum, x) => sum + x.total, 0);
  const standardRatePerNight = lines.reduce((sum, x) => sum + x.count * x.rate, 0);
  const discountReasons = ['Old Customer', 'Long Term', 'Many pets', 'Other'];
  const discountReason = String(input.discountReason ?? '').trim();
  const hasDiscountRate = input.discountRatePerNight !== undefined && input.discountRatePerNight !== null && String(input.discountRatePerNight).trim() !== '';
  if (discountReason && !discountReasons.includes(discountReason)) throw new Error('Choose a valid discount reason.');
  if (!discountReason && hasDiscountRate) throw new Error('Choose a discount reason.');
  let discountRatePerNight = null;
  let discountRateCents = null;
  if (discountReason) {
    discountRateCents = cents(input.discountRatePerNight);
    if (!discountRateCents) throw new Error('Discounted rate must be greater than zero.');
    if (discountRateCents >= Math.round(standardRatePerNight * 100)) throw new Error('Discounted rate must be less than the standard nightly rate.');
    discountRatePerNight = discountRateCents / 100;
  }
  const boardingTotal = discountRateCents === null ? standardTotal : discountRateCents * nights / 100;
  const discountAmount = standardTotal - boardingTotal;
  if (!Array.isArray(input.additionalCharges ?? []) || (input.additionalCharges ?? []).length > 50) throw new Error('Use at most 50 additional charges.');
  const additionalCharges = (input.additionalCharges ?? []).map(charge => {
    const amount = cents(charge.amount);
    if (!amount) throw new Error('Additional charge amounts must be greater than zero.');
    return { name: textValue(charge.name, 'each additional charge name', 120), amount: amount / 100 };
  });
  const additionalChargesTotal = additionalCharges.reduce((sum, charge) => sum + Math.round(charge.amount * 100), 0) / 100;
  return { customerName, contactNumber, pets, checkInDate: input.checkInDate, pickupDate: input.pickupDate, nights, lines, standardRatePerNight, standardTotal, discountReason, discountRatePerNight, discountAmount, boardingTotal, additionalCharges, additionalChargesTotal, finalTotal: boardingTotal + additionalChargesTotal, pricingVersion: '2026-09-v3' };
}
export function cents(value) {
  if (!/^(0|[1-9]\d{0,8})(\.\d{1,2})?$/.test(String(value))) throw new Error('Enter a positive amount with up to 2 decimal places.');
  const n = Math.round(Number(value) * 100);
  if (!Number.isSafeInteger(n)) throw new Error('Amount is too large.');
  return n;
}
export function calculateAccounts(input, currentDate = today()) {
  dateValue(input.date);
  if (input.date > currentDate) throw new Error('Accounts date cannot be in the future.');
  const opening = cents(input.openingCash);
  if (!Array.isArray(input.transactions) || input.transactions.length > 200) throw new Error('Use at most 200 transactions.');
  const transactions = input.transactions.map(t => {
    if (!['IN', 'OUT'].includes(t.type)) throw new Error('Choose Cash In or Cash Out.');
    const amount = cents(t.amount);
    if (!amount) throw new Error('Transaction amounts must be greater than zero.');
    return { type: t.type, description: textValue(t.description, 'a transaction description', 200), amount: amount / 100 };
  });
  const total = type => transactions.filter(t => t.type === type).reduce((sum, t) => sum + Math.round(t.amount * 100), 0);
  return { date: input.date, openingCash: opening / 100, transactions, totalCashIn: total('IN') / 100, totalCashOut: total('OUT') / 100, expectedCash: (opening + total('IN') - total('OUT')) / 100 };
}

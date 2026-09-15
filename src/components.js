export const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const paths = {
  home: '<path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1Z"/>',
  receipt: '<path d="M5 3h14v18l-3-2-4 2-4-2-3 2Z"/><path d="M9 7h6M9 11h6M9 15h3"/>',
  accounts: '<rect x="3" y="5" width="18" height="15" rx="3"/><path d="M3 9h18M16 14h5M7 5V3h10v2"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21v-2a8 8 0 0 1 16 0v2"/>',
  back: '<path d="m14 6-6 6 6 6"/>',
  arrow: '<path d="M5 12h14m-6-6 6 6-6 6"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  trash: '<path d="M4 6h16M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7M14 10v7"/>',
  paw: '<ellipse cx="12" cy="16" rx="6" ry="5"/><ellipse cx="4" cy="10" rx="2" ry="3"/><ellipse cx="9" cy="5" rx="2" ry="3"/><ellipse cx="15" cy="5" rx="2" ry="3"/><ellipse cx="20" cy="10" rx="2" ry="3"/>',
  cat: '<path d="M5 10 3 3l7 4h4l7-4-2 7a8 8 0 1 1-14 0Z"/><path d="M8 12h.01M16 12h.01m-6 4 2 1 2-1M2 15h5m10 0h5"/>',
  dog: '<path d="m6 5-4 6 3 4 2-5m11-5 4 6-3 4-2-5M6 5h12v11a6 6 0 0 1-12 0Z"/><path d="M9 11h.01M15 11h.01m-5 4 2 2 2-2"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  logout: '<path d="M10 4H4v16h6M10 12h11m-4-4 4 4-4 4"/>'
};
export const icon = (name, cls = '') => `<svg class="icon ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.paw}</svg>`;
export const brand = () => `<div class="brand"><span class="brand-mark">${icon('paw')}</span><span>UrbanCoop<small>Pet Boarding</small></span></div>`;
export const button = (label, action, secondary = false, extra = '') => `<button type="button" class="button ${secondary ? 'secondary' : ''}" data-action="${action}" ${extra}>${label}</button>`;
export const field = (label, name, value = '', options = '') => `<label class="field"><span>${label}</span><input name="${name}" value="${escape(value)}" ${options}></label>`;
export const loading = () => `<div class="loading" role="status"><span class="pet-bounce">${icon('dog')}${icon('cat')}</span><span>Loading...</span></div>`;
export async function confirmDialog(message, cancelText, confirmText, danger = false) {
  const previous = document.activeElement;
  const dialog = document.createElement('dialog');
  dialog.className = 'confirmation';
  dialog.innerHTML = `<form method="dialog"><span class="dialog-icon">${icon(danger ? 'back' : 'accounts')}</span><h2 id="confirm-title">${escape(message)}</h2><div class="dialog-actions"><button class="button secondary" value="cancel" autofocus>${cancelText}</button><button class="button ${danger ? 'danger' : ''}" value="confirm">${confirmText}</button></div></form>`;
  dialog.setAttribute('aria-labelledby', 'confirm-title');
  document.body.append(dialog);
  dialog.showModal();
  return new Promise(resolve => dialog.addEventListener('close', () => { const result = dialog.returnValue === 'confirm'; dialog.remove(); previous?.focus(); resolve(result); }, { once: true }));
}

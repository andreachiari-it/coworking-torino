// js/ui/toast.js — notifiche in italiano, con aria-live per gli screen reader.
import { el } from './dom.js';

let region = null;

function getRegion() {
  if (region && document.body.contains(region)) return region;
  region = el('div', { className: 'toast-region', role: 'status', 'aria-live': 'polite' });
  document.body.append(region);
  return region;
}

/**
 * @param {string} message
 * @param {{ variant?: 'default'|'danger', duration?: number }} [options]
 */
export function showToast(message, { variant = 'default', duration = 5000 } = {}) {
  const toast = el('div', {
    className: variant === 'danger' ? 'toast toast-danger' : 'toast',
  }, message);

  getRegion().append(toast);

  window.setTimeout(() => {
    toast.remove();
  }, duration);

  return toast;
}

export function showError(message) {
  return showToast(message, { variant: 'danger' });
}

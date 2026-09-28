// js/ui/modal.js — modal minimale, riusato da segnalazioni e "nuovo spazio".
import { el } from './dom.js';

/**
 * @param {(Node|string)[]} content
 * @returns {HTMLElement} il backdrop, per poterlo rimuovere (`.remove()`) dopo il submit.
 */
export function openModal(content) {
  const backdrop = el(
    'div',
    {
      className: 'modal-backdrop',
      onClick: (e) => {
        if (e.target === backdrop) backdrop.remove();
      },
    },
    [el('div', { className: 'modal', role: 'dialog', 'aria-modal': 'true' }, content)]
  );
  document.body.append(backdrop);

  const firstField = backdrop.querySelector('input, textarea, select, button');
  firstField?.focus();

  const onKeydown = (e) => {
    if (e.key === 'Escape') {
      backdrop.remove();
      document.removeEventListener('keydown', onKeydown);
    }
  };
  document.addEventListener('keydown', onKeydown);

  return backdrop;
}

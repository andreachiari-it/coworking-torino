// js/ui/suggest-space-modal.js — "Suggerisci un nuovo spazio" da app.html.
import { el } from './dom.js';
import { openModal } from './modal.js';
import { showToast, showError } from './toast.js';
import { createSuggestion } from '../api/suggestions.js';

/**
 * @param {Record<string, {value:string}[]>} fieldOptions
 */
export function openSuggestSpaceModal(fieldOptions) {
  const nameInput = el('input', { className: 'input', required: true });
  const typeSelect = selectFromOptions(fieldOptions.type);
  const zoneSelect = selectFromOptions(fieldOptions.zone);
  const addressInput = el('input', { className: 'input' });
  const costSelect = selectFromOptions(fieldOptions.cost_type);
  const priceInput = el('input', { className: 'input', type: 'number', min: '0' });
  const wifiSelect = selectFromOptions(fieldOptions.wifi_quality);
  const powerSelect = selectFromOptions(fieldOptions.power_outlets);
  const hoursInput = el('input', { className: 'input' });
  const notesInput = el('textarea', { className: 'textarea' });
  const messageInput = el('textarea', { className: 'textarea', placeholder: 'Come lo conosci? Qualsiasi dettaglio ci aiuta a verificarlo.' });

  const form = el('form', {}, [
    el('h2', {}, 'Suggerisci un nuovo spazio'),
    field('Nome', nameInput),
    field('Tipo', typeSelect),
    field('Zona', zoneSelect),
    field('Indirizzo', addressInput),
    field('Costo', costSelect),
    field('Prezzo (€/giorno, se fisso)', priceInput),
    field('Wifi', wifiSelect),
    field('Prese', powerSelect),
    field('Orari', hoursInput),
    field('Note', notesInput),
    field('Messaggio per chi verifica', messageInput),
    el('div', { className: 'space-detail-actions' }, [
      el('button', { type: 'submit', className: 'btn btn-primary' }, 'Invia suggerimento'),
      el('button', { type: 'button', className: 'btn btn-ghost', id: 'cancel-suggest-space' }, 'Annulla'),
    ]),
  ]);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = nameInput.value.trim();
    if (!name) {
      showError('Il nome dello spazio è obbligatorio.');
      return;
    }

    const payload = {
      name,
      type: typeSelect.value || null,
      zone: zoneSelect.value || null,
      address: addressInput.value.trim() || null,
      cost_type: costSelect.value || null,
      price_per_day: priceInput.value || null,
      wifi_quality: wifiSelect.value || null,
      power_outlets: powerSelect.value || null,
      opening_hours: hoursInput.value.trim() || null,
      notes: notesInput.value.trim() || null,
    };

    const { error } = await createSuggestion({ kind: 'new_space', payload, message: messageInput.value.trim() });
    if (error) return;

    showToast('Grazie! Lo verifichiamo prima di pubblicarlo.');
    modal.remove();
  });

  form.querySelector('#cancel-suggest-space').addEventListener('click', () => modal.remove());

  const modal = openModal([form]);
}

function selectFromOptions(options = []) {
  return el('select', { className: 'select' }, [
    el('option', { value: '' }, 'Non specificato'),
    ...options.map((o) => el('option', { value: o.value }, o.value)),
  ]);
}

function field(label, input) {
  return el('div', { className: 'field' }, [el('label', { className: 'field-label' }, label), input]);
}

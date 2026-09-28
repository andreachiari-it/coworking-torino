// js/ui/admin/field-options-tab.js — CRUD su field_options (sezione 7.2).
import { el, render } from '../dom.js';
import { showToast, showError } from '../toast.js';
import {
  listFieldOptionsFlat,
  createFieldOption,
  renameFieldOption,
  deleteFieldOption,
  countSpacesUsingFieldOption,
} from '../../api/field-options.js';

const FIELDS = ['type', 'zone', 'cost_type', 'source', 'personal_rating', 'wifi_quality', 'power_outlets', 'call_space', 'mood'];
const COLORS = ['green', 'yellow', 'red', 'blue', 'purple', 'orange', 'pink', 'gray'];

export async function mountFieldOptionsTab(container) {
  render(container, [el('h1', {}, 'Opzioni campi'), el('div', { id: 'field-options-list' })]);
  await reload(container);
}

async function reload(container) {
  const options = await listFieldOptionsFlat();
  const byField = {};
  for (const row of options) {
    if (!byField[row.field]) byField[row.field] = [];
    byField[row.field].push(row);
  }

  render(
    container.querySelector('#field-options-list'),
    FIELDS.map((field) =>
      el('section', { className: 'profile-section', style: 'margin-top: var(--space-6);' }, [
        el('h2', {}, field),
        el(
          'div',
          { className: 'admin-table-wrap' },
          el(
            'table',
            { className: 'admin-table' },
            [
              el('thead', {}, el('tr', {}, [el('th', {}, 'Valore'), el('th', {}, 'Colore'), el('th', {}, 'Ordine'), el('th', {}, 'In uso'), el('th', {}, 'Azioni')])),
              el(
                'tbody',
                {},
                (byField[field] || []).map((opt) => renderOptionRow(field, opt, container))
              ),
            ]
          )
        ),
        renderAddForm(field, container),
      ])
    )
  );
}

function renderOptionRow(field, opt, container) {
  const usageEl = el('span', {}, '…');
  countSpacesUsingFieldOption(field, opt.value).then((count) => {
    usageEl.textContent = String(count);
    usageEl.dataset.count = count;
  });

  return el('tr', {}, [
    el('td', {}, opt.value),
    el('td', {}, opt.color || '—'),
    el('td', {}, String(opt.sort_order)),
    el('td', {}, usageEl),
    el('td', {}, [
      el(
        'button',
        {
          type: 'button',
          className: 'btn btn-ghost btn-sm',
          onClick: async () => {
            const newValue = window.prompt(`Nuovo nome per "${opt.value}":`, opt.value);
            if (!newValue || newValue === opt.value) return;
            const { error } = await renameFieldOption(field, opt.value, newValue);
            if (error) return;
            showToast('Valore rinominato.');
            reload(container);
          },
        },
        'Rinomina'
      ),
      el(
        'button',
        {
          type: 'button',
          className: 'btn btn-danger btn-sm',
          onClick: async () => {
            const count = Number(usageEl.dataset.count || 0);
            if (count > 0) {
              showError(`In uso da ${count} spazi: non posso eliminarlo.`);
              return;
            }
            if (!window.confirm(`Eliminare "${opt.value}"?`)) return;
            const { error } = await deleteFieldOption(field, opt.value);
            if (error) return;
            showToast('Valore eliminato.');
            reload(container);
          },
        },
        'Elimina'
      ),
    ]),
  ]);
}

function renderAddForm(field, container) {
  const valueInput = el('input', { className: 'input', placeholder: 'Nuovo valore', style: 'max-width:200px;' });
  const colorSelect = el('select', { className: 'select', style: 'max-width:140px;' }, [
    el('option', { value: '' }, 'Colore'),
    ...COLORS.map((c) => el('option', { value: c }, c)),
  ]);
  const sortInput = el('input', { className: 'input', type: 'number', placeholder: 'Ordine', style: 'max-width:100px;' });

  return el('form', { className: 'admin-toolbar', style: 'margin-top: var(--space-3);' }, [
    valueInput,
    colorSelect,
    sortInput,
    el(
      'button',
      {
        type: 'submit',
        className: 'btn btn-secondary btn-sm',
        onClick: async (e) => {
          e.preventDefault();
          const value = valueInput.value.trim();
          if (!value) return;
          const { error } = await createFieldOption({ field, value, color: colorSelect.value, sortOrder: Number(sortInput.value) || 0 });
          if (error) return;
          showToast('Valore aggiunto.');
          reload(container);
        },
      },
      'Aggiungi'
    ),
  ]);
}

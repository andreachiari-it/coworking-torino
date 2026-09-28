// js/ui/admin/spaces-tab.js — anagrafica spazi (sezione 7.1): la parte più
// importante della dashboard.
import { el, render } from '../dom.js';
import { showToast, showError } from '../toast.js';
import { listAllSpaces, updateSpace, deleteSpace, duplicateSpace, bulkSetPublished } from '../../api/admin.js';
import { computeCompleteness } from '../../lib/completeness.js';
import { openSpaceEditor } from './space-editor.js';
import { openImportModal } from './import-export.js';
import { exportSpacesCsv, exportSpacesJson } from './import-export.js';

const CRITICAL_FIELDS = ['address', 'zone', 'cost_type', 'wifi_quality', 'power_outlets', 'last_verified_at'];

let allSpaces = [];
let fieldOptionsRef = {};
let sortKey = 'name';
let sortDir = 1;
let selected = new Set();
let filterState = { q: '', type: '', zone: '', source: '', published: '', incomplete: false };

export async function mountSpacesTab(container, fieldOptions) {
  fieldOptionsRef = fieldOptions;
  render(container, [
    el('h1', {}, 'Spazi'),
    el('div', { className: 'admin-toolbar' }, [
      el('input', { className: 'input', placeholder: 'Cerca...', style: 'max-width:220px;', onInput: (e) => { filterState.q = e.target.value; renderTable(container); } }),
      selectFilter('type', 'Tutti i tipi', fieldOptions.type, container),
      selectFilter('zone', 'Tutte le zone', fieldOptions.zone, container),
      selectFilter('source', 'Tutte le fonti', fieldOptions.source, container),
      el(
        'select',
        { className: 'select', onChange: (e) => { filterState.published = e.target.value; renderTable(container); } },
        [el('option', { value: '' }, 'Pubblicati e non'), el('option', { value: '1' }, 'Solo pubblicati'), el('option', { value: '0' }, 'Solo nascosti')]
      ),
      el('label', { className: 'checkbox-row' }, [
        el('input', { type: 'checkbox', onChange: (e) => { filterState.incomplete = e.target.checked; renderTable(container); } }),
        el('span', {}, 'Da completare'),
      ]),
      el('button', { type: 'button', className: 'btn btn-primary btn-sm', onClick: () => openSpaceEditor(null, { fieldOptions, onSaved: () => reload(container) }) }, 'Nuovo spazio'),
      el('button', { type: 'button', className: 'btn btn-secondary btn-sm', onClick: () => exportSpacesCsv(allSpaces) }, 'Esporta CSV'),
      el('button', { type: 'button', className: 'btn btn-secondary btn-sm', onClick: () => exportSpacesJson(allSpaces) }, 'Esporta JSON'),
      el('button', { type: 'button', className: 'btn btn-secondary btn-sm', onClick: () => openImportModal(allSpaces, () => reload(container)) }, 'Importa CSV'),
    ]),
    el('div', { id: 'bulk-actions-bar' }),
    el('div', { className: 'admin-table-wrap' }, [el('table', { className: 'admin-table', id: 'spaces-table' })]),
  ]);

  await reload(container);
}

async function reload(container) {
  allSpaces = await listAllSpaces();
  selected = new Set();
  renderTable(container);
}

function selectFilter(field, placeholder, options = [], container) {
  return el(
    'select',
    { className: 'select', onChange: (e) => { filterState[field] = e.target.value; renderTable(container); } },
    [el('option', { value: '' }, placeholder), ...options.map((o) => el('option', { value: o.value }, o.value))]
  );
}

function filteredSpaces() {
  return allSpaces.filter((s) => {
    if (filterState.q && !`${s.name} ${s.address || ''}`.toLowerCase().includes(filterState.q.toLowerCase())) return false;
    if (filterState.type && s.type !== filterState.type) return false;
    if (filterState.zone && s.zone !== filterState.zone) return false;
    if (filterState.source && s.source !== filterState.source) return false;
    if (filterState.published === '1' && !s.is_published) return false;
    if (filterState.published === '0' && s.is_published) return false;
    if (filterState.incomplete && !CRITICAL_FIELDS.some((f) => !s[f])) return false;
    return true;
  });
}

function renderTable(container) {
  const table = container.querySelector('#spaces-table');
  const rows = filteredSpaces().sort((a, b) => {
    const va = a[sortKey] ?? '';
    const vb = b[sortKey] ?? '';
    return va > vb ? sortDir : va < vb ? -sortDir : 0;
  });

  const columns = [
    { key: null, label: '' },
    { key: 'name', label: 'Nome' },
    { key: 'type', label: 'Tipo' },
    { key: 'zone', label: 'Zona' },
    { key: 'cost_type', label: 'Costo' },
    { key: 'price_per_day', label: 'Prezzo' },
    { key: 'personal_rating', label: 'Rating' },
    { key: 'source', label: 'Fonte' },
    { key: 'is_published', label: 'Pubblicato' },
    { key: null, label: 'Completezza' },
    { key: 'last_verified_at', label: 'Ultima verifica' },
  ];

  render(table, [
    el(
      'thead',
      {},
      el(
        'tr',
        {},
        columns.map((c) =>
          el(
            'th',
            c.key ? { onClick: () => { sortDir = sortKey === c.key ? -sortDir : 1; sortKey = c.key; renderTable(container); } } : {},
            c.key === sortKey ? `${c.label} ${sortDir === 1 ? '▲' : '▼'}` : c.label
          )
        )
      )
    ),
    el(
      'tbody',
      {},
      rows.map((space) => renderRow(space, container))
    ),
  ]);

  renderBulkBar(container);
}

function renderRow(space, container) {
  const { filled, total } = computeCompleteness(space);
  const pillClass = filled / total < 0.5 ? 'completeness-pill--low' : filled / total >= 0.85 ? 'completeness-pill--high' : '';

  return el('tr', {}, [
    el('td', {}, [
      el('input', {
        type: 'checkbox',
        checked: selected.has(space.id),
        onChange: (e) => {
          if (e.target.checked) selected.add(space.id);
          else selected.delete(space.id);
          renderBulkBar(container);
        },
      }),
    ]),
    el('td', {}, [el('a', { href: '#', onClick: (e) => { e.preventDefault(); openSpaceEditor(space, { fieldOptions: fieldOptionsRef, onSaved: () => reload(container) }); } }, space.name)]),
    el('td', {}, space.type || '—'),
    el('td', {}, space.zone || '—'),
    el('td', {}, space.cost_type || '—'),
    el('td', {}, inlineNumberCell(space, 'price_per_day', container)),
    el('td', {}, inlineSelectCell(space, 'personal_rating', fieldOptionsRef.personal_rating, container)),
    el('td', {}, space.source || '—'),
    el('td', {}, [
      el('input', {
        type: 'checkbox',
        checked: space.is_published,
        onChange: async (e) => {
          const prev = space.is_published;
          space.is_published = e.target.checked;
          const { error } = await updateSpace(space.id, { is_published: e.target.checked });
          if (error) { space.is_published = prev; e.target.checked = prev; }
        },
      }),
    ]),
    el('td', {}, el('span', { className: `completeness-pill ${pillClass}` }, `${filled}/${total}`)),
    el('td', {}, space.last_verified_at || '—'),
  ]);
}

function inlineNumberCell(space, key, container) {
  const input = el('input', {
    className: 'admin-inline-input',
    type: 'number',
    value: space[key] ?? '',
    onChange: async (e) => {
      const value = e.target.value === '' ? null : Number(e.target.value);
      input.dataset.state = 'saving';
      const { error } = await updateSpace(space.id, { [key]: value });
      input.dataset.state = error ? 'error' : '';
      if (!error) space[key] = value;
    },
  });
  return input;
}

function inlineSelectCell(space, key, options = [], container) {
  return el(
    'select',
    {
      className: 'admin-inline-input',
      onChange: async (e) => {
        const value = e.target.value || null;
        const { error } = await updateSpace(space.id, { [key]: value });
        if (!error) space[key] = value;
      },
    },
    [el('option', { value: '', selected: !space[key] }, '—'), ...options.map((o) => el('option', { value: o.value, selected: o.value === space[key] }, o.value))]
  );
}

function renderBulkBar(container) {
  const bar = container.querySelector('#bulk-actions-bar');
  if (selected.size === 0) {
    render(bar, []);
    return;
  }
  render(bar, [
    el('div', { className: 'admin-toolbar' }, [
      el('span', {}, `${selected.size} selezionati`),
      el('button', { type: 'button', className: 'btn btn-secondary btn-sm', onClick: async () => { await bulkSetPublished([...selected], true); showToast('Pubblicati.'); reload(container); } }, 'Pubblica'),
      el('button', { type: 'button', className: 'btn btn-secondary btn-sm', onClick: async () => { await bulkSetPublished([...selected], false); showToast('Nascosti.'); reload(container); } }, 'Nascondi'),
      el(
        'button',
        {
          type: 'button',
          className: 'btn btn-secondary btn-sm',
          onClick: async () => {
            for (const id of selected) {
              const space = allSpaces.find((s) => s.id === id);
              if (space) await duplicateSpace(space);
            }
            showToast('Duplicati.');
            reload(container);
          },
        },
        'Duplica'
      ),
      el(
        'button',
        {
          type: 'button',
          className: 'btn btn-danger btn-sm',
          onClick: async () => {
            if (!window.confirm(`Eliminare ${selected.size} spazi? L'azione non si può annullare.`)) return;
            for (const id of selected) await deleteSpace(id);
            showToast('Eliminati.');
            reload(container);
          },
        },
        'Elimina'
      ),
    ]),
  ]);
}

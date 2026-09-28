// js/ui/admin/import-export.js — esporta/importa l'anagrafica (sezione 7.1).
import { el, render } from '../dom.js';
import { openModal } from '../modal.js';
import { showToast, showError } from '../toast.js';
import { createSpace, updateSpace } from '../../api/admin.js';

const COLUMNS = [
  'slug', 'name', 'type', 'zone', 'address', 'lat', 'lng', 'cost_type', 'price_per_day', 'source',
  'personal_rating', 'wifi_quality', 'wifi_notes', 'power_outlets', 'call_space', 'mood', 'opening_hours',
  'has_outdoor', 'booking_required', 'instagram_url', 'maps_url', 'website_url', 'notes', 'notion_page_id',
  'last_verified_at', 'is_published',
];

// --- Export -----------------------------------------------------------

export function exportSpacesJson(spaces) {
  downloadBlob(JSON.stringify(spaces, null, 2), 'application/json', 'spazi-coworking-torino.json');
}

export function exportSpacesCsv(spaces) {
  const lines = [COLUMNS.join(',')];
  for (const space of spaces) {
    lines.push(COLUMNS.map((col) => csvCell(space[col])).join(','));
  }
  downloadBlob(lines.join('\r\n'), 'text/csv', 'spazi-coworking-torino.csv');
}

function csvCell(value) {
  if (value == null) return '';
  const text = Array.isArray(value) ? value.join(';') : String(value);
  if (/[",\r\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

function downloadBlob(content, type, filename) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

// --- Import -------------------------------------------------------------

export function openImportModal(currentSpaces, onDone) {
  const fileInput = el('input', { type: 'file', accept: '.csv' });
  const preview = el('div', { style: 'margin-top: var(--space-4); max-height: 320px; overflow-y: auto;' });
  let parsedRows = [];
  let plan = null;

  fileInput.addEventListener('change', async () => {
    const file = fileInput.files[0];
    if (!file) return;
    const text = await file.text();
    parsedRows = parseCsv(text);
    plan = buildImportPlan(parsedRows, currentSpaces);
    renderPreview(preview, plan);
  });

  const applyBtn = el(
    'button',
    {
      type: 'submit',
      className: 'btn btn-primary',
      onClick: async (e) => {
        e.preventDefault();
        if (!plan) {
          showError('Scegli prima un file CSV.');
          return;
        }
        for (const row of plan.newRows) await createSpace(row.values);
        for (const row of plan.changedRows) await updateSpace(row.existing.id, row.changes);
        showToast(`Import completato: ${plan.newRows.length} nuovi, ${plan.changedRows.length} modificati.`);
        modal.remove();
        onDone();
      },
    },
    'Applica import'
  );

  const form = el('form', {}, [
    el('h2', {}, 'Importa spazi da CSV'),
    el('p', { className: 'field-hint' }, 'Colonne attese, stesso ordine dell\'esportazione. Il confronto avviene per slug (o notion_page_id se lo slug manca).'),
    el('div', { className: 'field' }, [fileInput]),
    preview,
    el('div', { className: 'space-detail-actions' }, [applyBtn, el('button', { type: 'button', className: 'btn btn-ghost', onClick: () => modal.remove() }, 'Annulla')]),
  ]);

  const modal = openModal([form]);
}

function renderPreview(container, plan) {
  render(container, [
    el('p', {}, `${plan.newRows.length} nuovi · ${plan.changedRows.length} modificati · ${plan.unchangedCount} invariati`),
    ...plan.changedRows.slice(0, 20).map((row) =>
      el('div', { className: 'card', style: 'margin-top: var(--space-2);' }, [
        el('strong', {}, row.existing.name),
        ...Object.entries(row.changes).map(([field, value]) =>
          el('div', { className: 'diff-row' }, [el('span', {}, field), el('span', { className: 'diff-old' }, String(row.existing[field] ?? '—')), el('span', { className: 'diff-new' }, String(value ?? '—'))])
        ),
      ])
    ),
    plan.changedRows.length > 20 ? el('p', { className: 'field-hint' }, `+ altri ${plan.changedRows.length - 20} modificati`) : null,
  ]);
}

function buildImportPlan(rows, currentSpaces) {
  const bySlug = new Map(currentSpaces.map((s) => [s.slug, s]));
  const byNotionId = new Map(currentSpaces.filter((s) => s.notion_page_id).map((s) => [s.notion_page_id, s]));

  const newRows = [];
  const changedRows = [];
  let unchangedCount = 0;

  for (const row of rows) {
    const values = normalizeRow(row);
    const existing = (values.slug && bySlug.get(values.slug)) || (values.notion_page_id && byNotionId.get(values.notion_page_id));

    if (!existing) {
      newRows.push({ values });
      continue;
    }

    const changes = {};
    for (const col of COLUMNS) {
      if (col === 'slug') continue;
      const newVal = values[col];
      const oldVal = existing[col];
      const equal = Array.isArray(newVal) ? JSON.stringify(newVal) === JSON.stringify(oldVal || []) : newVal === (oldVal ?? null);
      if (!equal) changes[col] = newVal;
    }

    if (Object.keys(changes).length === 0) unchangedCount += 1;
    else changedRows.push({ existing, changes });
  }

  return { newRows, changedRows, unchangedCount };
}

function normalizeRow(row) {
  const values = { ...row };
  values.mood = row.mood ? row.mood.split(';').filter(Boolean) : [];
  values.lat = row.lat ? Number(row.lat) : null;
  values.lng = row.lng ? Number(row.lng) : null;
  values.price_per_day = row.price_per_day ? Number(row.price_per_day) : null;
  values.has_outdoor = row.has_outdoor === 'true' || row.has_outdoor === '1';
  values.booking_required = row.booking_required === 'true' || row.booking_required === '1';
  values.is_published = row.is_published === '' || row.is_published == null ? true : row.is_published === 'true' || row.is_published === '1';
  for (const col of COLUMNS) {
    if (values[col] === '') values[col] = null;
  }
  return values;
}

/** Parser CSV minimale ma corretto: gestisce virgolette, virgole e newline dentro i campi. */
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];

    if (inQuotes) {
      if (char === '"' && text[i + 1] === '"') {
        field += '"';
        i += 1;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
    } else if (char === ',') {
      row.push(field);
      field = '';
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && text[i + 1] === '\n') i += 1;
      row.push(field);
      field = '';
      if (row.some((c) => c !== '')) rows.push(row);
      row = [];
    } else {
      field += char;
    }
  }
  if (field !== '' || row.length) {
    row.push(field);
    rows.push(row);
  }

  const [header, ...dataRows] = rows;
  return dataRows.map((r) => Object.fromEntries(header.map((col, idx) => [col.trim(), r[idx]])));
}

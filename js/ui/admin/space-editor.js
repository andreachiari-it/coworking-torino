// js/ui/admin/space-editor.js — pannello di modifica completo di uno spazio
// (sezione 7.1). Mappa con pin trascinabile + geocoding, copertina,
// storico modifiche.
import { el, render } from '../dom.js';
import { showToast, showError } from '../toast.js';
import { createSpace, updateSpace, deleteSpace, getAuditLogForSpace, uploadCoverImage } from '../../api/admin.js';
import { formatDate } from '../../lib/format.js';

const SELECT_FIELDS = ['type', 'zone', 'cost_type', 'source', 'personal_rating', 'wifi_quality', 'power_outlets', 'call_space'];

let isDirty = false;
const onBeforeUnload = (e) => {
  if (!isDirty) return;
  e.preventDefault();
  e.returnValue = '';
};

/**
 * @param {object|null} space - null per un nuovo spazio
 * @param {{ fieldOptions: Record<string, {value:string}[]>, onSaved: () => void }} ctx
 */
export function openSpaceEditor(space, { fieldOptions, onSaved }) {
  const isNew = !space;
  const drawer = el('div', { className: 'drawer', dataset: { open: 'true' } }, [
    el('div', { className: 'drawer-backdrop', onClick: () => tryClose() }),
    el('div', { className: 'drawer-panel admin-editor-panel', id: 'space-editor-panel' }),
  ]);
  document.body.append(drawer);
  document.body.style.overflow = 'hidden';
  window.addEventListener('beforeunload', onBeforeUnload);
  isDirty = false;

  const panel = drawer.querySelector('#space-editor-panel');
  const inputs = {};

  function tryClose() {
    if (isDirty && !window.confirm('Hai modifiche non salvate. Vuoi uscire comunque?')) return;
    close();
  }

  function close() {
    window.removeEventListener('beforeunload', onBeforeUnload);
    document.body.style.overflow = '';
    drawer.remove();
  }

  function markDirty() {
    isDirty = true;
  }

  const fields = space || {
    name: '', slug: '', type: '', zone: '', address: '', lat: null, lng: null,
    cost_type: '', price_per_day: '', source: '', personal_rating: '', wifi_quality: '', wifi_notes: '',
    power_outlets: '', call_space: '', mood: [], opening_hours: '', has_outdoor: false, booking_required: false,
    instagram_url: '', maps_url: '', website_url: '', notes: '', last_verified_at: '', cover_image_url: '', is_published: true,
  };

  const content = [
    el('div', { style: 'display:flex; justify-content:space-between; align-items:center;' }, [
      el('h2', {}, isNew ? 'Nuovo spazio' : space.name),
      el('button', { type: 'button', className: 'btn btn-ghost btn-sm', onClick: tryClose }, 'Chiudi'),
    ]),

    textField('name', 'Nome', fields.name, markDirty, inputs),
    textField('slug', 'Slug (vuoto = generato automaticamente)', fields.slug, markDirty, inputs),

    el('div', { className: 'admin-editor-grid' }, [
      selectField('type', 'Tipo', fieldOptions.type, fields.type, markDirty, inputs),
      selectField('zone', 'Zona', fieldOptions.zone, fields.zone, markDirty, inputs),
    ]),

    textField('address', 'Indirizzo', fields.address, markDirty, inputs),

    el('div', { className: 'admin-editor-grid' }, [
      numberField('lat', 'Latitudine', fields.lat, markDirty, inputs),
      numberField('lng', 'Longitudine', fields.lng, markDirty, inputs),
    ]),
    el('button', { type: 'button', className: 'btn btn-secondary btn-sm', id: 'geocode-btn' }, 'Trova da indirizzo'),
    el('div', { id: 'admin-editor-map' }),

    el('div', { className: 'admin-editor-grid' }, [
      selectField('cost_type', 'Costo', fieldOptions.cost_type, fields.cost_type, markDirty, inputs),
      numberField('price_per_day', 'Prezzo (€/giorno)', fields.price_per_day, markDirty, inputs),
      selectField('source', 'Fonte', fieldOptions.source, fields.source, markDirty, inputs),
      selectField('personal_rating', 'Rating personale', fieldOptions.personal_rating, fields.personal_rating, markDirty, inputs),
      selectField('wifi_quality', 'Wifi', fieldOptions.wifi_quality, fields.wifi_quality, markDirty, inputs),
      selectField('power_outlets', 'Prese', fieldOptions.power_outlets, fields.power_outlets, markDirty, inputs),
      selectField('call_space', 'Spazio per call', fieldOptions.call_space, fields.call_space, markDirty, inputs),
    ]),
    textField('wifi_notes', 'Note wifi', fields.wifi_notes, markDirty, inputs),
    textareaField('opening_hours', 'Orari', fields.opening_hours, markDirty, inputs),

    moodField(fieldOptions.mood || [], fields.mood || [], markDirty, inputs),

    el('div', { className: 'admin-editor-grid' }, [
      checkboxField('has_outdoor', 'Spazio esterno', fields.has_outdoor, markDirty, inputs),
      checkboxField('booking_required', 'Prenotazione richiesta', fields.booking_required, markDirty, inputs),
      checkboxField('is_published', 'Pubblicato', fields.is_published, markDirty, inputs),
    ]),

    textField('instagram_url', 'Instagram', fields.instagram_url, markDirty, inputs),
    textField('maps_url', 'Link Maps', fields.maps_url, markDirty, inputs),
    textField('website_url', 'Sito', fields.website_url, markDirty, inputs),
    textareaField('notes', 'Note', fields.notes, markDirty, inputs),

    el('div', { className: 'field' }, [
      el('label', { className: 'field-label' }, 'Ultima verifica'),
      el('div', { style: 'display:flex; gap: var(--space-3); align-items:center;' }, [
        (() => {
          const input = el('input', { className: 'input', type: 'date', value: fields.last_verified_at || '', onChange: markDirty });
          inputs.last_verified_at = input;
          return input;
        })(),
        el(
          'button',
          {
            type: 'button',
            className: 'btn btn-secondary btn-sm',
            onClick: () => {
              inputs.last_verified_at.value = new Date().toISOString().slice(0, 10);
              markDirty();
            },
          },
          'Segna verificato oggi'
        ),
      ]),
    ]),

    coverImageField(fields, markDirty, inputs, space?.id),

    el('div', { className: 'space-detail-actions' }, [
      el('button', { type: 'button', className: 'btn btn-primary', id: 'save-space-btn' }, isNew ? 'Crea spazio' : 'Salva modifiche'),
      !isNew ? el('button', { type: 'button', className: 'btn btn-danger', id: 'delete-space-btn' }, 'Elimina') : null,
    ]),

    !isNew ? el('div', { id: 'audit-log-section' }) : null,
  ];

  render(panel, content);

  initMiniMap(inputs, fields, markDirty);
  document.getElementById('geocode-btn').addEventListener('click', () => geocodeAddress(inputs, markDirty));
  document.getElementById('save-space-btn').addEventListener('click', () => handleSave(space, inputs, fieldOptions, onSaved, close));
  document.getElementById('delete-space-btn')?.addEventListener('click', () => handleDelete(space, close, onSaved));

  if (!isNew) mountAuditLog(space.id);
}

// --- Campi del form ---------------------------------------------------

function textField(key, label, value, onChange, inputs) {
  const input = el('input', { className: 'input', value: value ?? '', onInput: onChange });
  inputs[key] = input;
  return el('div', { className: 'field' }, [el('label', { className: 'field-label' }, label), input]);
}

function numberField(key, label, value, onChange, inputs) {
  const input = el('input', { className: 'input', type: 'number', step: 'any', value: value ?? '', onInput: onChange });
  inputs[key] = input;
  return el('div', { className: 'field' }, [el('label', { className: 'field-label' }, label), input]);
}

function textareaField(key, label, value, onChange, inputs) {
  const input = el('textarea', { className: 'textarea', onInput: onChange }, value || '');
  inputs[key] = input;
  return el('div', { className: 'field' }, [el('label', { className: 'field-label' }, label), input]);
}

function checkboxField(key, label, checked, onChange, inputs) {
  const input = el('input', { type: 'checkbox', checked: Boolean(checked), onChange });
  inputs[key] = input;
  return el('label', { className: 'checkbox-row' }, [input, el('span', {}, label)]);
}

function selectField(key, label, options = [], value, onChange, inputs) {
  const select = el(
    'select',
    { className: 'select', onChange },
    [el('option', { value: '', selected: !value }, '—'), ...options.map((o) => el('option', { value: o.value, selected: o.value === value }, o.value))]
  );
  inputs[key] = select;
  return el('div', { className: 'field' }, [el('label', { className: 'field-label' }, label), select]);
}

function moodField(options, selected, onChange, inputs) {
  const state = new Set(selected);
  const chipRow = el(
    'div',
    { className: 'chip-row' },
    options.map((o) => {
      const active = state.has(o.value);
      return el(
        'button',
        {
          type: 'button',
          className: 'chip',
          'aria-pressed': active ? 'true' : 'false',
          onClick: (e) => {
            if (state.has(o.value)) {
              state.delete(o.value);
              e.target.setAttribute('aria-pressed', 'false');
            } else {
              state.add(o.value);
              e.target.setAttribute('aria-pressed', 'true');
            }
            onChange();
          },
        },
        o.value
      );
    })
  );
  inputs.mood = { get value() { return [...state]; } };
  return el('div', { className: 'field' }, [el('span', { className: 'field-label' }, 'Mood'), chipRow]);
}

function coverImageField(fields, markDirty, inputs, spaceId) {
  const preview = el('img', {
    src: fields.cover_image_url || '',
    alt: fields.cover_image_url ? `Copertina di ${fields.name || 'questo spazio'}` : '',
    style: `max-width:200px; border-radius:8px; margin-top:8px; ${fields.cover_image_url ? '' : 'display:none;'}`,
  });
  const urlInput = el('input', { type: 'hidden', value: fields.cover_image_url || '' });
  inputs.cover_image_url = urlInput;

  const fileInput = el('input', {
    type: 'file',
    accept: 'image/*',
    onChange: async (e) => {
      const file = e.target.files[0];
      if (!file || !spaceId) {
        if (!spaceId) showError('Salva prima lo spazio, poi carica la copertina.');
        return;
      }
      const { data: publicUrl, error } = await uploadCoverImage(spaceId, file);
      if (error) return;
      urlInput.value = publicUrl;
      preview.src = publicUrl;
      preview.style.display = '';
      markDirty();
      showToast('Copertina caricata.');
    },
  });

  return el('div', { className: 'field' }, [el('label', { className: 'field-label' }, 'Immagine di copertina'), fileInput, preview]);
}

// --- Mappa con pin trascinabile -----------------------------------------

let editorMapRefs = null;

function initMiniMap(inputs, fields, markDirty) {
  const L = window.L;
  const lat = fields.lat ?? 45.0703;
  const lng = fields.lng ?? 7.6869;

  const map = L.map('admin-editor-map').setView([lat, lng], fields.lat != null ? 15 : 12);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; collaboratori di OpenStreetMap',
  }).addTo(map);

  const marker = L.marker([lat, lng], { draggable: true }).addTo(map);
  marker.on('dragend', () => {
    const pos = marker.getLatLng();
    inputs.lat.value = pos.lat.toFixed(7);
    inputs.lng.value = pos.lng.toFixed(7);
    markDirty();
  });

  map.on('click', (e) => {
    marker.setLatLng(e.latlng);
    inputs.lat.value = e.latlng.lat.toFixed(7);
    inputs.lng.value = e.latlng.lng.toFixed(7);
    markDirty();
  });

  editorMapRefs = { map, marker };
}

async function geocodeAddress(inputs, markDirty) {
  const address = inputs.address.value.trim();
  if (!address) {
    showError("Scrivi prima un indirizzo.");
    return;
  }

  const url = new URL('https://nominatim.openstreetmap.org/search');
  url.searchParams.set('format', 'json');
  url.searchParams.set('q', `${address}, Torino, Italia`);
  url.searchParams.set('countrycodes', 'it');
  url.searchParams.set('limit', '5');

  let results;
  try {
    const res = await fetch(url);
    results = await res.json();
  } catch {
    showError('Nominatim non ha risposto. Riprova tra poco.');
    return;
  }

  if (!results.length) {
    showError('Nessun risultato per questo indirizzo.');
    return;
  }

  const choice = results.length === 1 ? results[0] : results.find((r) => window.confirm(`Usa questo risultato?\n${r.display_name}`)) || results[0];

  inputs.lat.value = Number(choice.lat).toFixed(7);
  inputs.lng.value = Number(choice.lon).toFixed(7);
  markDirty();

  if (editorMapRefs) {
    const latlng = [Number(choice.lat), Number(choice.lon)];
    editorMapRefs.map.setView(latlng, 16);
    editorMapRefs.marker.setLatLng(latlng);
  }
}

// --- Salvataggio, eliminazione, storico ----------------------------------

function readFormValues(inputs) {
  const get = (key) => (inputs[key]?.value ?? '').toString().trim();
  const getNum = (key) => {
    const v = get(key);
    return v === '' ? null : Number(v);
  };

  return {
    name: get('name'),
    slug: get('slug') || null,
    type: get('type') || null,
    zone: get('zone') || null,
    address: get('address') || null,
    lat: getNum('lat'),
    lng: getNum('lng'),
    cost_type: get('cost_type') || null,
    price_per_day: getNum('price_per_day'),
    source: get('source') || null,
    personal_rating: get('personal_rating') || null,
    wifi_quality: get('wifi_quality') || null,
    wifi_notes: get('wifi_notes') || null,
    power_outlets: get('power_outlets') || null,
    call_space: get('call_space') || null,
    mood: inputs.mood.value,
    opening_hours: get('opening_hours') || null,
    has_outdoor: Boolean(inputs.has_outdoor.checked),
    booking_required: Boolean(inputs.booking_required.checked),
    instagram_url: get('instagram_url') || null,
    maps_url: get('maps_url') || null,
    website_url: get('website_url') || null,
    notes: get('notes') || null,
    last_verified_at: get('last_verified_at') || null,
    cover_image_url: get('cover_image_url') || null,
    is_published: Boolean(inputs.is_published.checked),
  };
}

async function handleSave(space, inputs, fieldOptions, onSaved, close) {
  const values = readFormValues(inputs);

  if (!values.name) {
    showError('Il nome è obbligatorio.');
    return;
  }
  if (!values.type) {
    showError('Il tipo è obbligatorio.');
    return;
  }
  if (values.price_per_day != null && values.price_per_day < 0) {
    showError('Il prezzo non può essere negativo.');
    return;
  }
  for (const url of [values.instagram_url, values.maps_url, values.website_url]) {
    if (url && !/^https?:\/\//i.test(url)) {
      showError('I link devono iniziare con http:// o https://');
      return;
    }
  }

  const { error } = space ? await updateSpace(space.id, values) : await createSpace(values);
  if (error) return;

  isDirty = false;
  showToast(space ? 'Spazio aggiornato.' : 'Spazio creato.');
  onSaved();
  close();
}

async function handleDelete(space, close, onSaved) {
  const typed = window.prompt(`Per eliminare "${space.name}" scrivi di nuovo il suo nome:`);
  if (typed !== space.name) {
    if (typed !== null) showError('Nome non corrispondente: eliminazione annullata.');
    return;
  }
  const { error } = await deleteSpace(space.id);
  if (error) return;
  isDirty = false;
  showToast('Spazio eliminato.');
  onSaved();
  close();
}

async function mountAuditLog(spaceId) {
  const section = document.getElementById('audit-log-section');
  const entries = await getAuditLogForSpace(spaceId);

  render(section, [
    el('h3', { style: 'margin-top: var(--space-6);' }, 'Storico modifiche'),
    entries.length === 0
      ? el('p', { className: 'field-hint' }, 'Nessuna modifica registrata.')
      : el(
          'div',
          {},
          entries.map((entry) =>
            el('div', { className: 'card', style: 'margin-top: var(--space-2);' }, [
              el('p', { className: 'field-hint' }, `${formatDate(entry.created_at?.slice(0, 10))} — ${entry.action}`),
              ...renderDiff(entry.diff, entry.action),
            ])
          )
        ),
  ]);
}

function renderDiff(diff, action) {
  if (action !== 'update' || !diff || typeof diff !== 'object') return [];
  return Object.entries(diff).map(([field, change]) =>
    el('div', { className: 'diff-row' }, [
      el('span', {}, field),
      el('span', { className: 'diff-old' }, String(change.old ?? '—')),
      el('span', { className: 'diff-new' }, String(change.new ?? '—')),
    ])
  );
}

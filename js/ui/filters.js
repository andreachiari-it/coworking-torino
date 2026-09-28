// js/ui/filters.js — stato dei filtri <-> query string, filtro/ordinamento
// puri (testabili), e il pannello filtri.
import { el, render } from './dom.js';
import { WIFI_QUALITY_ORDER, POWER_OUTLETS_ORDER } from '../lib/labels.js';
import { computeCompleteness, isPersonallyTested } from '../lib/completeness.js';
import { distanceKm } from '../lib/format.js';

export const DEFAULT_FILTERS = {
  q: '',
  type: '',
  zone: '',
  cost: '',
  maxPrice: '',
  wifiMin: '',
  powerMin: '',
  call: false,
  mood: [],
  outdoor: false,
  noBooking: false,
  tested: false,
  today: false,
  sort: 'consigliati',
};

export function parseFiltersFromURL(search) {
  const params = new URLSearchParams(search);
  return {
    q: params.get('q') || '',
    type: params.get('type') || '',
    zone: params.get('zone') || '',
    cost: params.get('cost') || '',
    maxPrice: params.get('maxprice') || '',
    wifiMin: params.get('wifimin') || '',
    powerMin: params.get('powermin') || '',
    call: params.get('call') === '1',
    mood: params.get('mood') ? params.get('mood').split(',').filter(Boolean) : [],
    outdoor: params.get('outdoor') === '1',
    noBooking: params.get('nobooking') === '1',
    tested: params.get('tested') === '1',
    today: params.get('today') === '1',
    sort: params.get('sort') || 'consigliati',
  };
}

export function filtersToSearchParams(state) {
  const params = new URLSearchParams();
  if (state.q) params.set('q', state.q);
  if (state.type) params.set('type', state.type);
  if (state.zone) params.set('zone', state.zone);
  if (state.cost) params.set('cost', state.cost);
  if (state.maxPrice) params.set('maxprice', state.maxPrice);
  if (state.wifiMin) params.set('wifimin', state.wifiMin);
  if (state.powerMin) params.set('powermin', state.powerMin);
  if (state.call) params.set('call', '1');
  if (state.mood.length) params.set('mood', state.mood.join(','));
  if (state.outdoor) params.set('outdoor', '1');
  if (state.noBooking) params.set('nobooking', '1');
  if (state.tested) params.set('tested', '1');
  if (state.today) params.set('today', '1');
  if (state.sort && state.sort !== 'consigliati') params.set('sort', state.sort);
  return params;
}

function matchesText(space, q) {
  if (!q) return true;
  const haystack = `${space.name} ${space.address || ''} ${space.notes || ''}`.toLowerCase();
  return haystack.includes(q.toLowerCase());
}

function meetsMinimum(order, value, minimum) {
  if (!minimum) return true;
  if (!value) return false;
  return order.indexOf(value) >= order.indexOf(minimum);
}

export function filterSpaces(spaces, state) {
  return spaces.filter((space) => {
    if (!matchesText(space, state.q)) return false;
    if (state.type && space.type !== state.type) return false;
    if (state.zone && space.zone !== state.zone) return false;
    if (state.cost && space.cost_type !== state.cost) return false;

    if (state.maxPrice) {
      const max = Number(state.maxPrice);
      if (space.cost_type === 'Fisso €/giorno') {
        if (space.price_per_day == null || space.price_per_day > max) return false;
      }
    }

    if (!meetsMinimum(WIFI_QUALITY_ORDER, space.wifi_quality, state.wifiMin)) return false;
    if (!meetsMinimum(POWER_OUTLETS_ORDER, space.power_outlets, state.powerMin)) return false;
    if (state.call && !space.call_space) return false;
    if (state.mood.length && !state.mood.some((m) => (space.mood || []).includes(m))) return false;
    if (state.outdoor && !space.has_outdoor) return false;
    if (state.noBooking && space.booking_required) return false;
    if (state.tested && !isPersonallyTested(space)) return false;
    if (state.today && !(space.checkins_today > 0)) return false;

    return true;
  });
}

function recommendedScore(space) {
  const { filled, total } = computeCompleteness(space);
  const testedScore = isPersonallyTested(space) ? 1000 : 0;
  const ratingScore = space.avg_community_rating ? Number(space.avg_community_rating) * 10 : 0;
  return testedScore + ratingScore + (filled / total) * 10;
}

/**
 * @param {object[]} spaces
 * @param {string} sortKey - 'consigliati' | 'distanza' | 'prezzo' | 'recenti'
 * @param {{lat: number, lng: number}|null} userCoords - richiesto per 'distanza'
 */
export function sortSpaces(spaces, sortKey, userCoords) {
  const copy = [...spaces];

  if (sortKey === 'distanza' && userCoords) {
    return copy.sort((a, b) => {
      const da = a.lat != null ? distanceKm(userCoords.lat, userCoords.lng, a.lat, a.lng) : Infinity;
      const db = b.lat != null ? distanceKm(userCoords.lat, userCoords.lng, b.lat, b.lng) : Infinity;
      return da - db;
    });
  }

  if (sortKey === 'prezzo') {
    return copy.sort((a, b) => {
      const pa = a.price_per_day != null ? Number(a.price_per_day) : Infinity;
      const pb = b.price_per_day != null ? Number(b.price_per_day) : Infinity;
      return pa - pb;
    });
  }

  if (sortKey === 'recenti') {
    return copy.sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));
  }

  return copy.sort((a, b) => recommendedScore(b) - recommendedScore(a));
}

// ---------------------------------------------------------------------------
// Pannello filtri
// ---------------------------------------------------------------------------

/**
 * Ricostruisce il pannello filtri UNA volta (al montaggio, dopo "Azzera
 * filtri", o dopo una navigazione avanti/indietro che cambia l'URL). Le
 * modifiche che arrivano dai controlli stessi non ricostruiscono il
 * pannello: se lo facessero, un input di testo perderebbe il focus a ogni
 * carattere digitato. `onChange` aggiorna solo lo stato e i risultati;
 * `onReset` è l'unico percorso che richiede una nuova renderFilterPanel().
 *
 * @param {HTMLElement} container
 * @param {{ fieldOptions: Record<string, {value:string}[]>, state: object, onChange: (state: object) => void, onReset: () => void }} opts
 */
export function renderFilterPanel(container, { fieldOptions, state, onChange, onReset }) {
  const update = (patch) => onChange({ ...state, ...patch });
  let debounceId = null;
  const updateDebounced = (patch) => {
    window.clearTimeout(debounceId);
    debounceId = window.setTimeout(() => update(patch), 200);
  };

  const selectField = (label, field, options, placeholder) =>
    el('div', { className: 'field' }, [
      el('label', { className: 'field-label' }, label),
      el(
        'select',
        {
          className: 'select',
          onChange: (e) => update({ [field]: e.target.value }),
        },
        [
          el('option', { value: '', selected: state[field] === '' }, placeholder),
          ...options.map((opt) => el('option', { value: opt.value, selected: state[field] === opt.value }, opt.value)),
        ]
      ),
    ]);

  const checkboxField = (label, field) =>
    el('label', { className: 'checkbox-row' }, [
      el('input', {
        type: 'checkbox',
        checked: state[field],
        onChange: (e) => update({ [field]: e.target.checked }),
      }),
      el('span', {}, label),
    ]);

  const moodChips = el(
    'div',
    { className: 'chip-row', role: 'group', 'aria-label': 'Mood' },
    (fieldOptions.mood || []).map((opt) => {
      const active = state.mood.includes(opt.value);
      return el(
        'button',
        {
          type: 'button',
          className: 'chip',
          'aria-pressed': active ? 'true' : 'false',
          onClick: () => {
            const mood = active ? state.mood.filter((m) => m !== opt.value) : [...state.mood, opt.value];
            update({ mood });
          },
        },
        opt.value
      );
    })
  );

  render(container, [
    el('div', { className: 'field' }, [
      el('label', { className: 'field-label', for: 'filter-search' }, 'Cerca'),
      el('input', {
        id: 'filter-search',
        className: 'input',
        type: 'search',
        placeholder: 'Nome, indirizzo, note...',
        value: state.q,
        onInput: (e) => updateDebounced({ q: e.target.value }),
      }),
    ]),
    selectField('Tipo', 'type', fieldOptions.type || [], 'Qualsiasi tipo'),
    selectField('Zona', 'zone', fieldOptions.zone || [], 'Qualsiasi zona'),
    selectField('Costo', 'cost', fieldOptions.cost_type || [], 'Qualsiasi costo'),
    el('div', { className: 'field' }, [
      el('label', { className: 'field-label', for: 'filter-maxprice' }, 'Prezzo massimo (€/giorno)'),
      el('input', {
        id: 'filter-maxprice',
        className: 'input',
        type: 'number',
        min: '0',
        step: '1',
        value: state.maxPrice,
        onInput: (e) => updateDebounced({ maxPrice: e.target.value }),
      }),
    ]),
    selectField('Wifi minimo', 'wifiMin', fieldOptions.wifi_quality || [], 'Qualsiasi'),
    selectField('Prese, almeno', 'powerMin', fieldOptions.power_outlets || [], 'Qualsiasi'),
    checkboxField('Spazio per le call', 'call'),
    el('div', { className: 'field' }, [el('span', { className: 'field-label' }, 'Mood'), moodChips]),
    checkboxField('Spazio esterno', 'outdoor'),
    checkboxField('Senza prenotazione', 'noBooking'),
    checkboxField('Solo testati di persona', 'tested'),
    checkboxField("C'è qualcuno oggi", 'today'),
    el('button', { type: 'button', className: 'btn btn-ghost', onClick: onReset }, 'Azzera filtri'),
  ]);
}

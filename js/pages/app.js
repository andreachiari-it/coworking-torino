// js/pages/app.js — bootstrap di app.html: mappa + lista + filtri.
import { guard, signOut, getCurrentProfile } from '../auth.js';
import { listPublishedSpaces, subscribeToCheckinChanges } from '../api/spaces.js';
import { getFieldOptions } from '../api/field-options.js';
import { initMap, renderMarkers, setMarkerHighlighted, focusMarker } from '../ui/map.js';
import { renderSpaceCard } from '../ui/space-card.js';
import { renderFilterPanel, parseFiltersFromURL, filtersToSearchParams, filterSpaces, sortSpaces, DEFAULT_FILTERS } from '../ui/filters.js';
import { el, render } from '../ui/dom.js';
import { showToast } from '../ui/toast.js';
import { openSuggestSpaceModal } from '../ui/suggest-space-modal.js';

const SORT_OPTIONS = [
  { value: 'consigliati', label: 'Consigliati' },
  { value: 'distanza', label: 'Distanza' },
  { value: 'prezzo', label: 'Prezzo' },
  { value: 'recenti', label: 'Aggiornati di recente' },
];

let allSpaces = [];
let fieldOptions = {};
let filterState = DEFAULT_FILTERS;
let userCoords = null;
let mapRefs = null;
let markersBySpaceId = new Map();
let highlightedCardEl = null;

async function main() {
  await guard();

  document.getElementById('logout-button').addEventListener('click', async () => {
    await signOut();
    window.location.href = 'index.html';
  });

  document.getElementById('suggest-space-button').addEventListener('click', () => openSuggestSpaceModal(fieldOptions));

  getCurrentProfile().then((profile) => {
    if (profile?.role === 'admin') document.getElementById('admin-link').hidden = false;
  });

  mapRefs = initMap('app-map');
  initSheetDrag();
  initMobileToggle();
  initFiltersToggle();

  const [spaces, options] = await Promise.all([listPublishedSpaces(), getFieldOptions()]);
  allSpaces = spaces;
  fieldOptions = options;
  filterState = parseFiltersFromURL(window.location.search);

  initSortSelect();
  mountFilterPanel();
  computeAndRender();

  window.addEventListener('popstate', () => {
    filterState = parseFiltersFromURL(window.location.search);
    document.getElementById('sort-select').value = filterState.sort;
    mountFilterPanel();
    computeAndRender();
  });

  subscribeToCheckinChanges(async () => {
    allSpaces = await listPublishedSpaces();
    computeAndRender();
  });
}

function mountFilterPanel() {
  const panel = document.getElementById('filter-panel');
  renderFilterPanel(panel, {
    fieldOptions,
    state: filterState,
    onChange: (nextState) => {
      filterState = nextState;
      computeAndRender();
    },
    onReset: () => {
      filterState = { ...DEFAULT_FILTERS };
      document.getElementById('sort-select').value = filterState.sort;
      mountFilterPanel();
      computeAndRender();
    },
  });
}

function initSortSelect() {
  const select = document.getElementById('sort-select');
  render(
    select,
    SORT_OPTIONS.map((opt) => {
      const optionEl = document.createElement('option');
      optionEl.value = opt.value;
      optionEl.textContent = opt.label;
      return optionEl;
    })
  );
  select.value = filterState.sort;

  select.addEventListener('change', async () => {
    filterState = { ...filterState, sort: select.value };
    if (select.value === 'distanza' && !userCoords) {
      await requestGeolocation();
    }
    computeAndRender();
  });
}

function requestGeolocation() {
  if (!navigator.geolocation) {
    showToast('Il tuo browser non supporta la geolocalizzazione.');
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        userCoords = { lat: position.coords.latitude, lng: position.coords.longitude };
        resolve();
      },
      () => {
        showToast('Non ho potuto usare la tua posizione: mostro l\'ordine consigliato.');
        resolve();
      },
      { timeout: 8000 }
    );
  });
}

function computeAndRender() {
  const filtered = filterSpaces(allSpaces, filterState);
  const sorted = sortSpaces(filtered, filterState.sort, userCoords);

  renderResultCount(sorted.length, allSpaces.length);
  renderList(sorted);
  markersBySpaceId = renderMarkers(mapRefs, sorted, {
    onMarkerClick: (spaceId) => scrollToCard(spaceId),
    onMarkerHover: (spaceId) => highlightCard(spaceId),
  });

  const params = filtersToSearchParams(filterState);
  const query = params.toString();
  const newUrl = window.location.pathname + (query ? `?${query}` : '');
  window.history.replaceState(null, '', newUrl);
}

function renderResultCount(count, total) {
  const el = document.getElementById('result-count');
  el.textContent = count === total ? `${count} spazi` : `${count} di ${total} spazi`;
}

function renderList(spaces) {
  const list = document.getElementById('space-list');

  if (spaces.length === 0) {
    render(list, [
      el('div', { className: 'app-empty-state' }, "Nessuno spazio con questi filtri. Prova a togliere l'ultimo che hai aggiunto."),
    ]);
    return;
  }

  render(
    list,
    spaces.map((space) =>
      renderSpaceCard(space, {
        onHover: (id) => {
          for (const m of markersBySpaceId.keys()) setMarkerHighlighted(markersBySpaceId, m, m === id);
        },
      })
    )
  );
}

function highlightCard(spaceId) {
  highlightedCardEl?.classList.remove('is-highlighted');
  if (!spaceId) {
    highlightedCardEl = null;
    return;
  }
  const cardEl = document.querySelector(`.space-card[data-space-id="${CSS.escape(spaceId)}"]`);
  cardEl?.classList.add('is-highlighted');
  highlightedCardEl = cardEl;
}

function scrollToCard(spaceId) {
  highlightCard(spaceId);
  highlightedCardEl?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  focusMarker(mapRefs.map, markersBySpaceId, spaceId);
}

// --- Mobile: bottom sheet trascinabile + toggle Mappa/Lista ---------------

const SHEET_STATES = ['closed', 'half', 'full'];

function setSheetState(state) {
  const pane = document.getElementById('app-list-pane');
  pane.style.height = '';
  if (state === 'half') {
    pane.removeAttribute('data-sheet-state');
  } else {
    pane.dataset.sheetState = state;
  }
  const handle = document.getElementById('app-sheet-handle');
  handle.setAttribute('aria-expanded', state !== 'closed' ? 'true' : 'false');

  const toggle = document.getElementById('toggle-map-list');
  toggle.textContent = state === 'closed' ? 'Lista' : 'Mappa';
}

function initFiltersToggle() {
  const toggleBtn = document.getElementById('toggle-filters');
  const panel = document.getElementById('filter-panel');
  toggleBtn.addEventListener('click', () => {
    panel.hidden = !panel.hidden;
    toggleBtn.setAttribute('aria-expanded', String(!panel.hidden));
  });
}

function initMobileToggle() {
  setSheetState('half');
  document.getElementById('toggle-map-list').addEventListener('click', () => {
    const pane = document.getElementById('app-list-pane');
    const current = pane.dataset.sheetState || 'half';
    setSheetState(current === 'closed' ? 'full' : 'closed');
  });
}

function initSheetDrag() {
  const pane = document.getElementById('app-list-pane');
  const handle = document.getElementById('app-sheet-handle');

  handle.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    e.preventDefault();
    const current = pane.dataset.sheetState || 'half';
    const nextIndex = (SHEET_STATES.indexOf(current) + 1) % SHEET_STATES.length;
    setSheetState(SHEET_STATES[nextIndex]);
  });

  let startY = 0;
  let startHeight = 0;

  handle.addEventListener('pointerdown', (e) => {
    startY = e.clientY;
    startHeight = pane.getBoundingClientRect().height;
    pane.style.transition = 'none';
    handle.setPointerCapture(e.pointerId);
  });

  handle.addEventListener('pointermove', (e) => {
    if (!startHeight) return;
    const delta = startY - e.clientY;
    const next = Math.min(window.innerHeight * 0.88, Math.max(64, startHeight + delta));
    pane.style.height = `${next}px`;
  });

  const endDrag = () => {
    if (!startHeight) return;
    pane.style.transition = '';
    const currentHeight = pane.getBoundingClientRect().height;
    const viewport = window.innerHeight;
    const distances = {
      closed: Math.abs(currentHeight - 64),
      half: Math.abs(currentHeight - viewport * 0.45),
      full: Math.abs(currentHeight - viewport * 0.88),
    };
    const nearest = Object.entries(distances).sort((a, b) => a[1] - b[1])[0][0];
    startHeight = 0;
    setSheetState(nearest);
  };

  handle.addEventListener('pointerup', endDrag);
  handle.addEventListener('pointercancel', endDrag);
}

main();

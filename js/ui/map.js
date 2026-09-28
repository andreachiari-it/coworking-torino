// js/ui/map.js — mappa Leaflet: init, marker colorati per tipo, cluster,
// sincronizzazione con la lista.
//
// Leaflet e Leaflet.markercluster sono caricati come <script> globali
// classici in app.html/space.html (non come moduli ESM): sono plugin UMD
// che si aspettano un unico `window.L` condiviso. Importarli separatamente
// come moduli ESM creerebbe due istanze di Leaflet distinte, e
// `L.markerClusterGroup` finirebbe attaccato a quella sbagliata.
import { TYPE_COLOR_VAR } from '../lib/labels.js';
import { formatCost } from '../lib/format.js';

const L = window.L;

const TORINO_CENTER = [45.0703, 7.6869];
const DEFAULT_ZOOM = 13;

/** @param {string} containerId */
export function initMap(containerId) {
  const map = L.map(containerId, { scrollWheelZoom: true }).setView(TORINO_CENTER, DEFAULT_ZOOM);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">collaboratori di OpenStreetMap</a>',
  }).addTo(map);

  const clusterGroup = L.markerClusterGroup({ maxClusterRadius: 45 });
  map.addLayer(clusterGroup);

  return { map, clusterGroup };
}

function markerIcon(type) {
  const colorVar = TYPE_COLOR_VAR[type] || '--text-2';
  return L.divIcon({
    className: 'map-marker-wrap',
    html: `<span class="map-marker" style="background:var(${colorVar})"></span>`,
    iconSize: [22, 22],
    iconAnchor: [11, 11],
    popupAnchor: [0, -12],
  });
}

/**
 * Ridisegna tutti i marker. Gli spazi senza lat/lng non compaiono (restano
 * solo in lista, con nota "posizione da confermare").
 * @param {{map: L.Map, clusterGroup: L.MarkerClusterGroup}} mapRefs
 * @param {object[]} spaces
 * @param {{ onMarkerClick: (spaceId: string) => void, onMarkerHover?: (spaceId: string|null) => void }} handlers
 * @returns {Map<string, L.Marker>} spaceId -> marker, per l'evidenziazione da hover sulla card
 */
export function renderMarkers({ map, clusterGroup }, spaces, { onMarkerClick, onMarkerHover }) {
  clusterGroup.clearLayers();
  const markersBySpaceId = new Map();

  for (const space of spaces) {
    if (space.lat == null || space.lng == null) continue;

    const marker = L.marker([space.lat, space.lng], { icon: markerIcon(space.type) });
    const popupNode = buildPopup(space);
    marker.bindPopup(popupNode);

    marker.on('click', () => onMarkerClick?.(space.id));
    if (onMarkerHover) {
      marker.on('mouseover', () => onMarkerHover(space.id));
      marker.on('mouseout', () => onMarkerHover(null));
    }

    clusterGroup.addLayer(marker);
    markersBySpaceId.set(space.id, marker);
  }

  return markersBySpaceId;
}

function buildPopup(space) {
  const wrap = document.createElement('div');
  wrap.className = 'map-popup';

  const title = document.createElement('strong');
  title.textContent = space.name;
  wrap.append(title);

  const meta = document.createElement('div');
  meta.className = 'map-popup-meta';
  meta.textContent = [space.type, space.zone].filter(Boolean).join(' · ');
  wrap.append(meta);

  const cost = formatCost(space.cost_type, space.price_per_day);
  if (cost) {
    const costEl = document.createElement('div');
    costEl.className = 'map-popup-cost';
    costEl.textContent = cost;
    wrap.append(costEl);
  }

  const link = document.createElement('a');
  link.href = `space.html?s=${encodeURIComponent(space.slug)}`;
  link.className = 'map-popup-link';
  link.textContent = 'Apri scheda';
  wrap.append(link);

  return wrap;
}

/** Evidenzia il marker di uno spazio (hover dalla card) senza aprirne il popup. */
export function setMarkerHighlighted(markersBySpaceId, spaceId, highlighted) {
  const marker = markersBySpaceId.get(spaceId);
  const el = marker?.getElement()?.querySelector('.map-marker');
  el?.classList.toggle('map-marker--active', highlighted);
}

export function focusMarker(map, markersBySpaceId, spaceId) {
  const marker = markersBySpaceId.get(spaceId);
  if (!marker) return;
  map.panTo(marker.getLatLng());
  marker.openPopup();
}

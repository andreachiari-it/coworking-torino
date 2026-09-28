// js/pages/space.js — bootstrap di space.html.
import { guard } from '../auth.js';
import { getSpaceBySlug } from '../api/spaces.js';
import { getFieldOptions } from '../api/field-options.js';
import { renderSpaceDetail } from '../ui/space-detail.js';
import { initMap, renderMarkers } from '../ui/map.js';
import { el, render } from '../ui/dom.js';

async function main() {
  const session = await guard();

  const slug = new URLSearchParams(window.location.search).get('s');
  const container = document.getElementById('space-detail');

  if (!slug) {
    showNotFound(container);
    return;
  }

  const [space, fieldOptions] = await Promise.all([getSpaceBySlug(slug), getFieldOptions()]);
  if (!space) {
    showNotFound(container);
    return;
  }

  document.title = `${space.name} — Coworking Torino`;
  renderSpaceDetail(container, space, { fieldOptions, userId: session.user.id });

  if (space.lat != null) {
    const mapRefs = initMap('space-mini-map');
    mapRefs.map.setView([space.lat, space.lng], 15);
    renderMarkers(mapRefs, [space], { onMarkerClick: () => {} });
  }
}

function showNotFound(container) {
  render(container, [
    el('div', { className: 'app-empty-state' }, [
      el('p', {}, 'Non trovo questo spazio — magari il link non è più valido.'),
      el('a', { className: 'btn btn-primary', href: 'app.html' }, 'Torna alla mappa'),
    ]),
  ]);
}

main();

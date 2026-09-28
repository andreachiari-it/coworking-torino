// js/lib/completeness.js — quanto è "completo" un record spazio.
// Usato per l'ordinamento "Consigliati" (Fase 3) e per l'indicatore
// N/14 campi nella dashboard admin (Fase 5): stessa definizione ovunque.
const FIELD_COUNT = 14;

/**
 * @param {object} space - riga di spaces / spaces_public
 * @returns {{ filled: number, total: number }}
 */
export function computeCompleteness(space) {
  const checks = [
    Boolean(space.address),
    space.lat != null && space.lng != null,
    Boolean(space.zone),
    Boolean(space.cost_type),
    space.cost_type !== 'Fisso €/giorno' || space.price_per_day != null,
    Boolean(space.source),
    Boolean(space.personal_rating),
    Boolean(space.wifi_quality),
    Boolean(space.power_outlets),
    Boolean(space.call_space),
    Boolean(space.opening_hours),
    Array.isArray(space.mood) && space.mood.length > 0,
    Boolean(space.maps_url || space.instagram_url || space.website_url),
    Boolean(space.last_verified_at),
  ];

  return { filled: checks.filter(Boolean).length, total: FIELD_COUNT };
}

export function isPersonallyTested(space) {
  return space.source === 'Esperienza diretta' || (Boolean(space.personal_rating) && space.personal_rating !== 'Non testato');
}

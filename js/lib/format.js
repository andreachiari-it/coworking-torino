// js/lib/format.js — date, prezzi, orari, in italiano.

const DATE_FORMATTER = new Intl.DateTimeFormat('it-IT', { day: 'numeric', month: 'short', year: 'numeric' });
const WEEKDAY_FORMATTER = new Intl.DateTimeFormat('it-IT', { weekday: 'long', day: 'numeric', month: 'short' });

/** @param {string} isoDate - "YYYY-MM-DD" */
export function formatDate(isoDate) {
  if (!isoDate) return null;
  return DATE_FORMATTER.format(new Date(`${isoDate}T00:00:00`));
}

/** @param {string} isoDate - "YYYY-MM-DD" */
export function formatWeekday(isoDate) {
  if (!isoDate) return null;
  const label = WEEKDAY_FORMATTER.format(new Date(`${isoDate}T00:00:00`));
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export function formatLastVerified(isoDate) {
  if (!isoDate) return 'Mai verificato di persona';
  return `Verificato il ${formatDate(isoDate)}`;
}

/**
 * @param {string|null} costType
 * @param {number|null} pricePerDay
 */
export function formatCost(costType, pricePerDay) {
  if (!costType) return null;
  if (costType === 'Fisso €/giorno') {
    return pricePerDay != null ? `${formatPrice(pricePerDay)}/giorno` : 'Prezzo fisso (da verificare)';
  }
  return costType;
}

export function formatPrice(amount) {
  return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR', maximumFractionDigits: amount % 1 === 0 ? 0 : 2 }).format(
    amount
  );
}

/** @param {string} time - "HH:MM:SS" o "HH:MM" */
export function formatTime(time) {
  if (!time) return null;
  return time.slice(0, 5);
}

export function formatTimeRange(from, to) {
  const f = formatTime(from);
  const t = formatTime(to);
  if (f && t) return `${f}–${t}`;
  if (f) return `dalle ${f}`;
  if (t) return `fino alle ${t}`;
  return null;
}

/** Distanza haversine in km tra due punti. */
export function distanceKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function formatDistance(km) {
  if (km == null) return null;
  return km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`;
}

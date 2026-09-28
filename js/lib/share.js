// js/lib/share.js — link wa.me e Web Share API (sezione 6.3).

/**
 * Condivide un messaggio: usa la Web Share API se disponibile (soprattutto
 * su mobile), altrimenti apre wa.me con il testo precompilato.
 * @param {string} text
 */
export async function shareOrOpenWhatsApp(text) {
  if (navigator.share) {
    try {
      await navigator.share({ text });
      return;
    } catch (err) {
      if (err?.name === 'AbortError') return; // l'utente ha annullato
      // altrimenti prosegue con wa.me come fallback
    }
  }
  window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener,noreferrer');
}

/**
 * @param {{ spaceName: string, zone: string|null, date: string, timeFrom: string|null, timeTo: string|null, url: string }} params
 */
export function buildCheckinMessage({ spaceName, zone, date, timeFrom, timeTo, url }) {
  const when = formatWhen(date, timeFrom, timeTo);
  const place = zone ? `${spaceName} (${zone})` : spaceName;
  return `${when} lavoro da ${place}. Chi viene? 👉 ${url}`;
}

function formatWhen(isoDate, timeFrom, timeTo) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(`${isoDate}T00:00:00`);
  const diffDays = Math.round((target - today) / 86400000);

  let dayLabel;
  if (diffDays === 0) dayLabel = 'Oggi';
  else if (diffDays === 1) dayLabel = 'Domani';
  else dayLabel = new Intl.DateTimeFormat('it-IT', { weekday: 'long', day: 'numeric', month: 'short' }).format(target);

  const time = timeFrom && timeTo ? ` ${timeFrom.slice(0, 5)}–${timeTo.slice(0, 5)}` : '';
  return `${dayLabel}${time}`;
}

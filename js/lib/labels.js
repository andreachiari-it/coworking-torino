// js/lib/labels.js — mappa fra i valori enum del DB (già in italiano) e
// colori/etichette per la UI. I valori stessi vengono da field_options
// (così l'admin può aggiungerne di nuovi); qui viviono solo colore CSS e
// microcopy che il DB non ha motivo di conoscere.

export const TYPE_COLOR_VAR = {
  'Bar/Locale': '--type-bar',
  'Casa del Quartiere': '--type-casa-quartiere',
  'Coworking a pagamento': '--type-coworking',
  Biblioteca: '--type-biblioteca',
  'Hostel/Spazio ibrido': '--type-hostel',
};

export const COST_TYPE_LABEL = {
  Gratuito: 'Gratuito',
  'Consumazione obbligatoria': 'Consumazione obbligatoria',
  'Fisso €/giorno': null, // il prezzo viene mostrato al posto dell'etichetta, vedi format.js
};

export const WIFI_QUALITY_ORDER = ['Assente', 'Lento', 'Buono', 'Ottimo'];
export const POWER_OUTLETS_ORDER = ['Assenti', 'Poche', 'Abbondanti'];
export const PERSONAL_RATING_ORDER = ['Non testato', '1', '2', '3', '4', '5'];

export const MOOD_LABELS = ['Silenzioso', 'Informale', 'Studentesco', 'Elegante', 'Rumoroso', 'Internazionale'];

export const NOISE_LEVEL_LABELS = ['Silenzioso', 'Medio', 'Rumoroso'];

/**
 * Il badge "fonte" che compare su ogni card, secondo la logica della
 * sezione 6.2: chi ha provato di persona, chi viene da una guida esterna, e
 * tutto il resto (ricerca web, o mai testato di persona) come "Da verificare".
 * @param {string|null} source
 * @param {string|null} personalRating
 */
export function sourceBadgeLabel(source, personalRating) {
  if (source === 'Esperienza diretta' && personalRating && personalRating !== 'Non testato') {
    return 'Provato da Andrea';
  }
  if (source === 'Guida esterna') {
    return 'Da guida esterna';
  }
  return 'Da verificare';
}

/** Valore di fallback per campi vuoti in UI: mai stringa vuota. */
export const MISSING_VALUE = 'Da verificare';

export function orMissing(value) {
  return value === null || value === undefined || value === '' ? MISSING_VALUE : value;
}

// js/ui/space-detail.js — il corpo della scheda spazio (space.html).
import { el, render, linkify } from './dom.js';
import { icon } from './icons.js';
import { orMissing, MISSING_VALUE, NOISE_LEVEL_LABELS } from '../lib/labels.js';
import { formatCost, formatLastVerified, formatWeekday, formatTimeRange } from '../lib/format.js';
import { buildCheckinMessage, shareOrOpenWhatsApp } from '../lib/share.js';
import { showToast, showError } from './toast.js';
import { createCheckin, cancelCheckin, getUpcomingCheckinsForSpace } from '../api/checkins.js';
import { getReviewsForSpace, upsertReview, deleteReview } from '../api/reviews.js';
import { createSuggestion } from '../api/suggestions.js';
import { subscribeToCheckinChanges } from '../api/spaces.js';
import { openModal } from './modal.js';

/**
 * @param {HTMLElement} container
 * @param {object} space - riga di spaces_public
 * @param {{ fieldOptions: Record<string, {value:string}[]>, userId: string }} ctx
 */
export function renderSpaceDetail(container, space, ctx) {
  render(container, [
    el('header', { className: 'space-detail-header' }, [
      el('a', { className: 'btn btn-ghost btn-sm', href: 'app.html' }, '← Torna alla mappa'),
      el('h1', {}, space.name),
      el('p', { className: 'space-detail-meta' }, [space.type, orMissing(space.zone)].filter(Boolean).join(' · ')),
      el('div', { className: 'space-detail-badges' }, [
        el('span', { className: 'badge badge-source' }, sourceLabel(space)),
        el('span', { className: 'badge badge-outline' }, formatLastVerified(space.last_verified_at)),
      ]),
    ]),

    el('section', { className: 'space-detail-section', 'aria-labelledby': 'in-pratica-heading' }, [
      el('h2', { id: 'in-pratica-heading' }, 'In pratica'),
      el('dl', { className: 'fact-grid' }, [
        factRow('booking', 'Costo', formatCost(space.cost_type, space.price_per_day) || MISSING_VALUE),
        factRow('clock', 'Orari', orMissing(space.opening_hours)),
        factRow('wifi', 'Wifi', wifiText(space)),
        factRow('power', 'Prese', orMissing(space.power_outlets)),
        factRow('call', 'Spazio per call', orMissing(space.call_space)),
        factRow('outdoor', 'Spazio esterno', space.has_outdoor ? 'Sì' : 'No'),
        factRow('booking', 'Prenotazione', space.booking_required ? 'Richiesta' : 'Non richiesta'),
      ]),
    ]),

    space.mood?.length
      ? el('section', { className: 'space-detail-section' }, [
          el('h2', {}, 'Mood'),
          el(
            'div',
            { className: 'chip-row' },
            space.mood.map((m) => el('span', { className: 'chip' }, m))
          ),
        ])
      : null,

    space.notes
      ? el('section', { className: 'space-detail-section' }, [el('h2', {}, 'Note'), el('p', { className: 'space-detail-notes' }, linkify(space.notes))])
      : null,

    el('section', { className: 'space-detail-section', 'aria-labelledby': 'dove-heading' }, [
      el('h2', { id: 'dove-heading' }, 'Dove'),
      el('p', {}, orMissing(space.address)),
      space.lat != null ? el('div', { id: 'space-mini-map', className: 'space-mini-map' }) : el('p', { className: 'field-hint' }, 'Posizione da confermare.'),
      el('div', { className: 'space-detail-actions' }, [
        directionsLink('Apri in Google Maps', googleMapsUrl(space)),
        directionsLink('Apri in Apple Maps', appleMapsUrl(space)),
        space.instagram_url ? directionsLink('Instagram', space.instagram_url) : null,
        space.website_url ? directionsLink('Sito', space.website_url) : null,
      ]),
    ]),

    el('section', { className: 'space-detail-section', 'aria-labelledby': 'ci-vado-heading' }, [
      el('h2', { id: 'ci-vado-heading' }, 'Ci vado'),
      el('div', { id: 'checkin-panel' }),
    ]),

    el('section', { className: 'space-detail-section', 'aria-labelledby': 'chi-heading' }, [
      el('h2', { id: 'chi-heading' }, 'Chi ci va nei prossimi 7 giorni'),
      el('div', { id: 'upcoming-checkins' }),
    ]),

    el('section', { className: 'space-detail-section', 'aria-labelledby': 'recensioni-heading' }, [
      el('h2', { id: 'recensioni-heading' }, 'Recensioni della community'),
      el('div', { id: 'reviews-panel' }),
    ]),

    el('section', { className: 'space-detail-section', 'aria-labelledby': 'segnala-heading' }, [
      el('h2', { id: 'segnala-heading' }, 'Segnala una modifica'),
      el('p', { className: 'field-hint' }, "Qualcosa qui non è più giusto? Dicci cosa è cambiato, verifichiamo e aggiorniamo la guida."),
      el('div', { className: 'space-detail-actions' }, [
        el('button', { type: 'button', className: 'btn btn-secondary', id: 'open-correction-form' }, 'Segnala una modifica'),
        el('button', { type: 'button', className: 'btn btn-danger', id: 'open-closed-form' }, 'Questo posto ha chiuso'),
      ]),
    ]),
  ]);

  mountCheckinPanel(space);
  mountUpcomingCheckins(space);
  mountReviewsPanel(space, ctx.userId);
  mountSuggestionButtons(space, ctx.fieldOptions);
}

// ---------------------------------------------------------------------------
// Ci vado
// ---------------------------------------------------------------------------

function mountCheckinPanel(space) {
  const panel = document.getElementById('checkin-panel');

  render(panel, [
    el('form', { className: 'checkin-form', id: 'checkin-form' }, [
      el('div', { className: 'field' }, [
        el('span', { className: 'field-label' }, 'Quando' ),
        el('div', { className: 'radio-group' }, [
          el('label', {}, [el('input', { type: 'radio', name: 'checkin-day', value: 'today', checked: true }), ' Oggi']),
          el('label', {}, [el('input', { type: 'radio', name: 'checkin-day', value: 'tomorrow' }), ' Domani']),
          el('label', {}, [el('input', { type: 'radio', name: 'checkin-day', value: 'other' }), ' Altra data']),
        ]),
        el('input', { type: 'date', className: 'input', id: 'checkin-date', hidden: true, min: isoToday(), max: isoDate(30) }),
      ]),
      el('div', { className: 'field' }, [
        el('span', { className: 'field-label' }, 'Fascia oraria (facoltativa)'),
        el('div', { style: 'display:flex; gap: var(--space-3);' }, [
          el('input', { type: 'time', className: 'input', id: 'checkin-time-from' }),
          el('input', { type: 'time', className: 'input', id: 'checkin-time-to' }),
        ]),
      ]),
      el('div', { className: 'field' }, [
        el('label', { className: 'field-label', for: 'checkin-note' }, 'Nota breve (facoltativa)'),
        el('input', { className: 'input', id: 'checkin-note', maxlength: '140', placeholder: 'es. porto il pc, avviso in chat' }),
      ]),
      el('button', { type: 'submit', className: 'btn btn-primary' }, 'Segna che ci vado'),
    ]),
  ]);

  for (const radio of panel.querySelectorAll('input[name="checkin-day"]')) {
    radio.addEventListener('change', () => {
      document.getElementById('checkin-date').hidden = radio.value !== 'other' || !radio.checked;
    });
  }

  document.getElementById('checkin-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const dayChoice = panel.querySelector('input[name="checkin-day"]:checked').value;
    const date = dayChoice === 'today' ? isoToday() : dayChoice === 'tomorrow' ? isoDate(1) : document.getElementById('checkin-date').value;
    if (!date) {
      showError('Scegli una data.');
      return;
    }

    const timeFrom = document.getElementById('checkin-time-from').value;
    const timeTo = document.getElementById('checkin-time-to').value;
    const note = document.getElementById('checkin-note').value.trim();

    const { data, error } = await createCheckin({ spaceId: space.id, date, timeFrom, timeTo, note });
    if (error) return;

    showToast('Check-in salvato.');
    showShareCta(space, { date, timeFrom, timeTo });
    mountUpcomingCheckins(space);
  });
}

function showShareCta(space, { date, timeFrom, timeTo }) {
  const panel = document.getElementById('checkin-panel');
  const url = window.location.href;
  const message = buildCheckinMessage({ spaceName: space.name, zone: space.zone, date, timeFrom, timeTo, url });

  const cta = el('div', { className: 'card', style: 'margin-top: var(--space-4);' }, [
    el('p', {}, 'Fatto! Vuoi avvisare il gruppo?'),
    el(
      'button',
      { type: 'button', className: 'btn btn-confirm', style: 'margin-top: var(--space-3);', onClick: () => shareOrOpenWhatsApp(message) },
      'Condividi nel gruppo'
    ),
  ]);
  panel.append(cta);
}

// ---------------------------------------------------------------------------
// Chi ci va nei prossimi 7 giorni
// ---------------------------------------------------------------------------

let unsubscribeCheckins = null;

async function mountUpcomingCheckins(space) {
  const container = document.getElementById('upcoming-checkins');
  const upcoming = await getUpcomingCheckinsForSpace(space.id);

  if (upcoming.length === 0) {
    render(container, [el('p', { className: 'field-hint' }, 'Nessun check-in nei prossimi 7 giorni, per ora.')]);
  } else {
    render(
      container,
      upcoming.map((c) =>
        el('div', { className: 'checkin-row' }, [
          el('span', { className: 'checkin-row-day' }, formatWeekday(c.date)),
          el('span', {}, c.display_name),
          formatTimeRange(c.time_from, c.time_to) ? el('span', { className: 'field-hint' }, formatTimeRange(c.time_from, c.time_to)) : null,
          c.note ? el('span', { className: 'field-hint' }, `"${c.note}"`) : null,
          c.is_mine ? el('button', { type: 'button', className: 'btn btn-ghost btn-sm', onClick: () => handleCancel(c.id, space) }, 'Annulla') : null,
        ])
      )
    );
  }

  if (!unsubscribeCheckins) {
    unsubscribeCheckins = subscribeToCheckinChanges(() => mountUpcomingCheckins(space));
  }
}

async function handleCancel(checkinId, space) {
  const { error } = await cancelCheckin(checkinId);
  if (error) return;
  showToast('Check-in annullato.');
  mountUpcomingCheckins(space);
}

// ---------------------------------------------------------------------------
// Recensioni
// ---------------------------------------------------------------------------

async function mountReviewsPanel(space, userId) {
  const container = document.getElementById('reviews-panel');
  const reviews = await getReviewsForSpace(space.id);
  const published = reviews.filter((r) => r.status === 'published');
  const mine = reviews.find((r) => r.user_id === userId);

  const avg = published.length ? published.reduce((sum, r) => sum + r.rating, 0) / published.length : null;
  const distribution = [5, 4, 3, 2, 1].map((star) => ({ star, count: published.filter((r) => r.rating === star).length }));

  render(container, [
    published.length
      ? el('div', { className: 'reviews-summary' }, [
          el('div', { className: 'reviews-avg' }, [icon('star'), ` ${avg.toFixed(1)} su 5 (${published.length} recensioni)`]),
          el(
            'div',
            { className: 'reviews-distribution' },
            distribution.map((d) =>
              el('div', { className: 'reviews-distribution-row' }, [
                el('span', {}, `${d.star}★`),
                el('span', { className: 'reviews-bar' }, [el('span', { className: 'reviews-bar-fill', style: `width:${published.length ? (d.count / published.length) * 100 : 0}%` })]),
                el('span', { className: 'field-hint' }, String(d.count)),
              ])
            )
          ),
        ])
      : el('p', { className: 'field-hint' }, 'Ancora nessuna recensione: sii il primo.'),

    el('div', { id: 'my-review-block' }),

    published.filter((r) => r.user_id !== userId).length
      ? el(
          'div',
          { className: 'reviews-list' },
          published
            .filter((r) => r.user_id !== userId)
            .map((r) => renderReviewCard(r))
        )
      : null,
  ]);

  mountMyReviewBlock(space, mine, userId);
}

function renderReviewCard(review) {
  return el('div', { className: 'card review-card' }, [
    el('div', { className: 'review-card-rating' }, [icon('star'), ` ${review.rating}/5`]),
    review.visited_on ? el('p', { className: 'field-hint' }, `Visitato il ${review.visited_on}`) : null,
    review.comment ? el('p', {}, review.comment) : null,
    el('p', { className: 'field-hint' }, [
      review.wifi_quality ? `Wifi: ${review.wifi_quality}. ` : '',
      review.power_outlets ? `Prese: ${review.power_outlets}. ` : '',
      review.noise_level ? `Rumore: ${review.noise_level}.` : '',
    ].join('')),
  ]);
}

function mountMyReviewBlock(space, mine, userId) {
  const block = document.getElementById('my-review-block');

  if (mine && !block.dataset.editing) {
    render(block, [
      el('div', { className: 'card review-card review-card--mine' }, [
        el('p', { className: 'field-label' }, 'La tua recensione'),
        renderReviewCard(mine),
        el('div', { className: 'space-detail-actions' }, [
          el('button', { type: 'button', className: 'btn btn-secondary btn-sm', onClick: () => { block.dataset.editing = '1'; mountMyReviewBlock(space, mine, userId); } }, 'Modifica'),
          el(
            'button',
            {
              type: 'button',
              className: 'btn btn-danger btn-sm',
              onClick: async () => {
                const { error } = await deleteReview(mine.id);
                if (error) return;
                showToast('Recensione eliminata.');
                mountReviewsPanel(space, userId);
              },
            },
            'Elimina'
          ),
        ]),
      ]),
    ]);
    return;
  }

  render(block, [renderReviewForm(space, mine, userId, () => { delete block.dataset.editing; })]);
}

function renderReviewForm(space, existing, userId, onDone) {
  const form = el('form', { className: 'review-form' }, [
    el('div', { className: 'field' }, [
      el('span', { className: 'field-label' }, 'Voto'),
      el(
        'div',
        { className: 'radio-group', id: 'review-rating' },
        [1, 2, 3, 4, 5].map((n) => el('label', {}, [el('input', { type: 'radio', name: 'review-rating', value: String(n), checked: existing?.rating === n }), ` ${n}`]))
      ),
    ]),
    selectRow('review-wifi', 'Wifi percepito', ['Assente', 'Lento', 'Buono', 'Ottimo'], existing?.wifi_quality),
    selectRow('review-power', 'Prese', ['Assenti', 'Poche', 'Abbondanti'], existing?.power_outlets),
    selectRow('review-noise', 'Rumore', NOISE_LEVEL_LABELS, existing?.noise_level),
    el('div', { className: 'field' }, [
      el('label', { className: 'field-label', for: 'review-visited' }, 'Data della visita'),
      el('input', { type: 'date', className: 'input', id: 'review-visited', max: isoToday(), value: existing?.visited_on || '' }),
    ]),
    el('div', { className: 'field' }, [
      el('label', { className: 'field-label', for: 'review-comment' }, 'Commento'),
      el('textarea', { className: 'textarea', id: 'review-comment', maxlength: '1000' }, existing?.comment || ''),
    ]),
    el('div', { className: 'space-detail-actions' }, [
      el('button', { type: 'submit', className: 'btn btn-primary' }, existing ? 'Salva modifiche' : 'Pubblica recensione'),
      existing ? el('button', { type: 'button', className: 'btn btn-ghost', onClick: onDone }, 'Annulla') : null,
    ]),
  ]);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const rating = Number(form.querySelector('input[name="review-rating"]:checked')?.value);
    if (!rating) {
      showError('Scegli un voto da 1 a 5.');
      return;
    }

    const { error } = await upsertReview(space.id, {
      rating,
      wifiQuality: document.getElementById('review-wifi').value,
      powerOutlets: document.getElementById('review-power').value,
      noiseLevel: document.getElementById('review-noise').value,
      visitedOn: document.getElementById('review-visited').value,
      comment: document.getElementById('review-comment').value.trim(),
    });
    if (error) return;

    showToast('Recensione salvata.');
    onDone();
    mountReviewsPanel(space, userId);
  });

  return form;
}

function selectRow(id, label, options, currentValue) {
  return el('div', { className: 'field' }, [
    el('label', { className: 'field-label', for: id }, label),
    el(
      'select',
      { className: 'select', id },
      [el('option', { value: '' }, 'Non specificato'), ...options.map((o) => el('option', { value: o, selected: o === currentValue }, o))]
    ),
  ]);
}

// ---------------------------------------------------------------------------
// Segnalazioni
// ---------------------------------------------------------------------------

function mountSuggestionButtons(space, fieldOptions) {
  document.getElementById('open-correction-form').addEventListener('click', () => openCorrectionModal(space, fieldOptions));
  document.getElementById('open-closed-form').addEventListener('click', () => openClosedModal(space));
}

function openCorrectionModal(space, fieldOptions) {
  const fields = {
    zone: space.zone,
    cost_type: space.cost_type,
    price_per_day: space.price_per_day,
    wifi_quality: space.wifi_quality,
    wifi_notes: space.wifi_notes,
    power_outlets: space.power_outlets,
    call_space: space.call_space,
    opening_hours: space.opening_hours,
    notes: space.notes,
  };

  const inputs = {};
  const form = el('form', {}, [
    el('h2', {}, 'Segnala una modifica'),
    el('p', { className: 'field-hint' }, 'Cambia solo i campi che non sono più giusti, lascia gli altri come sono.'),
    ...Object.keys(fields).map((key) => {
      const input =
        key === 'notes' || key === 'wifi_notes'
          ? el('textarea', { className: 'textarea' }, fields[key] || '')
          : el('input', { className: 'input', value: fields[key] ?? '' });
      inputs[key] = input;
      return el('div', { className: 'field' }, [el('label', { className: 'field-label' }, key), input]);
    }),
    el('div', { className: 'space-detail-actions' }, [
      el('button', { type: 'submit', className: 'btn btn-primary' }, 'Invia segnalazione'),
      el('button', { type: 'button', className: 'btn btn-ghost', id: 'cancel-correction' }, 'Annulla'),
    ]),
  ]);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = {};
    for (const key of Object.keys(fields)) {
      const rawValue = inputs[key].value.trim();
      const newValue = rawValue === '' ? null : key === 'price_per_day' ? rawValue : rawValue;
      const oldValue = fields[key] == null ? null : String(fields[key]);
      if (newValue !== oldValue) payload[key] = rawValue === '' ? null : rawValue;
    }

    if (Object.keys(payload).length === 0) {
      showError('Non hai cambiato nessun campo.');
      return;
    }

    const { error } = await createSuggestion({ kind: 'correction', spaceId: space.id, payload });
    if (error) return;
    showToast('Segnalazione inviata, grazie!');
    modal.remove();
  });

  form.querySelector('#cancel-correction').addEventListener('click', () => modal.remove());

  const modal = openModal([form]);
}

function openClosedModal(space) {
  const messageInput = el('textarea', { className: 'textarea', placeholder: 'Facoltativo: come lo sai?' });
  const form = el('form', {}, [
    el('h2', {}, 'Questo posto ha chiuso?'),
    el('p', { className: 'field-hint' }, `Segnaliamo "${space.name}" come da verificare per chiusura. Un admin lo controlla prima di nasconderlo.`),
    el('div', { className: 'field' }, [messageInput]),
    el('div', { className: 'space-detail-actions' }, [
      el('button', { type: 'submit', className: 'btn btn-danger' }, 'Conferma segnalazione'),
      el('button', { type: 'button', className: 'btn btn-ghost', id: 'cancel-closed' }, 'Annulla'),
    ]),
  ]);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const { error } = await createSuggestion({ kind: 'closed', spaceId: space.id, message: messageInput.value.trim() });
    if (error) return;
    showToast('Segnalazione inviata, grazie!');
    modal.remove();
  });

  form.querySelector('#cancel-closed').addEventListener('click', () => modal.remove());

  const modal = openModal([form]);
}

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

function sourceLabel(space) {
  if (space.source === 'Esperienza diretta' && space.personal_rating && space.personal_rating !== 'Non testato') {
    return 'Provato da Andrea';
  }
  if (space.source === 'Guida esterna') return 'Da guida esterna';
  return 'Da verificare';
}

function wifiText(space) {
  if (!space.wifi_quality) return MISSING_VALUE;
  return space.wifi_notes ? `${space.wifi_quality} (${space.wifi_notes})` : space.wifi_quality;
}

function factRow(iconName, label, value) {
  return el('div', { className: 'fact-row' }, [el('dt', {}, [icon(iconName), label]), el('dd', {}, value)]);
}

function directionsLink(label, href) {
  if (!href) return null;
  return el('a', { className: 'btn btn-secondary btn-sm', href, target: '_blank', rel: 'noopener noreferrer' }, label);
}

function googleMapsUrl(space) {
  const dest = space.lat != null ? `${space.lat},${space.lng}` : space.address ? `${space.address}, Torino` : null;
  if (!dest) return null;
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(dest)}`;
}

function appleMapsUrl(space) {
  const dest = space.lat != null ? `${space.lat},${space.lng}` : space.address ? `${space.address}, Torino` : null;
  if (!dest) return null;
  return `https://maps.apple.com/?daddr=${encodeURIComponent(dest)}`;
}

function isoToday() {
  return new Date().toISOString().slice(0, 10);
}

function isoDate(daysFromToday) {
  const d = new Date();
  d.setDate(d.getDate() + daysFromToday);
  return d.toISOString().slice(0, 10);
}

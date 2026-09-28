// js/pages/profile.js — bootstrap di profile.html.
import { guard, signOut } from '../auth.js';
import { getMyProfile, updateMyProfile, exportMyData, deleteMyAccount } from '../api/profile.js';
import { getMyUpcomingCheckins, cancelCheckin } from '../api/checkins.js';
import { getMyReviews, deleteReview } from '../api/reviews.js';
import { getMySuggestions } from '../api/suggestions.js';
import { el, render } from '../ui/dom.js';
import { showToast, showError } from '../ui/toast.js';
import { formatDate, formatTimeRange } from '../lib/format.js';

const SUGGESTION_STATUS_LABEL = { pending: 'In attesa', approved: 'Approvata', rejected: 'Rifiutata' };
const SUGGESTION_KIND_LABEL = { new_space: 'Nuovo spazio', correction: 'Correzione', closed: 'Segnalazione chiusura' };

async function main() {
  await guard();

  const profile = await getMyProfile();
  if (!profile) return;

  mountProfileForm(profile);
  mountCheckins();
  mountReviews();
  mountSuggestions();
  mountDataActions();

  document.getElementById('logout-button').addEventListener('click', async () => {
    await signOut();
    window.location.href = 'index.html';
  });
}

function mountProfileForm(profile) {
  const nameInput = document.getElementById('profile-name');
  const checkinsToggle = document.getElementById('profile-show-checkins');
  nameInput.value = profile.display_name || '';
  checkinsToggle.checked = profile.show_in_checkins;

  document.getElementById('profile-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const displayName = nameInput.value.trim();
    if (!displayName) {
      showError('Il nome non può essere vuoto.');
      return;
    }
    const { error } = await updateMyProfile({ displayName, showInCheckins: checkinsToggle.checked });
    if (error) return;
    showToast('Profilo aggiornato.');
  });
}

async function mountCheckins() {
  const container = document.getElementById('my-checkins');
  const checkins = await getMyUpcomingCheckins();

  if (checkins.length === 0) {
    render(container, [el('p', { className: 'field-hint' }, 'Nessun check-in in programma.')]);
    return;
  }

  render(
    container,
    checkins.map((c) =>
      el('div', { className: 'checkin-row' }, [
        el('span', { className: 'checkin-row-day' }, formatDate(c.date)),
        el('a', { href: `space.html?s=${encodeURIComponent(c.spaces?.slug || '')}` }, c.spaces?.name || 'Spazio'),
        formatTimeRange(c.time_from, c.time_to) ? el('span', { className: 'field-hint' }, formatTimeRange(c.time_from, c.time_to)) : null,
        el(
          'button',
          {
            type: 'button',
            className: 'btn btn-ghost btn-sm',
            onClick: async () => {
              const { error } = await cancelCheckin(c.id);
              if (error) return;
              showToast('Check-in annullato.');
              mountCheckins();
            },
          },
          'Annulla'
        ),
      ])
    )
  );
}

async function mountReviews() {
  const container = document.getElementById('my-reviews');
  const reviews = await getMyReviews();

  if (reviews.length === 0) {
    render(container, [el('p', { className: 'field-hint' }, 'Non hai ancora scritto recensioni.')]);
    return;
  }

  render(
    container,
    reviews.map((r) =>
      el('div', { className: 'card review-card' }, [
        el('a', { href: `space.html?s=${encodeURIComponent(r.spaces?.slug || '')}`, className: 'field-label' }, r.spaces?.name || 'Spazio'),
        el('p', {}, `${r.rating}/5${r.comment ? ` — ${r.comment}` : ''}`),
        el(
          'button',
          {
            type: 'button',
            className: 'btn btn-ghost btn-sm',
            onClick: async () => {
              const { error } = await deleteReview(r.id);
              if (error) return;
              showToast('Recensione eliminata.');
              mountReviews();
            },
          },
          'Elimina'
        ),
      ])
    )
  );
}

async function mountSuggestions() {
  const container = document.getElementById('my-suggestions');
  const suggestions = await getMySuggestions();

  if (suggestions.length === 0) {
    render(container, [el('p', { className: 'field-hint' }, 'Non hai ancora inviato segnalazioni.')]);
    return;
  }

  render(
    container,
    suggestions.map((s) =>
      el('div', { className: 'card' }, [
        el('div', { style: 'display:flex; justify-content:space-between; gap: var(--space-3);' }, [
          el('strong', {}, SUGGESTION_KIND_LABEL[s.kind] || s.kind),
          el('span', { className: 'badge badge-outline' }, SUGGESTION_STATUS_LABEL[s.status] || s.status),
        ]),
        s.spaces?.name ? el('p', { className: 'field-hint' }, s.spaces.name) : null,
        s.admin_note ? el('p', { className: 'field-hint' }, `Nota: ${s.admin_note}`) : null,
      ])
    )
  );
}

function mountDataActions() {
  document.getElementById('export-data-button').addEventListener('click', async () => {
    const data = await exportMyData();
    if (!data) return;
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'i-miei-dati-coworking-torino.json';
    link.click();
    URL.revokeObjectURL(url);
  });

  document.getElementById('delete-account-button').addEventListener('click', async () => {
    const confirmed = window.confirm(
      'Vuoi davvero eliminare il tuo account? Cancella check-in, recensioni e segnalazioni, e non puoi tornare indietro.'
    );
    if (!confirmed) return;

    const { error } = await deleteMyAccount();
    if (error) return;

    showToast('Account eliminato. A presto, forse!');
    window.setTimeout(() => {
      window.location.href = 'index.html';
    }, 1500);
  });
}

main();

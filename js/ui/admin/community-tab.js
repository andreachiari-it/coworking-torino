// js/ui/admin/community-tab.js — utenti e check-in in programma (sezione 7.5).
import { el, render } from '../dom.js';
import { showToast, showError } from '../toast.js';
import { listCommunityUsers, setUserRole, getUpcomingCheckinsBySpace } from '../../api/admin.js';
import { formatDate } from '../../lib/format.js';

export async function mountCommunityTab(container) {
  render(container, [
    el('h1', {}, 'Community'),
    el('section', {}, [el('h2', {}, 'Utenti'), el('div', { className: 'admin-table-wrap' }, el('table', { className: 'admin-table', id: 'users-table' }))]),
    el('section', { style: 'margin-top: var(--space-7);' }, [el('h2', {}, 'Check-in nei prossimi 7 giorni'), el('div', { id: 'upcoming-by-space' })]),
  ]);

  const users = await listCommunityUsers();
  renderUsersTable(container, users);

  const upcoming = await getUpcomingCheckinsBySpace();
  renderUpcomingBySpace(container, upcoming);
}

function renderUsersTable(container, users) {
  const table = container.querySelector('#users-table');
  render(table, [
    el('thead', {}, el('tr', {}, [el('th', {}, 'Nome'), el('th', {}, 'Email'), el('th', {}, 'Iscritto il'), el('th', {}, 'Check-in'), el('th', {}, 'Recensioni'), el('th', {}, 'WhatsApp'), el('th', {}, 'Ruolo'), el('th', {}, '')])),
    el(
      'tbody',
      {},
      users.map((u) =>
        el('tr', {}, [
          el('td', {}, u.display_name || '—'),
          el('td', {}, u.email || '—'),
          el('td', {}, formatDate(u.created_at?.slice(0, 10)) || '—'),
          el('td', {}, String(u.checkins_count)),
          el('td', {}, String(u.reviews_count)),
          el('td', {}, u.whatsapp_member ? 'Sì' : 'No'),
          el('td', {}, u.role),
          el('td', {}, [
            u.role === 'admin'
              ? el(
                  'button',
                  {
                    type: 'button',
                    className: 'btn btn-ghost btn-sm',
                    onClick: async () => {
                      if (!window.confirm(`Revocare i permessi admin a ${u.display_name || u.email}?`)) return;
                      const { error } = await setUserRole(u.id, 'member');
                      if (error) return;
                      showToast('Ruolo aggiornato.');
                      u.role = 'member';
                      renderUsersTable(container, users);
                    },
                  },
                  'Revoca admin'
                )
              : el(
                  'button',
                  {
                    type: 'button',
                    className: 'btn btn-ghost btn-sm',
                    onClick: async () => {
                      if (!window.confirm(`Promuovere ${u.display_name || u.email} ad admin?`)) return;
                      const { error } = await setUserRole(u.id, 'admin');
                      if (error) return;
                      showToast('Ruolo aggiornato.');
                      u.role = 'admin';
                      renderUsersTable(container, users);
                    },
                  },
                  'Promuovi admin'
                ),
          ]),
        ])
      )
    ),
  ]);
}

function renderUpcomingBySpace(container, checkins) {
  const bySpace = {};
  for (const c of checkins) {
    const name = c.spaces?.name || 'Spazio';
    if (!bySpace[name]) bySpace[name] = [];
    bySpace[name].push(c.date);
  }

  const target = container.querySelector('#upcoming-by-space');
  const entries = Object.entries(bySpace);

  if (entries.length === 0) {
    render(target, [el('p', { className: 'field-hint' }, 'Nessun check-in nei prossimi giorni.')]);
    return;
  }

  render(
    target,
    entries.map(([name, dates]) => el('div', { className: 'card', style: 'margin-bottom: var(--space-2);' }, [el('strong', {}, name), el('p', { className: 'field-hint' }, dates.map(formatDate).join(', '))]))
  );
}

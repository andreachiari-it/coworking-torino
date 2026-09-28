// js/ui/admin/overview-tab.js — panoramica (sezione 7.6).
import { el, render } from '../dom.js';
import { listAllSpaces, listCommunityUsers, listSuggestions, getCheckinsThisWeekStats } from '../../api/admin.js';
import { computeCompleteness, isPersonallyTested } from '../../lib/completeness.js';

const CRITICAL_FIELDS = ['address', 'zone', 'cost_type', 'wifi_quality', 'power_outlets', 'last_verified_at'];

export async function mountOverviewTab(container) {
  render(container, [el('h1', {}, 'Panoramica'), el('div', { className: 'admin-kpi-grid', id: 'kpi-grid' })]);

  const [spaces, users, pendingSuggestions, weekStats] = await Promise.all([
    listAllSpaces(),
    listCommunityUsers(),
    listSuggestions('pending'),
    getCheckinsThisWeekStats(),
  ]);

  const published = spaces.filter((s) => s.is_published).length;
  const toComplete = spaces.filter((s) => CRITICAL_FIELDS.some((f) => !s[f])).length;
  const untested = spaces.filter((s) => !isPersonallyTested(s)).length;

  const now = Date.now();
  const usersLast7 = users.filter((u) => now - new Date(u.created_at).getTime() < 7 * 86400000).length;
  const usersLast30 = users.filter((u) => now - new Date(u.created_at).getTime() < 30 * 86400000).length;

  const topSpaces = Object.entries(weekStats.bySpace)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  render(container.querySelector('#kpi-grid'), [
    kpi(spaces.length, 'Spazi totali'),
    kpi(published, 'Pubblicati'),
    kpi(toComplete, 'Da completare'),
    kpi(untested, 'Non testati'),
    kpi(usersLast7, 'Iscritti ultimi 7 giorni'),
    kpi(usersLast30, 'Iscritti ultimi 30 giorni'),
    kpi(weekStats.total, 'Check-in questa settimana'),
    kpi(pendingSuggestions.length, 'Segnalazioni in attesa'),
  ]);

  container.append(
    el('section', { style: 'margin-top: var(--space-6);' }, [
      el('h2', {}, 'Spazi più scelti questa settimana'),
      topSpaces.length === 0
        ? el('p', { className: 'field-hint' }, 'Nessun check-in ancora questa settimana.')
        : el(
            'div',
            {},
            topSpaces.map(([name, count]) => el('div', { className: 'diff-row' }, [el('span', {}, name), el('span', { className: 'diff-new' }, `${count} check-in`), el('span', {})]))
          ),
    ])
  );
}

function kpi(value, label) {
  return el('div', { className: 'admin-kpi' }, [el('div', { className: 'admin-kpi-value' }, String(value)), el('div', { className: 'admin-kpi-label' }, label)]);
}

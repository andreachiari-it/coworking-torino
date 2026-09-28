// js/ui/space-card.js — la card di uno spazio, per la lista in app.html.
import { el } from './dom.js';
import { icon } from './icons.js';
import { sourceBadgeLabel, orMissing } from '../lib/labels.js';
import { formatCost } from '../lib/format.js';

/**
 * @param {object} space - riga di spaces_public
 * @param {{ onSelect?: (id:string)=>void, onHover?: (id:string|null)=>void }} [handlers]
 */
export function renderSpaceCard(space, handlers = {}) {
  const cost = formatCost(space.cost_type, space.price_per_day) || orMissing(null);

  const card = el(
    'a',
    {
      className: 'space-card',
      href: `space.html?s=${encodeURIComponent(space.slug)}`,
      dataset: { spaceId: space.id },
      onMouseenter: () => handlers.onHover?.(space.id),
      onMouseleave: () => handlers.onHover?.(null),
      onFocus: () => handlers.onHover?.(space.id),
      onBlur: () => handlers.onHover?.(null),
    },
    [
      el('div', { className: 'space-card-header' }, [
        el('h3', { className: 'space-card-name' }, space.name),
        el('span', { className: 'badge badge-source' }, sourceBadgeLabel(space.source, space.personal_rating)),
      ]),
      el('p', { className: 'space-card-meta' }, [space.type, orMissing(space.zone)].filter(Boolean).join(' · ')),
      el('div', { className: 'space-card-facts' }, [
        el('span', { className: 'badge' }, cost),
        factChip('wifi', orMissing(space.wifi_quality)),
        factChip('power', orMissing(space.power_outlets)),
        factChip('call', space.call_space ? orMissing(space.call_space) : 'Nessuno spazio per call'),
        space.has_outdoor ? factChip('outdoor', 'Spazio esterno') : null,
      ]),
      space.mood?.length
        ? el(
            'div',
            { className: 'chip-row' },
            space.mood.map((m) => el('span', { className: 'chip' }, m))
          )
        : null,
      el('div', { className: 'space-card-footer' }, [
        space.avg_community_rating
          ? el('span', { className: 'space-card-rating' }, [icon('star'), `${Number(space.avg_community_rating).toFixed(1)} (${space.reviews_count})`])
          : null,
        space.checkins_today > 0
          ? el('span', { className: 'space-card-checkins' }, [
              icon('people'),
              `${space.checkins_today} ${space.checkins_today === 1 ? 'persona ci va' : 'persone ci vanno'} oggi`,
            ])
          : null,
        space.lat == null ? el('span', { className: 'space-card-noposition' }, 'Posizione da confermare') : null,
      ]),
    ]
  );

  return card;
}

function factChip(iconName, label) {
  return el('span', { className: 'fact-chip' }, [icon(iconName), el('span', {}, label)]);
}

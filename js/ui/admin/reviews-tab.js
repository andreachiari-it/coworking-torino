// js/ui/admin/reviews-tab.js — moderazione recensioni (sezione 7.4).
import { el, render } from '../dom.js';
import { showToast } from '../toast.js';
import { listAllReviews, setReviewStatus, deleteReviewAdmin } from '../../api/admin.js';

export async function mountReviewsTab(container) {
  render(container, [
    el('h1', {}, 'Recensioni'),
    el('div', { className: 'admin-toolbar' }, [el('input', { className: 'input', id: 'reviews-filter', placeholder: 'Filtra per nome spazio...' })]),
    el('div', { id: 'reviews-list' }),
  ]);

  const all = await listAllReviews();
  renderList(container, all);

  document.getElementById('reviews-filter').addEventListener('input', (e) => {
    const q = e.target.value.toLowerCase();
    renderList(container, all.filter((r) => (r.spaces?.name || '').toLowerCase().includes(q)));
  });
}

function renderList(container, reviews) {
  const list = container.querySelector('#reviews-list');

  if (reviews.length === 0) {
    render(list, [el('p', { className: 'field-hint' }, 'Nessuna recensione.')]);
    return;
  }

  render(
    list,
    reviews.map((r) =>
      el('div', { className: 'card', style: 'margin-bottom: var(--space-3);' }, [
        el('div', { style: 'display:flex; justify-content:space-between;' }, [
          el('a', { href: `space.html?s=${r.spaces?.slug || ''}`, target: '_blank' }, r.spaces?.name || 'Spazio'),
          el('span', { className: 'badge badge-outline' }, r.status),
        ]),
        el('p', {}, `${r.rating}/5${r.comment ? ` — ${r.comment}` : ''}`),
        el('div', { className: 'space-detail-actions' }, [
          r.status === 'published'
            ? el('button', { type: 'button', className: 'btn btn-secondary btn-sm', onClick: async () => { await setReviewStatus(r.id, 'hidden'); showToast('Nascosta.'); r.status = 'hidden'; renderList(container, reviews); } }, 'Nascondi')
            : el('button', { type: 'button', className: 'btn btn-secondary btn-sm', onClick: async () => { await setReviewStatus(r.id, 'published'); showToast('Ripristinata.'); r.status = 'published'; renderList(container, reviews); } }, 'Ripristina'),
          el(
            'button',
            {
              type: 'button',
              className: 'btn btn-danger btn-sm',
              onClick: async () => {
                if (!window.confirm('Eliminare questa recensione?')) return;
                await deleteReviewAdmin(r.id);
                showToast('Eliminata.');
                renderList(container, reviews.filter((x) => x.id !== r.id));
              },
            },
            'Elimina'
          ),
        ]),
      ])
    )
  );
}

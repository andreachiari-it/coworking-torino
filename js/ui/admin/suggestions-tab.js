// js/ui/admin/suggestions-tab.js — coda delle segnalazioni (sezione 7.3).
import { el, render } from '../dom.js';
import { showToast, showError } from '../toast.js';
import { listSuggestions, approveSuggestion, rejectSuggestion, markSuggestionApprovedManually, getSpaceById } from '../../api/admin.js';
import { openSpaceEditor } from './space-editor.js';

const KIND_LABEL = { new_space: 'Nuovo spazio', correction: 'Correzione', closed: 'Chiusura' };

export async function mountSuggestionsTab(container, fieldOptions) {
  render(container, [
    el('h1', {}, 'Segnalazioni'),
    el('div', { className: 'admin-toolbar', id: 'suggestions-filter' }, [
      statusButton('pending', 'In attesa', container, fieldOptions),
      statusButton('approved', 'Approvate', container, fieldOptions),
      statusButton('rejected', 'Rifiutate', container, fieldOptions),
    ]),
    el('div', { id: 'suggestions-list' }),
  ]);
  await reload(container, fieldOptions, 'pending');
}

function statusButton(status, label, container, fieldOptions) {
  return el('button', { type: 'button', className: 'btn btn-secondary btn-sm', onClick: () => reload(container, fieldOptions, status) }, label);
}

async function reload(container, fieldOptions, status) {
  const suggestions = await listSuggestions(status);
  const list = container.querySelector('#suggestions-list');

  if (suggestions.length === 0) {
    render(list, [el('p', { className: 'field-hint' }, 'Niente qui.')]);
    return;
  }

  render(
    list,
    suggestions.map((s) => renderSuggestionCard(s, container, fieldOptions, status))
  );
}

function renderSuggestionCard(s, container, fieldOptions, status) {
  const body = [
    el('div', { style: 'display:flex; justify-content:space-between;' }, [
      el('strong', {}, KIND_LABEL[s.kind] || s.kind),
      el('span', { className: 'field-hint' }, new Date(s.created_at).toLocaleString('it-IT')),
    ]),
    s.spaces?.name ? el('p', {}, [el('a', { href: `space.html?s=${s.spaces.slug}`, target: '_blank' }, s.spaces.name)]) : null,
    s.message ? el('p', { className: 'field-hint' }, s.message) : null,
    s.kind === 'correction' && s.payload ? renderPayloadDiff(s.payload) : null,
    s.kind === 'new_space' && s.payload ? renderNewSpacePreview(s.payload) : null,
    s.admin_note ? el('p', { className: 'field-hint' }, `Nota admin: ${s.admin_note}`) : null,
  ];

  if (status === 'pending') {
    body.push(
      el('div', { className: 'space-detail-actions' }, [
        el(
          'button',
          {
            type: 'button',
            className: 'btn btn-confirm btn-sm',
            onClick: async () => {
              const { error } = await approveSuggestion(s.id);
              if (error) return;
              showToast('Approvata.');
              reload(container, fieldOptions, status);
            },
          },
          'Approva'
        ),
        el(
          'button',
          {
            type: 'button',
            className: 'btn btn-secondary btn-sm',
            onClick: async () => {
              const baseSpace = s.kind === 'correction' && s.space_id ? { ...(await getSpaceById(s.space_id)), ...s.payload } : null;
              openSpaceEditor(baseSpace, {
                fieldOptions,
                onSaved: async () => {
                  await markSuggestionApprovedManually(s.id);
                  reload(container, fieldOptions, status);
                },
              });
            },
          },
          'Approva con modifiche'
        ),
        el(
          'button',
          {
            type: 'button',
            className: 'btn btn-danger btn-sm',
            onClick: async () => {
              const note = window.prompt('Perché la rifiuti? (facoltativo)') || '';
              const { error } = await rejectSuggestion(s.id, note);
              if (error) return;
              showToast('Rifiutata.');
              reload(container, fieldOptions, status);
            },
          },
          'Rifiuta'
        ),
      ])
    );
  }

  return el('div', { className: 'card', style: 'margin-bottom: var(--space-3);' }, body);
}

function renderPayloadDiff(payload) {
  return el(
    'div',
    {},
    Object.entries(payload).map(([field, value]) => el('div', { className: 'diff-row' }, [el('span', {}, field), el('span', {}, '→'), el('span', { className: 'diff-new' }, String(value ?? '—'))]))
  );
}

function renderNewSpacePreview(payload) {
  return el(
    'div',
    {},
    Object.entries(payload)
      .filter(([, v]) => v != null && v !== '')
      .map(([field, value]) => el('div', { className: 'diff-row' }, [el('span', {}, field), el('span', {}, String(value)), el('span', {})]))
  );
}

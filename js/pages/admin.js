// js/pages/admin.js — bootstrap e router a tab di admin/index.html.
import { requireAdmin } from '../auth.js';
import { getFieldOptions } from '../api/field-options.js';
import { mountOverviewTab } from '../ui/admin/overview-tab.js';
import { mountSpacesTab } from '../ui/admin/spaces-tab.js';
import { mountFieldOptionsTab } from '../ui/admin/field-options-tab.js';
import { mountSuggestionsTab } from '../ui/admin/suggestions-tab.js';
import { mountReviewsTab } from '../ui/admin/reviews-tab.js';
import { mountCommunityTab } from '../ui/admin/community-tab.js';

const TABS = {
  panoramica: { label: 'Panoramica', mount: (el) => mountOverviewTab(el) },
  spazi: { label: 'Spazi', mount: (el, fieldOptions) => mountSpacesTab(el, fieldOptions) },
  opzioni: { label: 'Opzioni campi', mount: (el) => mountFieldOptionsTab(el) },
  segnalazioni: { label: 'Segnalazioni', mount: (el, fieldOptions) => mountSuggestionsTab(el, fieldOptions) },
  recensioni: { label: 'Recensioni', mount: (el) => mountReviewsTab(el) },
  community: { label: 'Community', mount: (el) => mountCommunityTab(el) },
};

let fieldOptions = {};

async function main() {
  await requireAdmin();
  fieldOptions = await getFieldOptions();

  renderSidebar();
  window.addEventListener('hashchange', renderActiveTab);
  renderActiveTab();
}

function renderSidebar() {
  const nav = document.getElementById('admin-nav');
  nav.innerHTML = '';
  for (const [key, tab] of Object.entries(TABS)) {
    const link = document.createElement('a');
    link.href = `#${key}`;
    link.className = 'admin-nav-item';
    link.textContent = tab.label;
    link.id = `nav-${key}`;
    nav.append(link);
  }
}

function currentTabKey() {
  const hash = window.location.hash.replace('#', '');
  return TABS[hash] ? hash : 'panoramica';
}

async function renderActiveTab() {
  const key = currentTabKey();

  for (const k of Object.keys(TABS)) {
    const link = document.getElementById(`nav-${k}`);
    if (link) {
      if (k === key) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    }
  }

  const content = document.getElementById('admin-content');
  content.innerHTML = '';
  await TABS[key].mount(content, fieldOptions);
}

main();

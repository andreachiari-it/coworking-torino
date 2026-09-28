// js/ui/dom.js — helper per costruire il DOM senza mai passare da innerHTML
// con dati che arrivano dal database o dagli utenti (vedi sezione 10, XSS).

/**
 * Crea un elemento DOM in modo sicuro.
 * @param {string} tag
 * @param {Object} [attrs] - attributi HTML; `className`, `dataset` (oggetto) e `on<Event>` (handler) sono gestiti a parte.
 * @param {(Node|string)[]|Node|string} [children]
 * @returns {HTMLElement}
 */
export function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);

  for (const [key, value] of Object.entries(attrs || {})) {
    if (value == null || value === false) continue;
    if (key === 'className') {
      node.className = value;
    } else if (key === 'dataset') {
      Object.assign(node.dataset, value);
    } else if (key.startsWith('on') && typeof value === 'function') {
      node.addEventListener(key.slice(2).toLowerCase(), value);
    } else if (key === 'text') {
      node.textContent = value;
    } else if (value === true) {
      node.setAttribute(key, '');
    } else {
      node.setAttribute(key, value);
    }
  }

  appendChildren(node, children);
  return node;
}

function appendChildren(node, children) {
  const list = Array.isArray(children) ? children : [children];
  for (const child of list) {
    if (child == null || child === false) continue;
    node.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
}

/** Rimuove tutti i figli di un nodo. */
export function clear(node) {
  while (node.firstChild) node.removeChild(node.firstChild);
}

/** Sostituisce il contenuto di `node` con `children`, in modo sicuro. */
export function render(node, children) {
  clear(node);
  appendChildren(node, children);
}

const URL_OR_EMAIL = /(https?:\/\/[^\s<>"')]+)|([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})/gi;

/**
 * Trasforma un testo libero (es. `spaces.notes`) in un DocumentFragment con
 * URL http(s) ed email cliccabili come <a>, tutto il resto come testo
 * semplice. Non genera mai HTML da stringa: solo nodi creati con createElement.
 * @param {string} text
 * @returns {DocumentFragment}
 */
export function linkify(text) {
  const fragment = document.createDocumentFragment();
  if (!text) return fragment;

  let lastIndex = 0;
  for (const match of text.matchAll(URL_OR_EMAIL)) {
    const [matched] = match;
    const index = match.index ?? 0;
    if (index > lastIndex) {
      fragment.append(document.createTextNode(text.slice(lastIndex, index)));
    }

    const isEmail = !matched.startsWith('http');
    const href = isEmail ? `mailto:${matched}` : matched;
    fragment.append(
      el('a', { href, target: isEmail ? null : '_blank', rel: isEmail ? null : 'noopener noreferrer' }, matched)
    );

    lastIndex = index + matched.length;
  }

  if (lastIndex < text.length) {
    fragment.append(document.createTextNode(text.slice(lastIndex)));
  }

  return fragment;
}

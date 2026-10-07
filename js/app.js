// Punto d'ingresso: carica l'archivio e decide quale vista mostrare.
//
//   #/                  tutte le cartelle
//   #/materia/italiano  una cartella
//   testo nella ricerca risultati in tutto l'archivio

import { loadArchive } from './archive.js';
import { SITE_TITLE } from './config.js';
import { initTheme } from './theme.js';
import { errorView, homeView, notFoundView, searchView, subjectView } from './views.js';

const main = document.getElementById('contenuto');
const search = document.getElementById('search');

let archive = null;

function currentSubject() {
  const match = location.hash.match(/^#\/materia\/([^/?]+)/);
  if (!match) return undefined;
  return archive.subjects.find((subject) => subject.slug === decodeURIComponent(match[1])) || null;
}

function render() {
  if (!archive) return;

  const query = search.value.trim();
  const subject = currentSubject();
  let view;
  let title = SITE_TITLE;

  if (query) {
    view = searchView(archive, query);
    title = `Ricerca: ${query} | ${SITE_TITLE}`;
  } else if (subject) {
    view = subjectView(subject);
    title = `${subject.name} | ${SITE_TITLE}`;
  } else if (subject === null) {
    view = notFoundView();
  } else {
    view = homeView(archive);
  }

  main.replaceChildren(view);
  document.title = title;
}

/* Navigazione ------------------------------------------------------------- */

window.addEventListener('hashchange', () => {
  search.value = '';
  render();
  window.scrollTo(0, 0);
  main.focus({ preventScroll: true });
});

// Un link interno cliccato durante una ricerca la chiude. Se l'indirizzo è
// già quello giusto non scatta "hashchange", quindi la vista si ridisegna qui.
document.addEventListener('click', (event) => {
  const link = event.target.closest('a[href^="#/"]');
  if (!link || !search.value) return;

  search.value = '';
  if (link.getAttribute('href') === location.hash) render();
});

/* Ricerca ----------------------------------------------------------------- */

search.addEventListener('input', render);

search.addEventListener('keydown', (event) => {
  if (event.key !== 'Escape') return;
  search.value = '';
  search.blur();
  render();
});

// Il tasto "/" porta il cursore nella ricerca
document.addEventListener('keydown', (event) => {
  const typing = event.target.closest('input, textarea, [contenteditable]');
  if (event.key !== '/' || typing || event.ctrlKey || event.metaKey || event.altKey) return;
  event.preventDefault();
  search.focus();
});

/* Avvio ------------------------------------------------------------------- */

initTheme(document.getElementById('theme-toggle'));

try {
  archive = await loadArchive();
  render();
} catch (error) {
  console.error('Archivio non caricato', error);
  main.replaceChildren(errorView());
}

// Punto d'ingresso: chiede la password, carica l'archivio e decide quale
// vista mostrare.
//
//   #/                          tutte le cartelle
//   #/materia/italiano          una materia: i suoi argomenti e le dispense sciolte
//   #/materia/italiano/verismo  un argomento della materia
//   testo nella ricerca         risultati in tutto l'archivio

import { loadArchive } from './archive.js';
import { PASSWORD, SITE_TITLE } from './config.js';
import { el } from './dom.js';
import { initTheme } from './theme.js';
import { errorView, homeView, lockView, notFoundView, searchView, subjectView, topicView } from './views.js';

const main = document.getElementById('contenuto');
const search = document.getElementById('search');

let archive = null;

// Un pezzo dell'indirizzo; se è codificato male non corrisponde a niente.
function decode(part) {
  try {
    return decodeURIComponent(part);
  } catch (error) {
    return null;
  }
}

// Materia e argomento indicati dall'indirizzo: undefined se l'indirizzo non
// ne parla, null se ne indica uno che non esiste.
function currentPlace() {
  const match = location.hash.match(/^#\/materia\/([^/?]+)(?:\/([^/?]+))?/);
  if (!match) return {};

  const subject = archive.subjects.find((entry) => entry.slug === decode(match[1])) || null;
  if (!subject || !match[2]) return { subject };

  return { subject, topic: subject.topics.find((entry) => entry.slug === decode(match[2])) || null };
}

function render() {
  if (!archive) return;

  const query = search.value.trim();
  const { subject, topic } = currentPlace();
  let view;
  let title = SITE_TITLE;

  if (query) {
    view = searchView(archive, query);
    title = `Ricerca: ${query} | ${SITE_TITLE}`;
  } else if (subject && topic) {
    view = topicView(subject, topic);
    title = `${topic.name} | ${subject.name} | ${SITE_TITLE}`;
  } else if (subject && topic === null) {
    view = notFoundView(subject);
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

// La password si chiede una volta sola per browser: js/boot.js segna la pagina
// come bloccata (data-locked) finché non è stata inserita.
const ACCESS_KEY = 'dispense:accesso';
const root = document.documentElement;

async function start() {
  try {
    archive = await loadArchive();
    render();
  } catch (error) {
    console.error('Archivio non caricato', error);
    main.replaceChildren(errorView());
  }
}

function unlock() {
  delete root.dataset.locked;
  try {
    localStorage.setItem(ACCESS_KEY, 'ok');
  } catch (error) {
    // Senza localStorage la password verrà richiesta alla prossima visita
  }
  main.replaceChildren(el('p', { class: 'state' }, 'Carico l\u2019archivio\u2026'));
  start();
}

initTheme(document.getElementById('theme-toggle'));

if ('locked' in root.dataset) {
  main.replaceChildren(lockView((value) => value === PASSWORD, unlock));
  main.querySelector('input').focus();
} else {
  start();
}

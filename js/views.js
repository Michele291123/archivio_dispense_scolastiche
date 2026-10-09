// Le viste: ogni funzione restituisce l'elemento da mettere dentro <main>.

import { REPO_URL, SITE_TITLE } from './config.js';
import { el } from './dom.js';
import { icon } from './icons.js';
import { countDocs, fold } from './text.js';

/* Pezzi riutilizzati ------------------------------------------------------ */

// Link per tornare indietro: all'archivio oppure, da un argomento, alla materia.
function backLink(label = 'Archivio', href = '#/') {
  return el('a', { class: 'crumb', href }, icon('back'), label);
}

function message(title, ...paragraphs) {
  return el('section', { class: 'state' }, el('h2', { class: 'state__title' }, title), paragraphs);
}

const text = (...content) => el('p', { class: 'state__text' }, ...content);
const code = (content) => el('code', {}, content);

// Cartella: linguetta colorata con il numero di dispense, sotto il nome.
function folderCard(subject) {
  const total = subject.docs.length;

  return el(
    'a',
    {
      class: total ? 'folder' : 'folder folder--empty',
      href: `#/materia/${subject.slug}`,
      accent: subject.color,
    },
    el('span', { class: 'folder__tab' }, total ? countDocs(total) : 'vuota'),
    el('span', { class: 'folder__body' }, el('span', { class: 'folder__name' }, subject.name)),
  );
}

// Cartella di un argomento dentro una materia: stesso aspetto, colore della materia.
function topicCard(subject, topic) {
  return el(
    'a',
    { class: 'folder', href: `#/materia/${subject.slug}/${topic.slug}`, accent: subject.color },
    el('span', { class: 'folder__tab' }, countDocs(topic.docs.length)),
    el('span', { class: 'folder__body' }, el('span', { class: 'folder__name' }, topic.name)),
  );
}

// Dispensa: la scheda apre il file; sotto compaiono titolo, descrizione e autore.
function docCard(doc, headingTag) {
  const { type } = doc;

  const preview = type.image
    ? el('img', { class: 'doc__thumb', src: doc.url, alt: '', loading: 'lazy', decoding: 'async' })
    : el('span', { class: 'doc__ext' }, type.label);

  const open = el(
    'a',
    {
      class: 'doc__open',
      href: doc.url,
      'aria-label': `${type.viewable ? 'Apri' : 'Scarica'} ${doc.title} (${type.label})`,
      // Quello che il browser sa mostrare si apre in una nuova scheda, il resto si scarica
      target: type.viewable && '_blank',
      rel: type.viewable && 'noopener',
      download: !type.viewable && doc.fileName,
    },
    preview,
    el('span', { class: 'doc__kind' }, type.kind),
  );

  const download = el(
    'a',
    {
      class: 'doc__download',
      href: doc.url,
      download: doc.fileName,
      title: 'Scarica',
      'aria-label': `Scarica ${doc.title}`,
    },
    icon('download'),
  );

  return el(
    'li',
    { class: 'doc', accent: doc.color },
    el('div', { class: 'doc__tile' }, open, download),
    el(headingTag, { class: 'doc__title' }, doc.title),
    doc.description && el('p', { class: 'doc__desc' }, doc.description),
    doc.author && el('p', { class: 'doc__author' }, `di ${doc.author}`),
  );
}

const docGrid = (docs, headingTag) => el('ul', { class: 'docs' }, docs.map((doc) => docCard(doc, headingTag)));

/* Viste ------------------------------------------------------------------- */

// Home: tutte le cartelle.
export function homeView({ subjects, docs }) {
  return el(
    'div',
    { class: 'view' },
    el(
      'header',
      { class: 'page-head' },
      el('h1', { class: 'page-title' }, SITE_TITLE),
      el('p', { class: 'page-note' }, `${countDocs(docs.length)} in ${subjects.length} cartelle`),
      // Porta alla scelta del modulo su GitHub: una issue per proporre la dispensa
      el(
        'a',
        { class: 'button page-head__action', href: `${REPO_URL}/issues/new/choose`, target: '_blank', rel: 'noopener' },
        icon('upload'),
        'Carica dispensa',
      ),
    ),
    el('ul', { class: 'folders' }, subjects.map((subject) => el('li', {}, folderCard(subject)))),
  );
}

// Una materia aperta: le cartelle degli argomenti e, sotto, le dispense
// che non hanno un argomento.
export function subjectView(subject) {
  const total = subject.docs.length;
  const { topics, loose } = subject;

  return el(
    'div',
    { class: 'view' },
    el(
      'header',
      { class: 'page-head page-head--accent', accent: subject.color },
      backLink(),
      el('div', { class: 'page-head__row' }, el('h1', { class: 'page-title' }, subject.name)),
      total > 0 && el('p', { class: 'page-note' }, countDocs(total)),
    ),
    topics.length > 0 && el('ul', { class: 'folders' }, topics.map((topic) => el('li', {}, topicCard(subject, topic)))),
    topics.length > 0 &&
      loose.length > 0 &&
      el(
        'section',
        { class: 'group', accent: subject.color },
        el('h2', { class: 'group__title' }, 'Senza argomento'),
        docGrid(loose, 'h3'),
      ),
    topics.length === 0 && loose.length > 0 && docGrid(loose, 'h2'),
    total === 0 &&
      message(
        'Cartella vuota',
        text(
          'Per aggiungere una dispensa usa il bottone in home page',
        ),
      ),
  );
}

// Un argomento aperto: le sue dispense e il link per tornare alla materia.
export function topicView(subject, topic) {
  return el(
    'div',
    { class: 'view' },
    el(
      'header',
      { class: 'page-head page-head--accent', accent: subject.color },
      backLink(subject.name, `#/materia/${subject.slug}`),
      el('div', { class: 'page-head__row' }, el('h1', { class: 'page-title page-title--topic' }, topic.name)),
      el('p', { class: 'page-note' }, countDocs(topic.docs.length)),
    ),
    docGrid(topic.docs, 'h2'),
  );
}

// Ricerca: le dispense trovate, raggruppate per materia.
export function searchView({ subjects }, query) {
  const words = fold(query).split(/\s+/).filter(Boolean);
  const groups = subjects
    .map((subject) => ({
      subject,
      docs: subject.docs.filter((doc) => words.every((word) => doc.haystack.includes(word))),
    }))
    .filter((group) => group.docs.length > 0);
  const total = groups.reduce((sum, group) => sum + group.docs.length, 0);

  return el(
    'div',
    { class: 'view' },
    el(
      'header',
      { class: 'page-head' },
      el('h1', { class: 'page-title' }, 'Risultati'),
      el('p', { class: 'page-note' }, total ? `${countDocs(total)} per \u201c${query}\u201d` : `Nessuna dispensa per \u201c${query}\u201d`),
    ),
    total > 0
      ? groups.map(({ subject, docs }) =>
          el(
            'section',
            { class: 'group', accent: subject.color },
            el('h2', { class: 'group__title' }, el('a', { href: `#/materia/${subject.slug}` }, subject.name)),
            docGrid(docs, 'h3'),
          ),
        )
      : message('Nessun risultato', text('La ricerca guarda titolo, descrizione, autore, materia, argomento e nome del file. Prova con un\u2019altra parola.')),
  );
}

// Indirizzo di una cartella che non esiste: una materia oppure, se la materia
// c'\u00e8, un suo argomento.
export function notFoundView(subject) {
  return el(
    'div',
    { class: 'view' },
    el('header', { class: 'page-head' }, subject ? backLink(subject.name, `#/materia/${subject.slug}`) : backLink()),
    subject
      ? message('Argomento inesistente', text(`Questo indirizzo non corrisponde a nessun argomento di ${subject.name}.`))
      : message('Cartella inesistente', text('Questo indirizzo non corrisponde a nessuna materia dell\u2019archivio.')),
  );
}

// Schermata iniziale: chiede la password prima di mostrare l'archivio.
// "check" riceve il testo scritto e dice se \u00e8 giusto; "onUnlock" apre il sito.
export function lockView(check, onUnlock) {
  const input = el('input', {
    class: 'lock__input',
    type: 'password',
    placeholder: 'Password',
    'aria-label': 'Password',
    autocomplete: 'current-password',
    required: true,
  });
  const error = el('p', { class: 'lock__error', role: 'alert' });
  const form = el(
    'form',
    { class: 'lock' },
    el('div', { class: 'lock__row' }, input, el('button', { class: 'button', type: 'submit' }, 'Entra')),
    error,
  );

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    if (check(input.value)) {
      onUnlock();
      return;
    }

    error.textContent = 'Password sbagliata, riprova.';
    input.select();
  });

  return el(
    'div',
    { class: 'view' },
    el(
      'header',
      { class: 'page-head' },
      el('h1', { class: 'page-title' }, SITE_TITLE),
      el('p', { class: 'page-note' }, 'Per entrare serve la password della classe.'),
    ),
    form,
  );
}

// L'indice non si è caricato.
export function errorView() {
  return el(
    'div',
    { class: 'view' },
    message(
      'Indice non trovato',
      text('Il sito non riesce a leggere ', code('dispense/indice.json'), '. Generalo dalla cartella del progetto:'),
      el('pre', { class: 'state__code' }, code('node strumenti/aggiorna-indice.mjs')),
    ),
  );
}

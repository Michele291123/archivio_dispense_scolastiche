// Carica l'archivio: legge l'indice, poi il .yml di ogni dispensa,
// e distribuisce le dispense nelle cartelle in base al campo "materia".
// Dentro ogni materia il campo facoltativo "argomento" crea una sottocartella.
// Una dispensa senza .yml compare lo stesso, con i dati ricavati dal nome del file.

import { EXTRA_COLOR, INDEX_URL, NO_AUTHOR, NO_DESCRIPTION, NO_SUBJECT, SUBJECTS } from './config.js';
import { fileType } from './filetypes.js';
import { parseInfo } from './parser.js';
import { fold, slugify } from './text.js';

// Codifica spazi, accenti e simboli di un percorso senza toccare le barre.
const toUrl = (path) => path.split('/').map(encodeURIComponent).join('/');

// Materia ricavata dal nome del file: "DB_Informatica.pdf" -> Informatica.
// Il nome della materia deve comparire come parola intera; vince il più lungo.
function subjectFromFileName(fileName) {
  const haystack = `-${slugify(fileName)}-`;
  const found = SUBJECTS.filter((subject) => haystack.includes(`-${slugify(subject.name)}-`));
  found.sort((a, b) => b.name.length - a.name.length);
  return found.length > 0 ? found[0].name : NO_SUBJECT;
}

// Legge il .yml della dispensa; null se manca o non si riesce a leggere.
async function loadInfo(entry) {
  if (!entry.info) return null;

  try {
    const response = await fetch(toUrl(entry.info), { cache: 'no-cache' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return parseInfo(await response.text());
  } catch (error) {
    console.warn(`Non riesco a leggere ${entry.info}: uso il nome del file`, error);
    return null;
  }
}

async function loadDoc(entry) {
  const fileName = entry.file.split('/').pop();
  const baseName = fileName.replace(/\.[^.]+$/, '');
  const info = await loadInfo(entry);

  // Senza .yml: titolo dal nome del file, materia cercata nel nome.
  const title = info ? info.titolo || baseName : baseName;
  const description = info ? info.descrizione || '' : NO_DESCRIPTION;
  const author = info ? info.autore || '' : NO_AUTHOR;
  const subject = info ? info.materia || NO_SUBJECT : subjectFromFileName(fileName);
  // Senza argomento la dispensa resta direttamente nella cartella della materia.
  const topic = info ? info.argomento || '' : '';

  return {
    title,
    description,
    author,
    subject,
    topic,
    fileName,
    url: toUrl(entry.file),
    type: fileType(fileName),
    // Testo su cui lavora la ricerca
    haystack: fold([title, description, author, subject, topic, fileName].join(' ')),
  };
}

// Divide le dispense di una materia in cartelle di argomento (subject.topics)
// e dispense senza argomento (subject.loose). Due nomi che differiscono solo
// per maiuscole, accenti o trattini sono lo stesso argomento.
function groupByTopic(subject) {
  const bySlug = new Map();
  subject.topics = [];
  subject.loose = [];

  for (const doc of subject.docs) {
    const slug = slugify(doc.topic);
    if (!slug) {
      subject.loose.push(doc);
      continue;
    }

    let topic = bySlug.get(slug);
    if (!topic) {
      topic = { name: doc.topic, slug, color: subject.color, docs: [] };
      bySlug.set(slug, topic);
      subject.topics.push(topic);
    }
    topic.docs.push(doc);
  }

  subject.topics.sort((a, b) => a.name.localeCompare(b.name, 'it', { numeric: true, sensitivity: 'base' }));
}

export async function loadArchive() {
  const response = await fetch(INDEX_URL, { cache: 'no-cache' });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const entries = await response.json();

  const docs = await Promise.all(entries.filter((entry) => entry && entry.file).map(loadDoc));
  docs.sort((a, b) => a.title.localeCompare(b.title, 'it', { numeric: true, sensitivity: 'base' }));

  // Le cartelle standard esistono sempre, anche vuote.
  const subjects = SUBJECTS.map((subject) => ({ ...subject, slug: slugify(subject.name), docs: [] }));
  const bySlug = new Map(subjects.map((subject) => [subject.slug, subject]));

  for (const doc of docs) {
    const slug = slugify(doc.subject);
    let subject = bySlug.get(slug);

    if (!subject) {
      subject = { name: doc.subject, color: EXTRA_COLOR, slug, docs: [] };
      subjects.push(subject);
      bySlug.set(slug, subject);
    }

    doc.color = subject.color;
    subject.docs.push(doc);
  }

  subjects.forEach(groupByTopic);

  return { subjects, docs };
}

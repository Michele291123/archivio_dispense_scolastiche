// Carica l'archivio: legge l'indice, poi il .yml di ogni dispensa,
// e distribuisce le dispense nelle cartelle in base al campo "materia".

import { EXTRA_COLOR, INDEX_URL, NO_SUBJECT, SUBJECTS } from './config.js';
import { fileType } from './filetypes.js';
import { parseInfo } from './parser.js';
import { fold, slugify } from './text.js';

// Codifica spazi, accenti e simboli di un percorso senza toccare le barre.
const toUrl = (path) => path.split('/').map(encodeURIComponent).join('/');

async function loadDoc(entry) {
  try {
    const response = await fetch(toUrl(entry.info), { cache: 'no-cache' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const info = parseInfo(await response.text());

    const fileName = entry.file.split('/').pop();
    const title = info.titolo || fileName.replace(/\.[^.]+$/, '');
    const description = info.descrizione || '';
    const author = info.autore || '';
    const subject = info.materia || NO_SUBJECT;

    return {
      title,
      description,
      author,
      subject,
      fileName,
      url: toUrl(entry.file),
      type: fileType(fileName),
      // Testo su cui lavora la ricerca
      haystack: fold([title, description, author, subject, fileName].join(' ')),
    };
  } catch (error) {
    console.warn(`Dispensa saltata: non riesco a leggere ${entry.info}`, error);
    return null;
  }
}

export async function loadArchive() {
  const response = await fetch(INDEX_URL, { cache: 'no-cache' });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const entries = await response.json();

  const docs = (await Promise.all(entries.map(loadDoc))).filter(Boolean);
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

  return { subjects, docs };
}

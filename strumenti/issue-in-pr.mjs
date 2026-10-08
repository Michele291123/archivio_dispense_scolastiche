#!/usr/bin/env node
// Trasforma una issue aperta con uno dei moduli di .github/ISSUE_TEMPLATE in
// una pull request che aggiunge la dispensa. Lo esegue il workflow
// .github/workflows/proposta-dispensa.yml a ogni issue aperta.
//
//   node strumenti/issue-in-pr.mjs                   (su GitHub Actions)
//   node strumenti/issue-in-pr.mjs --prova corpo.md  (in locale: legge il corpo
//                                                     di una issue da un file e
//                                                     dice cosa farebbe, senza
//                                                     scaricare né scrivere)
//
// Chiunque può aprire una issue, quindi tutto quello che arriva da lì è
// considerato non fidato: i testi finiscono su una riga sola e tra virgolette,
// i nomi di file e cartelle vengono ripuliti, l'allegato si scarica solo da
// GitHub e solo se ha una delle estensioni ammesse. Nessun valore della issue
// passa mai da una shell.
//
// La pull request non viene mai accettata da qui: la approva una persona.

import { execFileSync } from 'node:child_process';
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const FOLDER = 'dispense';
const FORMS = '.github/ISSUE_TEMPLATE';

// Voce della tendina "Argomento" che fa usare il campo "Nuovo argomento".
const NEW_TOPIC = 'Nuovo argomento';

export const EXTENSIONS = [
  'pdf', 'png', 'jpg', 'jpeg', 'gif', 'webp', 'doc', 'docx', 'xls', 'xlsx',
  'ppt', 'pptx', 'odt', 'ods', 'odp', 'txt', 'zip',
];

// Gli allegati caricati come immagine hanno un indirizzo senza estensione:
// in quel caso la si ricava dal tipo dichiarato dal server.
const EXTENSION_BY_TYPE = {
  'application/pdf': 'pdf',
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/gif': 'gif',
  'image/webp': 'webp',
};

const MAX_BYTES = 50 * 1024 * 1024;
const MAX_LENGTH = { titolo: 150, descrizione: 500, autore: 100, argomento: 60, file: 80 };

// Errore da spiegare a chi ha aperto la issue: il messaggio finisce nel commento.
export class ProposalError extends Error {}

/* Testo -------------------------------------------------------------------- */

// Come js/text.js: minuscole senza accenti, e "Sistemi e Reti" -> "sistemi-e-reti".
const fold = (text) => String(text).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

export const slugify = (text) => fold(text).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

// Riduce un testo a una riga sola: via i caratteri di controllo e quelli
// invisibili, spazi e a capo diventano uno spazio, lunghezza limitata.
export function oneLine(text, max) {
  const clean = String(text || '')
    .normalize('NFC')
    .replace(/[\u0000-\u001f\u007f-\u009f\u2028\u2029]/g, ' ')
    .replace(/[\u200b-\u200f\u202a-\u202e\u2060-\u2069\ufeff]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return Array.from(clean).slice(0, max).join('').trim();
}

// Valore di un campo .yml: sempre tra virgolette doppie, con \ e " protetti.
export const yamlString = (value) => `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;

// Nome di un argomento: lettere, cifre, spazi e poca punteggiatura.
export function cleanTopic(text) {
  return oneLine(text, MAX_LENGTH.argomento)
    .replace(/[^\p{L}\p{N} _.,'()+&-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .replace(/^[\s.]+|[\s.]+$/g, '');
}

// Nome di un file senza estensione: solo lettere non accentate, cifre, "_" e "-".
// Spariscono quindi barre, punti (anche "..") e ogni altro carattere strano.
export function cleanFileName(text) {
  const base = String(text || '').split(/[\\/]/).pop();
  const clean = fold(base).replace(/[^a-z0-9_-]+/g, '_').replace(/^[_-]+|[_-]+$/g, '');
  return clean.slice(0, MAX_LENGTH.file).replace(/[_-]+$/, '') || 'dispensa';
}

function splitExtension(name) {
  const base = String(name || '').split(/[\\/]/).pop();
  const dot = base.lastIndexOf('.');
  if (dot <= 0 || dot === base.length - 1) return { base, extension: '' };
  return { base: base.slice(0, dot), extension: base.slice(dot + 1).toLowerCase() };
}

/* Corpo della issue -------------------------------------------------------- */

// I moduli scrivono il corpo così:   ### Titolo \n\n valore \n\n ### Autore ...
// Restituisce i valori per etichetta ("titolo", "nuovo argomento", ...).
export function parseBody(body) {
  const sections = new Map();
  let label = null;

  for (const line of String(body || '').replace(/^﻿/, '').split(/\r?\n/)) {
    const heading = line.match(/^###\s+(.+?)\s*$/);
    if (heading) {
      label = fold(heading[1]);
      if (!sections.has(label)) sections.set(label, []);
    } else if (label) {
      sections.get(label).push(line);
    }
  }

  const values = new Map();
  for (const [key, lines] of sections) {
    const value = lines.join('\n').trim();
    // Un campo facoltativo lasciato vuoto arriva come "_No response_"
    values.set(key, /^_no response_$/i.test(value) ? '' : value);
  }
  return values;
}

// Una issue scritta a mano non ha le intestazioni dei moduli: va ignorata.
export const isFromForm = (fields) => ['materia', 'titolo', 'autore', 'argomento', 'file'].every((key) => fields.has(key));

// L'allegato nel campo "File": [nome.pdf](indirizzo), ![nome](indirizzo),
// <img alt="nome" src="indirizzo"> oppure il solo indirizzo.
export function findAttachments(text) {
  const names = new Map();
  for (const match of text.matchAll(/\[([^\]]*)\]\(\s*(https?:\/\/[^\s)]+)/g)) names.set(match[2], match[1]);
  for (const match of text.matchAll(/<img\b[^>]*>/gi)) {
    const src = match[0].match(/\bsrc="([^"]+)"/i);
    const alt = match[0].match(/\balt="([^"]*)"/i);
    if (src && alt) names.set(src[1], alt[1]);
  }

  const urls = new Set(text.match(/https?:\/\/[^\s)<>"'\]]+/g) || []);
  return [...urls].map((url) => ({ url, name: names.get(url) || '' }));
}

// Si scarica solo dagli allegati di GitHub.
export function isAttachmentUrl(url) {
  try {
    const { protocol, hostname, port, username, password, pathname } = new URL(url);
    return (
      protocol === 'https:' &&
      hostname === 'github.com' &&
      !port &&
      !username &&
      !password &&
      /^\/user-attachments\/(files|assets)\/[^/]/.test(pathname) &&
      !pathname.includes('..')
    );
  } catch (error) {
    return false;
  }
}

/* Moduli issue ------------------------------------------------------------- */

// Valore di una voce di tendina: semplice oppure tra virgolette.
function optionValue(raw) {
  const text = raw.trim();
  if (text.startsWith('"')) {
    try {
      return String(JSON.parse(text));
    } catch (error) {
      return text.slice(1, -1);
    }
  }
  if (text.startsWith("'") && text.endsWith("'")) return text.slice(1, -1).replace(/''/g, "'");
  return text;
}

// Le voci della tendina con un certo id dentro il testo di un modulo.
// Niente libreria YAML: i moduli hanno tutti la stessa forma, basta leggere
// le righe "- voce" sotto "options:".
function readOptions(lines, id) {
  const start = lines.findIndex((line) => new RegExp(`^\\s*id:\\s*${id}\\s*$`).test(line));
  if (start === -1) return null;

  let header = -1;
  for (let i = start + 1; i < lines.length && !/^\s*-\s+type:/.test(lines[i]); i += 1) {
    if (/^\s*options:\s*$/.test(lines[i])) {
      header = i;
      break;
    }
  }
  if (header === -1) return null;

  const options = [];
  for (let i = header + 1; i < lines.length; i += 1) {
    const option = lines[i].match(/^(\s*)-\s+(.+)$/);
    if (!option) break;
    options.push({ line: i, indent: option[1], value: optionValue(option[2]) });
  }
  return options;
}

// Legge tutti i moduli: per ognuno la materia e gli argomenti già in tendina.
export async function readForms(root = ROOT) {
  const dir = join(root, FORMS);
  const forms = [];

  for (const name of (await readdir(dir)).sort()) {
    if (!/\.ya?ml$/i.test(name) || /^config\.ya?ml$/i.test(name)) continue;

    const path = `${FORMS}/${name}`;
    const text = await readFile(join(dir, name), 'utf8');
    const lines = text.split(/\r?\n/);
    const subject = readOptions(lines, 'materia');
    const topics = readOptions(lines, 'argomento');
    if (!subject || subject.length !== 1 || !topics) continue;

    forms.push({
      path,
      text,
      subject: subject[0].value,
      topics: topics.map((option) => option.value).filter((value) => slugify(value) !== slugify(NEW_TOPIC)),
    });
  }
  return forms;
}

// Aggiunge un argomento alla tendina del modulo, prima di "Nuovo argomento".
export function addTopicToForm(text, topic) {
  const eol = text.includes('\r\n') ? '\r\n' : '\n';
  const lines = text.split(/\r?\n/);
  const options = readOptions(lines, 'argomento');
  if (!options || options.length === 0) throw new Error('tendina "argomento" non trovata nel modulo');

  const last = options.find((option) => slugify(option.value) === slugify(NEW_TOPIC)) || options[options.length - 1];
  lines.splice(last.line, 0, `${last.indent}- ${JSON.stringify(topic)}`);
  return lines.join(eol);
}

/* Dalla issue al piano ----------------------------------------------------- */

// Controlla i campi e decide cosa creare. Non tocca né la rete né il disco:
// tutti gli errori di compilazione del modulo escono da qui.
export function plan(fields, forms) {
  const problems = [];

  const form = forms.find((entry) => slugify(entry.subject) === slugify(oneLine(fields.get('materia'), 100)));
  if (!form) throw new ProposalError('La materia indicata non corrisponde a nessun modulo: apri la issue da uno dei moduli senza cambiare il campo **Materia**.');

  const titolo = oneLine(fields.get('titolo'), MAX_LENGTH.titolo);
  const descrizione = oneLine(fields.get('descrizione'), MAX_LENGTH.descrizione);
  const autore = oneLine(fields.get('autore'), MAX_LENGTH.autore);
  if (!titolo) problems.push('manca il **Titolo**');
  if (!autore) problems.push('manca l\u2019**Autore**');

  // Argomento: uno di quelli in tendina, oppure quello scritto a mano.
  const chosen = oneLine(fields.get('argomento'), 100);
  let argomento = '';
  let isNewTopic = false;

  if (!chosen) {
    problems.push('manca l\u2019**Argomento**');
  } else if (slugify(chosen) === slugify(NEW_TOPIC)) {
    const written = cleanTopic(fields.get('nuovo argomento'));
    const slug = slugify(written);
    if (!slug) {
      problems.push('hai scelto \u201cNuovo argomento\u201d ma il campo **Nuovo argomento** è vuoto (servono lettere o cifre)');
    } else if (slug === slugify(NEW_TOPIC)) {
      problems.push('il nome del nuovo argomento non può essere \u201cNuovo argomento\u201d');
    } else {
      // Se esiste già, anche scritto diversamente, si usa quello.
      const existing = form.topics.find((topic) => slugify(topic) === slug);
      argomento = existing || written;
      isNewTopic = !existing;
    }
  } else {
    argomento = form.topics.find((topic) => slugify(topic) === slugify(chosen)) || '';
    if (!argomento) problems.push('l\u2019**Argomento** scelto non è tra quelli del modulo: scegline uno dalla tendina oppure \u201cNuovo argomento\u201d');
  }

  // Allegato: uno solo, caricato su GitHub, con un'estensione ammessa.
  const attachments = findAttachments(fields.get('file') || '');
  let attachment = null;
  let extension = '';
  let baseName = '';

  if (attachments.length === 0) {
    problems.push('manca il **File**: caricalo nel campo del modulo');
  } else if (attachments.length > 1) {
    problems.push('nel campo **File** c\u2019è più di un allegato: caricane uno solo (per più file usa uno zip)');
  } else if (!isAttachmentUrl(attachments[0].url)) {
    problems.push('il **File** va caricato nel campo del modulo: i link ad altri siti non vengono scaricati');
  } else {
    [attachment] = attachments;
    let fromUrl = '';
    try {
      fromUrl = decodeURIComponent(new URL(attachment.url).pathname.split('/').pop());
    } catch (error) {
      fromUrl = '';
    }
    const urlParts = splitExtension(fromUrl);
    const nameParts = splitExtension(attachment.name);

    // L'estensione dell'indirizzo è quella vera; il nome mostrato vale solo se manca.
    extension = urlParts.extension || nameParts.extension;
    baseName = cleanFileName(nameParts.extension ? nameParts.base : attachment.name || (urlParts.extension ? urlParts.base : ''));
    if (extension && !EXTENSIONS.includes(extension)) {
      problems.push(`i file \u201c.${oneLine(extension, 12).replace(/[^a-z0-9]/g, '')}\u201d non sono ammessi. Estensioni ammesse: ${EXTENSIONS.join(', ')}`);
    }
  }

  if (problems.length > 0) throw new ProposalError(`Non posso preparare la dispensa:\n\n${problems.map((problem) => `- ${problem};`).join('\n')}`);

  return {
    form,
    info: { titolo, descrizione, autore, materia: form.subject, argomento },
    isNewTopic,
    attachment,
    extension,
    baseName,
    folder: `${FOLDER}/${slugify(form.subject)}/${slugify(argomento)}`,
  };
}

// Il contenuto del .yml: una riga per campo, valori tra virgolette.
export function infoFile(info) {
  return ['titolo', 'descrizione', 'autore', 'materia', 'argomento'].map((key) => `${key}: ${yamlString(info[key])}\n`).join('');
}

/* Scaricamento ------------------------------------------------------------- */

// GitHub rimanda gli allegati ai propri server di archiviazione.
function isDownloadHost(hostname) {
  return hostname === 'github.com' || hostname.endsWith('.githubusercontent.com') || /^github-[a-z0-9-]+\.s3\.amazonaws\.com$/.test(hostname);
}

async function fetchAttachment(url, token) {
  let current = new URL(url);

  // I rinvii si seguono a mano, per controllare ogni indirizzo e per non
  // mandare il token fuori da github.com.
  for (let hop = 0; hop < 6; hop += 1) {
    if (current.protocol !== 'https:' || !isDownloadHost(current.hostname)) throw new ProposalError('L\u2019allegato rimanda a un indirizzo che non è di GitHub: non lo scarico.');

    const headers = { 'User-Agent': 'archivio-dispense', Accept: '*/*' };
    if (token && current.hostname === 'github.com') headers.Authorization = `Bearer ${token}`;

    const response = await fetch(current, { redirect: 'manual', headers });
    const location = response.headers.get('location');
    if (response.status >= 300 && response.status < 400 && location) {
      current = new URL(location, current);
      continue;
    }
    return response;
  }
  throw new ProposalError('Non riesco a scaricare l\u2019allegato: troppi rinvii.');
}

// Scarica l'allegato: prima senza token (repo pubblica), poi con il token.
export async function download(url, token) {
  if (!isAttachmentUrl(url)) throw new ProposalError('Il file va caricato nel campo del modulo.');

  let response = await fetchAttachment(url, '');
  if (!response.ok && token) response = await fetchAttachment(url, token);
  if (!response.ok) throw new ProposalError(`Non riesco a scaricare l\u2019allegato (risposta ${response.status}). Riprova caricando di nuovo il file in una nuova issue.`);

  const tooBig = new ProposalError(`Il file supera ${MAX_BYTES / 1024 / 1024} MB: è troppo grande per l\u2019archivio.`);
  if (Number(response.headers.get('content-length')) > MAX_BYTES) throw tooBig;

  const chunks = [];
  let size = 0;
  for await (const chunk of response.body) {
    size += chunk.length;
    if (size > MAX_BYTES) throw tooBig;
    chunks.push(chunk);
  }
  if (size === 0) throw new ProposalError('Il file allegato è vuoto.');

  return { data: Buffer.concat(chunks), type: (response.headers.get('content-type') || '').split(';')[0].trim().toLowerCase() };
}

/* Scrittura ---------------------------------------------------------------- */

// Scrive la dispensa, il suo .yml e, se serve, la nuova voce nel modulo.
// Restituisce i percorsi dei file toccati (relativi alla cartella del progetto).
export async function writeProposal(proposal, { data, type }, root = ROOT) {
  const extension = proposal.extension || EXTENSION_BY_TYPE[type] || '';
  if (!EXTENSIONS.includes(extension)) {
    throw new ProposalError(`Non riconosco il tipo del file allegato. Estensioni ammesse: ${EXTENSIONS.join(', ')}.`);
  }

  // Il percorso deve restare dentro dispense/, qualunque cosa sia arrivata.
  const base = resolve(root, FOLDER);
  const dir = resolve(root, proposal.folder);
  if (!dir.startsWith(base + sep)) throw new Error(`percorso fuori da ${FOLDER}/: ${proposal.folder}`);

  await mkdir(dir, { recursive: true });

  // Mai sovrascrivere: se il nome è già usato (da un file o da un .yml,
  // maiuscole a parte) diventa nome-2, nome-3...
  const taken = new Set((await readdir(dir)).map((name) => splitExtension(name).base.toLowerCase()));
  let name = proposal.baseName;
  for (let n = 2; taken.has(name.toLowerCase()); n += 1) name = `${proposal.baseName}-${n}`;

  const file = `${proposal.folder}/${name}.${extension}`;
  const info = `${proposal.folder}/${name}.yml`;
  for (const path of [file, info]) {
    if (!resolve(root, path).startsWith(dir + sep)) throw new Error(`percorso fuori da ${proposal.folder}/: ${path}`);
  }

  // "wx": fallisce se il file esiste già
  await writeFile(resolve(root, file), data, { flag: 'wx' });
  await writeFile(resolve(root, info), infoFile(proposal.info), { flag: 'wx' });

  const paths = [file, info];
  if (proposal.isNewTopic) {
    await writeFile(resolve(root, proposal.form.path), addTopicToForm(proposal.form.text, proposal.info.argomento));
    paths.push(proposal.form.path);
  }
  return paths;
}

/* GitHub ------------------------------------------------------------------- */

const git = (...args) => execFileSync('git', args, { cwd: ROOT, stdio: 'inherit' });

async function api(method, path, body) {
  const response = await fetch(`https://api.github.com/repos/${process.env.GITHUB_REPOSITORY}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
      'User-Agent': 'archivio-dispense',
      'X-GitHub-Api-Version': '2022-11-28',
    },
    body: JSON.stringify(body),
  });

  const text = await response.text();
  if (!response.ok) {
    const error = new Error(`GitHub ha risposto ${response.status} a ${method} ${path}: ${text.slice(0, 500)}`);
    error.status = response.status;
    throw error;
  }
  return text ? JSON.parse(text) : null;
}

const comment = (number, body) => api('POST', `/issues/${number}/comments`, { body });

async function run() {
  const event = JSON.parse(await readFile(process.env.GITHUB_EVENT_PATH, 'utf8'));
  const { issue } = event;
  if (!issue || issue.pull_request) return;

  const fields = parseBody(issue.body);
  if (!isFromForm(fields)) {
    console.log('La issue non viene da uno dei moduli: la ignoro.');
    return;
  }

  const number = Number(issue.number);
  const branch = `dispensa/issue-${number}`;

  try {
    const proposal = plan(fields, await readForms());
    const downloaded = await download(proposal.attachment.url, process.env.GITHUB_TOKEN);
    const paths = await writeProposal(proposal, downloaded);
    const { info } = proposal;

    git('config', 'user.name', 'github-actions[bot]');
    git('config', 'user.email', '41898282+github-actions[bot]@users.noreply.github.com');
    git('checkout', '-b', branch);
    git('add', '--', ...paths);
    git('commit', '-m', `Dispensa dalla issue #${number}: ${info.titolo}`);
    git('push', 'origin', branch);

    const pull = await api('POST', '/pulls', {
      title: `Dispensa: ${info.titolo} (${info.materia})`,
      head: branch,
      base: event.repository.default_branch,
      body: [
        `Closes #${number}`,
        '',
        `Proposta da @${issue.user.login} con il modulo **${info.materia}**.`,
        '',
        `File: \`${paths[0]}\``,
        '',
        '~~~~yaml',
        infoFile(info).trimEnd(),
        '~~~~',
        '',
        proposal.isNewTopic ? `L\u2019argomento è nuovo: è stato aggiunto anche alla tendina in \`${proposal.form.path}\`.\n` : '',
        '**Prima di accettare** apri il file e controlla che sia davvero una dispensa e che titolo, autore e argomento siano giusti. Questa pull request non viene accettata in automatico.',
      ].join('\n'),
    });

    await comment(number, `Grazie! Ho preparato la pull request ${pull.html_url} con la tua dispensa. Un collaboratore la controllerà e, se va bene, la aggiungerà all\u2019archivio: questa issue si chiuderà da sola.`);
    console.log(`Pull request aperta: ${pull.html_url}`);
  } catch (error) {
    if (error instanceof ProposalError) {
      console.log(`Proposta non valida: ${error.message}`);
      await comment(number, `${error.message}\n\nCorreggi e apri una nuova issue dallo stesso modulo (modificare questa non fa ripartire il controllo).`);
      return;
    }

    // Il caso più comune: le Actions non hanno il permesso di aprire pull request.
    const hint = error.status === 403
      ? ' Probabile causa: in *Settings > Actions > General > Workflow permissions* non è attiva la voce \u201cAllow GitHub Actions to create and approve pull requests\u201d.'
      : '';
    await comment(number, `Qualcosa è andato storto mentre preparavo la pull request: non dipende da come hai compilato il modulo.${hint} Un collaboratore può guardare i dettagli nella scheda **Actions**.`).catch(() => {});
    throw error;
  }
}

// Prova in locale: stampa il piano ricavato da un corpo di issue salvato in un file.
async function dryRun(path) {
  const fields = parseBody(await readFile(path, 'utf8'));
  if (!isFromForm(fields)) {
    console.log('Il corpo non viene da uno dei moduli: la issue verrebbe ignorata.');
    return;
  }

  try {
    const proposal = plan(fields, await readForms());
    console.log(`Cartella:  ${proposal.folder}/`);
    console.log(`File:      ${proposal.baseName}.${proposal.extension || '(estensione dal tipo del file)'}`);
    console.log(`Allegato:  ${proposal.attachment.url}`);
    console.log(`Argomento: ${proposal.info.argomento}${proposal.isNewTopic ? ` (nuovo, da aggiungere a ${proposal.form.path})` : ''}`);
    console.log(`\n${infoFile(proposal.info)}`);
  } catch (error) {
    if (!(error instanceof ProposalError)) throw error;
    console.log(`Commento sulla issue:\n\n${error.message}`);
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const flag = process.argv.indexOf('--prova');
  await (flag === -1 ? run() : dryRun(process.argv[flag + 1]));
}

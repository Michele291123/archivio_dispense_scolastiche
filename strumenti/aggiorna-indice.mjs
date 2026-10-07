#!/usr/bin/env node
// Rigenera dispense/indice.json, l'elenco che il sito legge per sapere quali
// dispense esistono (una pagina web non può sfogliare una cartella da sola).
//
//   node strumenti/aggiorna-indice.mjs
//
// Una dispensa è una coppia di file con lo stesso nome dentro dispense/,
// anche in sottocartelle:  appunti.pdf  +  appunti.yml

import { readdir, writeFile } from 'node:fs/promises';
import { dirname, join, parse, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const FOLDER = 'dispense';
const INDEX = `${FOLDER}/indice.json`;
const INFO_EXTENSIONS = ['.yml', '.yaml'];

async function listFiles(dir) {
  const found = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue;
    const path = join(dir, entry.name);
    if (entry.isDirectory()) found.push(...(await listFiles(path)));
    else found.push(relative(ROOT, path).split(sep).join('/'));
  }
  return found;
}

// Raggruppa i file che hanno lo stesso percorso a meno dell'estensione.
const pairs = new Map();
for (const path of (await listFiles(join(ROOT, FOLDER))).sort()) {
  if (path === INDEX) continue;

  const { dir, name, ext } = parse(path);
  const key = `${dir}/${name}`.toLowerCase();
  const pair = pairs.get(key) || { info: null, files: [] };

  if (INFO_EXTENSIONS.includes(ext.toLowerCase())) pair.info = path;
  else pair.files.push(path);

  pairs.set(key, pair);
}

const index = [];
const warnings = [];

for (const { info, files } of pairs.values()) {
  if (info && files.length > 0) {
    index.push({ info, file: files[0] });
    if (files.length > 1) warnings.push(`${info}: più file con lo stesso nome, uso ${files[0]}`);
  } else if (info) {
    warnings.push(`${info}: manca il file della dispensa`);
  } else {
    for (const file of files) warnings.push(`${file}: manca il file .yml, la dispensa non comparirà`);
  }
}

await writeFile(join(ROOT, INDEX), `${JSON.stringify(index, null, 2)}\n`);

console.log(`Indice aggiornato: ${index.length} ${index.length === 1 ? 'dispensa' : 'dispense'}`);
for (const warning of warnings) console.warn(`  attenzione - ${warning}`);

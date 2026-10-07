// Configurazione del sito: nome, posizione dell'indice e cartelle.

export const SITE_TITLE = 'Archivio dispense';

// Elenco delle dispense, generato da strumenti/aggiorna-indice.mjs
export const INDEX_URL = 'dispense/indice.json';

// Cartelle standard, nell'ordine in cui compaiono.
// Il campo "materia" del file .yml deve corrispondere a uno di questi nomi:
// maiuscole, accenti e trattini non contano ("sistemi-e-reti" va bene).
export const SUBJECTS = [
  { name: 'Italiano', color: '#e8604c' },
  { name: 'Storia', color: '#d8a548' },
  { name: 'Informatica', color: '#57b98a' },
  { name: 'GPOI', color: '#b488e0' },
  { name: 'TPSIT', color: '#5aa2e6' },
  { name: 'Sistemi e Reti', color: '#3fc4c0' },
  { name: 'Matematica', color: '#ee8f45' },
  { name: 'Inglese', color: '#e56f9f' },
];

// Una materia che non è in elenco crea una cartella in più, con questo colore.
export const EXTRA_COLOR = '#a39d92';

// Cartella delle dispense prive del campo "materia".
export const NO_SUBJECT = 'Senza materia';

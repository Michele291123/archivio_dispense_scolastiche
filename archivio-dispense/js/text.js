// Piccole funzioni sul testo usate in più punti.

// Minuscole e senza accenti: per confrontare e cercare ignorando le differenze.
export function fold(text) {
  return String(text)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

// "Sistemi e Reti" -> "sistemi-e-reti": chiave della materia e parte dell'URL.
export function slugify(text) {
  return fold(text)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// "1 dispensa", "3 dispense"
export function countDocs(n) {
  return `${n} ${n === 1 ? 'dispensa' : 'dispense'}`;
}

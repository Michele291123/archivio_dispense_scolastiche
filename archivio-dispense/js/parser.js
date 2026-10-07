// Legge il file .yml che accompagna ogni dispensa: una riga per campo.
//
//   titolo: Verga e il Verismo
//   descrizione: Contesto storico e trama de I Malavoglia.
//   autore: Mario Rossi
//   materia: Italiano
//
// Le righe vuote e quelle che iniziano con # vengono ignorate.
// Il valore può stare tra virgolette e può contenere altri due punti.

const FIELDS = ['titolo', 'descrizione', 'autore', 'materia'];

export function parseInfo(text) {
  const info = {};

  for (const rawLine of text.replace(/^\uFEFF/, '').split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;

    const colon = line.indexOf(':');
    if (colon === -1) continue;

    const field = line.slice(0, colon).trim().toLowerCase();
    if (!FIELDS.includes(field)) continue;

    let value = line.slice(colon + 1).trim();
    const quote = value[0];
    if (value.length > 1 && (quote === '"' || quote === "'") && value.endsWith(quote)) {
      value = value.slice(1, -1).trim();
    }

    info[field] = value;
  }

  return info;
}

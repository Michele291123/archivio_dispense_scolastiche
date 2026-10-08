// Legge il file .yml che accompagna ogni dispensa: una riga per campo.
//
//   titolo: Verga e il Verismo
//   descrizione: Contesto storico e trama de I Malavoglia.
//   autore: Mario Rossi
//   materia: Italiano
//   argomento: Verismo
//
// "argomento" è facoltativo: indica la cartella dentro la materia.
// Le righe vuote e quelle che iniziano con # vengono ignorate.
// Il valore può stare tra virgolette e può contenere altri due punti.
// Tra virgolette doppie \" e \\ valgono " e \ (così scrive i file l'action
// che trasforma le issue in dispense); tra apici '' vale '.

const FIELDS = ['titolo', 'descrizione', 'autore', 'materia', 'argomento'];

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
      value = value.slice(1, -1);
      value = quote === '"' ? value.replace(/\\(["\\])/g, '$1') : value.replace(/''/g, "'");
      value = value.trim();
    }

    info[field] = value;
  }

  return info;
}

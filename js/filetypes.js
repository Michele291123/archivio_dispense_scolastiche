// Riconosce il tipo di file dall'estensione.
//   kind     descrizione mostrata sulla scheda
//   image    il file fa da anteprima di se stesso
//   viewable il browser sa aprirlo in una scheda (altrimenti si scarica)

const KINDS = [
  { kind: 'Documento', viewable: true, ext: ['pdf'] },
  { kind: 'Documento', ext: ['doc', 'docx', 'odt', 'rtf', 'pages'] },
  { kind: 'Foglio di calcolo', ext: ['xls', 'xlsx', 'ods', 'csv', 'numbers'] },
  { kind: 'Presentazione', ext: ['ppt', 'pptx', 'odp', 'key'] },
  { kind: 'Immagine', image: true, viewable: true, ext: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'avif', 'svg'] },
  { kind: 'Testo', viewable: true, ext: ['txt'] },
  { kind: 'Testo', ext: ['md'] },
  { kind: 'Archivio', ext: ['zip', 'rar', '7z'] },
];

export function fileType(fileName) {
  const dot = fileName.lastIndexOf('.');
  const ext = dot > 0 ? fileName.slice(dot + 1).toLowerCase() : '';
  const match = KINDS.find((entry) => entry.ext.includes(ext));

  return {
    label: ext ? ext.toUpperCase() : 'FILE',
    kind: match ? match.kind : 'File',
    image: Boolean(match && match.image),
    viewable: Boolean(match && match.viewable),
  };
}

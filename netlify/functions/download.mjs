// Contatore dei download, eseguito da Netlify come funzione.
//
//   GET  /api/download         { "dispense/appunti.pdf": 12, ... }
//   POST /api/download         corpo: il percorso del file, +1 al suo contatore
//
// Non usa cookie e non salva nulla di chi scarica (né IP né altro): tiene
// solo un numero per ogni file, quindi non serve nessun banner di consenso.
// Conta i click: chi apre la stessa dispensa tre volte vale tre.
//
// I numeri stanno in Netlify Blobs, tutti in un unico oggetto JSON.

import { getStore } from '@netlify/blobs';

const KEY = 'conteggi';
const store = () => getStore({ name: 'download', consistency: 'strong' });

// Accetta solo file che compaiono davvero nell'indice: così nessuno può
// riempire il contatore di nomi inventati.
async function isKnownFile(file, origin) {
  if (typeof file !== 'string' || !file.startsWith('dispense/') || file.length > 300) return false;

  try {
    const response = await fetch(new URL('/dispense/indice.json', origin));
    if (!response.ok) return false;
    const entries = await response.json();
    return entries.some((entry) => entry && entry.file === file);
  } catch (error) {
    return false;
  }
}

// Aumenta di uno. Se due download arrivano nello stesso istante, la scrittura
// del secondo trova l'oggetto cambiato (etag diverso) e riprova.
async function increment(file) {
  const blobs = store();

  for (let attempt = 0; attempt < 5; attempt++) {
    const current = await blobs.getWithMetadata(KEY, { type: 'json' });
    const counts = (current && current.data) || {};
    counts[file] = (Number(counts[file]) || 0) + 1;

    const condition = current ? { onlyIfMatch: current.etag } : { onlyIfNew: true };
    const { modified } = await blobs.setJSON(KEY, counts, condition);
    if (modified) return counts[file];
  }

  return null;
}

export default async (req) => {
  if (req.method === 'GET') {
    const counts = (await store().get(KEY, { type: 'json' })) || {};
    return Response.json(counts, { headers: { 'Cache-Control': 'no-cache' } });
  }

  if (req.method === 'POST') {
    const file = (await req.text()).trim();
    if (!(await isKnownFile(file, req.url))) return new Response('File sconosciuto', { status: 400 });

    const total = await increment(file);
    return Response.json({ file, total });
  }

  return new Response('Metodo non ammesso', { status: 405, headers: { Allow: 'GET, POST' } });
};

export const config = { path: '/api/download' };

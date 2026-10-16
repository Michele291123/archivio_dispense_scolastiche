// Numero di download di ogni dispensa, tenuto da netlify/functions/download.mjs.
// Niente cookie e niente dati di chi scarica: al server arriva solo il
// percorso del file. In locale (senza Netlify) l'indirizzo non esiste e il
// contatore semplicemente non compare.

const API_URL = '/api/download';

// { "dispense/appunti.pdf": 12, ... } oppure null se il contatore non risponde.
export async function loadDownloads() {
  try {
    const response = await fetch(API_URL, { cache: 'no-cache' });
    if (!response.ok) return null;
    const counts = await response.json();
    return counts && typeof counts === 'object' ? counts : null;
  } catch (error) {
    return null;
  }
}

// "1234" -> "1.234"
export const formatCount = (n) => Number(n).toLocaleString('it-IT');

// Segna un download. sendBeacon parte anche se la pagina cambia subito dopo
// il click; dove non c'è si usa fetch con keepalive.
export function countDownload(doc) {
  try {
    if (navigator.sendBeacon && navigator.sendBeacon(API_URL, doc.file)) return;
    fetch(API_URL, { method: 'POST', body: doc.file, keepalive: true }).catch(() => {});
  } catch (error) {
    // Il contatore non deve mai bloccare il download
  }
}

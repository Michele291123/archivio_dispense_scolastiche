// Script classico caricato nell'<head>, prima che la pagina venga disegnata.
// 1. Applica subito il tema scelto in precedenza, così non si vede il cambio.
// 2. Segnala se la pagina è stata aperta con doppio clic (file://): in quel
//    caso il browser blocca la lettura dei file e il CSS mostra un avviso.
// 3. Segnala se la password non è ancora stata inserita su questo browser:
//    il CSS nasconde la ricerca finché js/app.js non sblocca il sito.
(function () {
  var root = document.documentElement;
  var unlocked = false;

  try {
    var saved = localStorage.getItem('dispense:tema');
    if (saved === 'light' || saved === 'dark') root.dataset.theme = saved;
    unlocked = localStorage.getItem('dispense:accesso') === 'ok';
  } catch (error) {
    // localStorage non disponibile: resta il tema scuro predefinito e la
    // password viene chiesta a ogni visita
  }

  if (!unlocked) root.dataset.locked = '';

  if (location.protocol === 'file:') root.dataset.file = '';
})();

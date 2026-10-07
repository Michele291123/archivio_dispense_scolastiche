// Script classico caricato nell'<head>, prima che la pagina venga disegnata.
// 1. Applica subito il tema scelto in precedenza, così non si vede il cambio.
// 2. Segnala se la pagina è stata aperta con doppio clic (file://): in quel
//    caso il browser blocca la lettura dei file e il CSS mostra un avviso.
(function () {
  var root = document.documentElement;

  try {
    var saved = localStorage.getItem('dispense:tema');
    if (saved === 'light' || saved === 'dark') root.dataset.theme = saved;
  } catch (error) {
    // localStorage non disponibile: resta il tema scuro predefinito
  }

  if (location.protocol === 'file:') root.dataset.file = '';
})();

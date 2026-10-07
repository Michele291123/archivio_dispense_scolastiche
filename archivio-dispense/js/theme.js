// Tasto del tema: scuro di partenza, chiaro a richiesta. La scelta resta
// salvata nel browser (la rilegge js/boot.js al caricamento della pagina).

const STORAGE_KEY = 'dispense:tema';
const BAR_COLOR = { dark: '#0e0e0e', light: '#eeede8' };

export function initTheme(button) {
  const root = document.documentElement;
  const barColor = document.querySelector('meta[name="theme-color"]');

  function sync() {
    const theme = root.dataset.theme === 'light' ? 'light' : 'dark';
    button.setAttribute('aria-label', theme === 'dark' ? 'Passa al tema chiaro' : 'Passa al tema scuro');
    if (barColor) barColor.content = BAR_COLOR[theme];
  }

  button.addEventListener('click', () => {
    root.dataset.theme = root.dataset.theme === 'light' ? 'dark' : 'light';
    try {
      localStorage.setItem(STORAGE_KEY, root.dataset.theme);
    } catch (error) {
      // Senza localStorage il tema vale solo per questa visita
    }
    sync();
  });

  sync();
}

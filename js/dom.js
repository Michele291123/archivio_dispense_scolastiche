// Crea un elemento HTML. Il testo passa sempre da nodi di testo, quindi quello
// che arriva dai file .yml non può iniettare HTML nella pagina.
//
//   el('a', { class: 'crumb', href: '#/' }, 'Archivio')
//
// La proprietà speciale "accent" imposta il colore della materia (--accent).
export function el(tag, props = {}, ...children) {
  const node = document.createElement(tag);

  for (const [key, value] of Object.entries(props)) {
    if (value === null || value === undefined || value === false) continue;
    if (key === 'accent') node.style.setProperty('--accent', value);
    else if (key === 'class') node.className = value;
    else node.setAttribute(key, value === true ? '' : value);
  }

  node.append(...children.flat().filter((child) => child || child === 0));
  return node;
}

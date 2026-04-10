/** Pozycja rozszerzonej notatki: pod nagłówkiem aplikacji, na prawo od sidebara. */
export function readExpandOverlayLayout(): { top: number; left: number } {
  const main = document.querySelector('[data-app-main]');
  const sidebar = document.querySelector('[data-app-sidebar]');
  const top = main instanceof HTMLElement ? main.getBoundingClientRect().top : 72;
  const left = sidebar instanceof HTMLElement ? sidebar.getBoundingClientRect().right : 256;
  return { top, left };
}

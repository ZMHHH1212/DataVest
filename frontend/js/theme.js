// Light / dark mode for the report-style pages.
// Follows the device setting until the reader presses the sun/moon button; that choice is remembered.
// (A tiny inline script in each page's <head> applies a saved choice before the page paints.)

const KEY = "datavest.theme";
const handlers = [];

export const isDark = () => {
  const t = document.documentElement.dataset.theme;
  return t ? t === "dark" : window.matchMedia("(prefers-color-scheme: dark)").matches;
};

/** Pages whose charts can redraw in place register here; other pages simply reload on a switch. */
export function onThemeChange(fn) { handlers.push(fn); }

function changed() {
  if (handlers.length) handlers.forEach((fn) => fn(isDark()));
  else location.reload(); // charts read their colours when drawn
}

const SUN = `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.3 5.3l1.6 1.6M17.1 17.1l1.6 1.6M5.3 18.7l1.6-1.6M17.1 6.9l1.6-1.6"/></svg>`;
const MOON = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/></svg>`;

/** Put the sun/moon button in the top bar, just before the account area. */
export function mountThemeButton(top) {
  if (!top || top.querySelector("#theme")) return;
  const b = document.createElement("button");
  b.type = "button";
  b.className = "btn-quiet theme-btn";
  b.id = "theme";
  const paint = () => {
    const dark = isDark();
    b.innerHTML = dark ? SUN : MOON;
    b.setAttribute("aria-label", dark ? "Switch to light mode" : "Switch to dark mode");
    b.title = b.getAttribute("aria-label");
  };
  b.addEventListener("click", () => {
    const next = isDark() ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem(KEY, next); } catch { /* storage blocked */ }
    paint();
    changed();
  });
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
    if (!document.documentElement.dataset.theme) { paint(); changed(); }
  });
  top.insertBefore(b, top.querySelector("#account"));
  paint();
}

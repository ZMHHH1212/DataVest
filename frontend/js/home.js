// Home page: particle sphere opening, what DataVest is, philosophy, and where to start.
import { $, getJSON, renderTopBar } from "./common.js";
import { mountSphere } from "./particles.js";
import { applyStatic, dateText, marketShort, tx } from "./i18n.js";
import { FOUNDATIONS } from "./lessons.js";
import { INVESTING } from "./lessons-investing.js";

renderTopBar(null, "", { i18n: true });
applyStatic();

const small = window.matchMedia("(max-width: 760px)").matches;
mountSphere($("orb"), { count: small ? 4500 : 9000, cx: small ? 0.5 : 0.66, cy: small ? 0.3 : 0.5, size: small ? 0.42 : 0.4 });

// live numbers for the strip, all from the site's own data
$("s-lessons").textContent = String(FOUNDATIONS.length + INVESTING.length);
getJSON("data/tickers.json").then((meta) => {
  $("s-markets").textContent = String(meta.tickers.length);
  const last = meta.tickers.map((t) => t.last_date).sort().at(-1);
  if (last) $("s-updated").textContent = dateText(last);
  renderPulse(meta.tickers, last);
}).catch(() => {});

// the latest close for a few markets, under the sphere
const PULSE = ["^GSPC", "^IXIC", "^HSI", "0700.HK"];
const SHORT_EN = { "^GSPC": "S&P 500", "^IXIC": "Nasdaq", "^HSI": "Hang Seng", "0700.HK": "Tencent" };
function renderPulse(tickers, last) {
  const box = $("pulse");
  const cells = PULSE.map((sym) => tickers.find((t) => t.symbol === sym)).filter((t) => t && t.last && t.prev);
  if (!cells.length) { box.remove(); return; }
  const num = new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  box.innerHTML = cells.map((t) => {
    const ch = (t.last / t.prev - 1) * 100;
    const dir = ch > 0 ? "up" : ch < 0 ? "down" : "";
    const sign = ch > 0 ? "+" : ch < 0 ? "−" : "";
    return `<a href="markets.html"><span class="nm">${marketShort(t.symbol, SHORT_EN[t.symbol] ?? t.name)}</span>`
      + `<span class="v">${num.format(t.last)}</span><span class="c ${dir}">${sign}${Math.abs(ch).toFixed(2)}%</span></a>`;
  }).join("") + (last ? `<p class="when">${tx("Close of {date}", { date: dateText(last) })}</p>` : "");
}
getJSON("data/patterns.json").then((p) => {
  if (p?.map?.stocks) $("s-stocks").textContent = String(p.map.stocks.length);
}).catch(() => {});

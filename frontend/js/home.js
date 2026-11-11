// Home page: particle sphere opening, what DataVest is, philosophy, and where to start.
import { $, getJSON, renderTopBar } from "./common.js";
import { mountSphere } from "./particles.js";
import { applyStatic, dateText } from "./i18n.js";
import { FOUNDATIONS } from "./lessons.js";
import { INVESTING } from "./lessons-investing.js";

renderTopBar(null, "", { i18n: true });
applyStatic();

const small = window.matchMedia("(max-width: 760px)").matches;
mountSphere($("orb"), { count: small ? 4500 : 9000, cx: small ? 0.5 : 0.62, cy: small ? 0.36 : 0.5, size: small ? 0.4 : 0.38 });

// live numbers for the strip, all from the site's own data
$("s-lessons").textContent = String(FOUNDATIONS.length + INVESTING.length);
getJSON("data/tickers.json").then((meta) => {
  $("s-markets").textContent = String(meta.tickers.length);
  const last = meta.tickers.map((t) => t.last_date).sort().at(-1);
  if (last) $("s-updated").textContent = dateText(last);
}).catch(() => {});
getJSON("data/patterns.json").then((p) => {
  if (p?.map?.stocks) $("s-stocks").textContent = String(p.map.stocks.length);
}).catch(() => {});

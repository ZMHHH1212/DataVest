// Home page: particle sphere opening with the latest closes, what DataVest is, "what $1,000 became",
// philosophy, and where to start.
import { $, css, getJSON, renderTopBar, pct, fmtMonth } from "./common.js";
import { mountSphere } from "./particles.js";
import { applyStatic, dateText, marketShort, tx } from "./i18n.js";
import { onThemeChange } from "./theme.js";
import { growFrom } from "./grow.js";
import { FOUNDATIONS } from "./lessons.js";
import { INVESTING } from "./lessons-investing.js";

renderTopBar(null, "", { i18n: true });
applyStatic();

const small = window.matchMedia("(max-width: 760px)").matches;
const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const sphere = mountSphere($("orb"), { count: small ? 4500 : 9000, cx: small ? 0.5 : 0.66, cy: small ? 0.3 : 0.5, size: small ? 0.42 : 0.4 });

const SHORT_EN = {
  "^GSPC": "S&P 500", "^IXIC": "Nasdaq", "^HSI": "Hang Seng", SPY: "SPY", "2800.HK": "Tracker Fund",
  AAPL: "Apple", MSFT: "Microsoft", NVDA: "Nvidia", "0700.HK": "Tencent", "0005.HK": "HSBC",
};
const short = (t) => marketShort(t.symbol, SHORT_EN[t.symbol] ?? t.name);
const num2 = new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const UP = [74, 222, 128], DOWN = [248, 113, 113];

// live numbers for the intro, all from the site's own data
$("s-lessons").textContent = String(FOUNDATIONS.length + INVESTING.length);
getJSON("data/tickers.json").then((meta) => {
  $("s-markets").textContent = String(meta.tickers.length);
  const last = meta.tickers.map((t) => t.last_date).sort().at(-1);
  if (last) $("s-updated").textContent = dateText(last);
  renderPulse(meta.tickers, last);
  mountGrow(meta.tickers);
}).catch(() => {});
getJSON("data/patterns.json").then((p) => {
  if (p?.map?.stocks) $("s-stocks").textContent = String(p.map.stocks.length);
}).catch(() => {});

// ---- latest closes under the sphere: a small price line each; pointing at one tints the sphere ----
const PULSE = ["^GSPC", "^IXIC", "^HSI", "0700.HK"];

function sparkPath(vals, w = 120, h = 28) {
  const lo = Math.min(...vals), hi = Math.max(...vals), span = hi - lo || 1;
  return vals.map((v, i) => `${i ? "L" : "M"}${((i / (vals.length - 1)) * w).toFixed(1)} ${(h - 2 - ((v - lo) / span) * (h - 4)).toFixed(1)}`).join("");
}

function renderPulse(tickers, last) {
  const box = $("pulse");
  const cells = PULSE.map((sym) => tickers.find((t) => t.symbol === sym)).filter((t) => t && t.last && t.prev);
  if (!cells.length) { box.remove(); return; }
  box.innerHTML = cells.map((t) => {
    const ch = (t.last / t.prev - 1) * 100;
    const dir = ch > 0 ? "up" : ch < 0 ? "down" : "";
    const sign = ch > 0 ? "+" : ch < 0 ? "−" : "";
    const spark = t.spark?.length > 2 ? `<svg class="sp" viewBox="0 0 120 28" preserveAspectRatio="none" aria-hidden="true"><path d="${sparkPath(t.spark)}"/></svg>` : "";
    return `<a href="markets.html" data-dir="${dir}"><span class="nm">${short(t)}</span>`
      + `<span class="v">${num2.format(t.last)}</span><span class="c ${dir}">${sign}${Math.abs(ch).toFixed(2)}%</span>${spark}</a>`;
  }).join("") + (last ? `<p class="when">${tx("Close of {date}", { date: dateText(last) })}</p>` : "");
  box.querySelectorAll("a").forEach((a) => {
    const on = () => sphere.setMood(a.dataset.dir === "up" ? UP : a.dataset.dir === "down" ? DOWN : null);
    const off = () => sphere.setMood(null);
    a.addEventListener("pointerenter", on); a.addEventListener("focus", on);
    a.addEventListener("pointerleave", off); a.addEventListener("blur", off);
  });
}

// ---- "What $1,000 became": pick a market and a start date, real prices ----
const AMOUNT = 1000;
const cache = new Map();
const prices = (t) => {
  if (!cache.has(t.file)) cache.set(t.file, getJSON(`data/prices/${t.file}`).catch(() => null));
  return cache.get(t.file);
};
const cur = (t) => (t.currency === "HKD" ? "HK$" : "$");
const fmtMoney = (t, v) => `${cur(t)}${Math.round(v).toLocaleString("en-US")}`;

function mountGrow(tickers) {
  const pick = $("gr-pick"), range = $("gr-range"), canvas = $("gr-canvas"), tip = $("gr-tip");
  if (!pick || !canvas) return;
  const order = ["^GSPC", "^IXIC", "^HSI", "2800.HK", "SPY", "AAPL", "MSFT", "NVDA", "0700.HK", "0005.HK"];
  const list = order.map((s) => tickers.find((t) => t.symbol === s)).filter(Boolean);
  let t = list[0], rows = null, g = null, shown = AMOUNT, anim = 0, drawP = 1, hover = null;

  pick.innerHTML = list.map((x, i) => `<button type="button" data-sym="${x.symbol}" aria-pressed="${i === 0}">${short(x)}</button>`).join("");
  pick.addEventListener("click", (e) => {
    const b = e.target.closest("button");
    if (!b) return;
    pick.querySelectorAll("button").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
    t = list.find((x) => x.symbol === b.dataset.sym);
    load(true);
  });
  range.addEventListener("input", () => update(false));

  async function load(animate) {
    const data = await prices(t);
    if (!data || data.length < 80) return;
    const keepFrom = rows ? rows[Math.min(+range.value, rows.length - 1)][0] : null;
    rows = data;
    range.max = String(rows.length - 61);
    if (keepFrom) range.value = String(Math.min(+range.max, Math.max(0, rows.findIndex((r) => r[0] >= keepFrom))));
    else range.value = "0";
    update(animate);
  }

  function update(animate) {
    g = growFrom(rows, +range.value, AMOUNT);
    if (!g) return;
    $("gr-from").textContent = dateText(g.dates[0]);
    $("gr-total").textContent = pct(g.total);
    $("gr-total").className = g.total >= 0 ? "up" : "down";
    $("gr-year").textContent = g.years >= 1 ? pct(g.perYear) : "–";
    $("gr-worst").textContent = g.worst.depth < 0
      ? `${pct(g.worst.depth)}`
      : "0%";
    $("gr-when").textContent = g.worst.depth < 0
      ? tx("{from} to {to}", { from: fmtMonth(g.dates[g.worst.peak]), to: fmtMonth(g.dates[g.worst.trough]) })
      : tx("No fall from a high");
    canvas.setAttribute("aria-label", tx("{start} invested in {name} on {date} grew to {end}.", {
      start: fmtMoney(t, AMOUNT), name: short(t), date: dateText(g.dates[0]), end: fmtMoney(t, g.end),
    }));
    count(animate && !reduce ? 700 : 0);
    if (animate && !reduce) { drawP = 0; drawIn(); } else { drawP = 1; draw(); }
  }

  // the big number counts to its new value
  function count(ms) {
    cancelAnimationFrame(anim);
    const from = shown, to = g.end, t0 = performance.now();
    const step = (now) => {
      const k = ms ? Math.min(1, (now - t0) / ms) : 1, e = 1 - (1 - k) ** 3;
      shown = from + (to - from) * e;
      $("gr-start").textContent = fmtMoney(t, AMOUNT);
      $("gr-end").textContent = fmtMoney(t, shown);
      if (k < 1) anim = requestAnimationFrame(step);
    };
    anim = requestAnimationFrame(step);
  }
  function drawIn() {
    const t0 = performance.now();
    const step = (now) => { drawP = Math.min(1, (now - t0) / 900); draw(); if (drawP < 1) requestAnimationFrame(step); };
    requestAnimationFrame(step);
  }

  // the chart: one line, the worst fall drawn in red, a dashed line at the starting amount
  const ctx = canvas.getContext("2d");
  let W = 0, H = 0;
  function size() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2), r = canvas.getBoundingClientRect();
    W = r.width; H = r.height;
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    draw();
  }
  const pad = { l: 0, r: 6, t: 18, b: 26 };
  const geom = () => {
    const vals = g.values, lo = Math.min(AMOUNT, ...vals), hi = Math.max(AMOUNT, ...vals), span = hi - lo || 1;
    const x = (i) => pad.l + (i / (vals.length - 1)) * (W - pad.l - pad.r);
    const y = (v) => pad.t + (1 - (v - lo) / span) * (H - pad.t - pad.b);
    return { vals, x, y };
  };
  function draw() {
    if (!g || !W) return;
    ctx.clearRect(0, 0, W, H);
    const ink = css("--ink"), soft = css("--ink-soft"), rule = css("--rule"), accent = css("--accent");
    const { vals, x, y } = geom();
    const n = Math.max(2, Math.round(vals.length * drawP));
    // starting amount
    ctx.strokeStyle = rule; ctx.lineWidth = 1; ctx.setLineDash([3, 4]);
    ctx.beginPath(); ctx.moveTo(0, y(AMOUNT)); ctx.lineTo(W, y(AMOUNT)); ctx.stroke(); ctx.setLineDash([]);
    ctx.font = `12px ${css("--body") || "sans-serif"}`;
    ctx.textBaseline = "middle";
    const lab = fmtMoney(t, AMOUNT), lw = ctx.measureText(lab).width;
    const ly = y(AMOUNT);
    // soft area under the line
    const grad = ctx.createLinearGradient(0, pad.t, 0, H - pad.b);
    grad.addColorStop(0, accent + "33"); grad.addColorStop(1, accent + "00");
    ctx.beginPath(); ctx.moveTo(x(0), y(vals[0]));
    for (let i = 1; i < n; i++) ctx.lineTo(x(i), y(vals[i]));
    ctx.lineTo(x(n - 1), H - pad.b); ctx.lineTo(x(0), H - pad.b); ctx.closePath();
    ctx.fillStyle = grad; ctx.fill();
    // the line
    ctx.beginPath(); ctx.moveTo(x(0), y(vals[0]));
    for (let i = 1; i < n; i++) ctx.lineTo(x(i), y(vals[i]));
    ctx.strokeStyle = ink; ctx.lineWidth = 1.6; ctx.lineJoin = "round"; ctx.stroke();
    // the worst fall
    const { peak, trough, depth } = g.worst;
    if (depth < 0 && trough < n) {
      ctx.beginPath(); ctx.moveTo(x(peak), y(vals[peak]));
      for (let i = peak + 1; i <= trough; i++) ctx.lineTo(x(i), y(vals[i]));
      ctx.strokeStyle = "#f87171"; ctx.lineWidth = 2.4; ctx.stroke();
      ctx.fillStyle = "#f87171";
      ctx.beginPath(); ctx.arc(x(trough), y(vals[trough]), 3.5, 0, Math.PI * 2); ctx.fill();
    }
    // end point
    if (n === vals.length) {
      ctx.fillStyle = ink; ctx.beginPath(); ctx.arc(x(n - 1), y(vals[n - 1]), 3.5, 0, Math.PI * 2); ctx.fill();
    }
    // starting amount label, on a patch so the line never runs through it
    ctx.font = `12px ${css("--body") || "sans-serif"}`; ctx.textBaseline = "middle";
    ctx.fillStyle = css("--paper"); ctx.fillRect(W - lw - 14, ly - 9, lw + 14, 18);
    ctx.fillStyle = soft; ctx.fillText(lab, W - lw - 6, ly);
    // years along the bottom
    ctx.fillStyle = soft; ctx.textBaseline = "alphabetic";
    let lastYear = g.dates[0].slice(0, 4);
    g.dates.forEach((d, i) => {
      const yr = d.slice(0, 4);
      if (yr !== lastYear) { lastYear = yr; if (x(i) < W - 30) ctx.fillText(yr, x(i) + 3, H - 6); ctx.fillStyle = rule; ctx.fillRect(x(i), H - pad.b, 1, 5); ctx.fillStyle = soft; }
    });
    // pointer
    if (hover != null && hover < n) {
      ctx.strokeStyle = soft; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(x(hover), pad.t - 8); ctx.lineTo(x(hover), H - pad.b); ctx.stroke();
      ctx.fillStyle = accent; ctx.beginPath(); ctx.arc(x(hover), y(vals[hover]), 4.5, 0, Math.PI * 2); ctx.fill();
    }
  }
  function point(e) {
    if (!g) return;
    const r = canvas.getBoundingClientRect(), px = e.clientX - r.left;
    const i = Math.max(0, Math.min(g.values.length - 1, Math.round((px / W) * (g.values.length - 1))));
    hover = i; draw();
    tip.hidden = false;
    tip.innerHTML = `<b>${fmtMoney(t, g.values[i])}</b><span>${dateText(g.dates[i])}</span>`;
    const tw = tip.offsetWidth;
    tip.style.left = `${Math.max(0, Math.min(W - tw, px - tw / 2))}px`;
  }
  canvas.addEventListener("pointermove", point);
  canvas.addEventListener("pointerdown", point);
  canvas.addEventListener("pointerleave", () => { hover = null; tip.hidden = true; draw(); });

  new ResizeObserver(size).observe(canvas);
  onThemeChange(() => draw());
  load(false);
}

// Markets page: list of markets, price + drawdown charts, plain-language lessons.
import { onWatchlist, getWatchlist, isWatched, toggleWatch } from "./auth.js";
import { $, css, pct, money, fmtDate, fmtMonth, priceText, getJSON, esc, renderTopBar, chartDefaults, crosshair } from "./common.js";
import { mountSurface } from "./surface3d.js";

const SHORT = { "^GSPC": "S&P 500", "^IXIC": "Nasdaq", "^HSI": "Hang Seng", SPY: "SPY", "2800.HK": "Tracker 2800", "0700.HK": "Tencent", "0005.HK": "HSBC" };
const shortName = (t) => SHORT[t.symbol] || t.name;
let regimes = {};
let surface = null;
let lastShown = null;

const RANGES = { "1M": 1, "6M": 6, "1Y": 12, "5Y": 60 }; // months
const RANGE_WORDS = { "1M": "a month ago", "6M": "6 months ago", "1Y": "a year ago", "5Y": "5 years ago" };
const state = { tickers: [], current: null, series: [], range: "1Y", chart: null, dd: null, rsi: null, overlays: new Set() };
const cache = new Map();
let forecasts = {};

// ---- metrics -------------------------------------------------------------
function sliceRange(series, range) {
  const end = new Date(series[series.length - 1][0]);
  const start = new Date(end);
  start.setMonth(start.getMonth() - RANGES[range]);
  const iso = start.toISOString().slice(0, 10);
  const out = series.filter((r) => r[0] >= iso);
  return out.length >= 2 ? out : series.slice(-2);
}

function metrics(rows) {
  const adj = rows.map((r) => r[2]);
  const growth = adj[adj.length - 1] / adj[0];

  const rets = [];
  for (let i = 1; i < adj.length; i++) rets.push(Math.log(adj[i] / adj[i - 1]));
  const mean = rets.reduce((a, b) => a + b, 0) / rets.length;
  const variance = rets.reduce((a, b) => a + (b - mean) ** 2, 0) / Math.max(rets.length - 1, 1);
  const vol = Math.sqrt(variance) * Math.sqrt(252);

  let peak = adj[0], peakI = 0, worst = 0, worstPeakI = 0, worstTroughI = 0;
  const ddSeries = adj.map((v, i) => {
    if (v > peak) { peak = v; peakI = i; }
    const dd = v / peak - 1;
    if (dd < worst) { worst = dd; worstPeakI = peakI; worstTroughI = i; }
    return dd;
  });

  // Historical 95% one-day Value at Risk and expected shortfall (same method as pandas quantile)
  const simple = [];
  for (let i = 1; i < adj.length; i++) simple.push(adj[i] / adj[i - 1] - 1);
  const sorted = [...simple].sort((a, b) => a - b);
  const pos = (sorted.length - 1) * 0.05, lo = Math.floor(pos);
  const var95 = sorted[lo] + (sorted[Math.min(lo + 1, sorted.length - 1)] - sorted[lo]) * (pos - lo);
  const tail = sorted.filter((r) => r <= var95);
  const es95 = tail.reduce((a, b) => a + b, 0) / tail.length;

  const years = (new Date(rows[rows.length - 1][0]) - new Date(rows[0][0])) / (365.25 * 864e5);
  const cagr = years >= 0.95 ? growth ** (1 / years) - 1 : null;

  return {
    growth, vol, cagr, years, ddSeries, var95, es95, days: simple.length,
    dd: worst,
    ddPeak: rows[worstPeakI][0],
    ddTrough: rows[worstTroughI][0],
    start: rows[0][0],
    end: rows[rows.length - 1][0],
  };
}

// ---- list ----------------------------------------------------------------
function sparkline(values, up) {
  const lo = Math.min(...values), hi = Math.max(...values), span = hi - lo || 1;
  const pts = values.map((v, i) => `${((i / (values.length - 1)) * 64).toFixed(1)},${(20 - ((v - lo) / span) * 18 - 1).toFixed(1)}`).join(" ");
  return `<svg class="spark ${up ? "up" : "down"}" viewBox="0 0 64 20" aria-hidden="true" preserveAspectRatio="none"><polyline points="${pts}"/></svg>`;
}

function marketButton(t) {
  const day = t.last / t.prev - 1;
  const spark = t.spark && t.spark.length > 2 ? sparkline(t.spark, t.spark[t.spark.length - 1] >= t.spark[0]) : "";
  return `<button type="button" class="market" data-symbol="${esc(t.symbol)}" title="${esc(t.name)}: ${pct(day, 2)} on the last trading day">
      <span class="nm">${esc(t.name)}</span>
      <span class="sym">${esc(t.symbol)}</span>
      ${spark}
      <span class="chg ${day >= 0 ? "up" : "down"}">${pct(day, 2)}</span>
    </button>`;
}

function renderList() {
  const watched = getWatchlist();
  const groups = [];
  const mine = state.tickers.filter((t) => watched.includes(t.symbol));
  if (mine.length) groups.push(["Your watchlist", mine]);
  for (const t of state.tickers) {
    if (watched.includes(t.symbol)) continue;
    let g = groups.find(([name]) => name === t.group);
    if (!g) groups.push((g = [t.group, []]));
    g[1].push(t);
  }
  $("market-list").innerHTML = groups
    .map(([name, items]) => `<p class="group-name${name === "Your watchlist" ? " mine" : ""}">${esc(name)}</p>${items.map(marketButton).join("")}`)
    .join("");
  document.querySelectorAll(".market").forEach((b) => {
    b.addEventListener("click", () => select(b.dataset.symbol));
    b.setAttribute("aria-current", String(state.current?.symbol === b.dataset.symbol));
  });
}

// ---- detail --------------------------------------------------------------
function renderStar() {
  const on = isWatched(state.current.symbol);
  const star = $("star");
  star.hidden = false;
  star.setAttribute("aria-pressed", String(on));
  $("star-label").textContent = on ? "In your watchlist" : "Add to watchlist";
}

function renderDetail() {
  const t = state.current;
  const rows = sliceRange(state.series, state.range);
  const m = metrics(rows);
  const up = m.growth >= 1;

  $("m-name").textContent = `${t.name} (${t.symbol})`;
  renderLast(t);
  renderRegime(t);
  surface?.setHighlight(shortName(t));
  $("rail-range").textContent = { "1M": "last month", "6M": "last 6 months", "1Y": "last year", "5Y": "last 5 years" }[state.range];
  $("m-story").innerHTML = `$100 invested ${RANGE_WORDS[state.range]} is now worth <span class="amount ${up ? "" : "down"}">$${money(100 * m.growth)}</span>.`;
  const last = state.series[state.series.length - 1];
  const day = t.last / t.prev - 1;
  $("m-price").innerHTML = `Last close <strong>${priceText(t, last[1])}</strong> on ${fmtDate(last[0])}, <span class="${day >= 0 ? "up" : "down"}">${pct(day, 2)}</span> on the day.`;
  renderStar();

  $("vol-figure").textContent = `±${(m.vol * 100).toFixed(0)}% a year`;
  const calm = m.vol < 0.15 ? "calmer than a typical stock index" : m.vol < 0.25 ? "about normal for a stock index" : m.vol < 0.4 ? "bumpier than a broad index, typical for a single stock" : "very bumpy, so expect big swings";
  $("vol-text").textContent = `Over this period that is ${calm}.`;
  const f = forecasts[t.symbol];
  $("vol-forecast").hidden = !f;
  if (f) $("vol-forecast").innerHTML = `Forecast for the next month: <b>±${(f.garch_next_month * 100).toFixed(0)}% a year</b>, from a GARCH model. <a href="models.html">How well do forecasts work?</a>`;

  $("dd-figure").textContent = m.dd < -0.0005 ? pct(m.dd) : "No fall";
  $("dd-text").textContent = m.dd < -0.0005
    ? `From its high on ${fmtDate(m.ddPeak)} it fell to its low on ${fmtDate(m.ddTrough)}. $100 at that high became $${money(100 * (1 + m.dd))}.`
    : "The price only went up in this period.";

  if (m.cagr === null) {
    $("cagr-figure").textContent = pct(m.growth - 1);
    $("cagr-text").textContent = "Total change for this period. Pick 1 year or longer to see a yearly rate.";
  } else {
    $("cagr-figure").textContent = `${pct(m.cagr)} a year`;
    $("cagr-text").textContent = `The steady yearly rate that matches a total change of ${pct(m.growth - 1)} over ${m.years.toFixed(1)} years.`;
  }

  if (m.days >= 20) {
    $("var-figure").textContent = `${pct(m.var95)} in a day`;
    $("var-text").textContent = `On 1 trading day in 20 it fell this much or more. On those days the average fall was ${pct(m.es95)}.`;
  } else {
    $("var-figure").textContent = "–";
    $("var-text").textContent = "Pick 6 months or longer: this needs at least 20 trading days.";
  }

  const lastRsi = rows[rows.length - 1][5] == null ? null : Math.round(rows[rows.length - 1][5]);
  $("rsi-note").textContent = lastRsi == null
    ? "Compares the size of recent gains with recent losses on a 0–100 scale."
    : `Latest reading ${lastRsi}: ${lastRsi >= 70 ? "above 70, the zone often called overbought" : lastRsi <= 30 ? "below 30, the zone often called oversold" : "between 30 and 70, the neutral zone"}.`;

  document.querySelectorAll("[data-overlay]").forEach((b) => b.setAttribute("aria-pressed", String(state.overlays.has(b.dataset.overlay))));
  document.querySelectorAll(".ranges button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.range === state.range)));
  document.querySelectorAll(".market").forEach((b) => b.setAttribute("aria-current", String(b.dataset.symbol === t.symbol)));
  $("chart").setAttribute("aria-label", `${t.name} price from ${fmtDate(m.start)} to ${fmtDate(m.end)}, ${pct(m.growth - 1)} in total.`);
  $("ddchart").setAttribute("aria-label", `Falls from the peak for ${t.name}. Worst: ${pct(m.dd)}.`);
  drawCharts(rows, m, up);
}

function xTicks() {
  return { maxTicksLimit: 6, maxRotation: 0, callback(v) { return fmtMonth(this.getLabelForValue(v)); } };
}

function drawCharts(rows, m, up) {
  const color = up ? css("--jade") : css("--cinnabar");
  const labels = rows.map((r) => r[0]);
  const priceData = {
    labels,
    datasets: [{ data: rows.map((r) => r[1]), borderColor: color, borderWidth: 2, pointRadius: 0, pointHoverRadius: 4, pointHoverBorderColor: css("--paper"), pointHoverBorderWidth: 2, pointHoverBackgroundColor: color, tension: 0.15, fill: { target: "origin" }, backgroundColor: color + "1a" }],
  };
  const overlay = (key, col, label, varName, dash) => ({
    label, data: rows.map((r) => r[col]), borderColor: css(varName), borderWidth: 1.5,
    borderDash: dash, pointRadius: 0, pointHoverRadius: 0, tension: 0.1, fill: false, spanGaps: false,
  });
  if (state.overlays.has("sma50")) priceData.datasets.push(overlay("sma50", 3, "50-day", "--s1", []));
  if (state.overlays.has("sma200")) priceData.datasets.push(overlay("sma200", 4, "200-day", "--ink-soft", [6, 4]));
  const rsiData = {
    labels,
    datasets: [{ data: rows.map((r) => r[5]), borderColor: css("--ink"), borderWidth: 1.5, pointRadius: 0, pointHoverRadius: 3, tension: 0.1, spanGaps: false }],
  };
  const ddData = {
    labels,
    datasets: [{ data: m.ddSeries, borderColor: css("--cinnabar"), borderWidth: 1.5, pointRadius: 0, pointHoverRadius: 3, fill: { target: "origin" }, backgroundColor: css("--cinnabar") + "26", tension: 0 }],
  };

  if (state.chart) {
    state.chart.data = priceData;
    state.chart.update("none");
    state.dd.data = ddData;
    state.dd.update("none");
    state.rsi.data = rsiData;
    state.rsi.update("none");
    return;
  }
  const base = {
    maintainAspectRatio: false,
    animation: false,
    interaction: { mode: "index", intersect: false },
    plugins: { legend: { display: false } },
  };
  state.chart = new Chart($("chart"), {
    type: "line",
    data: priceData,
    plugins: [crosshair],
    options: {
      ...base,
      plugins: { ...base.plugins, tooltip: { displayColors: false, callbacks: { title: (i) => fmtDate(i[0].label), label: (i) => (i.datasetIndex === 0 ? priceText(state.current, i.parsed.y) : `${i.dataset.label} average: ${priceText(state.current, i.parsed.y)}`) } } },
      scales: {
        x: { grid: { display: false }, ticks: xTicks() },
        y: { position: "right", grid: { color: css("--rule") }, border: { display: false }, ticks: { maxTicksLimit: 6 } },
      },
    },
  });
  state.dd = new Chart($("ddchart"), {
    type: "line",
    data: ddData,
    plugins: [crosshair],
    options: {
      ...base,
      plugins: { ...base.plugins, tooltip: { displayColors: false, callbacks: { title: (i) => fmtDate(i[0].label), label: (i) => (i.parsed.y > -0.0005 ? "At a new high" : `${pct(i.parsed.y)} below the previous high`) } } },
      scales: {
        x: { grid: { display: false }, ticks: { display: false } },
        y: { position: "right", max: 0, grid: { color: css("--rule") }, border: { display: false }, ticks: { maxTicksLimit: 3, callback: (v) => `${Math.round(v * 100)}%` } },
      },
    },
  });
  drawRsi(rsiData);
}

const rsiZones = {
  id: "rsiZones",
  beforeDatasetsDraw(chart) {
    const { ctx, chartArea: a, scales: { y } } = chart;
    ctx.save();
    ctx.fillStyle = css("--rule");
    ctx.globalAlpha = 0.35;
    ctx.fillRect(a.left, y.getPixelForValue(70), a.right - a.left, y.getPixelForValue(30) - y.getPixelForValue(70));
    ctx.globalAlpha = 1;
    ctx.font = `500 11px ${css("--body")}`;
    ctx.fillStyle = css("--ink-soft");
    ctx.textBaseline = "bottom";
    ctx.fillText("70 overbought", a.left + 4, y.getPixelForValue(70) - 2);
    ctx.textBaseline = "top";
    ctx.fillText("30 oversold", a.left + 4, y.getPixelForValue(30) + 2);
    ctx.restore();
  },
};

function drawRsi(rsiData) {
  state.rsi = new Chart($("rsichart"), {
    type: "line",
    data: rsiData,
    plugins: [rsiZones, crosshair],
    options: {
      maintainAspectRatio: false,
      animation: false,
      interaction: { mode: "index", intersect: false },
      plugins: { legend: { display: false }, tooltip: { displayColors: false, callbacks: { title: (i) => fmtDate(i[0].label), label: (i) => `RSI ${i.parsed.y.toFixed(0)}` } } },
      scales: {
        x: { grid: { display: false }, ticks: { display: false } },
        y: { position: "right", min: 0, max: 100, grid: { display: false }, border: { display: false }, ticks: { stepSize: 50 } },
      },
    },
  });
}

// Big price readout with a short count animation when switching markets
function renderLast(t) {
  const el = $("m-last");
  if (!el) return;
  const target = t.last;
  const ccy = t.is_index ? "pts" : t.currency || "";
  const fmt = (v) => v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  if (lastShown === t.symbol) return;
  lastShown = t.symbol;
  if (reduce) { el.innerHTML = `${fmt(target)}<span class="ccy">${esc(ccy)}</span>`; return; }
  const start = performance.now(), from = target * 0.97;
  const step = (now) => {
    const k = Math.min((now - start) / 450, 1), e = 1 - (1 - k) ** 3;
    el.innerHTML = `${fmt(from + (target - from) * e)}<span class="ccy">${esc(ccy)}</span>`;
    if (k < 1 && lastShown === t.symbol) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
  el.classList.remove("flash"); void el.offsetWidth; el.classList.add("flash");
}

function renderRegime(t) {
  const r = regimes[t.symbol];
  $("regime-tile").hidden = !r;
  if (!r) return;
  const p = r.today_p_turbulent, storm = p > 0.5;
  $("m-regime").textContent = storm ? "Stormy" : "Calm";
  $("m-regime").className = `figure ${storm ? "storm" : "calm"}`;
  const [calm, st] = r.states;
  $("m-regime-text").textContent = `${Math.round((storm ? p : 1 - p) * 100)}% probability, from a Hidden Markov Model. Calm phases swing about ±${Math.round(calm.volatility * 100)}% a year, stormy ones ±${Math.round(st.volatility * 100)}%.`;
}

function renderTape() {
  const item = (t) => {
    const day = t.last / t.prev - 1;
    return `<button type="button" data-symbol="${esc(t.symbol)}"><span class="t-sym">${esc(shortName(t))}</span><span class="t-px">${t.last.toLocaleString("en-US", { maximumFractionDigits: 2 })}</span><span class="${day >= 0 ? "up" : "down"}">${day >= 0 ? "▲" : "▼"} ${Math.abs(day * 100).toFixed(2)}%</span></button>`;
  };
  const once = state.tickers.map(item).join("");
  $("tape").innerHTML = `<div class="tape-track">${once}${once.replace(/<button /g, '<button tabindex="-1" aria-hidden="true" ')}</div>`;
  $("tape").querySelectorAll("button").forEach((b) => b.addEventListener("click", () => select(b.dataset.symbol)));
}

function initSurface(ins) {
  const rv = ins?.rolling_vol;
  if (!rv || !$("surface")) { document.querySelector(".surface-panel")?.setAttribute("hidden", ""); return; }
  const keep = rv.dates.map((_, i) => i).filter((i) => i % 2 === 0);
  const rows = state.tickers
    .filter((t) => rv.series[t.symbol])
    .map((t) => ({ label: shortName(t), values: keep.map((i) => rv.series[t.symbol][i]) }));
  const dates = keep.map((i) => rv.dates[i]);
  // start where every market has data
  const first = dates.findIndex((_, c) => rows.every((r) => r.values[c] != null));
  const trimmed = rows.map((r) => ({ ...r, values: r.values.slice(Math.max(first, 0)) }));
  const spinBtn = $("sf-spin");
  surface = mountSurface($("surface"), $("sf-tip"), {
    rows: trimmed,
    dates: dates.slice(Math.max(first, 0)),
    formatDate: (d) => `week of ${fmtDate(d)}`,
    font: css("--mono"),
    colors: { ink: css("--ink"), soft: css("--ink-soft"), line: css("--rule"), amber: css("--amber") },
    highlight: state.current ? shortName(state.current) : null,
    onSpin: (on) => spinBtn.setAttribute("aria-pressed", String(on)),
  });
  if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) spinBtn.setAttribute("aria-pressed", "false");
  $("sf-in").addEventListener("click", () => surface.zoom(1.15));
  $("sf-out").addEventListener("click", () => surface.zoom(1 / 1.15));
  $("sf-reset").addEventListener("click", () => surface.reset());
  spinBtn.addEventListener("click", () => {
    const on = spinBtn.getAttribute("aria-pressed") !== "true";
    spinBtn.setAttribute("aria-pressed", String(on));
    surface.spin(on);
  });
  // where was it stormiest?
  let best = null;
  trimmed.forEach((r) => r.values.forEach((v, c) => { if (v != null && (!best || v > best.v)) best = { v, label: r.label, c }; }));
  if (best) $("sf-note").textContent = `Each market's 3-month volatility over the last five years, one ridge per market: peaks are stormy periods. The highest peak is ${best.label} around ${fmtDate(dates.slice(Math.max(first, 0))[best.c])} (±${Math.round(best.v * 100)}% a year). Drag to rotate, hover for values.`;
}

async function select(symbol) {
  const t = state.tickers.find((x) => x.symbol === symbol) || state.tickers[0];
  state.current = t;
  if (!cache.has(t.file)) cache.set(t.file, await getJSON(`data/prices/${t.file}`));
  state.series = cache.get(t.file);
  history.replaceState(null, "", `#${encodeURIComponent(t.symbol)}`);
  renderDetail();
}

async function init() {
  renderTopBar("markets");
  chartDefaults();
  document.querySelectorAll(".ranges button").forEach((b) =>
    b.addEventListener("click", () => { state.range = b.dataset.range; renderDetail(); })
  );
  $("star").addEventListener("click", () => toggleWatch(state.current.symbol));
  document.querySelectorAll("[data-overlay]").forEach((b) =>
    b.addEventListener("click", () => {
      const k = b.dataset.overlay;
      state.overlays.has(k) ? state.overlays.delete(k) : state.overlays.add(k);
      renderDetail();
    })
  );

  try {
    const meta = await getJSON("data/tickers.json");
    state.tickers = meta.tickers;
    if (!state.tickers.length) throw new Error("no tickers");
    $("updated").textContent = `Last updated ${new Date(meta.generated_at).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}.`;
    const lastDate = state.tickers.map((t) => t.last_date).sort().at(-1);
    if ($("asof")) $("asof").textContent = `Close ${fmtDate(lastDate)}`;
    if ($("tape")) renderTape();
    const [models, patterns, ins] = await Promise.all(["data/models.json", "data/patterns.json", "data/insights.json"].map((u) => getJSON(u).catch(() => null)));
    forecasts = models?.forecasts || {};
    regimes = patterns?.regimes || {};
    await select(decodeURIComponent(location.hash.slice(1)) || "^HSI");
    if ($("surface")) initSurface(ins);
    onWatchlist(() => { renderList(); renderStar(); });
  } catch (err) {
    console.error(err);
    $("market-list").innerHTML = "";
    $("main").innerHTML = `<p class="notice">No market data found. Run <code>python -m app.pipeline.ingest</code> and then <code>python -m app.export_site</code> in the backend folder, and reload this page.</p>`;
  }
}

init();

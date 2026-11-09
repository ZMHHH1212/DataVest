// Markets page: list of markets, price + drawdown charts, plain-language lessons.
import { onWatchlist, getWatchlist, isWatched, toggleWatch } from "./auth.js";
import { $, css, pct, money, fmtDate, fmtMonth, priceText, getJSON, esc, renderTopBar, chartDefaults, crosshair } from "./common.js";

const RANGES = { "1M": 1, "6M": 6, "1Y": 12, "5Y": 60 }; // months
const RANGE_WORDS = { "1M": "a month ago", "6M": "6 months ago", "1Y": "a year ago", "5Y": "5 years ago" };
const state = { tickers: [], current: null, series: [], range: "1Y", chart: null, dd: null };
const cache = new Map();

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

  const years = (new Date(rows[rows.length - 1][0]) - new Date(rows[0][0])) / (365.25 * 864e5);
  const cagr = years >= 0.95 ? growth ** (1 / years) - 1 : null;

  return {
    growth, vol, cagr, years, ddSeries,
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
  $("m-story").innerHTML = `$100 invested ${RANGE_WORDS[state.range]} is now worth <span class="amount ${up ? "" : "down"}">$${money(100 * m.growth)}</span>.`;
  const last = state.series[state.series.length - 1];
  const day = t.last / t.prev - 1;
  $("m-price").innerHTML = `Last close <strong>${priceText(t, last[1])}</strong> on ${fmtDate(last[0])}, <span class="${day >= 0 ? "up" : "down"}">${pct(day, 2)}</span> on the day.`;
  renderStar();

  $("vol-figure").textContent = `±${(m.vol * 100).toFixed(0)}% a year`;
  const calm = m.vol < 0.15 ? "calmer than a typical stock index" : m.vol < 0.25 ? "about normal for a stock index" : m.vol < 0.4 ? "bumpier than a broad index, typical for a single stock" : "very bumpy, so expect big swings";
  $("vol-text").textContent = `Over this period that is ${calm}.`;

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
  const ddData = {
    labels,
    datasets: [{ data: m.ddSeries, borderColor: css("--cinnabar"), borderWidth: 1.5, pointRadius: 0, pointHoverRadius: 3, fill: { target: "origin" }, backgroundColor: css("--cinnabar") + "26", tension: 0 }],
  };

  if (state.chart) {
    state.chart.data = priceData;
    state.chart.update("none");
    state.dd.data = ddData;
    state.dd.update("none");
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
      plugins: { ...base.plugins, tooltip: { displayColors: false, callbacks: { title: (i) => fmtDate(i[0].label), label: (i) => priceText(state.current, i.parsed.y) } } },
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

  try {
    const meta = await getJSON("data/tickers.json");
    state.tickers = meta.tickers;
    if (!state.tickers.length) throw new Error("no tickers");
    $("updated").textContent = `Last updated ${new Date(meta.generated_at).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}.`;
    await select(decodeURIComponent(location.hash.slice(1)) || "^HSI");
    onWatchlist(() => { renderList(); renderStar(); });
  } catch (err) {
    console.error(err);
    $("market-list").innerHTML = "";
    $("main").innerHTML = `<p class="notice">No market data found. Run <code>python -m app.pipeline.ingest</code> and then <code>python -m app.export_site</code> in the backend folder, and reload this page.</p>`;
  }
}

init();

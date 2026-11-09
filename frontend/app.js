// DataVest market explorer: reads static JSON from data/ (built by backend/app/export_site.py).
const RANGES = { "1M": 1, "6M": 6, "1Y": 12, "5Y": 60 }; // months
const state = { tickers: [], current: null, series: [], range: "1Y", chart: null };
const cache = new Map();
const $ = (id) => document.getElementById(id);

const css = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
const pct = (x, digits = 1) => `${x >= 0 ? "+" : "−"}${Math.abs(x * 100).toFixed(digits)}%`;
const money = (x) => x.toLocaleString("en-US", { maximumFractionDigits: 0 });
const fmtDate = (iso) => new Date(iso + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

function priceText(t, v) {
  const n = v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return t.is_index ? `${n} points` : `${n} ${t.currency || ""}`.trim();
}

async function getJSON(url) {
  const res = await fetch(url, { cache: "no-cache" });
  if (!res.ok) throw new Error(`${url}: ${res.status}`);
  return res.json();
}

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
  adj.forEach((v, i) => {
    if (v > peak) { peak = v; peakI = i; }
    const dd = v / peak - 1;
    if (dd < worst) { worst = dd; worstPeakI = peakI; worstTroughI = i; }
  });

  const years = (new Date(rows[rows.length - 1][0]) - new Date(rows[0][0])) / (365.25 * 864e5);
  const cagr = years >= 0.95 ? growth ** (1 / years) - 1 : null;

  return {
    growth, vol, cagr, years,
    dd: worst,
    ddPeak: rows[worstPeakI][0],
    ddTrough: rows[worstTroughI][0],
    start: rows[0][0],
    end: rows[rows.length - 1][0],
  };
}

function rangeWords(range) {
  return { "1M": "a month ago", "6M": "6 months ago", "1Y": "a year ago", "5Y": "5 years ago" }[range];
}

// ---- rendering -----------------------------------------------------------
function renderList() {
  const list = $("market-list");
  list.innerHTML = "";
  let group = null;
  for (const t of state.tickers) {
    if (t.group !== group) {
      group = t.group;
      const h = document.createElement("p");
      h.className = "group-name";
      h.textContent = group;
      list.append(h);
    }
    const day = t.last / t.prev - 1;
    const b = document.createElement("button");
    b.type = "button";
    b.className = "market";
    b.dataset.symbol = t.symbol;
    b.innerHTML = `<span class="nm"></span><span class="sym"></span><span class="chg ${day >= 0 ? "up" : "down"}">${pct(day, 2)}</span>`;
    b.querySelector(".nm").textContent = t.name;
    b.querySelector(".sym").textContent = t.symbol;
    b.title = `${t.name}: ${pct(day, 2)} on the last trading day`;
    b.addEventListener("click", () => select(t.symbol));
    list.append(b);
  }
}

function renderDetail() {
  const t = state.current;
  const rows = sliceRange(state.series, state.range);
  const m = metrics(rows);
  const final = 100 * m.growth;
  const up = m.growth >= 1;

  $("m-name").textContent = `${t.name} (${t.symbol})`;
  $("m-story").innerHTML = `$100 invested ${rangeWords(state.range)} is now worth <span class="amount ${up ? "" : "down"}">$${money(final)}</span>.`;
  const last = state.series[state.series.length - 1];
  const day = t.last / t.prev - 1;
  $("m-price").innerHTML = `Last close <strong>${priceText(t, last[1])}</strong> on ${fmtDate(last[0])}, <span class="${day >= 0 ? "up" : "down"}">${pct(day, 2)}</span> on the day.`;

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
  drawChart(rows, up);
}

function drawChart(rows, up) {
  const color = up ? css("--jade") : css("--cinnabar");
  const data = { labels: rows.map((r) => r[0]), datasets: [{ data: rows.map((r) => r[1]), borderColor: color, borderWidth: 2, pointRadius: 0, pointHoverRadius: 4, tension: 0.15, fill: { target: "origin" }, backgroundColor: color + "1f" }] };
  const t = state.current;
  if (state.chart) {
    state.chart.data = data;
    state.chart.update("none");
    return;
  }
  Chart.defaults.font.family = css("--body");
  Chart.defaults.color = css("--ink-soft");
  state.chart = new Chart($("chart"), {
    type: "line",
    data,
    options: {
      maintainAspectRatio: false,
      animation: false,
      interaction: { mode: "index", intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { title: (items) => fmtDate(items[0].label), label: (item) => priceText(state.current, item.parsed.y) } },
      },
      scales: {
        x: { grid: { display: false }, ticks: { maxTicksLimit: 6, maxRotation: 0, callback(v) { return fmtDate(this.getLabelForValue(v)).replace(/^\d+ /, ""); } } },
        y: { position: "right", grid: { color: css("--rule") }, border: { display: false }, ticks: { maxTicksLimit: 6 } },
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
  document.querySelectorAll(".ranges button").forEach((b) =>
    b.addEventListener("click", () => { state.range = b.dataset.range; renderDetail(); })
  );
  try {
    const meta = await getJSON("data/tickers.json");
    state.tickers = meta.tickers;
    if (!state.tickers.length) throw new Error("no tickers");
    $("updated").textContent = `Last updated ${new Date(meta.generated_at).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}.`;
    renderList();
    await select(decodeURIComponent(location.hash.slice(1)) || "^HSI");
  } catch (err) {
    console.error(err);
    $("market-list").innerHTML = "";
    $("main").innerHTML = `<p class="notice">No market data found. Run <code>python -m app.pipeline.ingest</code> and then <code>python -m app.export_site</code> in the backend folder, and reload this page.</p>`;
  }
}

init();

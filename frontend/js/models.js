// Models page: volatility forecasts and the RSI test. Data from data/models.json (export_models.py).
import { $, css, pct, fmtDate, fmtMonth, getJSON, esc, renderTopBar, chartDefaults, crosshair, endLabels } from "./common.js";

const MODEL_NAMES = { last_month: "Last month", long_run: "Long-run average", ewma: "EWMA", garch: "GARCH", har: "HAR regression" };
const SHORT = { "^GSPC": "S&P 500", "^IXIC": "Nasdaq", "^HSI": "Hang Seng", SPY: "SPY fund", "2800.HK": "Tracker Fund" };
let names = {};
let data;
const nm = (s) => names[s] || s;
const short = (s) => SHORT[s] || nm(s);
const volPct = (v) => (v == null ? "–" : `${(v * 100).toFixed(0)}%`);

// ---- headline + findings -----------------------------------------------------------
function findings() {
  const p = data.pooled;
  const n = p.garch?.markets || 0;
  const smart = ["ewma", "garch", "har"];
  const best = smart.reduce((a, b) => ((p[a]?.qlike_vs_last_month ?? 0) <= (p[b]?.qlike_vs_last_month ?? 0) ? a : b));
  const beats = p[best].beats_last_month;

  const ev = Object.values(data.rsi_events).flatMap((rows) => rows.filter((r) => r.group !== "all days"));
  const tests = ev.filter((r) => r.p_value != null);
  const sig = tests.filter((r) => r.p_value < 0.05).length;
  const strat = Object.values(data.rsi_strategy);
  const rsiWins = strat.filter((s) => (s.strategy.sharpe ?? -9) > (s.buy_and_hold.sharpe ?? -9)).length;

  const forecastWorks = beats > n / 2;
  const rsiWorks = sig > Math.max(1, tests.length * 0.1);
  $("headline").textContent = forecastWorks && !rsiWorks
    ? "Risk is easier to forecast than returns."
    : forecastWorks ? "Risk is forecastable, and RSI shows some signal."
    : "Neither risk nor RSI signals were easy to predict here.";

  $("findings").innerHTML = [
    `<p><b>${MODEL_NAMES[best]}</b> forecast next month's volatility best on average. Its error was <b>${pct(p[best].qlike_vs_last_month, 0)}</b> compared with assuming next month looks like the last, and it did better in <b>${beats} of ${n}</b> markets.</p>`,
    `<p>RSI signals were <b>${rsiWorks ? "sometimes" : "not"} reliable</b>. Only ${sig} of ${tests.length} tests showed a difference from ordinary days that is unlikely to be luck (p &lt; 0.05). Chance alone would give about ${Math.round(tests.length * 0.05)}.</p>`,
    `<p>Trading on RSI had a better return for its risk than holding in ${rsiWins} of ${strat.length} markets. It was invested only part of the time, so it also took less risk.</p>`,
  ].join("");
}

// ---- forecast table + scorecard -------------------------------------------------------
function forecastTable() {
  const rows = data.symbols.filter((s) => data.forecasts[s]);
  $("fc-table").innerHTML = `
    <thead><tr><th scope="col">Market</th><th scope="col">Last month</th><th scope="col">Forecast</th><th scope="col">Outlook</th></tr></thead>
    <tbody>${rows.map((s) => {
      const f = data.forecasts[s];
      const change = f.garch_next_month / f.last_month - 1;
      const dir = Math.abs(change) < 0.05 ? "Similar" : change > 0 ? "Bumpier" : "Calmer";
      return `<tr><td>${esc(short(s))}</td><td class="num">±${volPct(f.last_month)}</td><td class="num"><b>±${volPct(f.garch_next_month)}</b></td><td class="num">${dir}</td></tr>`;
    }).join("")}</tbody>`;
}

function scorecard() {
  const order = ["garch", "ewma", "har", "long_run"];
  const vals = order.map((m) => data.pooled[m]?.qlike_vs_last_month ?? 0);
  const max = Math.max(0.3, ...vals.map(Math.abs));
  $("scorecard").innerHTML = order.map((m, i) => {
    const v = vals[i];
    const w = (Math.abs(v) / max) * 50;
    const p = data.pooled[m];
    return `<div class="sc-row">
      <span class="sc-name">${MODEL_NAMES[m]}</span>
      <span class="sc-track" aria-hidden="true"><i class="${v < 0 ? "better" : "worse"}" style="width:${w}%; ${v < 0 ? `right:50%` : `left:50%`}"></i><b></b></span>
      <span class="sc-val">${pct(v, 0)}</span>
      <span class="sc-note">better in ${p.beats_last_month} of ${p.markets}</span>
    </div>`;
  }).join("") + `<div class="sc-axis" aria-hidden="true"><span>more accurate</span><span>less accurate</span></div>`;
}

// ---- forecast vs realised chart ---------------------------------------------------------
let volChart;
function volChartFor(sym) {
  const c = data.vol_charts[sym];
  if (!c) return;
  const sets = [
    ["target", "What happened", "--ink", 2],
    ["garch", "GARCH forecast", "--s1", 2],
    ["last_month", "Last month", "--s2", 1.5],
  ];
  const datasets = sets.map(([k, label, v, w]) => ({
    label, endLabel: label, data: c.series[k], borderColor: css(v), backgroundColor: css(v),
    borderWidth: w, pointRadius: 0, pointHoverRadius: 4, tension: 0.15,
  }));
  $("vc-legend").innerHTML = sets.map(([, label, v]) => `<span class="key"><i style="background: var(${v})"></i>${label}</span>`).join("");
  $("vc-title").textContent = `Forecast vs what happened: ${nm(sym)}`;
  document.querySelectorAll("#vc-pick button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.sym === sym)));
  if (volChart) {
    volChart.data = { labels: c.dates, datasets };
    volChart.update("none");
    return;
  }
  volChart = new Chart($("volchart"), {
    type: "line",
    data: { labels: c.dates, datasets },
    plugins: [crosshair, endLabels],
    options: {
      maintainAspectRatio: false, animation: false,
      layout: { padding: { right: 112 } },
      interaction: { mode: "index", intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { title: (i) => `Forecast made week of ${fmtDate(i[0].label)}`, label: (i) => ` ${i.dataset.label}: ±${volPct(i.parsed.y)}` } },
      },
      scales: {
        x: { grid: { display: false }, ticks: { maxTicksLimit: 6, maxRotation: 0, callback(v) { return fmtMonth(this.getLabelForValue(v)); } } },
        y: { min: 0, grid: { color: css("--rule") }, border: { display: false }, ticks: { callback: (v) => `${Math.round(v * 100)}%` } },
      },
    },
  });
}

// ---- RSI event table -------------------------------------------------------------------
function eventTable() {
  const rows = data.symbols.filter((s) => data.rsi_events[s]);
  const get = (s, prefix) => data.rsi_events[s].find((r) => r.group.startsWith(prefix)) || {};
  const ret = (r) => (r.avg_return == null ? "–" : pct(r.avg_return));
  const sig = (r) => (r.p_value == null ? "" : r.p_value < 0.05 ? ` <span class="flag" title="p = ${r.p_value.toFixed(3)}">p&lt;0.05</span>` : "");
  const n = (r) => (r.signals ? `<span class="muted"> (${r.signals})</span>` : "");
  $("ev-table").innerHTML = `
    <thead><tr><th scope="col">Market</th><th scope="col">After RSI &lt; 30</th><th scope="col">Ordinary day</th><th scope="col">After RSI &gt; 70</th></tr></thead>
    <tbody>${rows.map((s) => {
      const lo = get(s, "oversold"), all = get(s, "all"), hi = get(s, "overbought");
      return `<tr><td>${esc(nm(s))}</td><td class="num">${ret(lo)}${n(lo)}${sig(lo)}</td><td class="num">${ret(all)}</td><td class="num">${ret(hi)}${n(hi)}${sig(hi)}</td></tr>`;
    }).join("")}</tbody>`;
  $("ev-note").textContent = "Average return over the next 20 trading days. The number in brackets is how many separate signals there were. Few signals means a lot of luck in the average.";
}

// ---- RSI backtest ------------------------------------------------------------------------
let btChart;
function backtestFor(sym) {
  const s = data.rsi_strategy[sym];
  const eq = s.equity;
  const datasets = [
    { label: "RSI rule", data: eq.series.strategy.map((v) => v * 100), borderColor: css("--s1"), borderWidth: 2, pointRadius: 0, pointHoverRadius: 4, tension: 0.15 },
    { label: "Buy and hold", data: eq.series.buy_and_hold.map((v) => v * 100), borderColor: css("--ink"), borderWidth: 2, pointRadius: 0, pointHoverRadius: 4, tension: 0.15 },
  ];
  if (btChart) {
    btChart.data = { labels: eq.dates, datasets };
    btChart.update("none");
  } else {
    btChart = new Chart($("btchart"), {
      type: "line",
      data: { labels: eq.dates, datasets },
      plugins: [crosshair],
      options: {
        maintainAspectRatio: false, animation: false,
        interaction: { mode: "index", intersect: false },
        plugins: { legend: { display: false }, tooltip: { callbacks: { title: (i) => `Week of ${fmtDate(i[0].label)}`, label: (i) => ` ${i.dataset.label}: $${i.parsed.y.toFixed(0)}` } } },
        scales: {
          x: { grid: { display: false }, ticks: { maxTicksLimit: 6, maxRotation: 0, callback(v) { return fmtMonth(this.getLabelForValue(v)); } } },
          y: { grid: { color: css("--rule") }, border: { display: false }, ticks: { callback: (v) => `$${v}` } },
        },
      },
    });
  }
  const r = (o) => [o.cagr == null ? "–" : pct(o.cagr), o.sharpe == null ? "–" : o.sharpe.toFixed(2), pct(o.max_drawdown, 0)];
  const [sg, ss, sd] = r(s.strategy), [hg, hs, hd] = r(s.buy_and_hold);
  $("bt-table").innerHTML = `
    <thead><tr><th scope="col">${esc(nm(sym))}</th><th scope="col">Growth per year</th><th scope="col">Sharpe ratio</th><th scope="col">Worst fall</th><th scope="col">Time invested</th><th scope="col">Trades</th></tr></thead>
    <tbody>
      <tr><td>RSI rule</td><td class="num">${sg}</td><td class="num">${ss}</td><td class="num down">${sd}</td><td class="num">${(s.time_in_market * 100).toFixed(0)}%</td><td class="num">${s.trades}</td></tr>
      <tr><td>Buy and hold</td><td class="num">${hg}</td><td class="num">${hs}</td><td class="num down">${hd}</td><td class="num">100%</td><td class="num">1</td></tr>
    </tbody>`;
}

async function init() {
  renderTopBar("models");
  chartDefaults();
  try {
    const [meta, m] = await Promise.all([getJSON("data/tickers.json"), getJSON("data/models.json")]);
    names = Object.fromEntries(meta.tickers.map((t) => [t.symbol, t.name]));
    data = m;
    data.symbols = meta.tickers.map((t) => t.symbol);
    if (m.generated_at) $("updated").textContent = `Last updated ${new Date(m.generated_at).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}.`;

    findings();
    forecastTable();
    scorecard();

    const vcSyms = Object.keys(data.vol_charts);
    $("vc-pick").innerHTML = vcSyms.map((s) => `<button type="button" data-sym="${esc(s)}" aria-pressed="false">${esc(short(s))}</button>`).join("");
    $("vc-pick").querySelectorAll("button").forEach((b) => b.addEventListener("click", () => volChartFor(b.dataset.sym)));
    volChartFor(vcSyms[0]);

    eventTable();
    const btSyms = data.symbols.filter((s) => data.rsi_strategy[s]);
    $("bt-pick").innerHTML = btSyms.map((s) => `<option value="${esc(s)}">${esc(nm(s))}</option>`).join("");
    $("bt-pick").addEventListener("change", (e) => backtestFor(e.target.value));
    backtestFor(btSyms.includes("^HSI") ? "^HSI" : btSyms[0]);
    $("bt-pick").value = btSyms.includes("^HSI") ? "^HSI" : btSyms[0];
  } catch (err) {
    console.error(err);
    $("main").innerHTML = `<p class="notice">The model results aren't available yet. They are built with the market data: run <code>python -m app.export_site</code> in the backend folder.</p>`;
  }
}

init();

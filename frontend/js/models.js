// Models page: volatility forecasts and the RSI test. Data from data/models.json (export_models.py).
import { $, css, pct, fmtDate, fmtMonth, fmtWhen, getJSON, esc, renderTopBar, chartDefaults, crosshair, endLabels } from "./common.js";
import { tx, marketName, marketShort } from "./i18n.js";

const MODEL_NAMES = {
  last_month: tx("Last month"), long_run: tx("Long-run average"), ewma: "EWMA", garch: "GARCH", har: tx("HAR regression"),
  ridge: tx("Ridge regression (ML)"), gbm: tx("Gradient boosting (ML)"), mlp: tx("Neural network (ML)"),
};
const ML = ["ridge", "gbm", "mlp"];
const SHORT = { "^GSPC": "S&P 500", "^IXIC": "Nasdaq", "^HSI": "Hang Seng", SPY: "SPY fund", "2800.HK": "Tracker Fund" };
let names = {};
let data;
const nm = (s) => marketName(s, names[s] || s);
const short = (s) => marketShort(s, SHORT[s] || nm(s));
const volPct = (v) => (v == null ? "–" : `${(v * 100).toFixed(0)}%`);

// ---- headline + findings -----------------------------------------------------------
function findings() {
  const p = data.pooled;
  const n = p.garch?.markets || 0;
  const smart = ["ewma", "garch", "har", ...ML].filter((m) => p[m]);
  const best = smart.reduce((a, b) => ((p[a]?.qlike_vs_last_month ?? 0) <= (p[b]?.qlike_vs_last_month ?? 0) ? a : b));
  const beats = p[best].beats_last_month;

  const ev = Object.values(data.rsi_events).flatMap((rows) => rows.filter((r) => r.group !== "all days"));
  const tests = ev.filter((r) => r.p_value != null);
  const sig = tests.filter((r) => r.p_value < 0.05).length;
  const strat = Object.values(data.rsi_strategy);
  const rsiWins = strat.filter((s) => (s.strategy.sharpe ?? -9) > (s.buy_and_hold.sharpe ?? -9)).length;

  const forecastWorks = beats > n / 2;
  const rsiWorks = sig > Math.max(1, tests.length * 0.1);
  $("headline").textContent = tx(forecastWorks && !rsiWorks
    ? "Risk is easier to forecast than returns."
    : forecastWorks ? "Risk is forecastable, and RSI shows some signal."
    : "Neither risk nor RSI signals were easy to predict here.");

  $("findings").innerHTML = [
    `<p>${tx("<b>{model}</b> forecast next month's volatility best on average. Its error was <b>{err}</b> compared with assuming next month looks like the last, and it did better in <b>{beats} of {n}</b> markets.", { model: MODEL_NAMES[best], err: pct(p[best].qlike_vs_last_month, 0), beats, n })}</p>`,
    `<p>${tx(rsiWorks ? "RSI signals were <b>sometimes reliable</b>." : "RSI signals were <b>not reliable</b>.")} ${tx(sig === 0 ? "None of the {t} tests showed a difference from ordinary days that is unlikely to be luck (p &lt; 0.05). Chance alone would give about {c}." : "Only {s} of the {t} tests showed a difference from ordinary days that is unlikely to be luck (p &lt; 0.05). Chance alone would give about {c}.", { s: sig, t: tests.length, c: Math.round(tests.length * 0.05) })}</p>`,
    `<p>${tx("Trading on RSI had a better return for its risk than holding in {w} of {n} markets. It was invested only part of the time, so it also took less risk.", { w: rsiWins, n: strat.length })}</p>`,
    mlFinding(p),
  ].join("");
}

function mlFinding(p) {
  const have = ML.filter((m) => p[m]);
  if (!have.length || !p.garch) return "";
  const bestMl = have.reduce((a, b) => (p[a].qlike_vs_last_month <= p[b].qlike_vs_last_month ? a : b));
  const beatsGarch = p[bestMl].qlike_vs_last_month < p.garch.qlike_vs_last_month;
  const flexible = ["gbm", "mlp"].filter((m) => p[m]);
  const flexWorse = flexible.length && flexible.every((m) => p[m].qlike_vs_last_month > p.ridge?.qlike_vs_last_month);
  return `<p>${tx(beatsGarch ? "Machine learning: the best ML model was <b>{m}</b>, which beat GARCH." : "Machine learning: the best ML model was <b>{m}</b>, which did not beat GARCH.", { m: MODEL_NAMES[bestMl] })}${flexWorse ? tx(" The more flexible models (trees and the neural network) did worse than the simple linear one: with only five years of data, extra flexibility mostly fits noise.") : ""}</p>`;
}

// ---- forecast table + scorecard -------------------------------------------------------
function forecastTable() {
  const rows = data.symbols.filter((s) => data.forecasts[s]);
  $("fc-table").innerHTML = `
    <thead><tr><th scope="col">${tx("Market")}</th><th scope="col">${tx("Last month")}</th><th scope="col">${tx("Forecast")}</th><th scope="col">${tx("Outlook")}</th></tr></thead>
    <tbody>${rows.map((s) => {
      const f = data.forecasts[s];
      const change = f.garch_next_month / f.last_month - 1;
      const dir = tx(Math.abs(change) < 0.05 ? "Similar" : change > 0 ? "Bumpier" : "Calmer");
      return `<tr><td>${esc(short(s))}</td><td class="num">±${volPct(f.last_month)}</td><td class="num"><b>±${volPct(f.garch_next_month)}</b></td><td class="num">${dir}</td></tr>`;
    }).join("")}</tbody>`;
}

function scorecard() {
  const order = ["garch", "ewma", "har", ...ML, "long_run"].filter((m) => data.pooled[m]);
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
      <span class="sc-note">${tx("better in {b} of {n}", { b: p.beats_last_month, n: p.markets })}</span>
    </div>`;
  }).join("") + `<div class="sc-axis" aria-hidden="true"><span>${tx("more accurate")}</span><span>${tx("less accurate")}</span></div>`;
}

// ---- forecast vs realised chart ---------------------------------------------------------
let volChart;
function volChartFor(sym) {
  const c = data.vol_charts[sym];
  if (!c) return;
  const sets = [
    ["target", tx("What happened"), "--ink", 2],
    ["garch", "GARCH", "--s1", 2],
    ["ridge", tx("Ridge (ML)"), "--s3", 2],
    ["last_month", tx("Last month"), "--s2", 1.5],
  ].filter(([k]) => c.series[k]);
  const datasets = sets.map(([k, label, v, w]) => ({
    label, endLabel: label, data: c.series[k], borderColor: css(v), backgroundColor: css(v),
    borderWidth: w, pointRadius: 0, pointHoverRadius: 4, tension: 0.15,
  }));
  $("vc-legend").innerHTML = sets.map(([, label, v]) => `<span class="key"><i style="background: var(${v})"></i>${label}</span>`).join("");
  $("vc-title").textContent = tx("Forecast vs what happened: {name}", { name: nm(sym) });
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
        tooltip: { callbacks: { title: (i) => tx("Forecast made week of {date}", { date: fmtDate(i[0].label) }), label: (i) => ` ${i.dataset.label}: ±${volPct(i.parsed.y)}` } },
      },
      scales: {
        x: { grid: { display: false }, ticks: { maxTicksLimit: 6, maxRotation: 0, callback(v) { return fmtMonth(this.getLabelForValue(v)); } } },
        y: { min: 0, grid: { color: css("--rule") }, border: { display: false }, ticks: { callback: (v) => `${Math.round(v * 100)}%` } },
      },
    },
  });
}

// ---- feature importance --------------------------------------------------------------------
function importanceChart() {
  const imp = (data.feature_importance || []).filter((f) => f.importance != null);
  if (!imp.length) { $("importance-block").hidden = true; return; }
  const max = Math.max(...imp.map((f) => f.importance), 1e-9);
  $("importance").innerHTML = imp.map((f) => `
    <div class="imp-row">
      <span class="imp-name">${esc(tx(f.label))}</span>
      <span class="imp-track" aria-hidden="true"><i style="width:${Math.max(0, (f.importance / max) * 100).toFixed(1)}%"></i></span>
      <span class="imp-val">${f.importance.toFixed(3)}</span>
    </div>`).join("");
}

// ---- RSI event table -------------------------------------------------------------------
function eventTable() {
  const rows = data.symbols.filter((s) => data.rsi_events[s]);
  const get = (s, prefix) => data.rsi_events[s].find((r) => r.group.startsWith(prefix)) || {};
  const ret = (r) => (r.avg_return == null ? "–" : pct(r.avg_return));
  const sig = (r) => (r.p_value == null ? "" : r.p_value < 0.05 ? ` <span class="flag" title="p = ${r.p_value.toFixed(3)}">p&lt;0.05</span>` : "");
  const n = (r) => (r.signals ? `<span class="muted"> (${r.signals})</span>` : "");
  $("ev-table").innerHTML = `
    <thead><tr><th scope="col">${tx("Market")}</th><th scope="col">${tx("After RSI &lt; 30")}</th><th scope="col">${tx("Ordinary day")}</th><th scope="col">${tx("After RSI &gt; 70")}</th></tr></thead>
    <tbody>${rows.map((s) => {
      const lo = get(s, "oversold"), all = get(s, "all"), hi = get(s, "overbought");
      return `<tr><td>${esc(nm(s))}</td><td class="num">${ret(lo)}${n(lo)}${sig(lo)}</td><td class="num">${ret(all)}</td><td class="num">${ret(hi)}${n(hi)}${sig(hi)}</td></tr>`;
    }).join("")}</tbody>`;
  $("ev-note").textContent = tx("Average return over the next 20 trading days. The number in brackets is how many separate signals there were. Few signals means a lot of luck in the average.");
}

// ---- RSI backtest ------------------------------------------------------------------------
let btChart;
function backtestFor(sym) {
  const s = data.rsi_strategy[sym];
  const eq = s.equity;
  const datasets = [
    { label: tx("RSI rule"), data: eq.series.strategy.map((v) => v * 100), borderColor: css("--s1"), borderWidth: 2, pointRadius: 0, pointHoverRadius: 4, tension: 0.15 },
    { label: tx("Buy and hold"), data: eq.series.buy_and_hold.map((v) => v * 100), borderColor: css("--ink"), borderWidth: 2, pointRadius: 0, pointHoverRadius: 4, tension: 0.15 },
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
        plugins: { legend: { display: false }, tooltip: { callbacks: { title: (i) => tx("Week of {date}", { date: fmtDate(i[0].label) }), label: (i) => ` ${i.dataset.label}: $${i.parsed.y.toFixed(0)}` } } },
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
    <thead><tr><th scope="col">${esc(nm(sym))}</th><th scope="col">${tx("Growth per year")}</th><th scope="col">${tx("Sharpe ratio")}</th><th scope="col">${tx("Worst fall")}</th><th scope="col">${tx("Time invested")}</th><th scope="col">${tx("Trades")}</th></tr></thead>
    <tbody>
      <tr><td>${tx("RSI rule")}</td><td class="num">${sg}</td><td class="num">${ss}</td><td class="num down">${sd}</td><td class="num">${(s.time_in_market * 100).toFixed(0)}%</td><td class="num">${s.trades}</td></tr>
      <tr><td>${tx("Buy and hold")}</td><td class="num">${hg}</td><td class="num">${hs}</td><td class="num down">${hd}</td><td class="num">100%</td><td class="num">1</td></tr>
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
    if (m.generated_at) $("updated").textContent = tx("Last updated {when}.", { when: fmtWhen(m.generated_at) });

    findings();
    forecastTable();
    scorecard();

    const vcSyms = Object.keys(data.vol_charts);
    $("vc-pick").innerHTML = vcSyms.map((s) => `<button type="button" data-sym="${esc(s)}" aria-pressed="false">${esc(short(s))}</button>`).join("");
    $("vc-pick").querySelectorAll("button").forEach((b) => b.addEventListener("click", () => volChartFor(b.dataset.sym)));
    volChartFor(vcSyms[0]);

    importanceChart();
    eventTable();
    const btSyms = data.symbols.filter((s) => data.rsi_strategy[s]);
    $("bt-pick").innerHTML = btSyms.map((s) => `<option value="${esc(s)}">${esc(nm(s))}</option>`).join("");
    $("bt-pick").addEventListener("change", (e) => backtestFor(e.target.value));
    backtestFor(btSyms.includes("^HSI") ? "^HSI" : btSyms[0]);
    $("bt-pick").value = btSyms.includes("^HSI") ? "^HSI" : btSyms[0];
  } catch (err) {
    console.error(err);
    $("main").innerHTML = `<p class="notice">${tx("The model results aren't available yet. They are built with the market data.")}</p>`;
  }
}

init();

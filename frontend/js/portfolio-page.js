// Portfolio simulator page. Maths in portfolio.js (tested).
import { $, css, esc, fmtDate, fmtMonth, getJSON, renderTopBar, chartDefaults, crosshair } from "./common.js";
import * as P from "./portfolio.js";

const KEY = "datavest.portfolio";
const SHORT = { "^GSPC": "S&P 500", "^IXIC": "Nasdaq", "^HSI": "Hang Seng", SPY: "SPY fund", "2800.HK": "Tracker Fund" };
const pct = (x, d = 1) => (x == null || !Number.isFinite(x) ? "–" : `${x >= 0 ? "+" : "−"}${Math.abs(x * 100).toFixed(d)}%`);
const vol = (x) => `${Math.round(x * 100)}%`;

let D; // { names, labels, dates, prices, mu, cov }
let w = [];
let gChart, fChart;
let frontierCache = null;

const short = (sym) => SHORT[sym] || D.labels[D.names.indexOf(sym)] || sym;

function presets() {
  const idx = (s) => D.names.indexOf(s);
  const make = (pairs) => { const v = D.names.map(() => 0); pairs.forEach(([s, x]) => { if (idx(s) >= 0) v[idx(s)] = x; }); return P.normalise(v); };
  return [
    ["Equal mix", D.names.map(() => 1 / D.names.length)],
    ["All Hang Seng", make([["2800.HK", 1]])],
    ["US + HK funds 50/50", make([["SPY", 0.5], ["2800.HK", 0.5]])],
    ["Big tech", make([["AAPL", 1], ["MSFT", 1], ["NVDA", 1], ["0700.HK", 1]])],
  ];
}

// ---- builder ---------------------------------------------------------------------
function renderWeights() {
  $("weights").innerHTML = D.names.map((s, i) => `
    <div class="w-row">
      <label for="w${i}">${esc(D.labels[i])}</label>
      <input type="range" id="w${i}" min="0" max="100" step="1" value="${Math.round(w[i] * 100)}" data-i="${i}">
      <span class="w-val" id="wv${i}">${Math.round(w[i] * 100)}%</span>
    </div>`).join("");
  $("weights").querySelectorAll("input").forEach((el) => el.addEventListener("input", () => {
    const raw = D.names.map((_, i) => Number($(`w${i}`).value));
    w = P.normalise(raw);
    update(false);
  }));
}

function syncSliders() {
  D.names.forEach((_, i) => { $(`w${i}`).value = Math.round(w[i] * 100); });
}

function save() {
  try { localStorage.setItem(KEY, JSON.stringify(Object.fromEntries(D.names.map((s, i) => [s, w[i]])))); } catch { /* storage blocked */ }
}

function update(moveSliders = true) {
  if (moveSliders) syncSliders();
  D.names.forEach((_, i) => { $(`wv${i}`).textContent = `${Math.round(w[i] * 100)}%`; });
  $("w-total").textContent = "Weights are scaled to add up to 100%.";
  save();
  renderGrowth();
  renderRisk();
  renderFrontier();
}

// ---- growth vs benchmark -----------------------------------------------------------------
function renderGrowth() {
  const reb = $("rebalance").value;
  const curve = P.backtest(D.prices, D.dates, w, reb);
  const bi = Number($("bench").value);
  const bw = D.names.map((_, i) => (i === bi ? 1 : 0));
  const bench = P.backtest(D.prices, D.dates, bw, "none");
  const m = P.curveMetrics(curve), bm = P.curveMetrics(bench);
  const dr = P.diversificationRatio(w, D.cov);
  const card = (label, val, sub) => `<div class="pf-stat"><span>${label}</span><b>${val}</b><small>${sub}</small></div>`;
  $("pf-stats").innerHTML = [
    card("Growth per year", pct(m.cagr), `${short(D.names[bi])}: ${pct(bm.cagr)}`),
    card("Volatility", vol(m.vol), `${short(D.names[bi])}: ${vol(bm.vol)}`),
    card("Worst fall", pct(m.maxDrawdown, 0), `${short(D.names[bi])}: ${pct(bm.maxDrawdown, 0)}`),
    card("Diversification", `${dr.toFixed(2)}×`, dr < 1.1 ? "little benefit from mixing" : "risk lowered by mixing"),
  ].join("");
  $("g-legend").innerHTML = `<span class="key"><i style="background: var(--s1)"></i>Your mix</span><span class="key"><i style="background: var(--ink-soft)"></i>${esc(D.labels[bi])}</span>`;
  const data = {
    labels: D.dates,
    datasets: [
      { label: "Your mix", data: curve.map((x) => x * 100), borderColor: css("--s1"), borderWidth: 2, pointRadius: 0, pointHoverRadius: 4, tension: 0.1 },
      { label: D.labels[bi], data: bench.map((x) => x * 100), borderColor: css("--ink-soft"), borderWidth: 1.5, borderDash: [5, 4], pointRadius: 0, pointHoverRadius: 4, tension: 0.1 },
    ],
  };
  if (gChart) { gChart.data = data; gChart.update("none"); return; }
  gChart = new Chart($("g-chart"), {
    type: "line", data, plugins: [crosshair],
    options: {
      maintainAspectRatio: false, animation: false, interaction: { mode: "index", intersect: false },
      plugins: { legend: { display: false }, tooltip: { callbacks: { title: (i) => `Week of ${fmtDate(i[0].label)}`, label: (i) => ` ${i.dataset.label}: ${i.parsed.y.toFixed(1)}` } } },
      scales: {
        x: { grid: { display: false }, ticks: { maxTicksLimit: 6, maxRotation: 0, callback(v) { return fmtMonth(this.getLabelForValue(v)); } } },
        y: { position: "right", grid: { color: css("--rule") }, border: { display: false }, ticks: { maxTicksLimit: 5 } },
      },
    },
  });
}

// ---- risk contributions ----------------------------------------------------------------------
function renderRisk() {
  const rc = P.riskContributions(w, D.cov);
  const rows = D.names.map((s, i) => ({ s, i, w: w[i], rc: rc[i] })).filter((r) => r.w > 0.0005).sort((a, b) => b.rc - a.rc);
  const max = Math.max(...rows.map((r) => Math.max(r.w, r.rc)), 0.01);
  $("riskbars").innerHTML = `<div class="rb-head"><span></span><span>Share of money</span><span>Share of risk</span></div>` + rows.map((r) => `
    <div class="rb-row">
      <span class="rb-name">${esc(D.labels[r.i])}</span>
      <span class="rb-cell"><i class="money" style="width:${(r.w / max) * 100}%"></i><b>${Math.round(r.w * 100)}%</b></span>
      <span class="rb-cell"><i class="risk" style="width:${(Math.max(r.rc, 0) / max) * 100}%"></i><b>${Math.round(r.rc * 100)}%</b></span>
    </div>`).join("");
}

// ---- efficient frontier ------------------------------------------------------------------------------
function frontierData() {
  const cap = $("cap").checked ? 0.3 : 1;
  if (frontierCache?.cap === cap) return frontierCache;
  const rand = P.rng(42);
  const cloud = [];
  for (let n = 0; n < 2500; n++) {
    const rw = P.randomWeights(D.names.length, rand);
    if (Math.max(...rw) > cap + 1e-9) continue;
    const s = P.stats(rw, D.mu, D.cov);
    cloud.push({ x: s.vol, y: s.ret });
  }
  const minvar = P.optimise(D.mu, D.cov, "minvar", cap);
  const maxsharpe = P.optimise(D.mu, D.cov, "maxsharpe", cap);
  frontierCache = { cap, cloud, minvar, maxsharpe };
  return frontierCache;
}

function renderFrontier() {
  const f = frontierData();
  const pt = (wt) => { const s = P.stats(wt, D.mu, D.cov); return { x: s.vol, y: s.ret }; };
  const singles = D.names.map((s, i) => { const e = D.names.map((_, j) => (j === i ? 1 : 0)); return { ...pt(e), label: short(s) }; });
  const datasets = [
    { label: "Random mixes", data: f.cloud, backgroundColor: css("--rule"), pointRadius: 2, pointHoverRadius: 2 },
    { label: "Single markets", data: singles, backgroundColor: css("--ink-soft"), pointRadius: 5, pointHoverRadius: 7 },
    { label: "Lowest risk", data: [pt(f.minvar)], backgroundColor: css("--s3"), borderColor: css("--paper"), borderWidth: 2, pointRadius: 8, pointHoverRadius: 10 },
    { label: "Best return for its risk", data: [pt(f.maxsharpe)], backgroundColor: css("--s2"), borderColor: css("--paper"), borderWidth: 2, pointRadius: 8, pointHoverRadius: 10 },
    { label: "Your mix", data: [pt(w)], backgroundColor: css("--s1"), borderColor: css("--paper"), borderWidth: 2, pointRadius: 9, pointHoverRadius: 11, pointStyle: "rectRot" },
  ];
  if (fChart) { fChart.data.datasets = datasets; fChart.update("none"); }
  else {
    const labelSingles = {
      id: "labelSingles",
      afterDatasetsDraw(ch) {
        const { ctx } = ch;
        ctx.save();
        ctx.font = `500 11px ${css("--body")}`;
        ctx.fillStyle = css("--ink");
        ctx.textBaseline = "middle";
        ch.getDatasetMeta(1).data.forEach((el, i) => ctx.fillText(ch.data.datasets[1].data[i].label, el.x + 8, el.y));
        ctx.restore();
      },
    };
    fChart = new Chart($("f-chart"), {
      type: "scatter", data: { datasets }, plugins: [labelSingles],
      options: {
        maintainAspectRatio: false, animation: false,
        plugins: { legend: { display: false }, tooltip: { filter: (i) => i.datasetIndex > 0, callbacks: { label: (i) => `${i.raw.label || i.dataset.label}: ${pct(i.raw.y)} a year, volatility ${vol(i.raw.x)}` } } },
        scales: {
          x: { title: { display: true, text: "Volatility (risk)" }, grid: { color: css("--rule") }, border: { display: false }, ticks: { callback: (v) => `${Math.round(v * 100)}%` } },
          y: { title: { display: true, text: "Average return per year" }, grid: { color: (c) => (c.tick.value === 0 ? css("--ink-soft") : css("--rule")) }, border: { display: false }, ticks: { callback: (v) => `${Math.round(v * 100)}%` } },
        },
      },
    });
  }
}

// ---- out-of-sample test --------------------------------------------------------------------------------
function renderOutOfSample() {
  const split = Math.floor(D.prices.length * 0.6);
  const train = P.returnsFrom(D.prices.slice(0, split + 1));
  const mu = P.meanVector(train), cov = P.covMatrix(train);
  const testPrices = D.prices.slice(split), testDates = D.dates.slice(split);
  const mixes = [
    ["Best return-for-risk mix (fitted on the first period)", P.optimise(mu, cov, "maxsharpe")],
    ["Lowest-risk mix (fitted on the first period)", P.optimise(mu, cov, "minvar")],
    ["Equal mix (no fitting at all)", D.names.map(() => 1 / D.names.length)],
  ];
  const trainCurve = (wt) => P.curveMetrics(P.backtest(D.prices.slice(0, split + 1), D.dates.slice(0, split + 1), wt, "yearly"));
  const testCurve = (wt) => P.curveMetrics(P.backtest(testPrices, testDates, wt, "yearly"));
  const rows = mixes.map(([name, wt]) => ({ name, wt, tr: trainCurve(wt), te: testCurve(wt) }));
  const top = (wt) => Math.max(...wt) - Math.min(...wt) < 1e-9 ? `All ${wt.length} markets, ${Math.round(100 / wt.length)}% each` : wt.map((x, i) => [x, i]).filter(([x]) => x > 0.05).sort((a, b) => b[0] - a[0]).slice(0, 3).map(([x, i]) => `${short(D.names[i])} ${Math.round(x * 100)}%`).join(", ");
  $("o-note").textContent = `The mixes below were fitted using only ${fmtDate(D.dates[0])} to ${fmtDate(D.dates[split])}, then tested on ${fmtDate(D.dates[split])} to ${fmtDate(D.dates.at(-1))}, a period they never saw.`;
  $("o-table").innerHTML = `
    <thead><tr><th>Mix</th><th>Main holdings</th><th>Growth/yr, fitting period</th><th>Growth/yr, test period</th><th>Volatility, test period</th><th>Worst fall, test period</th></tr></thead>
    <tbody>${rows.map((r) => `<tr><td>${esc(r.name)}</td><td>${esc(top(r.wt))}</td><td class="num">${pct(r.tr.cagr)}</td><td class="num"><b>${pct(r.te.cagr)}</b></td><td class="num">${vol(r.te.vol)}</td><td class="num down">${pct(r.te.maxDrawdown, 0)}</td></tr>`).join("")}</tbody>`;
  const [ms, , eq] = rows;
  const drop = ms.tr.cagr - ms.te.cagr;
  $("o-note").textContent += ` The best return-for-risk mix earned ${pct(ms.tr.cagr)} a year while it was being fitted but ${pct(ms.te.cagr)} afterwards${drop > 0.02 ? ", a big drop: typical overfitting" : ""}. ${ms.te.cagr > eq.te.cagr ? "It still beat the equal mix in the test period." : "The plain equal mix did better in the test period."}`;
}

async function init() {
  renderTopBar("portfolio");
  chartDefaults();
  try {
    const meta = await getJSON("data/tickers.json");
    const tickers = meta.tickers;
    const files = await Promise.all(tickers.map((t) => getJSON(`data/prices/${t.file}`)));
    const series = Object.fromEntries(tickers.map((t, i) => [t.symbol, files[i].map((r) => [r[0], r[2]])]));
    const wk = P.weeklyPrices(series);
    const rets = P.returnsFrom(wk.prices);
    D = { names: wk.names, labels: wk.names.map((s) => tickers.find((t) => t.symbol === s).name), dates: wk.dates, prices: wk.prices, mu: P.meanVector(rets), cov: P.covMatrix(rets) };

    let saved = null;
    try { saved = JSON.parse(localStorage.getItem(KEY)); } catch { saved = null; }
    w = saved ? P.normalise(D.names.map((s) => saved[s] || 0)) : presets()[2][1];

    $("presets").innerHTML = presets().map(([name], i) => `<button type="button" data-p="${i}" aria-pressed="false">${esc(name)}</button>`).join("");
    $("presets").querySelectorAll("button").forEach((b) => b.addEventListener("click", () => { w = presets()[Number(b.dataset.p)][1]; update(); }));
    $("bench").innerHTML = D.names.map((s, i) => `<option value="${i}"${s === "^HSI" ? " selected" : ""}>${esc(D.labels[i])}</option>`).join("");
    ["rebalance", "bench"].forEach((id) => $(id).addEventListener("change", renderGrowth));
    $("cap").addEventListener("change", renderFrontier);
    $("use-minvar").addEventListener("click", () => { w = frontierData().minvar; update(); });
    $("use-maxsharpe").addEventListener("click", () => { w = frontierData().maxsharpe; update(); });

    renderWeights();
    update();
    renderOutOfSample();
  } catch (err) {
    console.error(err);
    $("main").innerHTML = `<p class="notice">Price data isn't available yet. It is built with the rest of the site's data.</p>`;
  }
}

init();

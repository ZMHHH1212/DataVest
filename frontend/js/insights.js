// Insights page: US vs Hong Kong over 5 years. Data from data/insights.json (export_site.py).
import { $, css, pct, fmtDate, fmtMonth, getJSON, esc, renderTopBar, chartDefaults, crosshair, endLabels } from "./common.js";

// Fixed series slots: colour follows the market, never its position in the list.
const GROWTH = [
  ["^GSPC", "--s1"],
  ["^IXIC", "--s3"],
  ["^HSI", "--s2"],
  ["SPY", "--s4"],
  ["2800.HK", "--s5"],
];
const DEFAULT_ON = new Set(["^GSPC", "^HSI", "^IXIC"]);
const isHK = (s) => s.endsWith(".HK") || s === "^HSI";

let names = {};
let data = null;
const nm = (s) => names[s] || s;

function findings() {
  const st = data.stats;
  const out = [];
  const us = st["^GSPC"], hk = st["^HSI"];
  if (us && hk) {
    out.push(`<p>Over five years the <b>S&amp;P 500</b> grew <b>${pct(us.cagr)} a year</b>, while the <b>Hang Seng</b> managed <b>${pct(hk.cagr)} a year</b> (index levels, before dividends).</p>`);
    const [bumpier, calmer, bv, cv] = hk.volatility >= us.volatility
      ? ["Hong Kong", "the S&amp;P 500", hk.volatility, us.volatility]
      : ["The US", "the Hang Seng", us.volatility, hk.volatility];
    out.push(`<p>${bumpier} was the bumpier ride: volatility of ${(bv * 100).toFixed(0)}% against ${(cv * 100).toFixed(0)}% for ${calmer}. The worst falls were ${pct(hk.max_drawdown, 0)} for the Hang Seng and ${pct(us.max_drawdown, 0)} for the S&amp;P 500.</p>`);
    const gap = us.cagr - hk.cagr;
    $("headline").textContent = Math.abs(gap) < 0.02
      ? "US and Hong Kong markets grew at a similar pace."
      : `${gap > 0 ? "The US" : "Hong Kong"} pulled ahead by ${(Math.abs(gap) * 100).toFixed(0)} percentage points a year.`;
  }
  const i = data.symbols.indexOf("^HSI"), j = data.symbols.indexOf("^GSPC");
  if (i >= 0 && j >= 0) {
    const w = data.corr_weekly[i][j], d = data.corr_daily[i][j];
    if (w != null && d != null) {
      out.push(`<p>The two markets move together more than same-day numbers suggest: correlation is <b>${d.toFixed(2)}</b> on same-day returns but <b>${w.toFixed(2)}</b> on weekly returns, because Hong Kong closes before New York opens.</p>`);
    }
  }
  const ranked = Object.entries(st).filter(([, v]) => v.sharpe != null).sort((a, b) => b[1].sharpe - a[1].sharpe);
  if (ranked.length) out.push(`<p>Best growth for the risk taken: <b>${esc(nm(ranked[0][0]))}</b>. Weakest: <b>${esc(nm(ranked[ranked.length - 1][0]))}</b>.</p>`);
  $("findings").innerHTML = out.join("");
}

// ---- growth of $100 --------------------------------------------------------
let growthChart;
function growth() {
  const g = data.growth;
  const series = GROWTH.filter(([s]) => g.series[s]);
  growthChart = new Chart($("growth"), {
    type: "line",
    data: {
      labels: g.dates,
      datasets: series.map(([s, v]) => ({
        label: nm(s), endLabel: nm(s), data: g.series[s], borderColor: css(v), backgroundColor: css(v),
        borderWidth: 2, pointRadius: 0, pointHoverRadius: 4, tension: 0.15, hidden: !DEFAULT_ON.has(s), spanGaps: true,
      })),
    },
    plugins: [crosshair, endLabels],
    options: {
      maintainAspectRatio: false, animation: false,
      layout: { padding: { right: 140 } },
      interaction: { mode: "index", intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: { itemSort: (a, b) => b.parsed.y - a.parsed.y, callbacks: { title: (i) => `Week ending ${fmtDate(i[0].label)}`, label: (i) => ` ${i.dataset.label}: $${i.parsed.y.toFixed(0)}` } },
      },
      scales: {
        x: { grid: { display: false }, ticks: { maxTicksLimit: 6, maxRotation: 0, callback(v) { return fmtMonth(this.getLabelForValue(v)); } } },
        y: { grid: { color: css("--rule") }, border: { display: false }, ticks: { callback: (v) => `$${v}` } },
      },
    },
  });

  // Legend doubles as the filter. Toggling never repaints the other lines.
  $("growth-legend").innerHTML = series
    .map(([s, v], k) => `<button type="button" class="key" data-k="${k}" aria-pressed="${DEFAULT_ON.has(s)}"><i style="background: var(${v})"></i>${esc(nm(s))}</button>`)
    .join("");
  $("growth-legend").querySelectorAll("button").forEach((b) =>
    b.addEventListener("click", () => {
      const k = Number(b.dataset.k);
      const on = b.getAttribute("aria-pressed") !== "true";
      if (!on && $("growth-legend").querySelectorAll('[aria-pressed="true"]').length === 1) return; // keep one
      b.setAttribute("aria-pressed", String(on));
      growthChart.setDatasetVisibility(k, on);
      growthChart.update("none");
    })
  );
}

// ---- risk vs return --------------------------------------------------------
const dotLabels = {
  id: "dotLabels",
  afterDatasetsDraw(chart) {
    const { ctx } = chart;
    ctx.save();
    ctx.font = `500 11px ${css("--body")}`;
    ctx.fillStyle = css("--ink");
    ctx.textBaseline = "middle";
    chart.data.datasets.forEach((ds, i) =>
      chart.getDatasetMeta(i).data.forEach((pt, j) => {
        const label = ds.data[j].name;
        const w = ctx.measureText(label).width;
        const left = pt.x + 8 + w > chart.chartArea.right;
        ctx.fillText(label, left ? pt.x - 8 - w : pt.x + 8, pt.y);
      })
    );
    ctx.restore();
  },
};

function scatter() {
  const pts = Object.entries(data.stats).map(([s, v]) => ({ x: v.volatility, y: v.cagr, name: nm(s), s }));
  const ds = (hk, slot, label) => ({
    label, data: pts.filter((p) => isHK(p.s) === hk),
    backgroundColor: css(slot), borderColor: css("--paper"), borderWidth: 2, pointRadius: 6, pointHoverRadius: 8,
  });
  new Chart($("scatter"), {
    type: "scatter",
    data: { datasets: [ds(false, "--s1", "United States"), ds(true, "--s2", "Hong Kong")] },
    plugins: [dotLabels],
    options: {
      maintainAspectRatio: false, animation: false,
      layout: { padding: { right: 8, top: 8 } },
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { title: (i) => i[0].raw.name, label: (i) => [`Growth ${pct(i.raw.y)} a year`, `Volatility ${(i.raw.x * 100).toFixed(0)}%`] } },
      },
      scales: {
        x: { title: { display: true, text: "Volatility (how bumpy)" }, grid: { color: css("--rule") }, border: { display: false }, ticks: { callback: (v) => `${Math.round(v * 100)}%` } },
        y: { title: { display: true, text: "Growth per year" }, grid: { color: (c) => (c.tick.value === 0 ? css("--ink-soft") : css("--rule")) }, border: { display: false }, ticks: { callback: (v) => `${Math.round(v * 100)}%` } },
      },
    },
  });
}

// ---- correlation heatmap -----------------------------------------------------
function heatmap(kind) {
  const m = kind === "weekly" ? data.corr_weekly : data.corr_daily;
  const syms = data.symbols;
  const SHORT = { "^GSPC": "S&P 500", "^IXIC": "Nasdaq", "^HSI": "Hang Seng", SPY: "SPY fund", "2800.HK": "Tracker Fund" };
  const short = (s) => SHORT[s] || nm(s);
  const cell = (v, i, j) => {
    if (i === j) return `<td class="self" title="${esc(nm(syms[i]))}"></td>`;
    if (v == null) return `<td class="na">–</td>`;
    const strength = Math.min(Math.abs(v), 1);
    const hue = v >= 0 ? "var(--div-pos)" : "var(--div-neg)";
    const dark = strength > 0.6 ? " strong" : "";
    const title = `${nm(syms[i])} and ${nm(syms[j])}: ${v.toFixed(2)}`;
    return `<td class="c${dark}" style="--mix:${(strength * 100).toFixed(0)}%; --hue:${hue}" title="${esc(title)}">${v.toFixed(2)}</td>`;
  };
  $("heatmap").innerHTML = `
    <thead><tr><th></th>${syms.map((s) => `<th scope="col"><span>${esc(short(s))}</span></th>`).join("")}</tr></thead>
    <tbody>${m.map((row, i) => `<tr><th scope="row">${esc(short(syms[i]))}</th>${row.map((v, j) => cell(v, i, j)).join("")}</tr>`).join("")}</tbody>`;
  $("corr-note").textContent = kind === "weekly"
    ? "Weekly returns line up both markets' trading sessions. Darker blue means they tend to rise and fall together."
    : "Same-day returns understate the link between US and Hong Kong, because Hong Kong trades while New York sleeps. Compare the US–HK cells with the weekly view.";
  document.querySelectorAll("[data-corr]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.corr === kind)));
}

// ---- rolling correlation -----------------------------------------------------
function rollingCorr() {
  const rc = data.rolling_corr;
  if (!rc) { $("rollcorr").closest("section").hidden = true; return; }
  new Chart($("rollcorr"), {
    type: "line",
    data: { labels: rc.dates, datasets: [{ data: rc.values, borderColor: css("--ink"), borderWidth: 2, pointRadius: 0, pointHoverRadius: 4, tension: 0.2 }] },
    plugins: [crosshair],
    options: {
      maintainAspectRatio: false, animation: false,
      interaction: { mode: "index", intersect: false },
      plugins: { legend: { display: false }, tooltip: { displayColors: false, callbacks: { title: (i) => `Year to ${fmtDate(i[0].label)}`, label: (i) => `Correlation ${i.parsed.y.toFixed(2)}` } } },
      scales: {
        x: { grid: { display: false }, ticks: { maxTicksLimit: 6, maxRotation: 0, callback(v) { return fmtMonth(this.getLabelForValue(v)); } } },
        y: { min: -0.25, max: 1, grid: { color: (c) => (c.tick.value === 0 ? css("--ink-soft") : css("--rule")) }, border: { display: false }, ticks: { stepSize: 0.25 } },
      },
    },
  });
}

// ---- table -------------------------------------------------------------------
const COLS = [
  ["name", "Market", (v) => esc(v)],
  ["cagr", "Growth per year", (v) => pct(v)],
  ["volatility", "Volatility", (v) => `${(v * 100).toFixed(0)}%`],
  ["sharpe", "Sharpe ratio", (v) => (Math.abs(v) < 0.005 ? "0.00" : v.toFixed(2).replace("-", "−"))],
  ["max_drawdown", "Worst fall", (v) => pct(v, 0)],
  ["dd_recovered", "Back to old high", (v) => (v ? fmtDate(v) : "Not yet")],
];
let sort = { key: "sharpe", dir: -1 };
function table() {
  const rows = Object.entries(data.stats).map(([s, v]) => ({ ...v, name: nm(s) }));
  rows.sort((a, b) => {
    const x = a[sort.key], y = b[sort.key];
    if (x == null) return 1;
    if (y == null) return -1;
    return (x > y ? 1 : x < y ? -1 : 0) * sort.dir;
  });
  $("stats").innerHTML = `
    <thead><tr>${COLS.map(([k, label]) => `<th scope="col" aria-sort="${sort.key === k ? (sort.dir > 0 ? "ascending" : "descending") : "none"}"><button type="button" data-k="${k}">${label}</button></th>`).join("")}</tr></thead>
    <tbody>${rows.map((r) => `<tr>${COLS.map(([k, , f], c) => `<td class="${c ? "num" : ""}${k === "max_drawdown" ? " down" : ""}">${r[k] == null && k !== "dd_recovered" ? "–" : f(r[k])}</td>`).join("")}</tr>`).join("")}</tbody>`;
  $("stats").querySelectorAll("th button").forEach((b) =>
    b.addEventListener("click", () => {
      sort = { key: b.dataset.k, dir: sort.key === b.dataset.k ? -sort.dir : b.dataset.k === "name" ? 1 : -1 };
      table();
    })
  );
}

async function init() {
  renderTopBar("insights");
  chartDefaults();
  try {
    const [meta, ins] = await Promise.all([getJSON("data/tickers.json"), getJSON("data/insights.json")]);
    names = Object.fromEntries(meta.tickers.map((t) => [t.symbol, t.name]));
    data = ins;
    $("updated").textContent = `Last updated ${new Date(ins.generated_at).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}.`;
    findings();
    growth();
    scatter();
    heatmap("weekly");
    document.querySelectorAll("[data-corr]").forEach((b) => b.addEventListener("click", () => heatmap(b.dataset.corr)));
    rollingCorr();
    table();
  } catch (err) {
    console.error(err);
    $("main").innerHTML = `<p class="notice">The insights data isn't available yet. It is built together with the market data: run <code>python -m app.export_site</code> in the backend folder.</p>`;
  }
}

init();

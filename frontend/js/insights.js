// Insights page: US vs Hong Kong over 5 years. Data from data/insights.json (export_site.py).
import { $, css, pct, fmtDate, fmtMonth, getJSON, esc, renderTopBar, chartDefaults, crosshair, endLabels } from "./common.js";
import { mountSurface } from "./surface3d.js";
import { drawdownSeries, deepest, mountStickers } from "./report.js";

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
    out.push(`<p><span class="mono">► Growth</span>Over five years the <b>S&amp;P 500</b> grew <b>${pct(us.cagr)} a year</b>, while the <b>Hang Seng</b> managed <b>${pct(hk.cagr)} a year</b> (index levels, before dividends).</p>`);
    const [bumpier, calmer, bv, cv] = hk.volatility >= us.volatility
      ? ["Hong Kong", "the S&amp;P 500", hk.volatility, us.volatility]
      : ["The US", "the Hang Seng", us.volatility, hk.volatility];
    out.push(`<p><span class="mono">► Risk</span>${bumpier} was the bumpier ride: volatility of ${(bv * 100).toFixed(0)}% against ${(cv * 100).toFixed(0)}% for ${calmer}. The worst falls were ${pct(hk.max_drawdown, 0)} for the Hang Seng and ${pct(us.max_drawdown, 0)} for the S&amp;P 500.</p>`);
    const gap = us.cagr - hk.cagr;
    $("headline").innerHTML = Math.abs(gap) < 0.02
      ? `<span class="dim">US and Hong Kong markets</span> grew at a similar pace.`
      : `${gap > 0 ? "The US" : "Hong Kong"} pulled ahead <span class="dim">by ${(Math.abs(gap) * 100).toFixed(0)} percentage points a year.</span>`;
  }
  const i = data.symbols.indexOf("^HSI"), j = data.symbols.indexOf("^GSPC");
  if (i >= 0 && j >= 0) {
    const w = data.corr_weekly[i][j], d = data.corr_daily[i][j];
    if (w != null && d != null) {
      out.push(`<p><span class="mono">► Link</span>The two markets move together more than same-day numbers suggest: correlation is <b>${d.toFixed(2)}</b> on same-day returns but <b>${w.toFixed(2)}</b> on weekly returns, because Hong Kong closes before New York opens.</p>`);
    }
  }
  const ranked = Object.entries(st).filter(([, v]) => v.sharpe != null).sort((a, b) => b[1].sharpe - a[1].sharpe);
  if (ranked.length) out.push(`<p><span class="mono">► Best for the risk</span>Best growth for the risk taken: <b>${esc(nm(ranked[0][0]))}</b>. Weakest: <b>${esc(nm(ranked[ranked.length - 1][0]))}</b>.</p>`);
  $("findings").innerHTML = out.join("");
}

// ---- opening: date range and stickers -------------------------------------------
const SHORT_NAMES = { "^GSPC": "S&P 500", "^IXIC": "Nasdaq", "^HSI": "Hang Seng", SPY: "SPY", "2800.HK": "Tracker 2800", "0700.HK": "Tencent", "0005.HK": "HSBC" };
const short = (s) => SHORT_NAMES[s] || nm(s);
const year = (iso) => iso.slice(0, 4);

function hero() {
  const d = data.growth.dates;
  $("hero-range").textContent = `DataVest report · ${year(d[0])}–${year(d[d.length - 1])} · ${data.symbols.length} markets`;
}

function stickers() {
  const st = data.stats, out = [];
  const add = (shape, color, small, big, foot, tilt, pos) => out.push(
    `<div class="sticker ${shape}" data-sticker style="--bg: var(${color}); --tilt: ${tilt}deg; ${pos}" role="img" aria-label="${esc(`${small} ${big} ${foot}`)}">
      ${shape === "star" ? `<svg viewBox="0 0 100 100" aria-hidden="true"><polygon points="${starPoints(12, 50, 34)}"/></svg>` : ""}
      <span class="s-small">${esc(small)}</span><span class="s-big">${esc(big)}</span><span class="s-foot">${esc(foot)}</span>
    </div>`);
  if (st["^GSPC"]) add("blob", "--k1", "S&P 500", pct(st["^GSPC"].cagr, 0), "a year", -8, "left: 3%; top: 8%;");
  if (st["^HSI"]) add("disc", "--k5", "Hang Seng", pct(st["^HSI"].cagr, 0), "a year", 7, "right: 4%; top: 2%;");
  const i = data.symbols.indexOf("^HSI"), j = data.symbols.indexOf("^GSPC");
  if (i >= 0 && j >= 0 && data.corr_weekly[i][j] != null) add("star", "--k2", "US–HK link", data.corr_weekly[i][j].toFixed(2), "weekly", -4, "left: 9%; bottom: -16%;");
  const worst = Object.entries(st).filter(([, v]) => v.max_drawdown != null).sort((a, b) => a[1].max_drawdown - b[1].max_drawdown)[0];
  if (worst) add("ticket", "--k4", "Worst fall", pct(worst[1].max_drawdown, 0), short(worst[0]), 9, "right: 18%; bottom: -4%;");
  if (patterns?.map) add("pill", "--k3", "ML found", `${patterns.map.k} groups`, `in ${patterns.map.stocks.length} stocks`, -5, "right: 1%; top: 46%;");
  const r = patterns?.regimes?.["^GSPC"];
  if (r) {
    const p = r.today_p_turbulent, stormy = p > 0.5;
    add("bubble", stormy ? "--k6" : "--k3", "S&P 500 now", stormy ? "Stormy" : "Calm", `${Math.round((stormy ? p : 1 - p) * 100)}% sure`, 4, "left: 1%; top: 52%;");
  }
  $("stickers").innerHTML = out.join("");
  mountStickers($("stickers"));
}

function starPoints(n, R, r) {
  const pts = [];
  for (let k = 0; k < n * 2; k++) {
    const a = (Math.PI * k) / n - Math.PI / 2, rad = k % 2 ? r : R;
    pts.push(`${(50 + rad * Math.cos(a)).toFixed(1)},${(50 + rad * Math.sin(a)).toFixed(1)}`);
  }
  return pts.join(" ");
}

// ---- line-art landscape: how far each market sat below its previous high ---------------
function lineArt() {
  const g = data.growth;
  const syms = data.symbols.filter((s) => g.series[s]);
  const rows = syms.map((s) => ({ label: short(s), values: drawdownSeries(g.series[s]).map((v) => (v == null ? null : -v)) }));
  mountSurface($("lineart"), $("lineart-tip"), {
    rows, dates: g.dates, mode: "line",
    ...(window.matchMedia("(max-width: 760px)").matches ? { zoom: 0.72, shift: 0.08 } : {}),
    formatDate: (iso) => fmtDate(iso),
    tipTemplate: (label, date, v) => `${esc(label)}<br>${date}<br><b>${v}%</b> below its high`,
    font: css("--mono"),
    colors: { ink: css("--ink"), soft: css("--ink-soft"), line: css("--rule"), amber: css("--k1"), paper: css("--paper") },
  });

  // Spade-style data cards: the window, and the deepest fall
  const worst = syms.map((s) => ({ s, ...deepest(g.series[s]) })).sort((a, b) => a.value - b.value)[0];
  $("call-a").innerHTML = `<p>► Window</p><p>${esc(g.dates[0])} → ${esc(g.dates[g.dates.length - 1])}</p>
    <p>► Sample</p><p>${syms.length} markets · ${g.dates.length} weeks<br>US + Hong Kong</p>`;
  if (worst && worst.index >= 0) {
    $("call-b").innerHTML = `<span class="badge ${isHK(worst.s) ? "hk" : "us"}">${isHK(worst.s) ? "HK" : "US"}</span>
      <span class="who"><b>${esc(short(worst.s))}</b><span class="mono">${esc(g.dates[worst.index])} · deepest point</span></span>
      <span class="amt">${pct(worst.value, 0)}</span>`;
  } else $("call-b").hidden = true;
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

// ---- market map (PCA + clustering) -------------------------------------------------
const CLUSTER_COLORS = ["--s1", "--s2", "--s3", "--s4", "--s5"];
let patterns = null;

function marketMap() {
  const m = patterns?.map;
  if (!m) { $("map-block").hidden = true; return; }
  const color = (c) => css(CLUSTER_COLORS[(c - 1) % CLUSTER_COLORS.length]);
  const groupName = (g) => `${g.region === "Mixed" ? "Mixed US and HK" : g.region === "Hong Kong" ? "Mostly Hong Kong" : "Mostly US"}: ${g.top_sectors.slice(0, 2).join(", ").toLowerCase()}`;
  $("map-legend").innerHTML = m.clusters.map((g) => `<span class="key"><i style="background: var(${CLUSTER_COLORS[(g.id - 1) % 5]})"></i>Group ${g.id}</span>`).join("");
  const weak = Math.max(m.ari_region, m.ari_sector) < 0.1;
  const verdict = weak ? "match neither country nor industry closely"
    : m.ari_region > m.ari_sector ? "line up with country much more than with industry" : "line up with industry more than with country";
  $("map-note").textContent = `An unsupervised model grouped ${m.stocks.length} large US and Hong Kong stocks into ${m.k} groups using only how their weekly returns moved together. Nobody told it about countries or industries. The groups ${verdict} (agreement ${m.ari_region.toFixed(2)} for country and ${m.ari_sector.toFixed(2)} for industry, where 1 is a perfect match and 0 is random).`;

  const pcLabel = (i) => `Pattern ${i} (${Math.round(m.explained[i - 1] * 100)}% of movement)`;
  new Chart($("mapchart"), {
    type: "scatter",
    data: {
      datasets: m.clusters.map((g) => ({
        label: `Group ${g.id}`,
        data: m.stocks.filter((s) => s.cluster === g.id).map((s) => ({ x: s.pc2, y: s.pc3, s })),
        backgroundColor: color(g.id), borderColor: css("--paper"), borderWidth: 1.5,
        pointStyle: (ctx) => (ctx.raw?.s.region === "Hong Kong" ? "rectRot" : "circle"),
        pointRadius: 6, pointHoverRadius: 8,
      })),
    },
    options: {
      maintainAspectRatio: false, animation: false,
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { title: (i) => `${i[0].raw.s.name} (${i[0].raw.s.symbol})`, label: (i) => [`${i.raw.s.sector}, ${i.raw.s.region}`, `Group ${i.raw.s.cluster}`] } },
      },
      scales: {
        x: { title: { display: true, text: pcLabel(2) }, grid: { color: css("--rule") }, border: { display: false }, ticks: { display: false } },
        y: { title: { display: true, text: pcLabel(3) }, grid: { color: css("--rule") }, border: { display: false }, ticks: { display: false } },
      },
    },
  });

  $("map-groups").innerHTML = `<p class="chart-note">Circles are US stocks, diamonds are Hong Kong stocks. Pattern 1 (${Math.round(m.explained[0] * 100)}% of movement) is the whole market rising and falling together, so the map shows patterns 2 and 3.</p>` +
    m.clusters.map((g) => {
      const members = m.stocks.filter((s) => s.cluster === g.id);
      return `<div class="group">
        <h3><i style="background: var(${CLUSTER_COLORS[(g.id - 1) % 5]})"></i>Group ${g.id}: ${esc(groupName(g))}</h3>
        <p class="muted">${g.size} stocks${g.avg_within_corr != null ? `, average correlation ${g.avg_within_corr.toFixed(2)} within the group` : ""}</p>
        <p class="chips">${members.map((s) => `<span title="${esc(s.sector)}">${esc(s.name)}</span>`).join("")}</p>
      </div>`;
    }).join("");
}

// ---- regimes (HMM) --------------------------------------------------------------------
let regChart;
let stormP = null; // weekly probability of the stormy state for the chart on screen
const stormBands = {
  id: "stormBands",
  beforeDatasetsDraw(chart) {
    const p = stormP;
    if (!p) return;
    const { ctx, chartArea: a, scales: { x } } = chart;
    ctx.save();
    ctx.fillStyle = css("--cinnabar");
    ctx.globalAlpha = 0.14;
    let start = null;
    const step = (x.getPixelForValue(1) - x.getPixelForValue(0)) / 2;
    p.forEach((v, i) => {
      const on = v != null && v > 0.5;
      if (on && start === null) start = i;
      if ((!on || i === p.length - 1) && start !== null) {
        const end = on ? i : i - 1;
        const x0 = x.getPixelForValue(start) - step, x1 = x.getPixelForValue(end) + step;
        ctx.fillRect(Math.max(x0, a.left), a.top, Math.min(x1, a.right) - Math.max(x0, a.left), a.bottom - a.top);
        start = null;
      }
    });
    ctx.restore();
  },
};

function regimeFor(sym) {
  const r = patterns.regimes[sym];
  const [calm, storm] = r.states;
  const p = r.today_p_turbulent;
  const phase = p > 0.5 ? "stormy" : "calm";
  const sure = Math.round((p > 0.5 ? p : 1 - p) * 100);
  $("reg-note").innerHTML = `As of ${fmtDate(r.today_date)}, the model puts the <b>${esc(nm(sym))}</b> in a <b>${phase}</b> phase (${sure}% probability). Stormy phases had a typical yearly swing of ±${(storm.volatility * 100).toFixed(0)}%, against ±${(calm.volatility * 100).toFixed(0)}% in calm ones.`;
  $("reg-table").innerHTML = `
    <thead><tr><th scope="col">${esc(nm(sym))}</th><th scope="col">Typical yearly swing</th><th scope="col">Average length</th><th scope="col">Share of the 5 years</th></tr></thead>
    <tbody>${r.states.map((st) => `<tr><td>${st.name === "calm" ? "Calm phase" : "Stormy phase"}</td><td class="num">±${(st.volatility * 100).toFixed(0)}%</td><td class="num">${Math.round(st.avg_days)} trading days</td><td class="num">${Math.round(st.share_of_time * 100)}%</td></tr>`).join("")}</tbody>`;
  document.querySelectorAll("#reg-pick button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.sym === sym)));

  const data = { labels: r.weekly.dates, datasets: [{ data: r.weekly.close, borderColor: css("--ink"), borderWidth: 1.75, pointRadius: 0, pointHoverRadius: 4, tension: 0.15 }] };
  stormP = r.weekly.p_turbulent;
  if (regChart) {
    regChart.data = data;
    regChart.update("none");
    return;
  }
  regChart = new Chart($("regchart"), {
    type: "line", data, plugins: [stormBands, crosshair],
    options: {
      maintainAspectRatio: false, animation: false,
      interaction: { mode: "index", intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: { displayColors: false, callbacks: { title: (i) => `Week of ${fmtDate(i[0].label)}`, label: (i) => [`Level ${i.parsed.y.toLocaleString("en-US", { maximumFractionDigits: 0 })}`, `Stormy: ${Math.round((stormP?.[i.dataIndex] ?? 0) * 100)}% likely`] } },
      },
      scales: {
        x: { grid: { display: false }, ticks: { maxTicksLimit: 6, maxRotation: 0, callback(v) { return fmtMonth(this.getLabelForValue(v)); } } },
        y: { position: "right", grid: { color: css("--rule") }, border: { display: false } },
      },
    },
  });
}

function regimes() {
  const syms = Object.keys(patterns?.regimes || {});
  if (!syms.length) { $("reg-block").hidden = true; return; }
  const SHORTN = { "^GSPC": "S&P 500", "^HSI": "Hang Seng" };
  $("reg-pick").innerHTML = syms.map((s) => `<button type="button" data-sym="${esc(s)}" aria-pressed="false">${esc(SHORTN[s] || nm(s))}</button>`).join("");
  $("reg-pick").querySelectorAll("button").forEach((b) => b.addEventListener("click", () => regimeFor(b.dataset.sym)));
  regimeFor(syms.includes("^HSI") ? "^HSI" : syms[0]);
}

async function init() {
  renderTopBar("insights");
  chartDefaults();
  Chart.defaults.font.family = css("--body");
  try {
    const [meta, ins] = await Promise.all([getJSON("data/tickers.json"), getJSON("data/insights.json")]);
    names = Object.fromEntries(meta.tickers.map((t) => [t.symbol, t.name]));
    data = ins;
    $("updated").textContent = `Last updated ${new Date(ins.generated_at).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}.`;
    findings();
    hero();
    try { lineArt(); } catch (e) { console.error(e); $("lede").querySelector(".art").hidden = true; }
    growth();
    scatter();
    heatmap("weekly");
    document.querySelectorAll("[data-corr]").forEach((b) => b.addEventListener("click", () => heatmap(b.dataset.corr)));
    rollingCorr();
    table();
    try { patterns = await getJSON("data/patterns.json"); } catch { patterns = null; }
    marketMap();
    regimes();
    stickers();
  } catch (err) {
    console.error(err);
    $("main").innerHTML = `<p class="notice">The insights data isn't available yet. It is built together with the market data: run <code>python -m app.export_site</code> in the backend folder.</p>`;
  }
}

init();

// Interactive widgets embedded in lessons (<div class="widget" data-widget="name">).
// Maths comes from invest.js (tested); prices from data/prices/*.json.
import { $, css, esc, fmtDate, fmtMonth, getJSON, crosshair } from "./common.js";
import * as v from "./invest.js";
import { tx, isZh, translatePage } from "./i18n.js";

const charts = [];
const priceCache = new Map();
const MARKETS = {
  "^HSI": { file: "_HSI.json", label: "Hang Seng" },
  "^GSPC": { file: "_GSPC.json", label: "S&P 500" },
  "2800.HK": { file: "2800.HK.json", label: "Tracker Fund (2800)" },
  SPY: { file: "SPY.json", label: "SPY fund" },
};

const pct = (x, d = 1) => (x == null || !Number.isFinite(x) ? "–" : `${x >= 0 ? "+" : "−"}${Math.abs(x * 100).toFixed(d)}%`);
const hk = (x, d = 0) => (Number.isFinite(x) ? `HK$${x.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d })}` : "–");
const num = (el) => {
  const x = parseFloat(el.value);
  return Number.isFinite(x) ? x : 0;
};
const field = (id, label, value, opts = {}) => `
  <label>${label}<span class="field ${opts.small ? "small" : ""}">${opts.prefix ? `<span class="cur">${opts.prefix}</span>` : ""}<input type="number" id="${id}" value="${value}" step="${opts.step ?? "any"}" ${opts.min != null ? `min="${opts.min}"` : ""} inputmode="decimal">${opts.suffix ? `<span>${opts.suffix}</span>` : ""}</span></label>`;
const seg = (id, items, active) => `<div class="segmented" id="${id}" role="group">${items.map(([k, label]) => `<button type="button" data-k="${esc(k)}" aria-pressed="${k === active}">${esc(label)}</button>`).join("")}</div>`;
const onSeg = (root, id, cb) => root.querySelectorAll(`#${id} button`).forEach((b) => b.addEventListener("click", () => {
  root.querySelectorAll(`#${id} button`).forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
  cb(b.dataset.k);
}));
const onInputs = (root, cb) => root.querySelectorAll("input").forEach((el) => el.addEventListener("input", cb));

async function prices(sym) {
  if (!priceCache.has(sym)) priceCache.set(sym, getJSON(`data/prices/${MARKETS[sym].file}`).catch(() => null));
  return priceCache.get(sym);
}

function lineChart(canvas, labels, datasets, opts = {}) {
  const ch = new Chart(canvas, {
    type: "line",
    data: { labels, datasets },
    plugins: [crosshair, ...(opts.plugins || [])],
    options: {
      maintainAspectRatio: false, animation: false,
      interaction: { mode: "index", intersect: false },
      plugins: { legend: { display: false }, tooltip: { callbacks: { title: (i) => fmtDate(i[0].label), ...(opts.tooltip || {}) } } },
      scales: {
        x: { grid: { display: false }, ticks: { maxTicksLimit: 6, maxRotation: 0, callback(val) { return fmtMonth(this.getLabelForValue(val)); } } },
        y: { position: "right", grid: { color: css("--rule") }, border: { display: false }, ticks: { maxTicksLimit: 5, ...(opts.yTicks || {}) } },
      },
    },
  });
  charts.push(ch);
  return ch;
}
const ds = (label, data, color, extra = {}) => ({ label, data, borderColor: css(color), backgroundColor: css(color), borderWidth: 2, pointRadius: 0, pointHoverRadius: 4, tension: 0.1, ...extra });
const legend = (items) => `<div class="legend static">${items.map(([label, color, dash]) => `<span class="key"><i style="background: var(${color})${dash ? "; opacity:.6" : ""}"></i>${esc(label)}</span>`).join("")}</div>`;

// ---- returns -----------------------------------------------------------------------------
function returns(root) {
  root.innerHTML = `
    <h4>Return calculator</h4>
    <div class="w-grid">
      <form class="inputs" onsubmit="return false">
        ${field("r-buy", "Bought at", 50, { prefix: "HK$" })}
        ${field("r-sell", "Sold at", 55, { prefix: "HK$" })}
        ${field("r-inc", "Dividends received", 2, { prefix: "HK$" })}
        ${field("r-yrs", "Held for", 2, { suffix: "years", small: true, min: 0.1 })}
      </form>
      <div class="w-out" id="r-out"></div>
    </div>`;
  const run = () => {
    const hpr = v.holdingPeriodReturn(num($("r-buy")), num($("r-sell")), num($("r-inc")));
    const yrs = Math.max(num($("r-yrs")), 0.01);
    $("r-out").innerHTML = `
      <p class="w-big">${pct(hpr)} <span>holding-period return</span></p>
      <p class="w-big">${pct(v.annualise(hpr, yrs))} <span>${tx(yrs === 1 ? "a year, annualised over {n} year" : "a year, annualised over {n} years", { n: yrs })}</span></p>
      <p class="muted">${tx("Without the dividends it would be {x}.", { x: pct(v.holdingPeriodReturn(num($("r-buy")), num($("r-sell")))) })}</p>`;
  };
  onInputs(root, run);
  run();
}

// ---- risk tolerance self-check ------------------------------------------------------------
function riskCheck(root) {
  const qs = [
    ["When will you need most of this money?", ["Within 2 years", "In 3–10 years", "In more than 10 years"]],
    ["Your investments fall 25% in a few months. You would…", ["Sell to stop the losses", "Hold and wait", "Invest more while prices are low"]],
    ["How stable is your income, and do you have an emergency fund?", ["Unstable, no emergency fund", "Fairly stable, small emergency fund", "Stable, full emergency fund"]],
    ["Which matters more to you?", ["Not losing money", "A balance of both", "Growing as much as possible over time"]],
  ];
  root.innerHTML = `
    <h4>Risk tolerance self-check</h4>
    <form class="rc" onsubmit="return false">${qs.map(([q, opts], i) => `
      <fieldset><legend>${i + 1}. ${esc(tx(q))}</legend>
        ${opts.map((o, j) => `<label class="opt"><input type="radio" name="rc${i}" value="${j + 1}"> <span>${esc(tx(o))}</span></label>`).join("")}
      </fieldset>`).join("")}</form>
    <p class="w-result" id="rc-out" role="status">Answer all four to see your result.</p>`;
  root.querySelectorAll("input").forEach((el) => el.addEventListener("change", () => {
    const picked = qs.map((_, i) => root.querySelector(`input[name="rc${i}"]:checked`));
    if (picked.some((p) => !p)) return;
    const score = picked.reduce((a, p) => a + Number(p.value), 0);
    const [name, text] = score <= 6
      ? ["Cautious", "Short horizon or low comfort with falls. Safety and access to cash matter most: savings, short-term deposits, or low-risk bond funds."]
      : score <= 9
        ? ["Balanced", "Some ups and downs are acceptable for better growth. A mix of shares and bonds, such as a balanced fund, fits this profile."]
        : ["Growth-oriented", "A long horizon and calm about falls. A higher share in broad stock index funds fits, provided your emergency fund is in place first."];
    $("rc-out").innerHTML = tx('<b>{name}</b> (score {s} of 12). {text} <span class="muted">This is a learning exercise, not financial advice.</span>', { name: tx(name), s: score, text: tx(text) });
  }));
}

// ---- Hong Kong trade cost -------------------------------------------------------------------
function tradeCost(root) {
  root.innerHTML = `
    <h4>Hong Kong trade cost calculator</h4>
    <div class="w-grid">
      <form class="inputs" onsubmit="return false">
        ${field("tc-price", "Share price", 50, { prefix: "HK$", min: 0 })}
        ${field("tc-shares", "Number of shares", 1000, { step: 100, min: 0, small: true, suffix: "shares" })}
        ${field("tc-rate", "Broker commission", 0.03, { step: 0.01, min: 0, small: true, suffix: "% of value" })}
        ${field("tc-min", "Minimum commission", 3, { prefix: "HK$", min: 0 })}
        <label class="check"><input type="checkbox" id="tc-settle" checked> Broker passes on the settlement fee</label>
      </form>
      <div class="w-out"><table class="stats" id="tc-table"></table><p class="w-result" id="tc-out"></p></div>
    </div>
    <p class="chart-note">Government and exchange charges per side as published by HKEX: stamp duty 0.1% (rounded up to the next dollar), trading fee 0.00565%, SFC levy 0.0027%, AFRC levy 0.00015%. The settlement fee (0.0042%) and commission depend on your broker, so check its fee table. Shares trade in board lots, so the number of shares must be a multiple of the stock's lot size.</p>`;
  const run = () => {
    const opts = { price: num($("tc-price")), shares: num($("tc-shares")), commissionRate: num($("tc-rate")) / 100, commissionMin: num($("tc-min")), includeSettlement: $("tc-settle").checked };
    const c = v.hkTradeCost(opts);
    const rows = [["Trade value", c.value], ["Broker commission", c.commission], ["Stamp duty", c.stampDuty], ["Exchange trading fee", c.tradingFee], ["SFC levy", c.sfcLevy], ["AFRC levy", c.afrcLevy], ["Settlement fee", c.settlement]];
    $("tc-table").innerHTML = `<tbody>${rows.map(([k, x], i) => `<tr${i === 0 ? ' class="sub"' : ""}><td>${k}</td><td class="num">${hk(x, 2)}</td></tr>`).join("")}<tr class="total"><td>Cost of buying</td><td class="num">${hk(c.total, 2)} (${(c.pctOfValue * 100).toFixed(3)}%)</td></tr></tbody>`;
    const be = c.value ? v.breakEvenRise(opts) : 0;
    $("tc-out").innerHTML = c.value ? tx("Selling later costs about the same again, so the round trip costs about <b>{total}</b>. The price must rise about <b>{be}%</b> before you make any profit.", { total: hk(c.total * 2, 2), be: (be * 100).toFixed(2) }) : "";
  };
  onInputs(root, run);
  run();
}

// ---- bull and bear markets --------------------------------------------------------------------
async function bearMarkets(root) {
  root.innerHTML = `
    <div class="w-head"><h4>Falls of 20% or more</h4>${seg("bm-pick", [["^HSI", "Hang Seng"], ["^GSPC", "S&P 500"]], "^HSI")}</div>
    ${legend([["Price", "--ink"], ["Bear market (20%+ below the peak)", "--cinnabar"]])}
    <div class="chart-wrap short2"><canvas id="bm-chart" role="img" aria-label="Price with bear markets shaded"></canvas></div>
    <div class="table-wrap"><table class="stats" id="bm-table"></table></div>`;
  let chart;
  let bands = [];
  const shade = {
    id: "shade",
    beforeDatasetsDraw(ch) {
      const { ctx, chartArea: a, scales: { x } } = ch;
      ctx.save();
      ctx.fillStyle = css("--cinnabar");
      ctx.globalAlpha = 0.14;
      bands.forEach(([s, e]) => {
        const x0 = x.getPixelForValue(s), x1 = x.getPixelForValue(e);
        ctx.fillRect(x0, a.top, Math.max(x1 - x0, 1), a.bottom - a.top);
      });
      ctx.restore();
    },
  };
  const run = async (sym) => {
    const rows = await prices(sym);
    if (!rows) { root.innerHTML = `<p class="muted">Price data isn't available yet.</p>`; return; }
    const series = rows.map((r) => [r[0], r[1]]);
    const falls = v.bigFalls(series, 0.2);
    const idx = (d) => series.findIndex((r) => r[0] === d);
    bands = falls.map((f) => [idx(f.peak), f.recovered ? idx(f.recovered) : series.length - 1]);
    const data = [ds(tx("Price"), series.map((r) => r[1]), "--ink", { borderWidth: 1.5 })];
    if (chart) { chart.data.labels = series.map((r) => r[0]); chart.data.datasets = data; chart.update("none"); }
    else chart = lineChart($("bm-chart"), series.map((r) => r[0]), data, { plugins: [shade] });
    const days = (a, b) => Math.round((new Date(b) - new Date(a)) / 864e5);
    $("bm-table").innerHTML = falls.length
      ? `<thead><tr><th>Peak</th><th>Low</th><th>Fall</th><th>Back to the peak</th></tr></thead><tbody>${falls.map((f) => `<tr><td>${fmtDate(f.peak)}</td><td>${fmtDate(f.trough)}</td><td class="num down">${pct(f.depth, 0)}</td><td class="num">${f.recovered ? tx("{date} ({n} months)", { date: fmtDate(f.recovered), n: Math.round(days(f.peak, f.recovered) / 30.4) }) : tx("Not yet")}</td></tr>`).join("")}</tbody>`
      : `<tbody><tr><td>No fall of 20% or more in this period.</td></tr></tbody>`;
  };
  onSeg(root, "bm-pick", run);
  run("^HSI");
}

// ---- balance sheet -------------------------------------------------------------------------------
function balanceSheet(root) {
  const start = () => ({ cash: 100000, equipment: 0, loan: 0, capital: 100000, retained: 0 });
  let s = start();
  const log = [];
  const moves = [
    ["Borrow HK$50,000 from a bank", () => { s.cash += 50000; s.loan += 50000; return "Cash (asset) +50,000 and bank loan (liability) +50,000."; }],
    ["Buy equipment for HK$30,000 cash", () => { s.cash -= 30000; s.equipment += 30000; return "Cash −30,000, equipment +30,000. Assets just change form, and the totals don't move."; }],
    ["Make a HK$20,000 profit in cash", () => { s.cash += 20000; s.retained += 20000; return "Cash +20,000 and retained profit (equity) +20,000."; }],
    ["Pay a HK$10,000 dividend", () => { s.cash -= 10000; s.retained -= 10000; return "Cash −10,000 and retained profit −10,000. Owners take part of the equity out."; }],
    ["Repay HK$20,000 of the loan", () => { s.cash -= 20000; s.loan -= 20000; return "Cash −20,000 and bank loan −20,000."; }],
  ];
  root.innerHTML = `
    <h4>Keep the balance sheet balanced</h4>
    <p class="muted">A new company starts with HK$100,000 from its owners. Click the events and watch both sides change by the same amount.</p>
    <div class="bs-moves">${moves.map(([label], i) => `<button type="button" class="btn-quiet" data-m="${i}">${label}</button>`).join("")}<button type="button" class="btn-quiet" data-m="reset">Start again</button></div>
    <div class="bs" id="bs"></div>
    <p class="w-result" id="bs-log" role="status"></p>`;
  const row = (k, x) => `<tr><td>${k}</td><td class="num">${hk(x)}</td></tr>`;
  const render = () => {
    const assets = s.cash + s.equipment, le = s.loan + s.capital + s.retained;
    $("bs").innerHTML = `
      <table class="stats"><thead><tr><th colspan="2">Assets</th></tr></thead><tbody>${row("Cash", s.cash)}${row("Equipment", s.equipment)}<tr class="total"><td>Total assets</td><td class="num">${hk(assets)}</td></tr></tbody></table>
      <table class="stats"><thead><tr><th colspan="2">Liabilities + equity</th></tr></thead><tbody>${row("Bank loan (liability)", s.loan)}${row("Share capital (equity)", s.capital)}${row("Retained profit (equity)", s.retained)}<tr class="total"><td>Total</td><td class="num">${hk(le)}</td></tr></tbody></table>`;
    $("bs-log").innerHTML = `${log.length ? esc(log.at(-1)) + " " : ""}<b>${assets === le ? "Balanced: assets = liabilities + equity." : "Not balanced!"}</b>`;
  };
  root.querySelectorAll("[data-m]").forEach((b) => b.addEventListener("click", () => {
    if (b.dataset.m === "reset") { s = start(); log.length = 0; render(); return; }
    log.push(moves[Number(b.dataset.m)][1]());
    render();
  }));
  render();
}

// ---- time value of money ----------------------------------------------------------------------------
function tvm(root) {
  root.innerHTML = `
    <h4>Time value of money calculator</h4>
    <div class="w-grid">
      <form class="inputs" onsubmit="return false">
        ${field("tv-amt", "Amount", 10000, { prefix: "HK$" })}
        ${field("tv-r", "Rate per year", 5, { suffix: "%", small: true, step: 0.25 })}
        ${field("tv-n", "Years", 10, { suffix: "years", small: true, min: 1, step: 1 })}
        ${field("tv-g", "Growth per year (for the growing case)", 2, { suffix: "%", small: true, step: 0.25 })}
        <label class="check"><input type="checkbox" id="tv-due"> Payments at the start of each year (annuity due)</label>
      </form>
      <div class="w-out"><table class="stats" id="tv-table"></table></div>
    </div>`;
  const run = () => {
    const a = num($("tv-amt")), r = num($("tv-r")) / 100, n = Math.max(1, Math.round(num($("tv-n")))), g = num($("tv-g")) / 100, due = $("tv-due").checked;
    const gp = v.presentValueGrowingPerpetuity(a, r, g);
    const rows = [
      [tx("The amount today, grown for {n} years", { n }), "Future value", v.futureValue(a, r, n)],
      [tx("The amount received in {n} years, valued today", { n }), "Present value", v.presentValue(a, r, n)],
      [tx("Paid every year for {n} years, total at the end", { n }), "Future value of an annuity", v.futureValueAnnuity(a, r, n, due)],
      [tx("Paid every year for {n} years, valued today", { n }), "Present value of an annuity", v.presentValueAnnuity(a, r, n, due)],
      ["Paid every year forever, valued today", "Perpetuity", v.presentValuePerpetuity(a, r)],
      [tx("Starting at the amount and growing {g}% a year forever", { g: (g * 100).toFixed(2).replace(/\.?0+$/, "") }), "Growing perpetuity", gp],
    ];
    $("tv-table").innerHTML = `<thead><tr><th>If the amount is…</th><th>Value</th></tr></thead><tbody>${rows.map(([what, name, x]) => `<tr><td>${what}<br><span class="muted">${name}</span></td><td class="num">${Number.isFinite(x) ? hk(x) : "No finite value (needs rate > growth)"}</td></tr>`).join("")}</tbody>`;
  };
  onInputs(root, run);
  run();
}

// ---- Gordon growth / two-stage -----------------------------------------------------------------------
function gordon(root) {
  root.innerHTML = `
    <h4>Dividend discount calculator</h4>
    <div class="w-grid">
      <form class="inputs" onsubmit="return false">
        ${field("gg-d0", "Dividend just paid (per share)", 2, { prefix: "HK$", step: 0.1 })}
        ${field("gg-r", "Required return (r)", 8, { suffix: "%", small: true, step: 0.25 })}
        ${field("gg-g", "Long-run growth (g)", 3, { suffix: "%", small: true, step: 0.25 })}
        <label class="check"><input type="checkbox" id="gg-two"> Add a fast-growth stage first</label>
        <div id="gg-stage" hidden>
          ${field("gg-g1", "Fast growth", 12, { suffix: "%", small: true, step: 0.5 })}
          ${field("gg-n", "For how many years", 5, { suffix: "years", small: true, min: 1, step: 1 })}
        </div>
      </form>
      <div class="w-out"><p class="w-big" id="gg-out"></p><p class="muted" id="gg-note"></p><div class="table-wrap"><table class="stats grid" id="gg-grid"></table></div></div>
    </div>`;
  const run = () => {
    const d0 = num($("gg-d0")), r = num($("gg-r")) / 100, g = num($("gg-g")) / 100, two = $("gg-two").checked;
    $("gg-stage").hidden = !two;
    if (r <= g) {
      $("gg-out").innerHTML = "No finite value";
      $("gg-note").textContent = "The required return must be higher than long-run growth.";
    } else if (two) {
      const res = v.twoStageValue({ d0, r, g1: num($("gg-g1")) / 100, n: Math.max(1, Math.round(num($("gg-n")))), g2: g });
      $("gg-out").innerHTML = `${hk(res.value, 2)} <span>per share</span>`;
      $("gg-note").textContent = tx("{a} comes from the fast-growth years and {b} ({p}%) from everything after: most value usually sits far in the future.", { a: hk(res.pvDividends, 2), b: hk(res.pvTerminal, 2), p: Math.round((res.pvTerminal / res.value) * 100) });
    } else {
      $("gg-out").innerHTML = `${hk(v.gordonValue({ d0, r, g }), 2)} <span>per share</span>`;
      $("gg-note").textContent = tx("Next year's dividend {d} ÷ ({r}% − {g}%).", { d: hk(d0 * (1 + g), 2), r: (r * 100).toFixed(2), g: (g * 100).toFixed(2) });
    }
    const rs = [-0.01, 0, 0.01].map((x) => r + x), gs = [-0.01, 0, 0.01].map((x) => g + x);
    const grid = v.gordonGrid({ d0, rs, gs });
    $("gg-grid").innerHTML = `<caption>Gordon value if r and g are 1 point different</caption>
      <thead><tr><th>r \\ g</th>${gs.map((x) => `<th>${(x * 100).toFixed(2)}%</th>`).join("")}</tr></thead>
      <tbody>${grid.map((row, i) => `<tr><th>${(rs[i] * 100).toFixed(2)}%</th>${row.map((x, j) => `<td class="num${i === 1 && j === 1 ? " here" : ""}">${Number.isFinite(x) && x > 0 ? hk(x, 0) : "–"}</td>`).join("")}</tr>`).join("")}</tbody>`;
  };
  onInputs(root, run);
  $("gg-two").addEventListener("change", run);
  run();
}

// ---- moving-average crosses ------------------------------------------------------------------------------
async function maCross(root) {
  root.innerHTML = `
    <div class="w-head"><h4>Golden and death crosses, tested</h4>${seg("mc-pick", [["^HSI", "Hang Seng"], ["^GSPC", "S&P 500"]], "^HSI")}</div>
    ${legend([["Price", "--ink"], ["50-day average", "--s1"], ["200-day average", "--s2"]])}
    <div class="chart-wrap short2"><canvas id="mc-chart" role="img" aria-label="Price with 50 and 200 day averages"></canvas></div>
    <div class="table-wrap"><table class="stats" id="mc-table"></table></div>
    <p class="w-result" id="mc-out"></p>`;
  let chart;
  const run = async (sym) => {
    const rows = await prices(sym);
    if (!rows) { root.innerHTML = `<p class="muted">Price data isn't available yet.</p>`; return; }
    const r4 = rows.map((r) => [r[0], r[1], r[3], r[4]]);
    const crosses = v.maCrosses(r4, 60);
    const base = v.averageForward(r4, 60);
    const labels = rows.map((r) => r[0]);
    const data = [ds(tx("Price"), rows.map((r) => r[1]), "--ink", { borderWidth: 1.25 }), ds(tx("50-day"), rows.map((r) => r[3]), "--s1", { borderWidth: 1.5 }), ds(tx("200-day"), rows.map((r) => r[4]), "--s2", { borderWidth: 1.5 })];
    if (chart) { chart.data.labels = labels; chart.data.datasets = data; chart.update("none"); }
    else chart = lineChart($("mc-chart"), labels, data);
    $("mc-table").innerHTML = crosses.length
      ? `<thead><tr><th>Date</th><th>Signal</th><th>Next 3 months</th></tr></thead><tbody>${crosses.map((c) => `<tr><td>${fmtDate(c.date)}</td><td>${c.kind === "golden" ? "Golden cross (said to be bullish)" : "Death cross (said to be bearish)"}</td><td class="num ${c.next == null ? "" : c.next >= 0 ? "up" : "down"}">${c.next == null ? "Too recent" : pct(c.next)}</td></tr>`).join("")}</tbody>`
      : "<tbody><tr><td>No crosses in this period.</td></tr></tbody>";
    const avg = (k) => { const xs = crosses.filter((c) => c.kind === k && c.next != null).map((c) => c.next); return xs.length ? [xs.reduce((a, b) => a + b, 0) / xs.length, xs.length] : [null, 0]; };
    const [gAvg, gN] = avg("golden"), [dAvg, dN] = avg("death");
    $("mc-out").innerHTML = tx("Average over the next 3 months: after golden crosses <b>{g}</b> ({gn}), after death crosses <b>{d}</b> ({dn}), after an ordinary day <b>{b}</b>. With so few signals, a difference could easily be luck: this is the small-sample problem.", { g: pct(gAvg), gn: gN, d: pct(dAvg), dn: dN, b: pct(base) });
  };
  onSeg(root, "mc-pick", run);
  run("^HSI");
}

// ---- index vs fund ------------------------------------------------------------------------------------------
async function indexVsFund(root) {
  root.innerHTML = `
    <div class="w-head"><h4>Index level vs a fund that tracks it</h4>${seg("if-pick", [["hk", "Hang Seng vs 2800"], ["us", "S&P 500 vs SPY"]], "hk")}</div>
    <div id="if-legend"></div>
    <div class="chart-wrap short2"><canvas id="if-chart" role="img" aria-label="Growth of 100: index vs fund"></canvas></div>
    <p class="w-result" id="if-out"></p>`;
  let chart;
  const run = async (k) => {
    const [ix, fd] = k === "hk" ? ["^HSI", "2800.HK"] : ["^GSPC", "SPY"];
    const [a, b] = await Promise.all([prices(ix), prices(fd)]);
    if (!a || !b) { root.innerHTML = `<p class="muted">Price data isn't available yet.</p>`; return; }
    const fmap = new Map(b.map((r) => [r[0], r[2]]));
    const common = a.filter((r) => fmap.has(r[0]));
    const i0 = common[0][1], f0 = fmap.get(common[0][0]);
    const labels = common.map((r) => r[0]);
    const idx = common.map((r) => (r[1] / i0) * 100), fund = common.map((r) => (fmap.get(r[0]) / f0) * 100);
    $("if-legend").innerHTML = legend([[tx("{m} index level (no dividends)", { m: tx(MARKETS[ix].label) }), "--ink"], [tx("{m}, dividends reinvested", { m: tx(MARKETS[fd].label) }), "--jade"]]);
    const data = [ds(tx("Index"), idx, "--ink", { borderWidth: 1.5 }), ds(tx("Fund"), fund, "--jade")];
    if (chart) { chart.data.labels = labels; chart.data.datasets = data; chart.update("none"); }
    else chart = lineChart($("if-chart"), labels, data, { tooltip: { label: (i) => ` ${i.dataset.label}: ${i.parsed.y.toFixed(1)}` } });
    const yrs = (new Date(labels.at(-1)) - new Date(labels[0])) / (365.25 * 864e5);
    const ia = v.annualise(idx.at(-1) / 100 - 1, yrs), fa = v.annualise(fund.at(-1) / 100 - 1, yrs);
    const gap = (fa - ia) * 100;
    $("if-out").innerHTML = tx("Over {y} years the index level changed <b>{i}</b> a year and the fund returned <b>{f}</b> a year. ", { y: yrs.toFixed(1), i: pct(ia), f: pct(fa) }) + (gap >= 0
      ? tx("The fund's extra {g} points a year is roughly the dividends it received, minus its fees and small tracking differences.", { g: gap.toFixed(1) })
      : tx("The fund trailed the index level by {g} points a year: its fees and tracking differences outweighed the dividends.", { g: Math.abs(gap).toFixed(1) }));
  };
  onSeg(root, "if-pick", run);
  run("hk");
}

// ---- DCA vs lump sum -----------------------------------------------------------------------------------------
async function dca(root) {
  root.innerHTML = `
    <div class="w-head"><h4>Lump sum vs dollar-cost averaging</h4>
      ${seg("dca-mkt", [["2800.HK", "Hong Kong (2800)"], ["SPY", "US (SPY)"]], "2800.HK")}
      ${seg("dca-len", [["6", "6 months"], ["12", "12 months"], ["24", "24 months"]], "12")}</div>
    <p class="w-big" id="dca-out"></p>
    ${legend([["Lump sum at the start", "--s1"], ["Spread evenly over the period", "--s2"]])}
    <div class="chart-wrap short2"><canvas id="dca-chart" role="img" aria-label="Final value of HK$12,000 for each start month"></canvas></div>
    <p class="chart-note" id="dca-note"></p>`;
  let chart, mkt = "2800.HK", len = 12;
  const run = async () => {
    const rows = await prices(mkt);
    if (!rows) { root.innerHTML = `<p class="muted">Price data isn't available yet.</p>`; return; }
    const res = v.dcaVsLump(rows.map((r) => [r[0], r[2]]), len, 12000);
    const labels = res.windows.map((w) => w.start);
    const data = [ds(tx("Lump sum"), res.windows.map((w) => w.lump), "--s1"), ds(tx("Spread out"), res.windows.map((w) => w.dca), "--s2")];
    if (chart) { chart.data.labels = labels; chart.data.datasets = data; chart.update("none"); }
    else chart = lineChart($("dca-chart"), labels, data, { tooltip: { title: (i) => tx("Starting {m}", { m: fmtMonth(i[0].label) }), label: (i) => ` ${i.dataset.label}: ${hk(i.parsed.y)}` }, yTicks: { callback: (x) => `${Math.round(x / 1000)}k` } });
    $("dca-out").innerHTML = tx("The lump sum ended ahead in <b>{p}%</b> of {n} start months <span>(average {a} vs {b})</span>", { p: Math.round(res.lumpWinShare * 100), n: res.windows.length, a: hk(res.avgLump), b: hk(res.avgDca) });
    $("dca-note").textContent = tx("Each point invests HK$12,000 starting in that month, either all at once or as {n} equal monthly amounts (uninvested cash earns nothing here), and values both one month after the last purchase. Uses fund prices with dividends reinvested.", { n: len });
  };
  onSeg(root, "dca-mkt", (k) => { mkt = k; run(); });
  onSeg(root, "dca-len", (k) => { len = Number(k); run(); });
  run();
}

// ---- checklist -----------------------------------------------------------------------------------------------
function checklist(root) {
  const KEY = "datavest.checklist";
  const items = [
    "I can explain in two sentences why I'm buying this.",
    "I've written down what would make me sell (both good and bad reasons).",
    "I've read the strongest argument against this investment.",
    "I'm not buying mainly because it went up recently or everyone is talking about it.",
    "I know what I'm paying: valuation (e.g. P/E) and trading costs.",
    "This position is small enough that being wrong won't seriously hurt me.",
    "My emergency fund is in place and I won't need this money soon.",
    "I'd be comfortable holding it if the price fell 30% next month.",
  ];
  let saved = [];
  try { saved = JSON.parse(localStorage.getItem(KEY)) || []; } catch { saved = []; }
  root.innerHTML = `
    <h4>Before-you-buy checklist</h4>
    <ul class="checklist">${items.map((t, i) => `<li><label><input type="checkbox" data-i="${i}" ${saved.includes(i) ? "checked" : ""}> <span>${esc(tx(t))}</span></label></li>`).join("")}</ul>
    <p class="w-result" id="cl-out" role="status"></p>`;
  const run = () => {
    const ticked = [...root.querySelectorAll("input:checked")].map((el) => Number(el.dataset.i));
    try { localStorage.setItem(KEY, JSON.stringify(ticked)); } catch { /* storage blocked */ }
    $("cl-out").innerHTML = ticked.length === items.length
      ? "<b>All 8 ticked.</b> Your decision has been through a real process, whatever the outcome."
      : tx("{t} of {n} ticked. Each unticked box is a question worth answering before you buy.", { t: ticked.length, n: items.length });
  };
  root.querySelectorAll("input").forEach((el) => el.addEventListener("change", run));
  run();
}

const WIDGETS = {
  returns, "risk-check": riskCheck, "trade-cost": tradeCost, "bear-markets": bearMarkets, "balance-sheet": balanceSheet,
  tvm, gordon, "ma-cross": maCross, "index-vs-fund": indexVsFund, dca, checklist,
};

/** Fill every widget slot inside `container`. Destroys charts from the previous lesson first. */
export function mountWidgets(container) {
  while (charts.length) charts.pop().destroy();
  container.querySelectorAll(".widget[data-widget]").forEach((el) => {
    const fn = WIDGETS[el.dataset.widget];
    if (!fn) return;
    // Chinese: the tools write English labels; translate them whenever a tool redraws (a second pass finds nothing left)
    if (isZh) new MutationObserver(() => translatePage(el)).observe(el, { childList: true, subtree: true, characterData: true });
    try {
      const out = fn(el);
      if (out && out.catch) out.catch((err) => { console.error(err); el.innerHTML = `<p class="muted">This tool couldn't load.</p>`; });
    } catch (err) {
      console.error(err);
      el.innerHTML = `<p class="muted">This tool couldn't load.</p>`;
    }
  });
}

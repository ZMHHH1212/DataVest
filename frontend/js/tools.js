// Tools page: four calculators. All maths lives in finance.js (tested).
import { $, css, getJSON, renderTopBar, chartDefaults, crosshair } from "./common.js";
import { tx } from "./i18n.js";
import { growth, monthlyNeeded, monthsToGoal, costOfWaiting, mpfEmployee, budget503020, MPF } from "./finance.js";

let cur = "HK$";
try { cur = localStorage.getItem("datavest.currency") || "HK$"; } catch { /* storage blocked */ }

const num = (id) => {
  const v = parseFloat($(id).value);
  return Number.isFinite(v) ? v : 0;
};
const money = (x) => `${cur}${Math.round(x).toLocaleString("en-US")}`;
const short = (x) => {
  const a = Math.abs(x);
  if (a >= 1e6) return `${cur}${(x / 1e6).toFixed(a >= 1e7 ? 1 : 2)}m`;
  if (a >= 1e4) return `${cur}${Math.round(x / 1e3)}k`;
  return money(x);
};
const plural = (n, word) => tx(n === 1 ? `{n} ${word}` : `{n} ${word}s`, { n });

// ---- 1. growth ------------------------------------------------------------------------
let gChart;
let marketContext = "";

function renderGrowth() {
  const years = Math.max(1, Math.round(num("g-years")));
  $("g-years-out").textContent = plural(years, "year");
  const real = $("g-real").checked;
  const rows = growth({ start: num("g-start"), monthly: num("g-monthly"), annualRate: num("g-rate") / 100, years, inflation: 0.02 });
  const last = rows.at(-1);
  const adj = (row, key) => (real ? row[key] / 1.02 ** row.year : row[key]);
  const total = adj(last, "value");
  const paid = adj(last, "paidIn");

  $("g-headline").innerHTML = tx(real ? "<b>{total}</b> after {years} in today's money" : "<b>{total}</b> after {years}", { total: money(total), years: plural(years, "year") });
  $("g-split").innerHTML = total >= paid
    ? tx('You put in {paid}. Growth adds <b class="up">{gain}</b>, or {share}% of the final amount.', { paid: money(paid), gain: money(total - paid), share: Math.round(((total - paid) / Math.max(total, 1)) * 100) })
    : tx(real ? 'You put in {paid}. After inflation, it is worth <b class="down">{loss} less</b> than you put in.' : 'You put in {paid}. It is worth <b class="down">{loss} less</b> than you put in.', { paid: money(paid), loss: money(paid - total) });
  $("g-context").textContent = marketContext;

  const data = {
    labels: rows.map((r) => r.year),
    datasets: [
      { label: tx("Total value"), data: rows.map((r) => adj(r, "value")), borderColor: css("--jade"), backgroundColor: css("--jade") + "22", borderWidth: 2, pointRadius: 0, pointHoverRadius: 4, fill: "+1", tension: 0.2 },
      { label: tx("Money you put in"), data: rows.map((r) => adj(r, "paidIn")), borderColor: css("--ink-soft"), borderWidth: 1.5, borderDash: [5, 4], pointRadius: 0, pointHoverRadius: 4, fill: false, tension: 0 },
    ],
  };
  if (gChart) {
    gChart.data = data;
    gChart.update("none");
    return;
  }
  gChart = new Chart($("g-chart"), {
    type: "line", data, plugins: [crosshair],
    options: {
      maintainAspectRatio: false, animation: false,
      interaction: { mode: "index", intersect: false },
      plugins: { legend: { display: false }, tooltip: { callbacks: { title: (i) => tx("After {years}", { years: plural(Number(i[0].label), "year") }), label: (i) => ` ${i.dataset.label}: ${money(i.parsed.y)}` } } },
      scales: {
        x: { grid: { display: false }, ticks: { maxTicksLimit: 8, maxRotation: 0, callback(v) { const y = this.getLabelForValue(v); return y === 0 ? tx("Now") : tx("{y}y", { y }); } } },
        y: { position: "right", beginAtZero: true, grid: { color: css("--rule") }, border: { display: false }, ticks: { maxTicksLimit: 5, callback: (v) => short(v) } },
      },
    },
  });
}

// ---- 2. goal ----------------------------------------------------------------------------
function renderGoal() {
  const goal = num("goal-amount"), start = num("goal-start"), years = Math.max(1, num("goal-years")), rate = num("goal-rate") / 100;
  const pay = monthlyNeeded({ goal, start, annualRate: rate, years });
  if (pay === 0) {
    $("goal-headline").innerHTML = tx("<b>You're already on track</b>");
    $("goal-detail").textContent = tx("{start} growing at {rate}% a year reaches {goal} without saving more.", { start: money(start), rate: num("goal-rate"), goal: money(goal) });
    return;
  }
  $("goal-headline").innerHTML = tx("Save <b>{pay}</b> a month", { pay: money(pay) });
  const half = monthsToGoal({ goal, start, monthly: pay / 2, annualRate: rate });
  const halfText = half == null ? tx("you would not reach it within 100 years") : tx("it would take {y} and {m}", { y: plural(Math.floor(half / 12), "year"), m: plural(half % 12, "month") });
  $("goal-detail").textContent = tx("That reaches {goal} in {years}. Saving half as much, {half}.", { goal: money(goal), years: plural(Math.round(years), "year"), half: halfText });
}

// ---- 3. waiting -------------------------------------------------------------------------
function renderWaiting() {
  const age = num("w-age"), delay = num("w-delay"), end = num("w-end");
  const w = costOfWaiting({ monthly: num("w-monthly"), annualRate: num("w-rate") / 100, ageNow: age, delayYears: delay, endAge: end });
  if (end <= age + delay) {
    $("w-headline").textContent = tx("Choose an end age after you'd start saving.");
    $("w-compare").innerHTML = "";
    $("w-note").textContent = "";
    return;
  }
  $("w-headline").innerHTML = tx('Waiting {years} costs <b class="down">{cost}</b>', { years: plural(delay, "year"), cost: money(w.difference) });
  const max = Math.max(w.startNow, 1);
  const bar = (label, value, paid, cls) => `
    <div class="cmp-row">
      <span class="cmp-label">${label}</span>
      <span class="cmp-track"><i class="${cls}" style="width:${((value / max) * 100).toFixed(1)}%"></i></span>
      <span class="cmp-val">${short(value)}</span>
      <span class="cmp-sub">${tx("you put in {paid}", { paid: short(paid) })}</span>
    </div>`;
  $("w-compare").innerHTML = bar(tx("Start at {age}", { age }), w.startNow, w.paidInNow, "now") + bar(tx("Start at {age}", { age: age + delay }), w.startLater, w.paidInLater, "later");
  const extraPaid = w.paidInNow - w.paidInLater;
  $("w-note").textContent = extraPaid > 0
    ? tx("Starting early means paying in {extra} more, but ending with {diff} more: {x} times the extra money, because early savings have the longest time to compound.", { extra: money(extraPaid), diff: money(w.difference), x: (w.difference / extraPaid).toFixed(1) })
    : "";
}

// ---- 4. pay -------------------------------------------------------------------------------
function renderPay() {
  const income = num("p-income");
  const mpf = $("p-mpf").checked ? mpfEmployee(income) : 0;
  const takeHome = Math.max(income - mpf, 0);
  const b = budget503020(takeHome);
  const rows = [
    ...(mpf > 0 ? [[tx("MPF (your 5%)"), mpf, "mpf", tx("Taken from your pay first. Your employer adds the same again.")]] : []),
    [tx("Needs, 50%"), b.needs, "needs", tx("Rent, food, transport, bills")],
    [tx("Wants, 30%"), b.wants, "wants", tx("Eating out, hobbies, trips")],
    [tx("Saving, 20%"), b.savings, "save", tx("Emergency fund first, then investing")],
  ];
  const max = Math.max(...rows.map((r) => r[1]), 1);
  $("p-bars").innerHTML = rows.map(([label, v, cls, hint]) => `
    <div class="cmp-row">
      <span class="cmp-label">${label}</span>
      <span class="cmp-track"><i class="${cls}" style="width:${((v / max) * 100).toFixed(1)}%"></i></span>
      <span class="cmp-val">${money(v)}</span>
      <span class="cmp-sub">${hint}</span>
    </div>`).join("");
  const mpfNote = !$("p-mpf").checked ? ""
    : income < MPF.minIncome ? tx("Below HK${min} a month you don't pay MPF, but your employer still does. ", { min: MPF.minIncome.toLocaleString() })
    : income > MPF.maxIncome ? tx("MPF is capped at 5% of HK${max}, so HK$1,500 a month. ", { max: MPF.maxIncome.toLocaleString() })
    : "";
  $("p-note").textContent = mpfNote + tx("Take-home after MPF: {pay}. Salaries tax is paid yearly and isn't included here. MPF rules as published by the MPFA in April 2026; higher limits have been proposed but are not yet law.", { pay: money(takeHome) });
}

// ---- wiring ---------------------------------------------------------------------------------
function setCurrency(c) {
  cur = c;
  try { localStorage.setItem("datavest.currency", c); } catch { /* storage blocked */ }
  document.querySelectorAll("#currency button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.cur === c)));
  document.querySelectorAll(".cur").forEach((el) => (el.textContent = c));
  $("p-mpf").closest("label").hidden = c !== "HK$";
  if (c !== "HK$") $("p-mpf").checked = false;
  renderAll();
}

function renderAll() {
  renderGrowth();
  renderGoal();
  renderWaiting();
  renderPay();
}

async function init() {
  renderTopBar("tools");
  chartDefaults();
  document.querySelectorAll("#currency button").forEach((b) => b.addEventListener("click", () => setCurrency(b.dataset.cur)));
  document.querySelectorAll("#g-rate-pick button").forEach((b) =>
    b.addEventListener("click", () => {
      $("g-rate").value = String(Math.round(parseFloat(b.dataset.rate) * 1000) / 10);
      document.querySelectorAll("#g-rate-pick button").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
      renderGrowth();
    })
  );
  $("g-rate").addEventListener("input", () => document.querySelectorAll("#g-rate-pick button").forEach((x) => x.setAttribute("aria-pressed", String(Math.round(parseFloat(x.dataset.rate) * 1000) === Math.round(num("g-rate") * 10)))));
  document.querySelectorAll(".inputs input").forEach((el) => el.addEventListener("input", renderAll));

  // Real-data context: what markets actually did over the last 5 years
  try {
    const ins = await getJSON("data/insights.json");
    const us = ins.stats["^GSPC"], hk = ins.stats["^HSI"];
    if (us && hk) {
      const p = (x) => `${x >= 0 ? "+" : "−"}${Math.abs(x * 100).toFixed(1)}%`;
      marketContext = tx('For reference, over the last five years the S&P 500 changed {us} a year and the Hang Seng {hk} a year, before dividends. The same "stocks" can give very different results depending on where and when you invest.', { us: p(us.cagr), hk: p(hk.cagr) });
    }
  } catch { /* context is optional */ }
  setCurrency(cur);
}

init();

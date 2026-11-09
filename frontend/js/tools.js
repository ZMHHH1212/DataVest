// Tools page: four calculators. All maths lives in finance.js (tested).
import { $, css, getJSON, renderTopBar, chartDefaults, crosshair } from "./common.js";
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
const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;

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

  $("g-headline").innerHTML = `<b>${money(total)}</b> after ${plural(years, "year")}${real ? " in today's money" : ""}`;
  $("g-split").innerHTML = total >= paid
    ? `You put in ${money(paid)}. Growth adds <b class="up">${money(total - paid)}</b>, or ${Math.round(((total - paid) / Math.max(total, 1)) * 100)}% of the final amount.`
    : `You put in ${money(paid)}. ${real ? "After inflation, " : ""}it is worth <b class="down">${money(paid - total)} less</b> than you put in.`;
  $("g-context").textContent = marketContext;

  const data = {
    labels: rows.map((r) => r.year),
    datasets: [
      { label: "Total value", data: rows.map((r) => adj(r, "value")), borderColor: css("--jade"), backgroundColor: css("--jade") + "22", borderWidth: 2, pointRadius: 0, pointHoverRadius: 4, fill: "+1", tension: 0.2 },
      { label: "Money you put in", data: rows.map((r) => adj(r, "paidIn")), borderColor: css("--ink-soft"), borderWidth: 1.5, borderDash: [5, 4], pointRadius: 0, pointHoverRadius: 4, fill: false, tension: 0 },
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
      plugins: { legend: { display: false }, tooltip: { callbacks: { title: (i) => `After ${plural(Number(i[0].label), "year")}`, label: (i) => ` ${i.dataset.label}: ${money(i.parsed.y)}` } } },
      scales: {
        x: { grid: { display: false }, ticks: { maxTicksLimit: 8, maxRotation: 0, callback(v) { const y = this.getLabelForValue(v); return y === 0 ? "Now" : `${y}y`; } } },
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
    $("goal-headline").innerHTML = `<b>You're already on track</b>`;
    $("goal-detail").textContent = `${money(start)} growing at ${num("goal-rate")}% a year reaches ${money(goal)} without saving more.`;
    return;
  }
  $("goal-headline").innerHTML = `Save <b>${money(pay)}</b> a month`;
  const half = monthsToGoal({ goal, start, monthly: pay / 2, annualRate: rate });
  const halfText = half == null ? "you would not reach it within 100 years" : `it would take ${plural(Math.floor(half / 12), "year")} and ${plural(half % 12, "month")}`;
  $("goal-detail").textContent = `That reaches ${money(goal)} in ${plural(Math.round(years), "year")}. Saving half as much, ${halfText}.`;
}

// ---- 3. waiting -------------------------------------------------------------------------
function renderWaiting() {
  const age = num("w-age"), delay = num("w-delay"), end = num("w-end");
  const w = costOfWaiting({ monthly: num("w-monthly"), annualRate: num("w-rate") / 100, ageNow: age, delayYears: delay, endAge: end });
  if (end <= age + delay) {
    $("w-headline").textContent = "Choose an end age after you'd start saving.";
    $("w-compare").innerHTML = "";
    $("w-note").textContent = "";
    return;
  }
  $("w-headline").innerHTML = `Waiting ${plural(delay, "year")} costs <b class="down">${money(w.difference)}</b>`;
  const max = Math.max(w.startNow, 1);
  const bar = (label, value, paid, cls) => `
    <div class="cmp-row">
      <span class="cmp-label">${label}</span>
      <span class="cmp-track"><i class="${cls}" style="width:${((value / max) * 100).toFixed(1)}%"></i></span>
      <span class="cmp-val">${short(value)}</span>
      <span class="cmp-sub">you put in ${short(paid)}</span>
    </div>`;
  $("w-compare").innerHTML = bar(`Start at ${age}`, w.startNow, w.paidInNow, "now") + bar(`Start at ${age + delay}`, w.startLater, w.paidInLater, "later");
  const extraPaid = w.paidInNow - w.paidInLater;
  $("w-note").textContent = extraPaid > 0
    ? `Starting early means paying in ${money(extraPaid)} more, but ending with ${money(w.difference)} more: ${(w.difference / extraPaid).toFixed(1)} times the extra money, because early savings have the longest time to compound.`
    : "";
}

// ---- 4. pay -------------------------------------------------------------------------------
function renderPay() {
  const income = num("p-income");
  const mpf = $("p-mpf").checked ? mpfEmployee(income) : 0;
  const takeHome = Math.max(income - mpf, 0);
  const b = budget503020(takeHome);
  const rows = [
    ...(mpf > 0 ? [["MPF (your 5%)", mpf, "mpf", "Taken from your pay first. Your employer adds the same again."]] : []),
    ["Needs, 50%", b.needs, "needs", "Rent, food, transport, bills"],
    ["Wants, 30%", b.wants, "wants", "Eating out, hobbies, trips"],
    ["Saving, 20%", b.savings, "save", "Emergency fund first, then investing"],
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
    : income < MPF.minIncome ? `Below HK$${MPF.minIncome.toLocaleString()} a month you don't pay MPF, but your employer still does. `
    : income > MPF.maxIncome ? `MPF is capped at 5% of HK$${MPF.maxIncome.toLocaleString()}, so HK$1,500 a month. `
    : "";
  $("p-note").textContent = `${mpfNote}Take-home after MPF: ${money(takeHome)}. Salaries tax is paid yearly and isn't included here. MPF rules as published by the MPFA in April 2026; higher limits have been proposed but are not yet law.`;
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
      marketContext = `For reference, over the last five years the S&P 500 changed ${p(us.cagr)} a year and the Hang Seng ${p(hk.cagr)} a year, before dividends. The same "stocks" can give very different results depending on where and when you invest.`;
    }
  } catch { /* context is optional */ }
  setCurrency(cur);
}

init();

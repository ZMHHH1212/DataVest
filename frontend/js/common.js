// Shared helpers: formatting, data loading, the top bar, chart defaults.
import { onUser, signOut } from "./auth.js";
import { t, isZh, switchLang } from "./i18n.js";
import { mountThemeButton } from "./theme.js";

export const $ = (id) => document.getElementById(id);
export const css = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

export const pct = (x, digits = 1) => `${x >= 0 ? "+" : "−"}${Math.abs(x * 100).toFixed(digits)}%`;
export const money = (x) => x.toLocaleString("en-US", { maximumFractionDigits: 0 });
export const fmtDate = (iso) =>
  new Date(iso + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
export const fmtMonth = (iso) => fmtDate(iso).replace(/^\d+ /, "");

export function priceText(t, v) {
  const n = v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return t.is_index ? `${n} points` : `${n} ${t.currency || ""}`.trim();
}

export async function getJSON(url) {
  const res = await fetch(url, { cache: "no-cache" });
  if (!res.ok) throw new Error(`${url}: ${res.status}`);
  return res.json();
}

export function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}

// ---- top bar --------------------------------------------------------------
export function renderTopBar(active, base = "", { i18n = false } = {}) {
  // Chinese navigation only on pages that are translated (opted in with i18n: true)
  const tr = (key, en) => (i18n ? t(key, en) : en);
  const links = [
    ["markets", `${base}markets.html`, tr("nav.markets", "Markets")],
    ["insights", `${base}insights.html`, tr("nav.insights", "Insights")],
    ["models", `${base}models.html`, tr("nav.models", "Models")],
    ["portfolio", `${base}portfolio.html`, tr("nav.portfolio", "Portfolio")],
    ["learn", `${base}learn.html`, tr("nav.learn", "Learn")],
    ["tools", `${base}tools.html`, tr("nav.tools", "Tools")],
    ["analysis", `${base}analysis/`, tr("nav.analysis", "Analysis")],
  ];
  const langBtn = i18n
    ? `<button type="button" class="btn-quiet lang" id="lang" lang="${isZh ? "en" : "zh-HK"}" aria-label="${isZh ? "Switch to English" : "切換至中文"}">${isZh ? "EN" : "中"}</button>`
    : "";
  const signIn = tr("nav.signin", "Sign in");
  $("top").innerHTML = `
    <a class="brand" href="${base || "./"}">DataVest</a>
    <nav class="site-nav" aria-label="Site">
      ${links.map(([k, href, label]) => `<a href="${href}"${k === active ? ' aria-current="page"' : ""}>${label}</a>`).join("")}
    </nav>
    ${langBtn}
    <div class="account" id="account"><a class="btn-quiet" href="${base}signin.html">${signIn}</a></div>`;
  if (i18n) $("lang").addEventListener("click", switchLang);
  // report-style pages get the light/dark button
  if (document.documentElement.classList.contains("report")) mountThemeButton($("top"));

  onUser((user) => {
    const box = $("account");
    if (!user) {
      box.innerHTML = `<a class="btn-quiet" href="${base}signin.html">${signIn}</a>`;
      return;
    }
    const first = (user.displayName || user.email || "You").split(" ")[0];
    const avatar = user.photoURL
      ? `<img class="avatar" src="${esc(user.photoURL)}" alt="" referrerpolicy="no-referrer">`
      : `<span class="avatar avatar-letter" aria-hidden="true">${esc(first[0])}</span>`;
    box.innerHTML = `${avatar}<span class="who">${esc(first)}</span><button type="button" class="btn-quiet" id="sign-out">${tr("nav.signout", "Sign out")}</button>`;
    $("sign-out").addEventListener("click", () => signOut());
  });
}

// ---- charts -----------------------------------------------------------------
export function chartDefaults() {
  Chart.defaults.font.family = css("--body");
  Chart.defaults.color = css("--ink-soft");
  Chart.defaults.plugins.tooltip.backgroundColor = css("--ink");
  Chart.defaults.plugins.tooltip.titleColor = css("--paper");
  Chart.defaults.plugins.tooltip.bodyColor = css("--paper");
  Chart.defaults.plugins.tooltip.padding = 10;
}

// Vertical hover line for line charts.
export const crosshair = {
  id: "crosshair",
  afterDatasetsDraw(chart) {
    const a = chart.tooltip?.getActiveElements?.();
    if (!a || !a.length) return;
    const { ctx, chartArea } = chart;
    const x = a[0].element.x;
    ctx.save();
    ctx.strokeStyle = css("--ink-soft");
    ctx.globalAlpha = 0.5;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, chartArea.top);
    ctx.lineTo(x, chartArea.bottom);
    ctx.stroke();
    ctx.restore();
  },
};

// Name each visible line at its right end (identity never by colour alone).
export const endLabels = {
  id: "endLabels",
  afterDatasetsDraw(chart) {
    const { ctx, chartArea } = chart;
    const placed = [];
    chart.data.datasets.forEach((ds, i) => {
      const meta = chart.getDatasetMeta(i);
      if (meta.hidden || !ds.endLabel) return;
      const pts = meta.data.filter((p) => !p.skip && Number.isFinite(p.y));
      const last = pts[pts.length - 1];
      if (!last) return;
      let y = last.y;
      while (placed.some((p) => Math.abs(p - y) < 14)) y += 14;
      placed.push(y);
      ctx.save();
      ctx.font = `600 12px ${css("--body")}`;
      ctx.fillStyle = css("--ink");
      ctx.textBaseline = "middle";
      ctx.fillText(ds.endLabel, Math.min(last.x + 6, chartArea.right + 6), y);
      ctx.restore();
    });
  },
};

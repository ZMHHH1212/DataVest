// Portfolio maths: weekly data alignment, statistics, backtests with rebalancing,
// risk contributions and long-only optimisation. Pure functions, tested in tests/portfolio.test.mjs.

export const WEEKS_PER_YEAR = 52;

/** ISO date of the Friday ending the week that contains `iso`. */
export function weekEnd(iso) {
  const d = new Date(iso + "T00:00:00Z");
  const add = (5 - d.getUTCDay() + 7) % 7; // days until Friday (Sat->6, Sun->5)
  d.setUTCDate(d.getUTCDate() + add);
  return d.toISOString().slice(0, 10);
}

/**
 * Align daily price series on weekly closes.
 * series: { name: [[isoDate, price], ...] } -> { dates, names, prices: number[][] (weeks x assets) }.
 * Uses each asset's last price in the week, carries the last known price forward,
 * and starts when every asset has a price.
 */
export function weeklyPrices(series) {
  const names = Object.keys(series);
  const weekly = names.map((n) => {
    const m = new Map();
    for (const [d, p] of series[n]) if (p != null) m.set(weekEnd(d), p);
    return m;
  });
  const dates = [...new Set(weekly.flatMap((m) => [...m.keys()]))].sort();
  const last = names.map(() => null);
  const rows = [];
  const keep = [];
  for (const d of dates) {
    weekly.forEach((m, i) => { if (m.has(d)) last[i] = m.get(d); });
    if (last.every((x) => x != null)) { rows.push([...last]); keep.push(d); }
  }
  return { dates: keep, names, prices: rows };
}

/** Simple returns between consecutive rows. */
export function returnsFrom(prices) {
  const out = [];
  for (let t = 1; t < prices.length; t++) out.push(prices[t].map((p, i) => p / prices[t - 1][i] - 1));
  return out;
}

export function meanVector(rets) {
  const k = rets[0].length;
  const mu = new Array(k).fill(0);
  rets.forEach((r) => r.forEach((x, i) => (mu[i] += x)));
  return mu.map((x) => x / rets.length);
}

export function covMatrix(rets) {
  const mu = meanVector(rets);
  const k = mu.length;
  const c = Array.from({ length: k }, () => new Array(k).fill(0));
  for (const r of rets) {
    for (let i = 0; i < k; i++) for (let j = i; j < k; j++) c[i][j] += (r[i] - mu[i]) * (r[j] - mu[j]);
  }
  for (let i = 0; i < k; i++) for (let j = i; j < k; j++) { c[i][j] /= rets.length - 1; c[j][i] = c[i][j]; }
  return c;
}

/** Yearly expected return and volatility of weights w, from per-period mean and covariance. */
export function stats(w, mu, cov, periods = WEEKS_PER_YEAR) {
  const m = w.reduce((a, wi, i) => a + wi * mu[i], 0);
  let v = 0;
  for (let i = 0; i < w.length; i++) for (let j = 0; j < w.length; j++) v += w[i] * w[j] * cov[i][j];
  return { ret: m * periods, vol: Math.sqrt(Math.max(v, 0) * periods) };
}

/** Share of portfolio variance coming from each holding (sums to 1). */
export function riskContributions(w, cov) {
  const cw = cov.map((row) => row.reduce((a, c, j) => a + c * w[j], 0));
  const total = w.reduce((a, wi, i) => a + wi * cw[i], 0);
  return w.map((wi, i) => (total > 0 ? (wi * cw[i]) / total : 0));
}

/** Weighted average of holdings' volatility ÷ portfolio volatility. 1 = no diversification benefit. */
export function diversificationRatio(w, cov) {
  const avg = w.reduce((a, wi, i) => a + wi * Math.sqrt(cov[i][i]), 0);
  let v = 0;
  for (let i = 0; i < w.length; i++) for (let j = 0; j < w.length; j++) v += w[i] * w[j] * cov[i][j];
  return v > 0 ? avg / Math.sqrt(v) : 1;
}

export function normalise(w) {
  const pos = w.map((x) => Math.max(x, 0));
  const s = pos.reduce((a, b) => a + b, 0);
  return s > 0 ? pos.map((x) => x / s) : pos.map(() => 1 / w.length);
}

/**
 * Value of 1 invested at the first row, following target weights.
 * rebalance: "none" (buy and hold), "yearly" or "monthly" (back to target at the first week of each new period).
 */
export function backtest(prices, dates, w, rebalance = "none") {
  let holdings = w.map((wi, i) => wi / prices[0][i]); // units per asset
  const values = [1];
  for (let t = 1; t < prices.length; t++) {
    const value = holdings.reduce((a, u, i) => a + u * prices[t][i], 0);
    values.push(value);
    const key = rebalance === "yearly" ? 4 : rebalance === "monthly" ? 7 : 0;
    if (key && dates[t].slice(0, key) !== dates[t - 1].slice(0, key)) {
      holdings = w.map((wi, i) => (wi * value) / prices[t][i]);
    }
  }
  return values;
}

/** Growth, risk and worst fall of an equity curve sampled `periods` times a year. */
export function curveMetrics(values, periods = WEEKS_PER_YEAR) {
  const rets = [];
  for (let t = 1; t < values.length; t++) rets.push(values[t] / values[t - 1] - 1);
  const years = rets.length / periods;
  const mean = rets.reduce((a, b) => a + b, 0) / rets.length;
  const sd = Math.sqrt(rets.reduce((a, r) => a + (r - mean) ** 2, 0) / (rets.length - 1));
  let peak = values[0], mdd = 0;
  for (const v of values) { peak = Math.max(peak, v); mdd = Math.min(mdd, v / peak - 1); }
  return {
    total: values.at(-1) / values[0] - 1,
    cagr: (values.at(-1) / values[0]) ** (1 / years) - 1,
    vol: sd * Math.sqrt(periods),
    sharpe: sd > 0 ? (mean / sd) * Math.sqrt(periods) : null,
    maxDrawdown: mdd,
  };
}

/** Deterministic pseudo-random numbers (mulberry32), so results don't change on reload. */
export function rng(seed = 1) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Random long-only weights (uniform on the simplex). */
export function randomWeights(k, rand) {
  const e = Array.from({ length: k }, () => -Math.log(1 - rand()));
  const s = e.reduce((a, b) => a + b, 0);
  return e.map((x) => x / s);
}

/**
 * Long-only optimisation by pairwise weight transfers (hill climbing on the simplex).
 * objective: "minvar" (lowest volatility) or "maxsharpe" (highest return per unit of volatility, rf = 0).
 * maxWeight caps any single holding (1 = no cap).
 */
export function optimise(mu, cov, objective = "minvar", maxWeight = 1) {
  const k = mu.length;
  const score = (w) => {
    const s = stats(w, mu, cov);
    return objective === "minvar" ? -s.vol : s.vol > 0 ? s.ret / s.vol : -Infinity;
  };
  let w = new Array(k).fill(1 / k);
  if (maxWeight < 1 / k) maxWeight = 1 / k;
  let best = score(w);
  for (let step = 0.25; step > 1e-5; step /= 2) {
    let improved = true;
    while (improved) {
      improved = false;
      for (let i = 0; i < k; i++) {
        for (let j = 0; j < k; j++) {
          if (i === j) continue;
          const d = Math.min(step, w[i], maxWeight - w[j]);
          if (d <= 0) continue;
          const trial = [...w];
          trial[i] -= d;
          trial[j] += d;
          const s = score(trial);
          if (s > best + 1e-12) { w = trial; best = s; improved = true; }
        }
      }
    }
  }
  return w.map((x) => (x < 1e-6 ? 0 : x));
}

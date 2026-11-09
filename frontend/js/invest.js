// Investing maths for the Stock investing lessons. Pure functions, tested in frontend/tests/invest.test.mjs.
// Rates are fractions (0.05 = 5%).

// ---- returns ---------------------------------------------------------------------------

/** Holding-period return: price change plus income received, relative to what you paid. */
export function holdingPeriodReturn(buyPrice, sellPrice, income = 0) {
  return (sellPrice - buyPrice + income) / buyPrice;
}

/** Turn a return earned over `years` into the equivalent yearly (compound) return. */
export function annualise(totalReturn, years) {
  return (1 + totalReturn) ** (1 / years) - 1;
}

/** Effective annual rate of a quoted yearly rate compounded `m` times a year. */
export function effectiveAnnualRate(nominal, m) {
  return (1 + nominal / m) ** m - 1;
}

/** Portfolio return = weighted average of the holdings' returns. Weights are normalised to sum to 1. */
export function portfolioReturn(holdings) {
  const total = holdings.reduce((a, h) => a + h.weight, 0);
  return holdings.reduce((a, h) => a + (h.weight / total) * h.ret, 0);
}

// ---- Hong Kong trading costs -------------------------------------------------------------

// Per side of each trade. Sources: HKEX "Transaction" fee schedule (trading fee, SFC and AFRC
// levies, stamp duty) and IFEC "Stock trading fees and charges". The CCASS settlement fee is set by
// HKSCC and passed on at each broker's discretion; 0.0042% with no minimum is a commonly quoted rate.
export const HK_FEES = {
  stampDuty: 0.001,      // rounded up to the next whole dollar
  tradingFee: 0.0000565,
  sfcLevy: 0.000027,
  afrcLevy: 0.0000015,
  settlement: 0.000042,
};

const cents = (x) => Math.round(x * 100) / 100;

/** Costs of one side (a buy or a sell) of a Hong Kong stock trade. */
export function hkTradeCost({ price, shares, commissionRate = 0, commissionMin = 0, includeSettlement = true }) {
  const value = price * shares;
  const commission = value > 0 ? Math.max(value * commissionRate, commissionMin) : 0;
  const parts = {
    commission: cents(commission),
    stampDuty: Math.ceil(value * HK_FEES.stampDuty - 1e-9),
    tradingFee: cents(value * HK_FEES.tradingFee),
    sfcLevy: cents(value * HK_FEES.sfcLevy),
    afrcLevy: cents(value * HK_FEES.afrcLevy),
    settlement: includeSettlement ? cents(value * HK_FEES.settlement) : 0,
  };
  const total = Object.values(parts).reduce((a, b) => a + b, 0);
  return { value, ...parts, total: cents(total), pctOfValue: value ? total / value : 0 };
}

/** How much the price must rise just to cover the costs of buying and later selling. */
export function breakEvenRise(opts) {
  const buy = hkTradeCost(opts);
  // sell side priced at the buy price is a close approximation for small moves
  const sell = hkTradeCost(opts);
  return (buy.total + sell.total) / buy.value;
}

// ---- time value of money -----------------------------------------------------------------

export const futureValue = (pv, r, n) => pv * (1 + r) ** n;
export const presentValue = (fv, r, n) => fv / (1 + r) ** n;

/** Future value of `pmt` paid every period for n periods (end of period, or start if `due`). */
export function futureValueAnnuity(pmt, r, n, due = false) {
  const base = r === 0 ? pmt * n : pmt * (((1 + r) ** n - 1) / r);
  return due ? base * (1 + r) : base;
}

/** Present value of `pmt` paid every period for n periods. */
export function presentValueAnnuity(pmt, r, n, due = false) {
  const base = r === 0 ? pmt * n : pmt * ((1 - (1 + r) ** -n) / r);
  return due ? base * (1 + r) : base;
}

/** Present value of `pmt` paid every period forever, starting one period from now. */
export function presentValuePerpetuity(pmt, r) {
  if (r <= 0) return Infinity;
  return pmt / r;
}

/** Present value of a payment that starts at `next` and grows by g forever. Needs r > g. */
export function presentValueGrowingPerpetuity(next, r, g) {
  if (r <= g) return Infinity;
  return next / (r - g);
}

// ---- stock valuation ---------------------------------------------------------------------------

/** Gordon growth model: value = next year's dividend / (required return − growth). */
export function gordonValue({ d0, r, g }) {
  if (r <= g) return Infinity;
  return (d0 * (1 + g)) / (r - g);
}

/** Two-stage dividend discount model: fast growth g1 for n years, then g2 forever. */
export function twoStageValue({ d0, r, g1, n, g2 }) {
  if (r <= g2) return Infinity;
  let pv = 0;
  let d = d0;
  for (let t = 1; t <= n; t++) {
    d *= 1 + g1;
    pv += d / (1 + r) ** t;
  }
  const terminal = (d * (1 + g2)) / (r - g2); // value at the end of year n
  return { value: pv + terminal / (1 + r) ** n, pvDividends: pv, pvTerminal: terminal / (1 + r) ** n };
}

/** Value grid for a range of required returns and growth rates (sensitivity table). */
export function gordonGrid({ d0, rs, gs }) {
  return rs.map((r) => gs.map((g) => gordonValue({ d0, r, g })));
}

/** Price multiples. */
export const priceToEarnings = (price, eps) => (eps > 0 ? price / eps : null);
export const priceToBook = (price, bookPerShare) => (bookPerShare > 0 ? price / bookPerShare : null);
export const priceToSales = (price, salesPerShare) => (salesPerShare > 0 ? price / salesPerShare : null);

// ---- strategies on real price series ----------------------------------------------------------

/** First trading day of each month, from [[isoDate, price], ...] sorted by date. */
export function monthStarts(series) {
  const out = [];
  let last = "";
  for (const [d, p] of series) {
    const m = d.slice(0, 7);
    if (m !== last) {
      out.push([d, p]);
      last = m;
    }
  }
  return out;
}

/**
 * Lump sum vs dollar-cost averaging over every `months`-long window in the history.
 * Lump sum invests everything at the window start; DCA invests 1/months each month (cash waits at 0%).
 * Both are valued at the start of the month after the window ends.
 */
export function dcaVsLump(series, months = 12, amount = 12000) {
  const ms = monthStarts(series);
  const windows = [];
  for (let s = 0; s + months < ms.length; s++) {
    const end = ms[s + months][1];
    const lump = (amount / ms[s][1]) * end;
    let units = 0;
    for (let k = 0; k < months; k++) units += amount / months / ms[s + k][1];
    const dca = units * end;
    windows.push({ start: ms[s][0], lump, dca, avgCost: (amount / units) });
  }
  const lumpWins = windows.filter((w) => w.lump > w.dca).length;
  return {
    windows,
    lumpWinShare: windows.length ? lumpWins / windows.length : null,
    avgLump: windows.reduce((a, w) => a + w.lump, 0) / (windows.length || 1),
    avgDca: windows.reduce((a, w) => a + w.dca, 0) / (windows.length || 1),
  };
}

/**
 * Falls of at least `threshold` from a peak (0.2 = the usual definition of a bear market).
 * Returns each episode's peak, trough, depth and recovery date (null if not yet recovered).
 */
export function bigFalls(series, threshold = 0.2) {
  const out = [];
  let peakI = 0;
  let troughI = 0;
  let inFall = false;
  for (let i = 1; i < series.length; i++) {
    const p = series[i][1];
    if (!inFall) {
      if (p >= series[peakI][1]) {
        peakI = i;
      } else if (p / series[peakI][1] - 1 <= -threshold) {
        inFall = true;
        troughI = i;
      }
    } else {
      if (p < series[troughI][1]) troughI = i;
      if (p >= series[peakI][1]) {
        out.push(episode(series, peakI, troughI, i));
        inFall = false;
        peakI = i;
      }
    }
  }
  if (inFall) out.push(episode(series, peakI, troughI, null));
  return out;
}

function episode(series, peakI, troughI, recI) {
  return {
    peak: series[peakI][0],
    trough: series[troughI][0],
    depth: series[troughI][1] / series[peakI][1] - 1,
    recovered: recI == null ? null : series[recI][0],
  };
}

/**
 * Days where the fast average crosses the slow one.
 * rows: [[date, price, fast, slow], ...]. A "golden" cross is fast moving above slow, "death" the reverse.
 * Each cross records the return over the next `ahead` rows (null if not enough data yet).
 */
export function maCrosses(rows, ahead = 60) {
  const out = [];
  for (let i = 1; i < rows.length; i++) {
    const [, , f0, s0] = rows[i - 1];
    const [d, p, f1, s1] = rows[i];
    if ([f0, s0, f1, s1].some((x) => x == null)) continue;
    const before = Math.sign(f0 - s0), after = Math.sign(f1 - s1);
    if (before !== after && after !== 0) {
      const later = rows[i + ahead];
      out.push({ date: d, kind: after > 0 ? "golden" : "death", price: p, next: later ? later[1] / p - 1 : null });
    }
  }
  return out;
}

/** Average forward return over `ahead` rows across all days (the baseline for comparison). */
export function averageForward(rows, ahead = 60) {
  let sum = 0, n = 0;
  for (let i = 0; i + ahead < rows.length; i++) {
    sum += rows[i + ahead][1] / rows[i][1] - 1;
    n++;
  }
  return n ? sum / n : null;
}

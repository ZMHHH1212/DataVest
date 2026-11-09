// Personal-finance maths for the Tools page. Pure functions, no DOM: tested in frontend/tests/finance.test.mjs.
// Rates are yearly and given as fractions (0.05 = 5%). Saving happens at the end of each month.

/** Monthly rate equivalent to a yearly rate, so 12 months of compounding give exactly the yearly rate. */
export function monthlyRate(annual) {
  return (1 + annual) ** (1 / 12) - 1;
}

/**
 * Grow a starting amount plus a monthly saving.
 * Returns one row per year (year 0 = today): total value, money put in, growth,
 * and the value in today's money after inflation.
 */
export function growth({ start = 0, monthly = 0, annualRate = 0, years = 10, inflation = 0 }) {
  const r = monthlyRate(annualRate);
  let value = start;
  let paidIn = start;
  const rows = [{ year: 0, value, paidIn, growth: 0, realValue: value }];
  for (let m = 1; m <= Math.round(years * 12); m++) {
    value = value * (1 + r) + monthly;
    paidIn += monthly;
    if (m % 12 === 0) {
      const year = m / 12;
      rows.push({ year, value, paidIn, growth: value - paidIn, realValue: value / (1 + inflation) ** year });
    }
  }
  return rows;
}

/** Monthly saving needed to reach `goal` in `years`, starting from `start`. Never negative. */
export function monthlyNeeded({ goal, start = 0, annualRate = 0, years }) {
  const n = Math.round(years * 12);
  if (n <= 0) return Math.max(goal - start, 0);
  const r = monthlyRate(annualRate);
  const grownStart = start * (1 + r) ** n;
  const remaining = goal - grownStart;
  if (remaining <= 0) return 0;
  return r === 0 ? remaining / n : (remaining * r) / ((1 + r) ** n - 1);
}

/** Months until `goal` is reached, or null if it never is within `maxMonths`. */
export function monthsToGoal({ goal, start = 0, monthly = 0, annualRate = 0, maxMonths = 1200 }) {
  if (start >= goal) return 0;
  const r = monthlyRate(annualRate);
  let value = start;
  for (let m = 1; m <= maxMonths; m++) {
    value = value * (1 + r) + monthly;
    if (value >= goal) return m;
  }
  return null;
}

/** Same monthly saving, starting now vs `delayYears` later, both stopping at `endAge`. */
export function costOfWaiting({ monthly, annualRate, ageNow, delayYears, endAge }) {
  const now = growth({ monthly, annualRate, years: Math.max(endAge - ageNow, 0) }).at(-1);
  const later = growth({ monthly, annualRate, years: Math.max(endAge - ageNow - delayYears, 0) }).at(-1);
  return {
    startNow: now.value,
    startLater: later.value,
    paidInNow: now.paidIn,
    paidInLater: later.paidIn,
    difference: now.value - later.value,
  };
}

// Hong Kong MPF mandatory contribution for monthly-paid employees.
// Source: MPFA, "Mandatory contributions: employees" (page reviewed 30 Apr 2026).
// Higher levels (HK$10,500 / HK$40,000) were proposed in 2026 but are not yet law.
export const MPF = { rate: 0.05, minIncome: 7100, maxIncome: 30000 };

/** Employee's monthly MPF contribution on a monthly relevant income in HK$. */
export function mpfEmployee(income) {
  if (income < MPF.minIncome) return 0;
  return Math.min(income, MPF.maxIncome) * MPF.rate;
}

/** 50/30/20 budget on take-home pay (after MPF and tax): needs, wants, savings. */
export function budget503020(takeHome) {
  return { needs: takeHome * 0.5, wants: takeHome * 0.3, savings: takeHome * 0.2 };
}

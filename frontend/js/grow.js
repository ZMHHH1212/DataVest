// "What $1,000 became": pure maths for the home page tool (tested in tests/grow.test.mjs).

/**
 * Grow an amount through a price series from index `start` to the end.
 * rows: [[date, close, adjClose?], ...]; the adjusted close (dividends included) is used when present.
 * Returns { dates, values, end, total, years, perYear, worst: { depth, peak, trough } }.
 */
export function growFrom(rows, start = 0, amount = 1000) {
  const px = (r) => (r[2] ?? r[1]);
  const slice = rows.slice(Math.max(0, start)).filter((r) => px(r) > 0);
  if (slice.length < 2) return null;
  const base = px(slice[0]);
  const dates = slice.map((r) => r[0]);
  const values = slice.map((r) => (amount * px(r)) / base);
  const end = values.at(-1);
  const total = end / amount - 1;
  const years = (new Date(dates.at(-1)) - new Date(dates[0])) / (365.25 * 864e5);
  const perYear = years > 0 ? (1 + total) ** (1 / years) - 1 : 0;

  // worst fall from a previous high, and where it happened
  let peakI = 0, worst = { depth: 0, peak: 0, trough: 0 };
  values.forEach((v, i) => {
    if (v > values[peakI]) peakI = i;
    const depth = v / values[peakI] - 1;
    if (depth < worst.depth) worst = { depth, peak: peakI, trough: i };
  });
  return { dates, values, end, total, years, perYear, worst };
}

/** Index of the first row on or after an ISO date (or the last row). */
export function indexOnOrAfter(rows, iso) {
  const i = rows.findIndex((r) => r[0] >= iso);
  return i < 0 ? rows.length - 1 : i;
}

import test from "node:test";
import assert from "node:assert/strict";
import * as v from "../js/invest.js";

const close = (a, b, tol = 1e-6) => assert.ok(Math.abs(a - b) <= tol, `${a} vs ${b}`);

test("holding-period return includes dividends", () => {
  close(v.holdingPeriodReturn(50, 55, 2), 0.14);
});

test("annualise a 2-year 21% return to 10%", () => {
  close(v.annualise(0.21, 2), 0.1);
});

test("effective annual rate with monthly compounding", () => {
  close(v.effectiveAnnualRate(0.12, 12), 1.01 ** 12 - 1);
});

test("portfolio return is the weighted average", () => {
  close(v.portfolioReturn([{ weight: 60, ret: 0.1 }, { weight: 40, ret: -0.05 }]), 0.04);
});

test("HK trade cost on a HK$100,000 buy", () => {
  const c = v.hkTradeCost({ price: 50, shares: 2000, commissionRate: 0.0003, commissionMin: 3 });
  assert.equal(c.value, 100000);
  assert.equal(c.stampDuty, 100);
  assert.equal(c.tradingFee, 5.65);
  assert.equal(c.sfcLevy, 2.7);
  assert.equal(c.afrcLevy, 0.15);
  assert.equal(c.settlement, 4.2);
  assert.equal(c.commission, 30);
  close(c.total, 142.7, 1e-9);
});

test("stamp duty rounds up to the next dollar and minimum commission applies", () => {
  const c = v.hkTradeCost({ price: 10.05, shares: 100, commissionRate: 0.0003, commissionMin: 3 });
  assert.equal(c.stampDuty, 2); // 1.005 rounds up
  assert.equal(c.commission, 3);
});

test("break-even rise covers both sides", () => {
  const be = v.breakEvenRise({ price: 50, shares: 2000, commissionRate: 0.0003, commissionMin: 3 });
  close(be, (142.7 * 2) / 100000, 1e-9);
});

test("time value of money identities", () => {
  close(v.presentValue(v.futureValue(1000, 0.05, 10), 0.05, 10), 1000);
  close(v.futureValueAnnuity(100, 0.05, 3), 315.25);
  close(v.futureValueAnnuity(100, 0.05, 3, true), 315.25 * 1.05);
  close(v.presentValueAnnuity(100, 0.05, 3), 100 / 1.05 + 100 / 1.05 ** 2 + 100 / 1.05 ** 3);
  close(v.presentValueAnnuity(100, 0, 3), 300);
  close(v.presentValuePerpetuity(5, 0.04), 125);
  close(v.presentValueGrowingPerpetuity(5, 0.08, 0.03), 100);
  assert.equal(v.presentValueGrowingPerpetuity(5, 0.03, 0.05), Infinity);
});

test("a long annuity approaches the perpetuity value", () => {
  close(v.presentValueAnnuity(5, 0.04, 2000), v.presentValuePerpetuity(5, 0.04), 1e-6);
});

test("Gordon growth model", () => {
  close(v.gordonValue({ d0: 2, r: 0.09, g: 0.04 }), (2 * 1.04) / 0.05);
  assert.equal(v.gordonValue({ d0: 2, r: 0.04, g: 0.05 }), Infinity);
});

test("two-stage model equals Gordon when both stages grow alike", () => {
  const two = v.twoStageValue({ d0: 2, r: 0.09, g1: 0.04, n: 5, g2: 0.04 });
  close(two.value, v.gordonValue({ d0: 2, r: 0.09, g: 0.04 }), 1e-9);
  const fast = v.twoStageValue({ d0: 2, r: 0.09, g1: 0.12, n: 5, g2: 0.04 });
  assert.ok(fast.value > two.value);
});

test("sensitivity grid moves the right way", () => {
  const grid = v.gordonGrid({ d0: 1, rs: [0.08, 0.1], gs: [0.02, 0.04] });
  assert.ok(grid[0][1] > grid[0][0]); // more growth, higher value
  assert.ok(grid[0][0] > grid[1][0]); // higher required return, lower value
});

test("multiples", () => {
  assert.equal(v.priceToEarnings(30, 2), 15);
  assert.equal(v.priceToEarnings(30, -1), null);
  assert.equal(v.priceToBook(30, 20), 1.5);
});

function series(prices, start = "2024-01-01") {
  const d = new Date(start);
  return prices.map((p, i) => {
    const x = new Date(d);
    x.setDate(x.getDate() + i);
    return [x.toISOString().slice(0, 10), p];
  });
}

test("month starts", () => {
  const s = [["2024-01-02", 1], ["2024-01-03", 2], ["2024-02-01", 3], ["2024-03-04", 4]];
  assert.deepEqual(v.monthStarts(s).map((r) => r[0]), ["2024-01-02", "2024-02-01", "2024-03-04"]);
});

test("rising market: lump sum beats DCA; falling market: DCA wins", () => {
  const months = (ps) => ps.map((p, i) => [`2024-${String(i + 1).padStart(2, "0")}-01`, p]);
  const up = v.dcaVsLump(months([100, 110, 120, 130, 140]), 3, 300);
  assert.equal(up.lumpWinShare, 1);
  const down = v.dcaVsLump(months([140, 130, 120, 110, 100]), 3, 300);
  assert.equal(down.lumpWinShare, 0);
  // DCA's average cost is the harmonic mean of the prices paid
  close(down.windows[0].avgCost, 3 / (1 / 140 + 1 / 130 + 1 / 120));
});

test("big falls: depth, trough and recovery", () => {
  const s = series([100, 90, 70, 75, 60, 80, 101, 95, 120, 90]);
  const f = v.bigFalls(s, 0.2);
  assert.equal(f.length, 2);
  close(f[0].depth, -0.4);
  assert.equal(f[0].trough, s[4][0]);
  assert.equal(f[0].recovered, s[6][0]);
  close(f[1].depth, -0.25);
  assert.equal(f[1].recovered, null);
});

test("moving-average crosses and their forward returns", () => {
  const rows = [
    ["d1", 10, 1, 2], ["d2", 11, 3, 2], ["d3", 12, 3, 2], ["d4", 9, 1, 2], ["d5", 8, 1, 2],
  ];
  const x = v.maCrosses(rows, 2);
  assert.deepEqual(x.map((c) => [c.date, c.kind]), [["d2", "golden"], ["d4", "death"]]);
  close(x[0].next, 9 / 11 - 1);
  assert.equal(x[1].next, null);
  close(v.averageForward([["a", 10], ["b", 11], ["c", 12.1]], 1), 0.1);
});

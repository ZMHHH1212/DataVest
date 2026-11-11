import test from "node:test";
import assert from "node:assert/strict";
import * as p from "../js/portfolio.js";

const close = (a, b, tol = 1e-6) => assert.ok(Math.abs(a - b) <= tol, `${a} vs ${b}`);

test("week end is the Friday of that week", () => {
  assert.equal(p.weekEnd("2026-11-09"), "2026-11-13"); // Monday
  assert.equal(p.weekEnd("2026-11-13"), "2026-11-13"); // Friday
  assert.equal(p.weekEnd("2026-11-14"), "2026-11-20"); // Saturday -> next Friday
});

test("weekly alignment carries prices forward and waits for every asset", () => {
  const w = p.weeklyPrices({
    A: [["2026-01-05", 10], ["2026-01-12", 11], ["2026-01-19", 12]],
    B: [["2026-01-13", 20], ["2026-01-21", 21]],
  });
  assert.deepEqual(w.dates, ["2026-01-16", "2026-01-23"]);
  assert.deepEqual(w.prices, [[11, 20], [12, 21]]);
});

test("two-asset minimum variance matches the formula", () => {
  const cov = [[0.04, 0.006], [0.006, 0.01]];
  const w = p.optimise([0.01, 0.01], cov, "minvar");
  const w1 = (0.01 - 0.006) / (0.04 + 0.01 - 2 * 0.006);
  close(w[0], w1, 1e-3);
});

test("max Sharpe with uncorrelated assets weights by mean / variance", () => {
  const mu = [0.002, 0.001], cov = [[0.0004, 0], [0, 0.0001]];
  const w = p.optimise(mu, cov, "maxsharpe");
  const raw = [0.002 / 0.0004, 0.001 / 0.0001];
  close(w[0], raw[0] / (raw[0] + raw[1]), 1e-3);
});

test("weight cap is respected", () => {
  const w = p.optimise([0.01, 0.001, 0.001], [[0.01, 0, 0], [0, 0.01, 0], [0, 0, 0.01]], "maxsharpe", 0.5);
  assert.ok(Math.max(...w) <= 0.5 + 1e-9);
  close(w.reduce((a, b) => a + b, 0), 1);
});

test("risk contributions sum to one; equal for identical uncorrelated assets", () => {
  const rc = p.riskContributions([0.5, 0.5], [[0.04, 0], [0, 0.04]]);
  close(rc[0], 0.5);
  close(p.riskContributions([0.2, 0.3, 0.5], [[0.04, 0.01, 0], [0.01, 0.09, 0.02], [0, 0.02, 0.01]]).reduce((a, b) => a + b, 0), 1);
});

test("diversification ratio is 1 for perfectly correlated assets and higher otherwise", () => {
  close(p.diversificationRatio([0.5, 0.5], [[0.04, 0.04], [0.04, 0.04]]), 1);
  close(p.diversificationRatio([0.5, 0.5], [[0.04, 0], [0, 0.04]]), Math.SQRT2);
});

test("buy and hold vs rebalancing", () => {
  const dates = ["2026-01-02", "2026-01-30", "2026-02-06", "2026-02-27"];
  const prices = [[100, 100], [200, 100], [200, 100], [100, 100]];
  const hold = p.backtest(prices, dates, [0.5, 0.5], "none");
  assert.deepEqual(hold, [1, 1.5, 1.5, 1]);
  const mon = p.backtest(prices, dates, [0.5, 0.5], "monthly");
  // rebalanced to 50/50 at 1.5 in February, then asset A halves: 0.75 * 0.5 + 0.75 = 1.125
  close(mon.at(-1), 1.125);
});

test("curve metrics", () => {
  const m = p.curveMetrics([1, 1.1, 0.88, 1.21], 1);
  close(m.total, 0.21);
  close(m.maxDrawdown, 0.88 / 1.1 - 1);
  close(m.cagr, 1.21 ** (1 / 3) - 1);
});

test("random weights are valid and deterministic", () => {
  const a = p.randomWeights(5, p.rng(7)), b = p.randomWeights(5, p.rng(7));
  assert.deepEqual(a, b);
  close(a.reduce((x, y) => x + y, 0), 1);
  assert.ok(a.every((x) => x >= 0));
});

test("stats and covariance", () => {
  const rets = [[0.01, 0.02], [0.03, -0.02], [-0.01, 0.0]];
  const cov = p.covMatrix(rets);
  close(cov[0][1], cov[1][0]);
  const s = p.stats([1, 0], p.meanVector(rets), cov, 1);
  close(s.ret, 0.01);
  close(s.vol, Math.sqrt(cov[0][0]));
});

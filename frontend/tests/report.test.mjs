import test from "node:test";
import assert from "node:assert/strict";
import { drawdownSeries, deepest } from "../js/report.js";

const close = (a, b, tol = 1e-12) => assert.ok(Math.abs(a - b) <= tol, `${a} vs ${b}`);

test("drawdown is zero at new highs and measured from the running peak", () => {
  const dd = drawdownSeries([100, 120, 90, 60, 130, 117]);
  [0, 0, -0.25, -0.5, 0, -0.1].forEach((v, i) => close(dd[i], v));
});

test("gaps stay gaps and do not reset the peak", () => {
  const dd = drawdownSeries([100, null, 80, 100]);
  assert.equal(dd[1], null);
  close(dd[2], -0.2);
  close(dd[3], 0);
});

test("deepest finds the worst point, and a market that only rose has none", () => {
  assert.deepEqual(deepest([100, 120, 90, 60, 130]), { value: -0.5, index: 3 });
  assert.deepEqual(deepest([100, 101, 102]), { value: 0, index: -1 });
});

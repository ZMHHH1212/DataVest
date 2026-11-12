import test from "node:test";
import assert from "node:assert/strict";
import { growFrom, indexOnOrAfter } from "../js/grow.js";

const rows = [
  ["2020-01-01", 100, 100],
  ["2020-07-01", 120, 120],
  ["2021-01-01", 90, 90],   // 25% below the 120 high
  ["2021-07-01", 130, 130],
  ["2022-01-01", 121, 121],
];

test("growth uses the adjusted close and scales the amount", () => {
  const g = growFrom(rows, 0, 1000);
  assert.equal(g.values[0], 1000);
  assert.ok(Math.abs(g.end - 1210) < 1e-9);
  assert.ok(Math.abs(g.total - 0.21) < 1e-9);
});

test("the yearly rate compounds back to the total", () => {
  const g = growFrom(rows, 0, 1000);
  assert.ok(Math.abs((1 + g.perYear) ** g.years - 1.21) < 1e-9);
  assert.ok(g.years > 1.99 && g.years < 2.01);
});

test("the worst fall is measured from the previous high", () => {
  const g = growFrom(rows, 0, 1000);
  assert.ok(Math.abs(g.worst.depth + 0.25) < 1e-9);
  assert.equal(g.dates[g.worst.peak], "2020-07-01");
  assert.equal(g.dates[g.worst.trough], "2021-01-01");
});

test("starting later rebases to the new first price", () => {
  const g = growFrom(rows, 2, 1000);
  assert.ok(Math.abs(g.end - (1000 * 121) / 90) < 1e-9);
  assert.ok(Math.abs(g.worst.depth - (121 / 130 - 1)) < 1e-12);
});

test("falls back to the close when there is no adjusted close", () => {
  const g = growFrom([["2020-01-01", 10], ["2021-01-01", 15]], 0, 1000);
  assert.equal(g.end, 1500);
  assert.equal(g.worst.depth, 0);
});

test("too few rows gives nothing, and dates map to indexes", () => {
  assert.equal(growFrom(rows, 4), null);
  assert.equal(indexOnOrAfter(rows, "2020-08-01"), 2);
  assert.equal(indexOnOrAfter(rows, "2030-01-01"), 4);
});

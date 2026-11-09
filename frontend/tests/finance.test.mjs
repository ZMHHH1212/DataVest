import test from "node:test";
import assert from "node:assert/strict";
import * as f from "../js/finance.js";

const close = (a, b, tol = 0.01) => assert.ok(Math.abs(a - b) <= tol, `${a} vs ${b}`);

test("monthly rate compounds back to the yearly rate", () => {
  close((1 + f.monthlyRate(0.07)) ** 12 - 1, 0.07, 1e-12);
});

test("a lump sum grows by the yearly rate each year", () => {
  const rows = f.growth({ start: 1000, annualRate: 0.1, years: 2 });
  close(rows[1].value, 1100);
  close(rows[2].value, 1210);
  assert.equal(rows[2].paidIn, 1000);
});

test("saving with no return just adds up", () => {
  const last = f.growth({ monthly: 500, years: 3 }).at(-1);
  assert.equal(last.value, 18000);
  assert.equal(last.growth, 0);
});

test("monthly saving matches the annuity formula", () => {
  const r = f.monthlyRate(0.05), n = 120;
  const expected = 100 * (((1 + r) ** n - 1) / r);
  close(f.growth({ monthly: 100, annualRate: 0.05, years: 10 }).at(-1).value, expected, 1e-6);
});

test("inflation shrinks the value in today's money", () => {
  const last = f.growth({ start: 1000, years: 10, inflation: 0.02 }).at(-1);
  close(last.realValue, 1000 / 1.02 ** 10);
});

test("monthlyNeeded and growth agree", () => {
  const pay = f.monthlyNeeded({ goal: 100000, start: 5000, annualRate: 0.04, years: 8 });
  close(f.growth({ start: 5000, monthly: pay, annualRate: 0.04, years: 8 }).at(-1).value, 100000, 0.01);
  assert.equal(f.monthlyNeeded({ goal: 1000, start: 2000, annualRate: 0.03, years: 5 }), 0);
  close(f.monthlyNeeded({ goal: 1200, years: 1 }), 100);
});

test("monthsToGoal", () => {
  assert.equal(f.monthsToGoal({ goal: 1000, monthly: 100 }), 10);
  assert.equal(f.monthsToGoal({ goal: 1000, start: 1000 }), 0);
  assert.equal(f.monthsToGoal({ goal: 1000, monthly: 0 }), null);
});

test("waiting costs more than the money not saved", () => {
  const w = f.costOfWaiting({ monthly: 1000, annualRate: 0.06, ageNow: 22, delayYears: 10, endAge: 65 });
  assert.ok(w.startNow > w.startLater);
  assert.equal(w.paidInNow - w.paidInLater, 120000);
  assert.ok(w.difference > 120000 * 3); // growth makes the gap several times the extra money paid in
});

test("MPF employee contribution follows the thresholds", () => {
  assert.equal(f.mpfEmployee(7000), 0);
  assert.equal(f.mpfEmployee(7100), 355);
  assert.equal(f.mpfEmployee(20000), 1000);
  assert.equal(f.mpfEmployee(50000), 1500);
});

test("50/30/20 adds up", () => {
  const b = f.budget503020(20000);
  assert.deepEqual(b, { needs: 10000, wants: 6000, savings: 4000 });
});

import test from "node:test";
import assert from "node:assert/strict";
import { rng, noise3, spherePoints } from "../js/particles.js";

test("the random generator is repeatable and stays in [0, 1)", () => {
  const a = rng(3), b = rng(3);
  for (let i = 0; i < 100; i++) {
    const x = a();
    assert.equal(x, b());
    assert.ok(x >= 0 && x < 1);
  }
});

test("noise is smooth and bounded", () => {
  for (let i = 0; i < 200; i++) {
    const v = noise3(i * 0.37, i * 0.11, i * 0.73);
    assert.ok(v >= 0 && v <= 1);
  }
  const d = Math.abs(noise3(1.5, 2.5, 3.5) - noise3(1.501, 2.5, 3.5));
  assert.ok(d < 0.01);
});

test("sphere points: right count, same every time, within the shell", () => {
  const p = spherePoints(2000, 7);
  assert.equal(p.length, 2000);
  assert.deepEqual(p.slice(0, 5), spherePoints(2000, 7).slice(0, 5));
  for (const q of p) {
    const r = Math.hypot(q.x, q.y, q.z);
    assert.ok(r > 0.25 && r < 1.15, `radius ${r}`);
    assert.ok(q.t >= 0 && q.t <= 1);
  }
  const shell = p.filter((q) => Math.hypot(q.x, q.y, q.z) > 0.9).length / p.length;
  assert.ok(shell > 0.7, "most points sit on the surface");
});

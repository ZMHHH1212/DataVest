import test from "node:test";
import assert from "node:assert/strict";
import { rotate, project, ramp } from "../js/surface3d.js";

const close = (a, b, tol = 1e-9) => assert.ok(Math.abs(a - b) <= tol, `${a} vs ${b}`);

test("rotation keeps distances and turns a quarter turn correctly", () => {
  const [x, y, z] = rotate([1, 0, 0], Math.PI / 2, 0);
  close(x, 0); close(y, 0); close(z, 1);
  const p = rotate([0.3, -0.7, 0.2], 0.9, 0.4);
  close(Math.hypot(...p), Math.hypot(0.3, -0.7, 0.2));
});

test("the origin projects to the screen centre; height goes up the screen", () => {
  const cam = { yaw: 0.3, pitch: 0.2, scale: 100, cx: 200, cy: 150 };
  const [sx, sy] = project([0, 0, 0], cam);
  close(sx, 200); close(sy, 150);
  assert.ok(project([0, 1, 0], { ...cam, yaw: 0, pitch: 0 })[1] < 150);
});

test("colour ramp ends and clamping", () => {
  assert.deepEqual(ramp(0), [29, 59, 92]);
  assert.deepEqual(ramp(1), [255, 226, 168]);
  assert.deepEqual(ramp(-1), ramp(0));
  assert.deepEqual(ramp(2), ramp(1));
});

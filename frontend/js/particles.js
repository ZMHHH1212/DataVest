// A glowing particle sphere on a 2D canvas (no libraries): patchy, slowly turning, drag to spin,
// and the dots drift away from the mouse. Used as the home page opening.

/** Small seeded random number generator, so the sphere looks the same on every visit. */
export function rng(seed = 7) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// smooth 3D value noise in [0, 1]
function hash(x, y, z) {
  let h = (x * 374761393 + y * 668265263 + z * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}
const fade = (t) => t * t * (3 - 2 * t);
export function noise3(x, y, z) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
  const u = fade(x - xi), v = fade(y - yi), w = fade(z - zi);
  const L = (a, b, t) => a + (b - a) * t;
  const c = (dx, dy, dz) => hash(xi + dx, yi + dy, zi + dz);
  return L(
    L(L(c(0, 0, 0), c(1, 0, 0), u), L(c(0, 1, 0), c(1, 1, 0), u), v),
    L(L(c(0, 0, 1), c(1, 0, 1), u), L(c(0, 1, 1), c(1, 1, 1), u), v),
    w,
  );
}

/**
 * Points on a patchy sphere: dense clusters and thin gaps (from noise), a few inside for depth.
 * Each point: { x, y, z, t } where t in [0, 1] picks its colour. Radius stays within about 0.3–1.1.
 */
export function spherePoints(n, seed = 7) {
  const r = rng(seed), pts = [];
  let guard = 0;
  while (pts.length < n && guard++ < n * 40) {
    // random direction (normalised gaussian)
    const g = () => Math.sqrt(-2 * Math.log(r() + 1e-12)) * Math.cos(2 * Math.PI * r());
    let x = g(), y = g(), z = g();
    const len = Math.hypot(x, y, z) || 1;
    x /= len; y /= len; z /= len;
    const nz = noise3(x * 2.6 + 5, y * 2.6 + 5, z * 2.6 + 5);
    const inner = r() < 0.12;
    if (!inner && r() > 0.05 + 0.95 * fade(Math.min(1, Math.max(0, (nz - 0.38) / 0.3)))) continue;
    const rad = inner ? 0.3 + 0.65 * r() : 0.94 + 0.12 * nz + 0.05 * (r() - 0.5);
    const t = inner ? 0.7 + 0.3 * r() : nz * 1.25 - 0.15 + 0.15 * (r() - 0.5);
    pts.push({ x: x * rad, y: y * rad, z: z * rad, t: Math.min(1, Math.max(0, t)) });
  }
  return pts;
}

/** Mount on a canvas. opts: { count, colors: [[r,g,b], …] from cool to warm }. Returns { destroy }. */
export function mountSphere(canvas, opts = {}) {
  const ctx = canvas.getContext("2d");
  const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  const pts = spherePoints(opts.count ?? 5000, opts.seed ?? 7);
  const colors = opts.colors ?? [[44, 198, 166], [227, 237, 220], [246, 214, 178], [242, 169, 59]];
  const BUCKETS = 12;
  const fills = Array.from({ length: BUCKETS }, (_, i) => {
    const t = i / (BUCKETS - 1), k = t * (colors.length - 1), j = Math.min(colors.length - 2, Math.floor(k)), u = k - j;
    const c = colors[j].map((v, q) => Math.round(v + (colors[j + 1][q] - v) * u));
    return `rgb(${c[0]},${c[1]},${c[2]})`;
  });
  // sort by colour bucket once, so each frame changes fillStyle only 12 times
  pts.forEach((p) => { p.b = Math.round(p.t * (BUCKETS - 1)); p.ox = 0; p.oy = 0; });
  pts.sort((a, b) => a.b - b.b);

  const view = { yaw: 0.4, pitch: 0.28, spin: !reduce };
  let w = 0, h = 0, dpr = 1, raf = 0, last = 0, visible = true;
  let mouse = null, drag = null;

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    const r = canvas.getBoundingClientRect();
    w = r.width; h = r.height;
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    draw();
  }

  function draw() {
    if (!w) return;
    ctx.clearRect(0, 0, w, h);
    const R = Math.min(w, h) * (opts.size ?? 0.36), cx = w * (opts.cx ?? 0.5), cy = h * (opts.cy ?? 0.48);
    const cyw = Math.cos(view.yaw), syw = Math.sin(view.yaw), cp = Math.cos(view.pitch), sp = Math.sin(view.pitch);
    const dist = 3.2;
    // soft warm light inside the sphere
    const glow = ctx.createRadialGradient(cx, cy + R * 0.15, 0, cx, cy, R * 1.15);
    glow.addColorStop(0, "rgba(246, 214, 178, 0.16)");
    glow.addColorStop(0.5, "rgba(242, 169, 59, 0.05)");
    glow.addColorStop(1, "rgba(242, 169, 59, 0)");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, w, h);
    ctx.globalCompositeOperation = "lighter";
    let bucket = -1;
    for (const p of pts) {
      const x1 = p.x * cyw - p.z * syw, z1 = p.x * syw + p.z * cyw;
      const y2 = p.y * cp - z1 * sp, z2 = p.y * sp + z1 * cp;
      const f = dist / (dist + z2);
      let sx = cx + x1 * R * f, sy = cy - y2 * R * f;
      // drift away from the mouse, easing back when it leaves
      let tx = 0, ty = 0;
      if (mouse) {
        const dx = sx - mouse.x, dy = sy - mouse.y, d = Math.hypot(dx, dy), rad = R * 0.45;
        if (d < rad && d > 0.01) {
          const push = (1 - d / rad) ** 2 * R * 0.22;
          tx = (dx / d) * push; ty = (dy / d) * push;
        }
      }
      p.ox += (tx - p.ox) * 0.12; p.oy += (ty - p.oy) * 0.12;
      sx += p.ox; sy += p.oy;
      if (p.b !== bucket) { bucket = p.b; ctx.fillStyle = fills[bucket]; }
      const front = (1 - z2) / 2; // 0 back … 1 front
      ctx.globalAlpha = 0.14 + 0.66 * front;
      const s = (1.1 + 1.9 * front) * f * (opts.dot ?? 1);
      ctx.fillRect(sx - s / 2, sy - s / 2, s, s);
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
  }

  function loop(t) {
    raf = requestAnimationFrame(loop);
    const dt = last ? Math.min(t - last, 50) : 16;
    last = t;
    if (!visible) return;
    if (view.spin && !drag) view.yaw += dt * 0.00011;
    if (view.spin || mouse || drag) draw();
  }

  const pos = (e) => { const r = canvas.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
  const onMove = (e) => {
    if (drag) {
      view.yaw = drag.yaw + (e.clientX - drag.x) * 0.006;
      view.pitch = Math.min(1.2, Math.max(-1.2, drag.pitch + (e.clientY - drag.y) * 0.004));
    }
    if (e.pointerType === "mouse") mouse = pos(e);
    if (reduce) draw();
  };
  const onDown = (e) => { drag = { x: e.clientX, y: e.clientY, yaw: view.yaw, pitch: view.pitch }; canvas.setPointerCapture(e.pointerId); };
  const onUp = () => { drag = null; };
  const onLeave = () => { mouse = null; if (reduce) draw(); };
  canvas.addEventListener("pointermove", onMove);
  canvas.addEventListener("pointerdown", onDown);
  canvas.addEventListener("pointerup", onUp);
  canvas.addEventListener("pointercancel", onUp);
  canvas.addEventListener("pointerleave", onLeave);

  const ro = new ResizeObserver(resize);
  ro.observe(canvas);
  const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; });
  io.observe(canvas);
  resize();
  raf = requestAnimationFrame(loop);

  return {
    destroy() {
      cancelAnimationFrame(raf); ro.disconnect(); io.disconnect();
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerdown", onDown);
      canvas.removeEventListener("pointerup", onUp);
      canvas.removeEventListener("pointercancel", onUp);
      canvas.removeEventListener("pointerleave", onLeave);
    },
  };
}

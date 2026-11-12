// A small dependency-free 3D surface renderer on a 2D canvas.
// Rows = markets (one ribbon each), columns = time, height = volatility. Drag to rotate, hover for values.

/** Rotate a point (x, y, z) by yaw (around the vertical axis) then pitch (around the horizontal axis). */
export function rotate([x, y, z], yaw, pitch) {
  const cy = Math.cos(yaw), sy = Math.sin(yaw);
  const x1 = x * cy - z * sy, z1 = x * sy + z * cy;
  const cp = Math.cos(pitch), sp = Math.sin(pitch);
  return [x1, y * cp - z1 * sp, y * sp + z1 * cp];
}

/** Perspective projection onto the screen. Returns [sx, sy, depth]. */
export function project(p, { yaw, pitch, scale, cx, cy, dist = 4 }) {
  const [x, y, z] = rotate(p, yaw, pitch);
  const f = dist / (dist + z);
  return [cx + x * scale * f, cy - y * scale * f, z];
}

/** Colour ramp for 0..1: deep blue → blue → amber → pale amber. */
export function ramp(t) {
  const stops = [[0, [29, 59, 92]], [0.4, [77, 155, 240]], [0.75, [242, 169, 59]], [1, [255, 226, 168]]];
  t = Math.min(1, Math.max(0, t));
  for (let i = 1; i < stops.length; i++) {
    if (t <= stops[i][0]) {
      const [t0, c0] = stops[i - 1], [t1, c1] = stops[i];
      const u = (t - t0) / (t1 - t0);
      return c0.map((c, k) => Math.round(c + (c1[k] - c) * u));
    }
  }
  return stops.at(-1)[1];
}

function inside(px, py, poly) {
  let hit = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if ((yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) hit = !hit;
  }
  return hit;
}

/**
 * Mount the surface.
 * opts: { rows: [{label, values}], dates: [iso], formatDate, colors: {ink, soft, line, amber, paper}, highlight,
 *         mode: "fill" (colour ramp, default) | "line" (engraving: opaque paper ribbons, ink edges and hatching) }
 * Returns { setHighlight(label), destroy() }.
 */
export function mountSurface(canvas, tip, opts) {
  const ctx = canvas.getContext("2d");
  const { rows, dates } = opts;
  const lineArt = opts.mode === "line";
  const nR = rows.length, nC = dates.length;
  const all = rows.flatMap((r) => r.values).filter((v) => v != null);
  const vmax = Math.max(...all), vmin = Math.min(...all);
  const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  const z0 = opts.zoom ?? 1; // starting zoom (smaller on narrow screens so labels fit)
  const view = { yaw: -0.65, pitch: 0.5, zoom: z0, spin: !reduce, highlight: opts.highlight ?? null };
  const home = { yaw: -0.65, pitch: 0.5, zoom: z0 };
  let quads = [];
  let hover = null;
  let raf = 0, last = 0, dragging = null, w = 0, h = 0;

  // world coordinates: x across time [-1.3, 1.3], z across markets [-0.8, 0.8], y height [0, 0.9]
  const X = (c) => -1.3 + (2.6 * c) / (nC - 1);
  const Z = (r) => -0.8 + (1.6 * r) / Math.max(nR - 1, 1);
  const Y = (v) => (v == null ? 0 : (0.75 * v) / (vmax || 1)); // height from zero, so ribbons compare honestly

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const r = canvas.getBoundingClientRect();
    w = r.width; h = r.height;
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    draw();
  }

  function cam() {
    return { yaw: view.yaw, pitch: view.pitch, scale: Math.min(w, h * 1.5) * 0.31 * view.zoom, cx: w * (0.5 - (opts.shift ?? 0)), cy: h * 0.7 };
  }

  function draw() {
    if (!w) return;
    const c = cam();
    ctx.clearRect(0, 0, w, h);
    const P = (x, y, z) => project([x, y, z], c);

    // floor grid
    ctx.lineWidth = 1;
    ctx.strokeStyle = opts.colors.line;
    for (let r = 0; r < nR; r++) {
      const a = P(X(0), 0, Z(r)), b = P(X(nC - 1), 0, Z(r));
      ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
    }
    const years = [];
    dates.forEach((d, i) => { if (i === 0 || d.slice(0, 4) !== dates[i - 1].slice(0, 4)) years.push(i); });
    years.forEach((i) => {
      const a = P(X(i), 0, Z(0)), b = P(X(i), 0, Z(nR - 1));
      ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
    });

    // one standing ribbon per market (floor to its volatility line), painted back to front.
    // Markets are separate rows: nothing is drawn "between" two markets.
    quads = [];
    for (let r = 0; r < nR; r++) {
      const vals = rows[r].values;
      for (let col = 0; col < nC - 1; col++) {
        const a = vals[col], b = vals[col + 1];
        if (a == null || b == null) continue;
        const z = Z(r);
        const pts = [P(X(col), 0, z), P(X(col + 1), 0, z), P(X(col + 1), Y(b), z), P(X(col), Y(a), z)];
        const depth = (pts[0][2] + pts[1][2] + pts[2][2] + pts[3][2]) / 4;
        quads.push({ r, col, pts, depth, value: (a + b) / 2 });
      }
    }
    quads.sort((a, b) => b.depth - a.depth);
    for (const q of quads) {
      const hl = view.highlight != null && rows[q.r].label === view.highlight;
      const dim = view.highlight != null && !hl;
      if (lineArt) {
        // hidden-line drawing: the opaque ribbon hides whatever is behind it
        const [a, , c, d] = q.pts;
        ctx.beginPath();
        q.pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
        ctx.closePath();
        ctx.fillStyle = opts.colors.paper;
        ctx.fill();
        ctx.strokeStyle = hl ? opts.colors.amber : opts.colors.ink;
        if (q.col % 2 === 0) {
          ctx.globalAlpha = dim ? 0.25 : 0.55;
          ctx.lineWidth = 0.7;
          ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(d[0], d[1]); ctx.stroke();
        }
        ctx.globalAlpha = dim ? 0.45 : 1;
        ctx.lineWidth = hl ? 2 : 1.25;
        ctx.beginPath(); ctx.moveTo(d[0], d[1]); ctx.lineTo(c[0], c[1]); ctx.stroke();
        ctx.globalAlpha = 1;
        continue;
      }
      const [cr, cg, cb] = ramp((q.value - vmin) / (vmax - vmin || 1));
      ctx.beginPath();
      q.pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
      ctx.closePath();
      ctx.fillStyle = `rgba(${cr},${cg},${cb},${hl ? 0.95 : dim ? 0.55 : 0.8})`;
      ctx.fill();
    }

    // ridge line for each market + labels
    ctx.font = `500 11px ${opts.font || "sans-serif"}`;
    rows.forEach((row, r) => {
      const isH = row.label === view.highlight;
      if (!lineArt) {
      ctx.beginPath();
      let started = false;
      row.values.forEach((v, col) => {
        if (v == null) return;
        const [x, y] = P(X(col), Y(v), Z(r));
        if (!started) { ctx.moveTo(x, y); started = true; } else ctx.lineTo(x, y);
      });
      ctx.strokeStyle = isH ? opts.colors.amber : "rgba(220,230,242,0.28)";
      ctx.lineWidth = isH ? 2 : 1;
      ctx.stroke();
      }
      const [lx, ly] = P(X(nC - 1) + 0.08, 0, Z(r));
      ctx.fillStyle = isH ? opts.colors.amber : opts.colors.soft;
      ctx.fillText(row.label, lx + 4, ly + 4);
    });
    ctx.fillStyle = opts.colors.soft;
    years.forEach((i) => {
      const [x, y] = P(X(i), 0, Z(0) - 0.12);
      ctx.fillText(dates[i].slice(0, 4), x - 12, y + 12);
    });

    // hover marker
    if (hover) {
      ctx.beginPath();
      hover.q.pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
      ctx.closePath();
      ctx.strokeStyle = lineArt ? opts.colors.amber : "#ffffff";
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  }

  function loop(t) {
    raf = requestAnimationFrame(loop);
    const dt = last ? Math.min(t - last, 50) : 16;
    last = t;
    if (view.spin && !dragging) { view.yaw += dt * 0.00012; draw(); }
  }

  function pick(px, py) {
    for (let i = quads.length - 1; i >= 0; i--) if (inside(px, py, quads[i].pts)) return quads[i];
    return null;
  }

  function showTip(e) {
    const rect = canvas.getBoundingClientRect();
    const px = e.clientX - rect.left, py = e.clientY - rect.top;
    const q = pick(px, py);
    hover = q ? { q } : null;
    if (!q) { tip.hidden = true; draw(); return; }
    const row = rows[q.r], v = row.values[q.col];
    tip.innerHTML = opts.tipTemplate
      ? opts.tipTemplate(row.label, opts.formatDate(dates[q.col]), Math.round(v * 100))
      : `${row.label}<br>${opts.formatDate(dates[q.col])}<br>volatility <b>${Math.round(v * 100)}%</b>`;
    tip.hidden = false;
    const tx = Math.min(px + 14, w - tip.offsetWidth - 6), ty = Math.max(py - tip.offsetHeight - 10, 6);
    tip.style.left = `${tx}px`; tip.style.top = `${ty}px`;
    draw();
  }

  const onDown = (e) => { dragging = { x: e.clientX, y: e.clientY, yaw: view.yaw, pitch: view.pitch }; canvas.setPointerCapture(e.pointerId); view.spin = false; opts.onSpin?.(false); tip.hidden = true; };
  const onMove = (e) => {
    if (dragging) {
      view.yaw = dragging.yaw + (e.clientX - dragging.x) * 0.008;
      view.pitch = dragging.pitch + (e.clientY - dragging.y) * 0.006; // free in every direction: a full 360° turn
      draw();
    } else if (e.pointerType === "mouse") showTip(e);
  };
  const onUp = (e) => { if (dragging && Math.abs(e.clientX - dragging.x) + Math.abs(e.clientY - dragging.y) < 4) showTip(e); dragging = null; };
  const onLeave = () => { if (!dragging) { tip.hidden = true; hover = null; draw(); } };
  const onKey = (e) => {
    const k = { ArrowLeft: [-0.12, 0], ArrowRight: [0.12, 0], ArrowUp: [0, -0.08], ArrowDown: [0, 0.08] }[e.key];
    if (!k) return;
    e.preventDefault();
    view.spin = false; opts.onSpin?.(false);
    view.yaw += k[0];
    view.pitch += k[1];
    draw();
  };
  canvas.addEventListener("pointerdown", onDown);
  canvas.addEventListener("pointermove", onMove);
  canvas.addEventListener("pointerup", onUp);
  canvas.addEventListener("pointerleave", onLeave);
  canvas.addEventListener("keydown", onKey);
  const ro = new ResizeObserver(resize);
  ro.observe(canvas);
  resize();
  raf = requestAnimationFrame(loop);

  return {
    setHighlight(label) { view.highlight = label; draw(); },
    zoom(f) { view.zoom = Math.min(2.2, Math.max(0.6, view.zoom * f)); draw(); },
    spin(on) { view.spin = on; },
    reset() { Object.assign(view, home); draw(); },
    destroy() {
      cancelAnimationFrame(raf);
      ro.disconnect();
      canvas.removeEventListener("pointerdown", onDown);
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerup", onUp);
      canvas.removeEventListener("pointerleave", onLeave);
      canvas.removeEventListener("keydown", onKey);
      tip.hidden = true;
    },
  };
}

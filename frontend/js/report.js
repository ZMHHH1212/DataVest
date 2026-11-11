// Helpers for the Insights report page: drawdown maths (pure, tested) and draggable stickers.

/** Fall below the running peak at each point: 0 at a new high, −0.3 means 30% below it. Gaps stay null. */
export function drawdownSeries(values) {
  let peak = -Infinity;
  return values.map((v) => {
    if (v == null) return null;
    peak = Math.max(peak, v);
    return v / peak - 1;
  });
}

/** The deepest point of a drawdown series: { value, index }. */
export function deepest(values) {
  let best = { value: 0, index: -1 };
  drawdownSeries(values).forEach((d, i) => {
    if (d != null && d < best.value) best = { value: d, index: i };
  });
  return best;
}

/**
 * Make every [data-sticker] inside `root` draggable with mouse, pen or touch.
 * Positions live in CSS variables (--dx, --dy) so the sticker keeps its own tilt.
 */
export function mountStickers(root) {
  let z = 10;
  root.querySelectorAll("[data-sticker]").forEach((el) => {
    let start = null;
    el.addEventListener("pointerdown", (e) => {
      if (e.button !== 0) return;
      start = { x: e.clientX, y: e.clientY, dx: parseFloat(el.style.getPropertyValue("--dx")) || 0, dy: parseFloat(el.style.getPropertyValue("--dy")) || 0 };
      el.setPointerCapture(e.pointerId);
      el.classList.add("grab");
      el.style.zIndex = String(++z);
    });
    el.addEventListener("pointermove", (e) => {
      if (!start) return;
      el.style.setProperty("--dx", `${start.dx + e.clientX - start.x}px`);
      el.style.setProperty("--dy", `${start.dy + e.clientY - start.y}px`);
    });
    const end = () => { start = null; el.classList.remove("grab"); };
    el.addEventListener("pointerup", end);
    el.addEventListener("pointercancel", end);
  });
}

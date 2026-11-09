"""Smoke-test the published site in a real browser.

    python scripts/check_site.py https://zmhhh1212.github.io/DataVest/ screenshots/

Opens every page, clicks through the main controls, saves screenshots and
exits non-zero if any page throws a JavaScript error or a chart is missing.
"""
import sys
from pathlib import Path

from playwright.sync_api import sync_playwright

BASE = sys.argv[1].rstrip("/") + "/"
OUT = Path(sys.argv[2] if len(sys.argv) > 2 else "screenshots")
OUT.mkdir(parents=True, exist_ok=True)

PAGES = [
    ("markets", "", ["#chart", "#ddchart"]),
    ("insights", "insights.html", ["#growth", "#scatter", "#rollcorr"]),
    ("signin", "signin.html", []),
    ("analysis", "analysis/01_us_vs_hk_markets.html", []),
]

problems = []
with sync_playwright() as p:
    browser = p.chromium.launch()
    for name, path, canvases in PAGES:
        for label, viewport, scheme in [("desktop", {"width": 1366, "height": 900}, "light"),
                                        ("mobile", {"width": 390, "height": 844}, "dark")]:
            page = browser.new_page(viewport=viewport, color_scheme=scheme)
            errors = []
            page.on("pageerror", lambda e: errors.append(f"page error: {e}"))
            page.on("console", lambda m: errors.append(f"console: {m.text}") if m.type == "error" else None)
            resp = page.goto(BASE + path, wait_until="networkidle")
            if not resp or not resp.ok:
                problems.append(f"{name}: HTTP {resp.status if resp else 'no response'}")
                continue
            page.wait_for_timeout(1000)
            for sel in canvases:
                if not page.evaluate(f"!!(window.Chart && Chart.getChart(document.querySelector('{sel}')))"):
                    errors.append(f"chart {sel} was not drawn")
            if name == "markets" and label == "desktop":
                page.click("[data-range='5Y']")
                page.click("text=Tencent")
                page.wait_for_timeout(500)
            if name == "insights" and label == "desktop":
                page.click("[data-corr=daily]")
                page.click(".stats th button[data-k=cagr]")
            page.screenshot(path=str(OUT / f"{name}-{label}.png"), full_page=True)
            problems += [f"{name} ({label}): {e}" for e in errors]
            page.close()
    browser.close()

if problems:
    print("Problems found:\n  " + "\n  ".join(problems))
    sys.exit(1)
print(f"All pages OK. Screenshots in {OUT}/")

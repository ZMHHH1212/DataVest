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
    ("home", "", []),  # sphere checked below
    ("markets", "markets.html", ["#chart", "#ddchart", "#rsichart"]),  # plus the 3D landscape, checked below
    ("markets-zh", "markets.html?lang=zh", ["#chart", "#ddchart", "#rsichart"]),
    ("insights", "insights.html", ["#growth", "#scatter", "#rollcorr", "#mapchart", "#regchart"]),
    ("models", "models.html", ["#volchart", "#btchart"]),
    ("portfolio", "portfolio.html", ["#g-chart", "#f-chart"]),
    ("tools", "tools.html", ["#g-chart"]),
    ("learn", "learn.html", []),
    ("signin", "signin.html", []),
    ("analysis-index", "analysis/", []),
    ("analysis", "analysis/01_us_vs_hk_markets.html", []),
    ("analysis-vol", "analysis/02_volatility_forecasting.html", []),
    ("analysis-rsi", "analysis/03_does_rsi_work.html", []),
    ("analysis-ml", "analysis/04_machine_learning_volatility.html", []),
    ("analysis-clusters", "analysis/05_clusters_and_regimes.html", []),
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
            if name == "markets-zh":
                if page.evaluate("document.documentElement.lang") != "zh-HK" or "投資" not in page.inner_text("#m-story"):
                    errors.append("Chinese version did not load")
            if name == "home":
                lit = page.evaluate("""() => { const c = document.getElementById('orb'); if (!c || !c.width) return false;
                    const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
                    for (let i = 3; i < d.length; i += 4000) if (d[i] > 0) return true; return false; }""")
                if not lit:
                    errors.append("particle sphere was not drawn")
                if page.inner_text("#s-markets").strip() in ("", "–"):
                    errors.append("home page numbers did not load")
            if name in ("markets", "markets-zh"):
                drawn = page.evaluate("""() => { const c = document.getElementById('surface'); if (!c || !c.width) return false;
                    const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
                    for (let i = 3; i < d.length; i += 4000) if (d[i] > 0) return true; return false; }""")
                if not drawn:
                    errors.append("3D volatility landscape was not drawn")
            if name in ("markets", "markets-zh") and label == "desktop":
                page.click("[data-range='5Y']")
                page.click("[data-overlay=sma50]")
                page.click("[data-overlay=sma200]")
                page.click(".market[data-symbol='0700.HK']")  # watchlist row, not the moving ticker tape
                page.wait_for_timeout(500)
                if "0700" not in page.inner_text("#m-name"):
                    errors.append("Choosing a market from the watchlist did not switch the page")
            if name == "models" and label == "desktop":
                page.click("#vc-pick button >> nth=1")
                page.select_option("#bt-pick", index=0)
            if name == "learn" and label == "desktop":
                # every Stock investing tool should render without errors
                for lesson, sel in [("returns-risk", "#r-out"), ("placing-trade", "#tc-out"), ("price-drivers", "#bm-table"),
                                    ("accounts", "#bs-log"), ("time-value", "#tv-table"), ("valuation", "#gg-out"),
                                    ("technical", "#mc-out"), ("funds", "#if-out"), ("strategies", "#dca-out"), ("behaviour", "#cl-out")]:
                    page.goto(BASE + "learn.html#" + lesson)
                    page.wait_for_timeout(1200)
                    if not page.inner_text(sel).strip():
                        errors.append(f"lesson {lesson}: tool {sel} is empty")
                page.goto(BASE + "learn.html#basics")
                page.wait_for_timeout(500)
                for qi in range(3):
                    page.check(f'input[name="q{qi}"] >> nth=0')
                page.click("#check")
                if "out of 3" not in page.inner_text("#quiz-score"):
                    errors.append("quiz did not score")
            if name == "portfolio" and label == "desktop":
                page.click("#use-minvar")
                page.click("#use-maxsharpe")
                page.select_option("#rebalance", "monthly")
                if not page.inner_text("#o-table").strip():
                    errors.append("out-of-sample table is empty")
            if name == "tools" and label == "desktop":
                page.fill("#g-monthly", "3000")
                page.click("#currency button >> nth=1")
                if "US$" not in page.inner_text("#g-headline"):
                    errors.append("currency switch failed")
            if True:
                # giant display words (page names, footer) must fit the screen once the real fonts have loaded
                page.evaluate("document.fonts.ready")
                for sel in (".mega", ".r-foot .wordmark"):
                    over = page.evaluate("""(sel) => { const el = document.querySelector(sel); if (!el) return 0;
                        const r = document.createRange(); r.selectNodeContents(el); const w = r.getBoundingClientRect().width;
                        return Math.round(w - document.documentElement.clientWidth); }""", sel)
                    if over > 0:
                        errors.append(f"{sel} is {over}px wider than the screen")
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

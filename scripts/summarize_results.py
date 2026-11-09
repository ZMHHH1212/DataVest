"""Print the headline results of the latest build (also used as the GitHub Actions job summary).

    python scripts/summarize_results.py frontend/data
"""
import json
import os
import sys
from pathlib import Path

d = Path(sys.argv[1] if len(sys.argv) > 1 else "frontend/data")
lines = ["## DataVest build results", ""]


def pct(x, nd=1):
    return "–" if x is None else f"{x * 100:+.{nd}f}%"


meta = json.loads((d / "tickers.json").read_text())
names = {t["symbol"]: t["name"] for t in meta["tickers"]}
lines.append(f"Data to **{max(t['last_date'] for t in meta['tickers'])}** for {len(meta['tickers'])} markets.")

if (d / "insights.json").exists():
    ins = json.loads((d / "insights.json").read_text())
    lines += ["", "### Markets (5 years)", "", "| Market | Growth / yr | Volatility | Sharpe | Worst fall |", "|---|---:|---:|---:|---:|"]
    for s, v in sorted(ins["stats"].items(), key=lambda kv: -(kv[1]["sharpe"] or -9)):
        lines.append(f"| {names.get(s, s)} | {pct(v['cagr'])} | {v['volatility'] * 100:.0f}% | {v['sharpe']:.2f} | {pct(v['max_drawdown'], 0)} |")
    i, j = ins["symbols"].index("^HSI"), ins["symbols"].index("^GSPC")
    lines.append(f"\nHang Seng vs S&P 500 correlation: same-day **{ins['corr_daily'][i][j]:.2f}**, weekly **{ins['corr_weekly'][i][j]:.2f}**.")

if (d / "models.json").exists():
    m = json.loads((d / "models.json").read_text())
    lines += ["", "### Volatility forecasting (error vs 'same as last month', lower is better)", "", "| Model | QLIKE vs baseline | Better in |", "|---|---:|---:|"]
    for k, v in sorted(m["pooled"].items(), key=lambda kv: kv[1]["qlike_vs_last_month"] or 0):
        lines.append(f"| {k} | {pct(v['qlike_vs_last_month'], 0)} | {v['beats_last_month']} of {v['markets']} |")
    if m.get("feature_importance"):
        top = ", ".join(f["label"] for f in m["feature_importance"][:3])
        lines.append(f"\nTop ML inputs: {top}.")
    tests = [r for rows in m["rsi_events"].values() for r in rows if r["group"] != "all days" and r["p_value"] is not None]
    sig = sum(r["p_value"] < 0.05 for r in tests)
    wins = sum((s["strategy"]["sharpe"] or -9) > (s["buy_and_hold"]["sharpe"] or -9) for s in m["rsi_strategy"].values())
    lines.append(f"\nRSI: {sig} of {len(tests)} signal tests had p < 0.05. RSI rule beat buy-and-hold on Sharpe in {wins} of {len(m['rsi_strategy'])} markets.")

if (d / "patterns.json").exists():
    pt = json.loads((d / "patterns.json").read_text())
    if pt.get("map"):
        m = pt["map"]
        lines += ["", "### Market map (unsupervised)", "",
                  f"{len(m['stocks'])} stocks, {m['k']} groups. Match with country (ARI): {m['ari_region']:.2f}; with sector: {m['ari_sector']:.2f}. "
                  f"PC1 explains {m['explained'][0] * 100:.0f}% of weekly movement.", ""]
        for g in m["clusters"]:
            names_in = [s["name"] for s in m["stocks"] if s["cluster"] == g["id"]]
            lines.append(f"- Group {g['id']} ({g['region']}, {g['size']}): {', '.join(names_in)}")
    for sym, r in pt.get("regimes", {}).items():
        calm, storm = r["states"]
        lines.append(f"\n{names.get(sym, sym)} regimes: calm ±{calm['volatility'] * 100:.0f}% ({calm['share_of_time'] * 100:.0f}% of time), "
                     f"stormy ±{storm['volatility'] * 100:.0f}% (avg {storm['avg_days']:.0f} days). Today: {r['today_p_turbulent'] * 100:.0f}% stormy.")

text = "\n".join(lines)
print(text)
if os.environ.get("GITHUB_STEP_SUMMARY"):
    with open(os.environ["GITHUB_STEP_SUMMARY"], "a") as f:
        f.write(text + "\n")

"""Numbers behind the market map and regime sections (data/patterns.json)."""
import numpy as np
import pandas as pd

from app import unsupervised as un
from app.config import RESEARCH_UNIVERSE

REGIME_SYMBOLS = ["^GSPC", "^HSI"]


def _num(x, nd=4):
    if x is None:
        return None
    x = float(x)
    return None if np.isnan(x) or np.isinf(x) else round(x, nd)


def region(sym: str) -> str:
    return "Hong Kong" if sym.endswith(".HK") else "United States"


def build_patterns(research: pd.DataFrame, site_prices: pd.DataFrame) -> dict:
    out: dict = {}

    # ---- market map
    stocks = [s for s in RESEARCH_UNIVERSE if s in research.columns]
    if len(stocks) >= 8:
        w = un.weekly_return_matrix(research[stocks])
        res = un.cluster(w)
        p = un.pca(w)
        labels = res["labels"]
        sector = pd.Series({s: RESEARCH_UNIVERSE[s][1] for s in w.columns})
        reg = pd.Series({s: region(s) for s in w.columns})
        clusters = []
        for c in sorted(labels.unique()):
            members = labels[labels == c].index
            regions = reg[members].value_counts()
            sectors = sector[members].value_counts()
            clusters.append({
                "id": int(c), "size": int(len(members)),
                "region": regions.index[0] if regions.iloc[0] / len(members) >= 0.75 else "Mixed",
                "top_sectors": list(sectors.index[:3]),
                "avg_within_corr": _num(w[members].corr().to_numpy()[np.triu_indices(len(members), 1)].mean()) if len(members) > 1 else None,
            })
        out["map"] = {
            "weeks": int(len(w)),
            "k": int(res["k"]),
            "silhouette": {str(k): _num(v) for k, v in res["silhouette"].items()},
            "explained": [_num(v) for v in p["explained"]],
            "ari_region": _num(un.agreement(labels, reg)),
            "ari_sector": _num(un.agreement(labels, sector)),
            "clusters": clusters,
            "stocks": [{
                "symbol": s, "name": RESEARCH_UNIVERSE[s][0], "sector": sector[s], "region": reg[s],
                "cluster": int(labels[s]),
                "pc1": _num(p["loadings"].loc[s, "PC1"]), "pc2": _num(p["loadings"].loc[s, "PC2"]),
                "pc3": _num(p["loadings"].loc[s, "PC3"]),
            } for s in w.columns],
        }

    # ---- regimes
    regs = {}
    for sym in REGIME_SYMBOLS:
        if sym not in site_prices:
            continue
        close = site_prices[sym].dropna()
        r = un.regimes(close)
        weekly = pd.DataFrame({
            "close": close,
            "p_turbulent": r["p_turbulent_smoothed"],
        }).resample("W-FRI").last().dropna()
        m = r["model"]
        regs[sym] = {
            "today_p_turbulent": _num(r["p_turbulent_filtered"].iloc[-1]),
            "today_date": r["p_turbulent_filtered"].index[-1].date().isoformat(),
            "states": [{
                "name": name, "volatility": _num(r["vol"][i]), "avg_days": _num(r["expected_days"][i], 1),
                "share_of_time": _num(r["share_of_time"][i]), "daily_mean": _num(m.mean[i], 6),
            } for i, name in enumerate(["calm", "turbulent"])],
            "weekly": {
                "dates": [d.date().isoformat() for d in weekly.index],
                "close": [_num(v, 2) for v in weekly["close"]],
                "p_turbulent": [_num(v, 3) for v in weekly["p_turbulent"]],
            },
        }
    out["regimes"] = regs
    return out

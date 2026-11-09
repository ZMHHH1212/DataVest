"""Numbers behind the website's Models page (data/models.json)."""
import numpy as np
import pandas as pd

from app import analytics as an
from app import backtest as bt
from app import forecast as fc

MIN_TRAIN = 500  # trading days of history before the first out-of-sample forecast
CHART_SYMBOLS = ["^HSI", "^GSPC"]


def _num(x, nd=5):
    if x is None:
        return None
    x = float(x)
    return None if np.isnan(x) or np.isinf(x) else round(x, nd)


def _weekly(df: pd.DataFrame) -> dict:
    w = df.resample("W-FRI").last().dropna(how="all")
    return {"dates": [d.date().isoformat() for d in w.index],
            "series": {c: [_num(v, 4) for v in w[c]] for c in w.columns}}


def build_models(prices: pd.DataFrame, order: list[str]) -> dict:
    forecasts, evals, rsi_study, strategies, charts = {}, {}, {}, {}, {}
    for sym in [s for s in order if s in prices.columns]:
        close = prices[sym].dropna()
        if len(close) < MIN_TRAIN + 100:
            continue

        # -- volatility forecasting
        wf = fc.walk_forward(close, min_train=MIN_TRAIN)
        table = fc.evaluate(wf)
        evals[sym] = {"n": int(len(wf)), "start": wf.index[0].date().isoformat(),
                      **{m: {k: _num(v) for k, v in row.items()} for m, row in table.iterrows()}}
        lf = fc.latest_forecast(close)
        forecasts[sym] = {k: _num(v) for k, v in lf.items()}
        if sym in CHART_SYMBOLS:
            charts[sym] = _weekly(wf[["target", "garch", "last_month"]])

        # -- RSI
        rsi = an.rsi(close)
        es = bt.event_study(close, rsi, h=20, n_boot=4000)
        rsi_study[sym] = [{"group": g, **{k: _num(v) for k, v in row.items()}} for g, row in es.iterrows()]
        res = bt.compare_rsi_strategy(close)
        strategies[sym] = {
            "strategy": {k: _num(v) for k, v in res["strategy"].items()},
            "buy_and_hold": {k: _num(v) for k, v in res["buy_and_hold"].items()},
            "time_in_market": _num(res["time_in_market"]),
            "trades": res["trades"],
            "equity": _weekly(res["equity"]),
        }

    # Pooled view: how often each model beat the "last month" baseline, and average error ratio
    models = fc.MODELS
    pooled = {}
    for m in models:
        ratios = [evals[s][m]["qlike"] / evals[s]["last_month"]["qlike"] for s in evals if evals[s]["last_month"]["qlike"]]
        wins = sum(1 for s in evals if evals[s][m]["qlike"] < evals[s]["last_month"]["qlike"])
        best = sum(1 for s in evals if min(models, key=lambda k: evals[s][k]["qlike"]) == m)
        pooled[m] = {"qlike_vs_last_month": _num(np.mean(ratios) - 1 if ratios else None),
                     "beats_last_month": wins, "best_in": best, "markets": len(evals)}

    return {"forecasts": forecasts, "evaluation": evals, "pooled": pooled, "vol_charts": charts,
            "rsi_events": rsi_study, "rsi_strategy": strategies, "settings": {
                "horizon_days": 21, "min_train_days": MIN_TRAIN, "refit_every_days": 21,
                "rsi_low": 30, "rsi_high": 70, "event_horizon_days": 20, "cost_per_trade": 0.001}}

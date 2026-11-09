"""Forecasting next month's volatility, evaluated honestly (walk-forward, out of sample).

Target: realised volatility over the next `h` trading days (default 21, about a month),
annualised. Every forecast made on day t uses only prices up to and including day t.

Models
- last_month  realised volatility of the past h days (the "tomorrow looks like today" baseline)
- long_run    realised volatility over all history so far
- ewma        RiskMetrics exponentially weighted variance, lambda = 0.94
- garch       GARCH(1,1), fitted by maximum likelihood, refitted every `refit_every` days
- har         HAR regression (Corsi 2009): next month's variance from the last day, week and month
"""
from dataclasses import dataclass

import numpy as np
import pandas as pd
from scipy.optimize import minimize
from scipy.signal import lfilter

TRADING_DAYS = 252
MODELS = ["last_month", "long_run", "ewma", "garch", "har"]


def log_returns(close: pd.Series) -> pd.Series:
    return np.log(close.dropna()).diff().dropna()


def realised_vol_ahead(r: pd.Series, h: int = 21) -> pd.Series:
    """Annualised volatility over days t+1 .. t+h, stamped on day t (NaN at the end)."""
    sq = r.pow(2)
    ahead = sq[::-1].rolling(h, min_periods=h).sum()[::-1].shift(-1)
    return np.sqrt(ahead * TRADING_DAYS / h)


# ---- GARCH(1,1) -------------------------------------------------------------------

@dataclass
class Garch:
    omega: float  # in (percent return)^2 units
    alpha: float
    beta: float

    @property
    def persistence(self) -> float:
        return self.alpha + self.beta

    @property
    def long_run_var(self) -> float:
        return self.omega / (1 - self.persistence)


def garch_filter(r: np.ndarray, g: Garch, var0: float) -> np.ndarray:
    """Conditional variance for each day: s2[t] = omega + alpha*r[t-1]^2 + beta*s2[t-1].

    Returns an array one longer than r: the last element is the forecast for the next day.
    Uses a linear filter instead of a Python loop (fast enough to refit often).
    """
    x = np.empty(len(r) + 1)
    x[0] = var0
    x[1:] = g.omega + g.alpha * r**2
    # s2[t] - beta*s2[t-1] = x[t]  ->  IIR filter with a = [1, -beta]
    s2 = lfilter([1.0], [1.0, -g.beta], x)
    return s2


def garch_fit(r: np.ndarray) -> Garch:
    """Maximum likelihood (Gaussian) fit. `r` is daily returns in percent (mean assumed ~0)."""
    var0 = float(np.var(r))

    def nll(p):
        g = Garch(*p)
        if g.omega <= 0 or g.alpha < 0 or g.beta < 0 or g.persistence >= 0.9999:
            return 1e12
        s2 = garch_filter(r, g, var0)[:-1]
        return 0.5 * np.sum(np.log(s2) + r**2 / s2)

    best = None
    for a0, b0 in [(0.08, 0.90), (0.05, 0.93), (0.15, 0.80)]:
        x0 = [var0 * (1 - a0 - b0), a0, b0]
        res = minimize(nll, x0, method="L-BFGS-B",
                       bounds=[(1e-8, 10 * var0), (0.0, 0.5), (0.0, 0.9999)])
        if best is None or res.fun < best.fun:
            best = res
    return Garch(*best.x)


def garch_horizon_var(g: Garch, next_var: float, h: int) -> float:
    """Average daily variance over the next h days, given tomorrow's variance."""
    k = np.arange(h)
    path = g.long_run_var + g.persistence**k * (next_var - g.long_run_var)
    return float(path.mean())


# ---- HAR regression ---------------------------------------------------------------

def har_features(r: pd.Series) -> pd.DataFrame:
    sq = r.pow(2)
    return pd.DataFrame({
        "rv_d": sq,
        "rv_w": sq.rolling(5).mean(),
        "rv_m": sq.rolling(22).mean(),
    })


# ---- walk-forward -----------------------------------------------------------------

def walk_forward(close: pd.Series, h: int = 21, min_train: int = 500, refit_every: int = 21,
                 lam: float = 0.94) -> pd.DataFrame:
    """Out-of-sample forecasts for every day after `min_train` returns.

    Columns: target (realised vol over the next h days) and one column per model,
    all annualised volatilities. Rows where the target isn't known yet are dropped.
    """
    r = log_returns(close)
    target = realised_vol_ahead(r, h)
    # Percent units help the GARCH optimiser. Returns are NOT de-meaned with the full-sample
    # mean: that would leak future information. The daily mean is tiny next to daily moves.
    pct = r * 100
    ann = np.sqrt(TRADING_DAYS)

    out = pd.DataFrame(index=r.index)
    out["target"] = target
    out["last_month"] = r.pow(2).rolling(h).mean().pow(0.5) * ann
    out["long_run"] = r.pow(2).expanding(min_periods=h).mean().pow(0.5) * ann

    # EWMA (RiskMetrics): s2[t+1] = lam*s2[t] + (1-lam)*r[t]^2
    sq = r.pow(2).to_numpy()
    ewma = lfilter([1 - lam], [1, -lam], sq, zi=[lam * sq[:h].mean()])[0]
    out["ewma"] = np.sqrt(ewma) * ann

    # GARCH and HAR: refit on data available at the refit date, then roll forward daily
    feats = har_features(r)
    har_target = r.pow(2)[::-1].rolling(h, min_periods=h).mean()[::-1].shift(-1)  # avg var over t+1..t+h
    garch_col = pd.Series(np.nan, index=r.index)
    har_col = pd.Series(np.nan, index=r.index)
    n = len(r)
    p = pct.to_numpy()
    for start in range(min_train, n, refit_every):
        stop = min(start + refit_every, n)
        # -- GARCH: fit on returns 0..start-1, i.e. everything known on day start-1
        g = garch_fit(p[:start])
        s2 = garch_filter(p[:stop], g, float(np.var(p[:start])))  # s2[i] = variance for day i, given data to i-1
        for i in range(start - 1, stop - 1):
            # forecast made at the close of day i uses s2[i+1] (needs r up to day i only)
            garch_col.iloc[i] = np.sqrt(garch_horizon_var(g, s2[i + 1], h)) / 100 * ann
        # -- HAR: training rows whose h-day target ended by day start-1
        train = pd.concat([feats, har_target.rename("y")], axis=1).iloc[: start - h].dropna()
        X = np.column_stack([np.ones(len(train)), train[["rv_d", "rv_w", "rv_m"]].to_numpy()])
        coef, *_ = np.linalg.lstsq(X, train["y"].to_numpy(), rcond=None)
        block = feats.iloc[start - 1: stop - 1].dropna()
        pred = np.column_stack([np.ones(len(block)), block.to_numpy()]) @ coef
        floor = r.iloc[:start].pow(2).mean() * 0.05
        har_col.loc[block.index] = np.sqrt(np.maximum(pred, floor)) * ann

    out["garch"] = garch_col
    out["har"] = har_col
    return out.iloc[min_train - 1:].dropna()


def evaluate(fc: pd.DataFrame, baseline: str = "last_month") -> pd.DataFrame:
    """Error of each model against the realised target. Lower is better for every metric.

    QLIKE compares variances and punishes forecasts that are too low more than too high,
    which matches how risk forecasts are used.
    """
    rows = {}
    y = fc["target"]
    for m in [c for c in MODELS if c in fc]:
        f = fc[m]
        ratio = (y**2) / (f**2)
        rows[m] = {
            "rmse": float(np.sqrt(((f - y) ** 2).mean())),
            "mae": float((f - y).abs().mean()),
            "qlike": float((ratio - np.log(ratio) - 1).mean()),
            "bias": float((f - y).mean()),
        }
    table = pd.DataFrame.from_dict(rows, orient="index")
    table["rmse_vs_baseline"] = table["rmse"] / table.loc[baseline, "rmse"] - 1
    return table


def latest_forecast(close: pd.Series, h: int = 21) -> dict:
    """GARCH forecast of next month's volatility from all data, plus last month's for reference."""
    r = log_returns(close)
    p = (r * 100).to_numpy()
    g = garch_fit(p)
    s2 = garch_filter(p, g, float(np.var(p)))
    ann = np.sqrt(TRADING_DAYS)
    return {
        "garch_next_month": float(np.sqrt(garch_horizon_var(g, s2[-1], h)) / 100 * ann),
        "last_month": float(np.sqrt(r.iloc[-h:].pow(2).mean()) * ann),
        "long_run": float(np.sqrt(g.long_run_var) / 100 * ann),
        "persistence": g.persistence,
        "half_life_days": float(np.log(0.5) / np.log(g.persistence)) if g.persistence < 1 else None,
    }

"""Market analytics on price tables. Pure pandas/numpy, no database needed.

Input convention: a "wide" DataFrame of adjusted close prices,
index = trading dates (DatetimeIndex), one column per symbol.
"""
import numpy as np
import pandas as pd

TRADING_DAYS = 252


def daily_returns(prices: pd.DataFrame) -> pd.DataFrame:
    """Simple daily returns per symbol, each on its own trading calendar.

    US and HK markets have different holidays, so a wide table has gaps.
    We drop each column's gaps before computing returns instead of filling
    them, which would invent zero-return days.
    """
    return prices.apply(lambda s: s.dropna().pct_change()).iloc[1:]


def weekly_returns(prices: pd.DataFrame) -> pd.DataFrame:
    """Friday-to-Friday returns. Better for comparing markets in different
    time zones: Hong Kong closes before New York opens, so same-day daily
    returns don't line up in time."""
    return prices.ffill().resample("W-FRI").last().pct_change().iloc[1:]


def cagr(series: pd.Series) -> float:
    s = series.dropna()
    years = (s.index[-1] - s.index[0]).days / 365.25
    return float((s.iloc[-1] / s.iloc[0]) ** (1 / years) - 1)


def annual_volatility(returns: pd.Series) -> float:
    return float(returns.dropna().std() * np.sqrt(TRADING_DAYS))


def sharpe_ratio(returns: pd.Series, risk_free: float = 0.0) -> float:
    """Annualised excess return per unit of volatility."""
    r = returns.dropna()
    excess = r - risk_free / TRADING_DAYS
    return float(excess.mean() / excess.std() * np.sqrt(TRADING_DAYS))


def drawdown(series: pd.Series) -> pd.Series:
    """Fall from the running peak at each date (0 = at a new high, -0.3 = 30% below)."""
    s = series.dropna()
    return s / s.cummax() - 1


def max_drawdown(series: pd.Series) -> dict:
    dd = drawdown(series)
    trough = dd.idxmin()
    peak = series.loc[:trough].idxmax()
    after = series.loc[trough:]
    recovered = after[after >= series.loc[peak]]
    return {
        "max_drawdown": float(dd.min()),
        "peak": peak,
        "trough": trough,
        "recovered": recovered.index[0] if len(recovered) else None,
    }


def rolling_volatility(prices: pd.DataFrame, window: int = 63) -> pd.DataFrame:
    """Annualised volatility over a rolling window (63 trading days ≈ 3 months)."""
    rets = daily_returns(prices)
    return rets.apply(lambda r: r.dropna().rolling(window).std() * np.sqrt(TRADING_DAYS))


def correlation(prices: pd.DataFrame, freq: str = "weekly") -> pd.DataFrame:
    rets = weekly_returns(prices) if freq == "weekly" else prices.ffill().pct_change().iloc[1:]
    return rets.corr()


def summary(prices: pd.DataFrame, risk_free: float = 0.0) -> pd.DataFrame:
    """One row per symbol: growth, risk and worst fall."""
    rets = daily_returns(prices)
    rows = {}
    for sym in prices.columns:
        s = prices[sym].dropna()
        if len(s) < 30:
            continue
        mdd = max_drawdown(s)
        rows[sym] = {
            "total_return": float(s.iloc[-1] / s.iloc[0] - 1),
            "cagr": cagr(s),
            "volatility": annual_volatility(rets[sym]),
            "sharpe": sharpe_ratio(rets[sym], risk_free),
            "max_drawdown": mdd["max_drawdown"],
            "dd_peak": mdd["peak"],
            "dd_trough": mdd["trough"],
            "dd_recovered": mdd["recovered"],
            "start": s.index[0],
            "end": s.index[-1],
        }
    return pd.DataFrame.from_dict(rows, orient="index")

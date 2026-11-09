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


# ---- technical indicators (single price series in, series/frame out) ---------

def sma(close: pd.Series, window: int) -> pd.Series:
    """Simple moving average: the plain average of the last `window` closes."""
    return close.rolling(window, min_periods=window).mean()


def ema(close: pd.Series, span: int) -> pd.Series:
    """Exponential moving average: recent days weigh more."""
    return close.ewm(span=span, adjust=False, min_periods=span).mean()


def rsi(close: pd.Series, period: int = 14) -> pd.Series:
    """Relative Strength Index (Wilder's smoothing), 0-100.

    Compares the size of recent gains with recent losses. Readings above 70
    are conventionally called "overbought", below 30 "oversold".
    """
    delta = close.diff()
    gain = delta.clip(lower=0)
    loss = -delta.clip(upper=0)
    avg_gain = gain.ewm(alpha=1 / period, adjust=False, min_periods=period).mean()
    avg_loss = loss.ewm(alpha=1 / period, adjust=False, min_periods=period).mean()
    rs = avg_gain / avg_loss
    out = 100 - 100 / (1 + rs)
    # no losses at all in the window -> RSI is 100 by definition
    return out.where(avg_loss != 0, 100.0).where(avg_gain.notna())


def macd(close: pd.Series, fast: int = 12, slow: int = 26, signal: int = 9) -> pd.DataFrame:
    """MACD line (fast EMA - slow EMA), its signal line, and the histogram."""
    line = ema(close, fast) - ema(close, slow)
    sig = line.ewm(span=signal, adjust=False, min_periods=signal).mean()
    return pd.DataFrame({"macd": line, "signal": sig, "histogram": line - sig})


def bollinger(close: pd.Series, window: int = 20, k: float = 2.0) -> pd.DataFrame:
    """Moving average with bands k standard deviations above and below."""
    mid = sma(close, window)
    sd = close.rolling(window, min_periods=window).std()
    return pd.DataFrame({"middle": mid, "upper": mid + k * sd, "lower": mid - k * sd})


# ---- risk measures --------------------------------------------------------------

def value_at_risk(returns: pd.Series, level: float = 0.95) -> float:
    """Historical one-day VaR as a (negative) return.

    At 95%: on 19 days out of 20 the loss was smaller than this.
    """
    r = returns.dropna()
    return float(r.quantile(1 - level))


def expected_shortfall(returns: pd.Series, level: float = 0.95) -> float:
    """Average return on the days worse than VaR (also called CVaR)."""
    r = returns.dropna()
    var = r.quantile(1 - level)
    return float(r[r <= var].mean())


def beta(returns: pd.Series, benchmark: pd.Series) -> float:
    """How much the asset moves for each 1% move in the benchmark.

    The two return series are aligned on their common dates. For markets in
    different time zones, pass weekly returns (risk_report does this).
    """
    df = pd.concat([returns, benchmark], axis=1, join="inner").dropna()
    if len(df) < 10:
        return float("nan")
    cov = df.cov().iloc[0, 1]
    return float(cov / df.iloc[:, 1].var())


def risk_report(close: pd.Series, benchmark: pd.Series | None = None, risk_free: float = 0.0) -> dict:
    """All the headline risk numbers for one price series."""
    s = close.dropna()
    r = s.pct_change().dropna()
    mdd = max_drawdown(s)
    report = {
        "start": s.index[0],
        "end": s.index[-1],
        "days": int(len(s)),
        "total_return": float(s.iloc[-1] / s.iloc[0] - 1),
        "cagr": cagr(s) if (s.index[-1] - s.index[0]).days >= 300 else None,
        "volatility": annual_volatility(r),
        "sharpe": sharpe_ratio(r, risk_free),
        "max_drawdown": mdd["max_drawdown"],
        "max_drawdown_peak": mdd["peak"],
        "max_drawdown_trough": mdd["trough"],
        "recovered": mdd["recovered"],
        "var_95": value_at_risk(r, 0.95),
        "expected_shortfall_95": expected_shortfall(r, 0.95),
        "best_day": float(r.max()),
        "worst_day": float(r.min()),
        "positive_days": float((r > 0).mean()),
    }
    if benchmark is not None:
        # weekly returns: robust when the two markets trade in different time zones
        both = pd.concat([s, benchmark.dropna()], axis=1).ffill().resample("W-FRI").last().pct_change().dropna()
        report["beta"] = beta(both.iloc[:, 0], both.iloc[:, 1])
        report["correlation"] = float(both.iloc[:, 0].corr(both.iloc[:, 1])) if len(both) > 10 else None
    return report

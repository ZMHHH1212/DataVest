"""Does RSI work? Two honest tests.

1. Event study: after RSI drops below 30 ("oversold") or rises above 70 ("overbought"),
   what happened over the next h days, compared with an ordinary day?
2. Backtest: a long-only rule (buy when RSI < 30, sell when RSI > 70) against simply
   holding, with trading costs and no look-ahead (decide at today's close, earn from tomorrow).
"""
import numpy as np
import pandas as pd

from app import analytics as an


def forward_return(close: pd.Series, h: int) -> pd.Series:
    """Return from today's close to the close h trading days later (NaN near the end)."""
    return close.shift(-h) / close - 1


def episodes(mask: pd.Series, gap: int) -> pd.Series:
    """First day of each signal episode: signal days at least `gap` days after the previous signal start."""
    starts = []
    last = -10**9
    for i, on in enumerate(mask.to_numpy()):
        if on and i - last >= gap:
            starts.append(i)
            last = i
    out = pd.Series(False, index=mask.index)
    out.iloc[starts] = True
    return out


def event_study(close: pd.Series, rsi: pd.Series, low: float = 30, high: float = 70, h: int = 20,
                n_boot: int = 5000, seed: int = 0) -> pd.DataFrame:
    """Forward h-day returns after oversold / overbought signals vs all days.

    Signals cluster (RSI stays below 30 for several days), and overlapping windows
    would count the same move many times. So each group uses only the first day of
    each episode, with episodes at least h days apart.

    p_value: share of random draws of ordinary days (same count) whose average return
    is at least as far from the all-days average as the signal group's. Small = unusual.
    """
    fwd = forward_return(close, h)
    valid = fwd.notna() & rsi.notna()
    base = fwd[valid]
    rng = np.random.default_rng(seed)

    rows = {"all days": _group_stats(base)}
    rows["all days"]["p_value"] = None
    for name, mask in [("oversold (RSI < %g)" % low, rsi < low), ("overbought (RSI > %g)" % high, rsi > high)]:
        starts = episodes(mask & valid, gap=h)
        g = fwd[starts]
        stats = _group_stats(g)
        if len(g) >= 3:
            draws = rng.choice(base.to_numpy(), size=(n_boot, len(g)), replace=True).mean(axis=1)
            diff = abs(g.mean() - base.mean())
            stats["p_value"] = float((np.abs(draws - base.mean()) >= diff).mean())
        else:
            stats["p_value"] = None
        rows[name] = stats
    return pd.DataFrame.from_dict(rows, orient="index")


def _group_stats(x: pd.Series) -> dict:
    return {
        "signals": int(len(x)),
        "avg_return": float(x.mean()) if len(x) else None,
        "median_return": float(x.median()) if len(x) else None,
        "share_positive": float((x > 0).mean()) if len(x) else None,
    }


def rsi_positions(rsi: pd.Series, low: float = 30, high: float = 70) -> pd.Series:
    """1 = holding, 0 = in cash. Buy when RSI < low, stay in until RSI > high.

    The value on day t is the decision made at day t's close.
    """
    pos = np.zeros(len(rsi))
    holding = 0.0
    for i, v in enumerate(rsi.to_numpy()):
        if np.isnan(v):
            pos[i] = holding
            continue
        if holding == 0 and v < low:
            holding = 1.0
        elif holding == 1 and v > high:
            holding = 0.0
        pos[i] = holding
    return pd.Series(pos, index=rsi.index)


def backtest(close: pd.Series, positions: pd.Series, cost: float = 0.001) -> pd.DataFrame:
    """Daily returns of following `positions` (decided at each close, applied to the next day).

    cost: fraction of the trade value paid on every buy or sell (0.001 = 0.1%).
    Cash earns nothing, which is conservative for the strategy.
    """
    r = close.pct_change().fillna(0)
    held = positions.shift(1).fillna(0)  # yesterday's decision earns today's return
    trades = positions.diff().abs().fillna(positions.iloc[0])
    strat = held * r - trades.shift(1).fillna(0) * cost  # cost charged when the trade executes
    return pd.DataFrame({"strategy": strat, "buy_and_hold": r, "position": held, "trade": trades.shift(1).fillna(0)})


def performance(daily: pd.Series) -> dict:
    """Growth, risk and worst fall for a daily return series."""
    equity = (1 + daily).cumprod()
    years = len(daily) / 252
    return {
        "total_return": float(equity.iloc[-1] - 1),
        "cagr": float(equity.iloc[-1] ** (1 / years) - 1) if years > 0 else None,
        "volatility": float(daily.std() * np.sqrt(252)),
        "sharpe": float(daily.mean() / daily.std() * np.sqrt(252)) if daily.std() > 0 else None,
        "max_drawdown": float(an.drawdown(equity).min()),
    }


def compare_rsi_strategy(close: pd.Series, low: float = 30, high: float = 70, cost: float = 0.001) -> dict:
    rsi = an.rsi(close)
    bt = backtest(close, rsi_positions(rsi, low, high), cost)
    start = rsi.first_valid_index()
    bt = bt.loc[start:]
    return {
        "strategy": performance(bt["strategy"]),
        "buy_and_hold": performance(bt["buy_and_hold"]),
        "time_in_market": float(bt["position"].mean()),
        "trades": int(bt["trade"].sum()),
        "equity": (1 + bt[["strategy", "buy_and_hold"]]).cumprod(),
    }

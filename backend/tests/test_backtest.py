import numpy as np
import pandas as pd
import pytest

from app import analytics as an
from app import backtest as bt


def series(values, start="2020-01-01"):
    return pd.Series(values, index=pd.bdate_range(start, periods=len(values)), dtype=float)


def random_walk(n=1500, seed=0, drift=0.0003):
    rng = np.random.default_rng(seed)
    return series(100 * np.cumprod(1 + rng.normal(drift, 0.012, n)))


def test_forward_return():
    c = series([100, 110, 121, 133.1])
    f = bt.forward_return(c, 2)
    assert f.iloc[0] == pytest.approx(0.21) and f.iloc[-2:].isna().all()


def test_episodes_counts_each_cluster_once():
    mask = series([0, 1, 1, 1, 0, 0, 0, 0, 1, 1]).astype(bool)
    starts = bt.episodes(mask, gap=5)
    assert starts.sum() == 2 and starts.iloc[1] and starts.iloc[8]


def test_positions_follow_the_rule():
    rsi = series([50, 25, 40, 65, 75, 50, 28, 80])
    pos = bt.rsi_positions(rsi)
    assert pos.tolist() == [0, 1, 1, 1, 0, 0, 1, 0]


def test_backtest_has_no_look_ahead():
    close = series([100, 100, 110, 121, 121])
    pos = series([0, 1, 1, 0, 0])  # decide to buy at close of day 1, sell at close of day 3
    out = bt.backtest(close, pos, cost=0)
    # earns day 2 and day 3 returns only (10% each), not day 1
    assert out["strategy"].tolist() == pytest.approx([0, 0, 0.1, 0.1, 0])


def test_costs_are_charged_on_each_trade():
    close = series([100] * 6)
    pos = series([1, 0, 1, 0, 0, 0])
    out = bt.backtest(close, pos, cost=0.001)
    assert out["strategy"].sum() == pytest.approx(-0.004)  # four trades, flat prices


def test_always_holding_equals_buy_and_hold():
    close = random_walk(300, seed=1)
    out = bt.backtest(close, pd.Series(1.0, index=close.index), cost=0)
    assert np.allclose(out["strategy"].iloc[1:], out["buy_and_hold"].iloc[1:])


def test_event_study_on_a_random_walk_finds_nothing_special():
    close = random_walk(3000, seed=2)
    es = bt.event_study(close, an.rsi(close), h=20, n_boot=2000)
    over = es.loc[es.index.str.startswith("oversold")].iloc[0]
    assert over["signals"] >= 3
    assert over["p_value"] > 0.01  # no real edge exists in a random walk


def test_compare_rsi_strategy_reports_both_sides():
    out = bt.compare_rsi_strategy(random_walk(1500, seed=3))
    assert {"cagr", "sharpe", "max_drawdown"} <= set(out["strategy"])
    assert 0 <= out["time_in_market"] <= 1 and out["trades"] >= 0
    assert list(out["equity"].columns) == ["strategy", "buy_and_hold"]

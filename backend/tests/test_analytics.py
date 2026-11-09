import numpy as np
import pandas as pd
import pytest

from app import analytics as an


def series(values, start="2024-01-01"):
    return pd.Series(values, index=pd.bdate_range(start, periods=len(values)), dtype=float)


def test_drawdown_and_recovery():
    s = series([100, 120, 90, 60, 100, 130])
    dd = an.drawdown(s)
    assert dd.iloc[1] == 0
    assert dd.min() == pytest.approx(-0.5)  # 120 -> 60
    m = an.max_drawdown(s)
    assert m["peak"] == s.index[1] and m["trough"] == s.index[3]
    assert m["recovered"] == s.index[5]  # first close back above 120


def test_cagr_doubling_over_one_year():
    s = pd.Series([100.0, 200.0], index=pd.to_datetime(["2024-01-01", "2024-12-31"]))
    assert an.cagr(s) == pytest.approx(1.0, rel=0.01)


def test_volatility_and_sharpe_scale_with_sqrt_time():
    rng = np.random.default_rng(0)
    r = pd.Series(rng.normal(0.0005, 0.01, 5000))
    assert an.annual_volatility(r) == pytest.approx(0.01 * np.sqrt(252), rel=0.05)
    assert an.sharpe_ratio(r) == pytest.approx(0.0005 / 0.01 * np.sqrt(252), abs=0.4)


def test_daily_returns_skip_holidays_instead_of_inventing_zero_days():
    idx = pd.bdate_range("2024-01-01", periods=4)
    prices = pd.DataFrame({"US": [100, 101, 102, 103], "HK": [50, np.nan, 55, 55]}, index=idx, dtype=float)
    rets = an.daily_returns(prices)
    assert rets["HK"].dropna().tolist() == pytest.approx([0.1, 0.0])  # 50 -> 55 across the holiday


def test_weekly_correlation_of_identical_series_is_one():
    rng = np.random.default_rng(1)
    p = 100 * np.cumprod(1 + rng.normal(0, 0.01, 300))
    idx = pd.bdate_range("2024-01-01", periods=300)
    prices = pd.DataFrame({"A": p, "B": p * 2}, index=idx)
    assert an.correlation(prices).loc["A", "B"] == pytest.approx(1.0)


def test_summary_has_a_row_per_symbol():
    rng = np.random.default_rng(2)
    idx = pd.bdate_range("2021-01-01", periods=800)
    prices = pd.DataFrame({s: 100 * np.cumprod(1 + rng.normal(0.0003, 0.012, 800)) for s in "XYZ"}, index=idx)
    out = an.summary(prices)
    assert list(out.index) == ["X", "Y", "Z"]
    assert {"cagr", "volatility", "sharpe", "max_drawdown"} <= set(out.columns)
    assert (out["max_drawdown"] <= 0).all()

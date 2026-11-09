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


# ---- indicators ----------------------------------------------------------------

def test_sma_matches_hand_calculation():
    s = series([1, 2, 3, 4, 5])
    assert an.sma(s, 3).tolist()[2:] == [2.0, 3.0, 4.0]
    assert an.sma(s, 3).isna().sum() == 2


def test_ema_weights_recent_days_more():
    s = series([10] * 20 + [20] * 5)
    assert an.sma(s, 10).iloc[-1] < an.ema(s, 10).iloc[-1] < 20


def test_rsi_extremes_and_range():
    up = series(np.arange(1, 40, dtype=float))
    down = series(np.arange(40, 1, -1, dtype=float))
    assert an.rsi(up).iloc[-1] == 100
    assert an.rsi(down).iloc[-1] == pytest.approx(0)
    rng = np.random.default_rng(3)
    noisy = series(100 * np.cumprod(1 + rng.normal(0, 0.01, 300)))
    r = an.rsi(noisy).dropna()
    assert r.between(0, 100).all() and 30 < r.mean() < 70


def test_rsi_known_value():
    # Gains of 1 and losses of 1 alternating -> equal average gain and loss -> RSI 50
    s = series([10, 11] * 30)
    assert an.rsi(s).iloc[-1] == pytest.approx(50, abs=3)


def test_macd_is_zero_for_a_flat_price():
    m = an.macd(series([50.0] * 60)).dropna()
    assert (m.abs() < 1e-9).all().all()


def test_bollinger_bands_surround_the_average():
    rng = np.random.default_rng(4)
    s = series(100 + rng.normal(0, 1, 100).cumsum())
    b = an.bollinger(s).dropna()
    assert (b["upper"] > b["middle"]).all() and (b["lower"] < b["middle"]).all()


# ---- risk ----------------------------------------------------------------------

def test_var_and_expected_shortfall():
    r = pd.Series(np.linspace(-0.10, 0.09, 20))  # 20 evenly spaced daily returns
    var = an.value_at_risk(r, 0.95)
    assert -0.10 <= var <= -0.09
    assert an.expected_shortfall(r, 0.95) <= var


def test_beta_of_a_leveraged_copy_is_two():
    rng = np.random.default_rng(5)
    bench = pd.Series(rng.normal(0, 0.01, 200))
    assert an.beta(2 * bench, bench) == pytest.approx(2.0)


def test_risk_report_fields():
    rng = np.random.default_rng(6)
    s = series(100 * np.cumprod(1 + rng.normal(0.0004, 0.01, 600)))
    b = series(100 * np.cumprod(1 + rng.normal(0.0003, 0.01, 600)))
    rep = an.risk_report(s, b)
    for key in ["cagr", "volatility", "sharpe", "max_drawdown", "var_95", "expected_shortfall_95", "beta", "correlation"]:
        assert rep[key] is not None
    assert rep["expected_shortfall_95"] <= rep["var_95"] < 0 < rep["best_day"]

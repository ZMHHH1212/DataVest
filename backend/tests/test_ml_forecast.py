import numpy as np
import pandas as pd
import pytest

from app import forecast as fc
from app import ml_forecast as ml
from tests.test_forecast import simulate_garch


def make_prices(n=1400, seed=0):
    us = pd.bdate_range("2019-01-01", periods=n)
    hk = us.drop(us[::40])
    cols = {}
    for i, (sym, idx) in enumerate([("^GSPC", us), ("AAPL", us), ("^HSI", hk), ("0700.HK", hk)]):
        r = simulate_garch(len(idx), omega=0.03, alpha=0.1, beta=0.87, seed=seed + i) / 100
        cols[sym] = pd.Series(100 * np.exp(np.cumsum(r)), index=idx)
    return pd.DataFrame(cols).sort_index()


@pytest.fixture(scope="module")
def prices():
    return make_prices()


@pytest.fixture(scope="module")
def forecasts(prices):
    return ml.walk_forward_ml(prices, min_train=600, refit_every=126)


def test_features_use_only_the_past():
    close = make_prices(400)["AAPL"].dropna()
    f = ml.symbol_features(close)
    r = fc.log_returns(close)
    day = f.index[100]
    assert f.loc[day, "lrv_5"] == pytest.approx(np.log(r.loc[:day].iloc[-5:].pow(2).mean() + ml.EPS))
    assert f.loc[day, "target_end"] == f.index[100 + 21]


def test_us_market_features_are_lagged_for_hong_kong(prices):
    panel = ml.build_panel(prices)
    m = fc.log_returns(prices["^GSPC"].dropna())
    hk = panel[(panel.symbol == "^HSI")].set_index("date")
    day = hk.index[300]
    us_prev = m.loc[:day].index[-2]  # the previous US trading day
    expected = np.log(m.loc[:us_prev].iloc[-22:].pow(2).mean() + ml.EPS)
    assert hk.loc[day, "mkt_lrv_22"] == pytest.approx(expected)


def test_forecasts_cover_all_markets_and_are_positive(forecasts):
    assert set(forecasts.symbol) == {"^GSPC", "AAPL", "^HSI", "0700.HK"}
    assert set(ml.ML_MODELS) == {"ridge", "gbm", "mlp"}
    assert (forecasts[ml.ML_MODELS] > 0).all().all()
    assert forecasts.groupby("symbol").size().min() > 400


def test_no_look_ahead(prices, forecasts):
    day = sorted(forecasts.date.unique())[50]
    changed = prices.copy()
    future = changed.index > day
    changed.loc[future] = changed.loc[future] * np.linspace(1, 2.5, future.sum())[:, None]
    again = ml.walk_forward_ml(changed, min_train=600, refit_every=126)
    a = forecasts[forecasts.date == day].set_index("symbol")[ml.ML_MODELS]
    b = again[again.date == day].set_index("symbol")[ml.ML_MODELS]
    pd.testing.assert_frame_equal(a.sort_index(), b.sort_index())


def test_ml_is_competitive_with_naive_baselines(prices, forecasts):
    classical = {s: fc.walk_forward(prices[s].dropna(), min_train=600, refit_every=126) for s in prices}
    merged = ml.combine_with_classical(classical, forecasts)
    scores = pd.DataFrame({s: fc.evaluate(df)["qlike"] for s, df in merged.items()})
    avg = scores.mean(axis=1)
    # every ML model should beat "next month = last month"; the linear one should also beat the long-run average
    for m in ml.ML_MODELS:
        assert avg[m] < avg["last_month"], m
    assert avg["ridge"] < avg["long_run"]


def test_feature_importance_ranks_volatility_features_first(prices):
    imp = ml.feature_importance(prices, holdout_days=250)
    assert set(imp.index) == set(ml.FEATURES)
    assert imp.index[0].startswith(("lrv", "lewma", "down"))  # past volatility should matter most
    assert imp.index[-1] != imp.index[0]

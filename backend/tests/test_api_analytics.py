import numpy as np
import pandas as pd
import pytest
from fastapi.testclient import TestClient

from app.db import get_session
from app.main import app
from app.pipeline.fetch import clean_prices
from app.pipeline.ingest import ingest_symbol
from tests.test_pipeline import session_factory  # noqa: F401  (fixture)

DAYS = pd.bdate_range("2023-01-02", periods=500)


def fake_fetch(seed, drift=0.0004):
    def fetch(symbol, start=None, period="5y"):
        p = 100 * np.cumprod(1 + np.random.default_rng(seed).normal(drift, 0.01, len(DAYS)))
        cols = pd.MultiIndex.from_product([["Open", "High", "Low", "Close", "Adj Close", "Volume"], [symbol]])
        raw = pd.DataFrame(np.column_stack([p, p, p, p, p, np.full(len(p), 1000)]), index=pd.DatetimeIndex(DAYS, name="Date"), columns=cols)
        return clean_prices(raw)
    return fetch


@pytest.fixture
def client(session_factory):  # noqa: F811
    with session_factory() as s:
        for i, sym in enumerate(["^GSPC", "^HSI", "AAPL"]):
            ingest_symbol(s, sym, fetcher=fake_fetch(i), info_fetcher=lambda x: {"name": x, "currency": "USD"})

    def override():
        with session_factory() as s:
            yield s

    app.dependency_overrides[get_session] = override
    yield TestClient(app)
    app.dependency_overrides.clear()


def test_risk_report(client):
    r = client.get("/analytics/AAPL/risk").json()
    assert r["symbol"] == "AAPL" and r["benchmark"] == "^GSPC"
    assert r["expected_shortfall_95"] <= r["var_95"] < 0
    assert -1 < r["max_drawdown"] <= 0 and r["beta"] is not None


def test_risk_without_benchmark_and_with_dates(client):
    r = client.get("/analytics/^HSI/risk", params={"benchmark": "", "start": "2024-01-01"}).json()
    assert "beta" not in r and r["start"] >= "2024-01-01"


def test_indicators_warm_up_before_the_start_date(client):
    rows = client.get("/analytics/^GSPC/indicators", params={"include": "sma200,rsi14,macd,bb20", "start": "2024-06-03"}).json()["rows"]
    first = rows[0]
    assert first["date"] >= "2024-06-03"
    assert first["sma200"] is not None  # computed from earlier history, not blank
    assert 0 <= first["rsi14"] <= 100
    assert {"macd", "signal", "histogram", "bb20_upper", "bb20_lower"} <= set(first)


def test_indicators_reject_bad_input(client):
    assert client.get("/analytics/^GSPC/indicators", params={"include": "sma9999"}).status_code == 400
    assert client.get("/analytics/^GSPC/indicators", params={"include": "magic5"}).status_code == 400


def test_compare(client):
    r = client.get("/analytics/compare", params={"symbols": "^GSPC,^HSI,AAPL"}).json()
    assert r["symbols"] == ["^GSPC", "^HSI", "AAPL"]
    assert r["correlation_weekly"][1][1] == pytest.approx(1.0)
    assert set(r["summary"]["AAPL"]) >= {"cagr", "volatility", "sharpe", "max_drawdown"}


def test_unknown_symbol_and_bad_compare(client):
    assert client.get("/analytics/NOPE/risk").status_code == 404
    assert client.get("/analytics/compare", params={"symbols": "^GSPC"}).status_code == 400

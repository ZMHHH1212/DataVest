from datetime import date

import pandas as pd
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from sqlalchemy import create_engine

from app.db import Base, get_session
from app.main import app
from app.pipeline.fetch import clean_prices
from app.pipeline.ingest import ingest_symbol


def raw_frame(days: list[str]) -> pd.DataFrame:
    """Mimics yfinance output: DatetimeIndex + MultiIndex columns."""
    idx = pd.DatetimeIndex(pd.to_datetime(days), name="Date")
    cols = pd.MultiIndex.from_product([["Open", "High", "Low", "Close", "Adj Close", "Volume"], ["TEST"]])
    data = [[10 + i, 11 + i, 9 + i, 10.5 + i, 10.4 + i, 1000 * (i + 1)] for i in range(len(days))]
    return pd.DataFrame(data, index=idx, columns=cols)


@pytest.fixture
def session_factory():
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    from app import models  # noqa: F401
    Base.metadata.create_all(engine)
    return sessionmaker(bind=engine)


def test_clean_prices_normalises_yfinance_frame():
    raw = raw_frame(["2026-01-02", "2026-01-05", "2026-01-05"])
    df = clean_prices(raw)
    assert list(df.columns) == ["date", "open", "high", "low", "close", "adj_close", "volume"]
    assert len(df) == 2  # duplicate date removed
    assert df["date"].iloc[0] == date(2026, 1, 2)


def test_clean_prices_handles_empty():
    assert clean_prices(pd.DataFrame()).empty


def test_ingest_is_incremental_and_idempotent(session_factory):
    calls = []

    def fake_fetch(symbol, start=None, period="5y"):
        calls.append(start)
        days = ["2026-01-02", "2026-01-05"] if start is None else ["2026-01-05", "2026-01-06"]
        return clean_prices(raw_frame(days))

    info = lambda s: {"name": "Test Corp", "currency": "USD"}
    with session_factory() as s:
        assert ingest_symbol(s, "test", fetcher=fake_fetch, info_fetcher=info) == 2
        # second run asks only for data after the last stored day, and skips the overlap
        assert ingest_symbol(s, "test", fetcher=fake_fetch, info_fetcher=info) == 1
    assert calls == [None, date(2026, 1, 6)]


def test_api_returns_stored_prices(session_factory):
    with session_factory() as s:
        ingest_symbol(s, "TEST", fetcher=lambda *a, **k: clean_prices(raw_frame(["2026-01-02", "2026-01-05"])),
                      info_fetcher=lambda s: {"name": "Test Corp", "currency": "USD"})

    def override():
        with session_factory() as s:
            yield s

    app.dependency_overrides[get_session] = override
    try:
        client = TestClient(app)
        tickers = client.get("/tickers").json()
        assert tickers[0]["symbol"] == "TEST" and tickers[0]["rows"] == 2
        prices = client.get("/prices/test", params={"start": "2026-01-05"}).json()
        assert [p["date"] for p in prices] == ["2026-01-05"]
        assert client.get("/prices/NOPE").status_code == 404
    finally:
        app.dependency_overrides.clear()


def test_export_site_writes_json(session_factory, tmp_path):
    import json
    from app.export_site import export

    with session_factory() as s:
        ingest_symbol(s, "^HSI", fetcher=lambda *a, **k: clean_prices(raw_frame(["2026-01-02", "2026-01-05"])),
                      info_fetcher=lambda s: {"name": "HANG SENG INDEX", "currency": "HKD"})
        assert export(s, tmp_path) == 1

    meta = json.loads((tmp_path / "tickers.json").read_text())
    t = meta["tickers"][0]
    assert t["name"] == "Hang Seng Index" and t["group"] == "Indexes" and t["is_index"]
    assert t["last"] == 11.5 and t["prev"] == 10.5
    series = json.loads((tmp_path / "prices" / "_HSI.json").read_text())
    assert series[0] == ["2026-01-02", 10.5, 10.4, None, None, None]


def test_export_builds_insights_for_several_markets(session_factory, tmp_path):
    import json
    import numpy as np
    from app.export_site import export

    rng = np.random.default_rng(0)
    days = pd.bdate_range("2023-01-02", periods=400)

    def fetch_for(seed):
        def fetch(symbol, start=None, period="5y"):
            p = 100 * np.cumprod(1 + np.random.default_rng(seed).normal(0.0004, 0.01, len(days)))
            cols = pd.MultiIndex.from_product([["Open", "High", "Low", "Close", "Adj Close", "Volume"], [symbol]])
            raw = pd.DataFrame(np.column_stack([p, p, p, p, p, np.full(len(p), 1000)]), index=pd.DatetimeIndex(days, name="Date"), columns=cols)
            return clean_prices(raw)
        return fetch

    with session_factory() as s:
        for i, sym in enumerate(["^GSPC", "^HSI", "AAPL"]):
            ingest_symbol(s, sym, fetcher=fetch_for(i), info_fetcher=lambda x: {"name": None, "currency": "USD"})
        assert export(s, tmp_path) == 3

    ins = json.loads((tmp_path / "insights.json").read_text())
    assert ins["symbols"] == ["^GSPC", "^HSI", "AAPL"]
    assert set(ins["stats"]) == {"^GSPC", "^HSI", "AAPL"}
    assert ins["corr_weekly"][0][0] == 1.0
    assert ins["rolling_corr"]["a"] == "^HSI" and len(ins["rolling_corr"]["values"]) > 10
    meta = json.loads((tmp_path / "tickers.json").read_text())
    assert len(meta["tickers"][0]["spark"]) == 90
    rows = json.loads((tmp_path / "prices" / "_GSPC.json").read_text())
    assert rows[49][3] is not None and rows[48][3] is None  # 50-day average starts on day 50
    assert rows[-1][4] is not None and 0 <= rows[-1][5] <= 100

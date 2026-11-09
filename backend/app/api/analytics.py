"""Analytics endpoints: risk numbers, technical indicators, market comparison."""
import math
import re
from datetime import date

import pandas as pd
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from app import analytics as an
from app.db import get_session
from app.models import Price, Ticker

router = APIRouter(prefix="/analytics", tags=["analytics"])

DEFAULT_BENCHMARK = "^GSPC"
TOKEN = re.compile(r"^(sma|ema|rsi|bb)(\d{1,3})$|^macd$")


# ---- helpers -----------------------------------------------------------------

def load_close(session: Session, symbol: str) -> pd.Series:
    """Adjusted close (falls back to close) for one symbol, indexed by date."""
    ticker = session.scalar(select(Ticker).where(Ticker.symbol == symbol.upper()))
    if ticker is None:
        raise HTTPException(404, f"{symbol.upper()} is not tracked yet. Run the ingest pipeline for it first.")
    rows = session.execute(
        select(Price.date, Price.adj_close, Price.close).where(Price.ticker_id == ticker.id).order_by(Price.date)
    ).all()
    s = pd.Series(
        [a if a is not None else c for _, a, c in rows],
        index=pd.to_datetime([d for d, _, _ in rows]),
        name=ticker.symbol,
        dtype=float,
    )
    return s


def window(s: pd.Series, start: date | None, end: date | None) -> pd.Series:
    if start:
        s = s[s.index >= pd.Timestamp(start)]
    if end:
        s = s[s.index <= pd.Timestamp(end)]
    return s


def need(s: pd.Series, n: int, what: str) -> None:
    if len(s) < n:
        raise HTTPException(422, f"Not enough data for {what}: {len(s)} trading days in range, need at least {n}.")


def clean(x):
    """Make numpy/pandas values JSON friendly."""
    if isinstance(x, dict):
        return {k: clean(v) for k, v in x.items()}
    if isinstance(x, (list, tuple)):
        return [clean(v) for v in x]
    if x is None or x is pd.NaT:
        return None
    if isinstance(x, pd.Timestamp):
        return x.date().isoformat()
    if isinstance(x, float):
        return None if math.isnan(x) or math.isinf(x) else round(x, 6)
    if hasattr(x, "item"):  # numpy scalar
        return clean(x.item())
    return x


# ---- endpoints -----------------------------------------------------------------

@router.get("/{symbol}/risk")
def risk(
    symbol: str,
    start: date | None = None,
    end: date | None = None,
    benchmark: str | None = Query(default=DEFAULT_BENCHMARK, description="Symbol to compute beta and correlation against. Empty to skip."),
    session: Session = Depends(get_session),
):
    """Growth, volatility, Sharpe ratio, worst fall, 95% one-day Value at Risk and more."""
    s = window(load_close(session, symbol), start, end)
    need(s, 30, "risk metrics")
    bench = None
    if benchmark and benchmark.upper() != symbol.upper():
        bench = window(load_close(session, benchmark), start, end)
    report = an.risk_report(s, bench)
    report["symbol"] = symbol.upper()
    report["benchmark"] = benchmark.upper() if bench is not None else None
    return clean(report)


@router.get("/{symbol}/indicators")
def indicators(
    symbol: str,
    include: str = Query(default="sma50,sma200,rsi14", description="Comma-separated: smaN, emaN, rsiN, bbN (Bollinger), macd"),
    start: date | None = None,
    end: date | None = None,
    session: Session = Depends(get_session),
):
    """Daily close plus the requested indicators.

    Indicators are calculated on the full history before the date filter is
    applied, so a 200-day average is already correct on the first day shown.
    """
    tokens = [t.strip().lower() for t in include.split(",") if t.strip()]
    bad = [t for t in tokens if not TOKEN.match(t) or (t != "macd" and not 2 <= int(TOKEN.match(t).group(2)) <= 400)]
    if bad:
        raise HTTPException(400, f"Unknown or out-of-range indicator(s): {', '.join(bad)}. Use smaN, emaN, rsiN or bbN with N from 2 to 400, or macd.")

    close = load_close(session, symbol)
    frame = pd.DataFrame({"close": close})
    for t in tokens:
        if t == "macd":
            frame = frame.join(an.macd(close))
            continue
        kind, n = TOKEN.match(t).group(1), int(TOKEN.match(t).group(2))
        if kind == "sma":
            frame[t] = an.sma(close, n)
        elif kind == "ema":
            frame[t] = an.ema(close, n)
        elif kind == "rsi":
            frame[t] = an.rsi(close, n)
        elif kind == "bb":
            bands = an.bollinger(close, n)
            frame[[f"{t}_upper", f"{t}_middle", f"{t}_lower"]] = bands[["upper", "middle", "lower"]].to_numpy()

    frame = frame[(frame.index >= pd.Timestamp(start)) if start else slice(None)]
    if end:
        frame = frame[frame.index <= pd.Timestamp(end)]
    rows = [{"date": d.date().isoformat(), **{k: clean(v) for k, v in row.items()}} for d, row in frame.iterrows()]
    return {"symbol": symbol.upper(), "indicators": tokens, "rows": rows}


@router.get("/compare")
def compare(
    symbols: str = Query(..., description="Comma-separated symbols, e.g. ^GSPC,^HSI,2800.HK"),
    start: date | None = None,
    end: date | None = None,
    session: Session = Depends(get_session),
):
    """Side-by-side growth and risk, plus the correlation of weekly returns."""
    syms = list(dict.fromkeys(s.strip().upper() for s in symbols.split(",") if s.strip()))
    if not 2 <= len(syms) <= 20:
        raise HTTPException(400, "Give between 2 and 20 symbols.")
    prices = pd.DataFrame({s: window(load_close(session, s), start, end) for s in syms}).sort_index()
    summary = an.summary(prices)
    missing = [s for s in syms if s not in summary.index]
    if missing:
        raise HTTPException(422, f"Not enough data in this range for: {', '.join(missing)}.")
    corr = an.correlation(prices, "weekly").reindex(index=syms, columns=syms)
    return clean({
        "symbols": syms,
        "summary": {s: summary.loc[s].to_dict() for s in syms},
        "correlation_weekly": corr.to_numpy().tolist(),
    })

from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.db import get_session
from app.models import Price, Ticker

router = APIRouter(tags=["market data"])


class TickerOut(BaseModel):
    symbol: str
    name: str | None
    currency: str | None
    first_date: date | None
    last_date: date | None
    rows: int


class PriceOut(BaseModel):
    date: date
    open: float | None
    high: float | None
    low: float | None
    close: float
    adj_close: float | None
    volume: int | None


@router.get("/tickers", response_model=list[TickerOut])
def list_tickers(session: Session = Depends(get_session)):
    stmt = (
        select(Ticker, func.min(Price.date), func.max(Price.date), func.count(Price.id))
        .outerjoin(Price)
        .group_by(Ticker.id)
        .order_by(Ticker.symbol)
    )
    return [
        TickerOut(symbol=t.symbol, name=t.name, currency=t.currency, first_date=lo, last_date=hi, rows=n)
        for t, lo, hi, n in session.execute(stmt)
    ]


@router.get("/prices/{symbol}", response_model=list[PriceOut])
def get_prices(
    symbol: str,
    start: date | None = None,
    end: date | None = None,
    limit: int = Query(default=5000, le=20000),
    session: Session = Depends(get_session),
):
    ticker = session.scalar(select(Ticker).where(Ticker.symbol == symbol.upper()))
    if ticker is None:
        raise HTTPException(404, f"{symbol.upper()} is not tracked yet. Run the ingest pipeline for it first.")
    stmt = select(Price).where(Price.ticker_id == ticker.id)
    if start:
        stmt = stmt.where(Price.date >= start)
    if end:
        stmt = stmt.where(Price.date <= end)
    rows = session.scalars(stmt.order_by(Price.date.desc()).limit(limit)).all()
    return list(reversed(rows))

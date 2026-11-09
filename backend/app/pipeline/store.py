"""Save cleaned price frames into the database without duplicates."""
from datetime import date, datetime, timedelta, timezone

import pandas as pd
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import Price, Ticker


def get_or_create_ticker(session: Session, symbol: str, name: str | None = None, currency: str | None = None) -> Ticker:
    symbol = symbol.upper()
    ticker = session.scalar(select(Ticker).where(Ticker.symbol == symbol))
    if ticker is None:
        ticker = Ticker(symbol=symbol)
        session.add(ticker)
    ticker.name = name or ticker.name
    ticker.currency = currency or ticker.currency
    session.flush()
    return ticker


def last_stored_date(session: Session, ticker: Ticker) -> date | None:
    return session.scalar(select(func.max(Price.date)).where(Price.ticker_id == ticker.id))


def next_start_date(session: Session, ticker: Ticker) -> date | None:
    """Day after the last stored row, or None for a full backfill."""
    last = last_stored_date(session, ticker)
    return last + timedelta(days=1) if last else None


def save_prices(session: Session, ticker: Ticker, df: pd.DataFrame) -> int:
    """Insert rows whose date isn't stored yet. Returns rows inserted."""
    if df.empty:
        return 0
    existing = set(session.scalars(
        select(Price.date).where(Price.ticker_id == ticker.id, Price.date.in_(list(df["date"])))
    ))
    new_rows = [
        Price(
            ticker_id=ticker.id,
            date=row.date,
            open=_num(row.open),
            high=_num(row.high),
            low=_num(row.low),
            close=float(row.close),
            adj_close=_num(row.adj_close),
            volume=int(row.volume) if pd.notna(row.volume) else None,
        )
        for row in df.itertuples(index=False)
        if row.date not in existing
    ]
    session.add_all(new_rows)
    ticker.last_updated = datetime.now(timezone.utc)
    session.flush()
    return len(new_rows)


def _num(value):
    return None if pd.isna(value) else float(value)

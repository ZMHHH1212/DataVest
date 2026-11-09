from datetime import date, datetime

from sqlalchemy import BigInteger, Date, DateTime, Float, ForeignKey, String, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base


class Ticker(Base):
    __tablename__ = "tickers"

    id: Mapped[int] = mapped_column(primary_key=True)
    symbol: Mapped[str] = mapped_column(String(20), unique=True, index=True)
    name: Mapped[str | None] = mapped_column(String(200))
    currency: Mapped[str | None] = mapped_column(String(10))
    last_updated: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    prices: Mapped[list["Price"]] = relationship(back_populates="ticker", cascade="all, delete-orphan")


class Price(Base):
    """One row per symbol per trading day (daily OHLCV)."""

    __tablename__ = "prices"
    __table_args__ = (UniqueConstraint("ticker_id", "date", name="uq_price_ticker_date"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    ticker_id: Mapped[int] = mapped_column(ForeignKey("tickers.id"), index=True)
    date: Mapped[date] = mapped_column(Date, index=True)
    open: Mapped[float | None] = mapped_column(Float)
    high: Mapped[float | None] = mapped_column(Float)
    low: Mapped[float | None] = mapped_column(Float)
    close: Mapped[float] = mapped_column(Float)
    adj_close: Mapped[float | None] = mapped_column(Float)
    volume: Mapped[int | None] = mapped_column(BigInteger)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    ticker: Mapped[Ticker] = relationship(back_populates="prices")

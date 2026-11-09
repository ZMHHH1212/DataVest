"""Export stored prices as static JSON for the website (frontend/data/).

    python -m app.export_site            # writes ../frontend/data
    python -m app.export_site --out DIR
"""
import argparse
import json
import math
from datetime import datetime, timezone
from pathlib import Path

from sqlalchemy import select
from sqlalchemy.orm import Session

import pandas as pd

from app import analytics as an
from app.config import WATCHLIST_GROUPS
from app.db import SessionLocal, init_db
from app.models import Price, Ticker

DEFAULT_OUT = Path(__file__).resolve().parents[2] / "frontend" / "data"


def file_name(symbol: str) -> str:
    return symbol.replace("^", "_") + ".json"


def group_of(symbol: str) -> tuple[str, str | None]:
    for group, members in WATCHLIST_GROUPS.items():
        if symbol in members:
            return group, members[symbol]
    return "Other", None


def export(session: Session, out: Path) -> int:
    (out / "prices").mkdir(parents=True, exist_ok=True)
    tickers = []
    wide: dict[str, pd.Series] = {}
    for ticker in session.scalars(select(Ticker).order_by(Ticker.symbol)):
        rows = session.execute(
            select(Price.date, Price.close, Price.adj_close)
            .where(Price.ticker_id == ticker.id)
            .order_by(Price.date)
        ).all()
        if len(rows) < 2:
            continue
        # [date, close, adjusted close, 50-day avg, 200-day avg, RSI 14]
        # Adjusted close includes dividends and is used for returns; indicators use the plotted close.
        close = pd.Series([c for _, c, _ in rows], dtype=float)
        ind = pd.DataFrame({
            "sma50": an.sma(close, 50),
            "sma200": an.sma(close, 200),
            "rsi14": an.rsi(close, 14),
        }).round({"sma50": 4, "sma200": 4, "rsi14": 2})
        ind = ind.astype(object).where(ind.notna(), None)
        series = [
            [d.isoformat(), round(c, 4), round(a if a is not None else c, 4), *ind.iloc[i].tolist()]
            for i, (d, c, a) in enumerate(rows)
        ]
        (out / "prices" / file_name(ticker.symbol)).write_text(json.dumps(series, separators=(",", ":")))

        wide[ticker.symbol] = pd.Series(
            [r[2] for r in series], index=pd.to_datetime([r[0] for r in series])
        )
        group, friendly = group_of(ticker.symbol)
        tickers.append({
            "symbol": ticker.symbol,
            "name": friendly or ticker.name or ticker.symbol,
            "group": group,
            "currency": ticker.currency,
            "is_index": ticker.symbol.startswith("^"),
            "file": file_name(ticker.symbol),
            "last_date": series[-1][0],
            "last": series[-1][1],
            "prev": series[-2][1],
            "spark": [r[1] for r in series[-90:]],
        })

    order = list(WATCHLIST_GROUPS) + ["Other"]
    tickers.sort(key=lambda t: (order.index(t["group"]), t["symbol"]))
    meta = {"generated_at": datetime.now(timezone.utc).isoformat(timespec="minutes"), "tickers": tickers}
    (out / "tickers.json").write_text(json.dumps(meta, indent=1))

    if len(wide) >= 2:
        prices = pd.DataFrame(wide).sort_index()
        insights = build_insights(prices, [t["symbol"] for t in tickers])
        insights["generated_at"] = meta["generated_at"]
        (out / "insights.json").write_text(json.dumps(insights, separators=(",", ":")))
    return len(tickers)


def _clean(x):
    """JSON-safe numbers/dates (NaN -> None, Timestamp -> ISO date)."""
    if x is None or x is pd.NaT or (isinstance(x, float) and math.isnan(x)):
        return None
    if isinstance(x, pd.Timestamp):
        return x.date().isoformat()
    if isinstance(x, float):
        return round(x, 5)
    return x


def _matrix(df: pd.DataFrame, order: list[str]) -> list[list]:
    df = df.reindex(index=order, columns=order)
    return [[_clean(float(v)) for v in row] for row in df.to_numpy()]


def build_insights(prices: pd.DataFrame, order: list[str]) -> dict:
    """Numbers behind the Insights page."""
    order = [s for s in order if s in prices.columns]
    summary = an.summary(prices)
    stats = {
        sym: {k: _clean(v) for k, v in row.items()}
        for sym, row in summary.iterrows()
    }

    weekly = prices.ffill().resample("W-FRI").last()
    growth = weekly / weekly.bfill().iloc[0] * 100

    roll_vol = an.rolling_volatility(prices).ffill().resample("W-FRI").last()

    wret = an.weekly_returns(prices)
    pair = None
    if {"^HSI", "^GSPC"} <= set(prices.columns):
        rc = wret["^HSI"].rolling(52).corr(wret["^GSPC"]).dropna()
        pair = {"a": "^HSI", "b": "^GSPC", "dates": [d.date().isoformat() for d in rc.index], "values": [_clean(float(v)) for v in rc]}

    def table(df):
        return {
            "dates": [d.date().isoformat() for d in df.index],
            "series": {s: [_clean(float(v)) for v in df[s]] for s in order if s in df.columns},
        }

    return {
        "symbols": order,
        "stats": stats,
        "growth": table(growth),
        "rolling_vol": table(roll_vol.dropna(how="all")),
        "corr_weekly": _matrix(an.correlation(prices, "weekly"), order),
        "corr_daily": _matrix(an.correlation(prices, "daily"), order),
        "rolling_corr": pair,
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--out", type=Path, default=DEFAULT_OUT)
    args = parser.parse_args()
    init_db()
    with SessionLocal() as session:
        n = export(session, args.out)
    print(f"Exported {n} symbols to {args.out}")


if __name__ == "__main__":
    main()

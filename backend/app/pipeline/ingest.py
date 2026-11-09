"""Run the pipeline: fetch -> clean -> store, incrementally.

    python -m app.pipeline.ingest                 # website markets + research universe
    python -m app.pipeline.ingest AAPL 0700.HK    # specific symbols
    python -m app.pipeline.ingest --period max    # longer first backfill
"""
import argparse
import logging
from collections.abc import Callable

import pandas as pd
from sqlalchemy.orm import Session

from app.config import ALL_SYMBOLS
from app.db import SessionLocal, init_db
from app.pipeline import fetch, store

log = logging.getLogger("datavest.ingest")


def ingest_symbol(
    session: Session,
    symbol: str,
    period: str = "5y",
    fetcher: Callable[..., pd.DataFrame] = fetch.fetch_prices,
    info_fetcher: Callable[[str], dict] = fetch.fetch_info,
) -> int:
    ticker = store.get_or_create_ticker(session, symbol)
    if ticker.name is None:
        info = info_fetcher(symbol)
        ticker.name, ticker.currency = info["name"], info["currency"]

    start = store.next_start_date(session, ticker)
    df = fetcher(symbol, start=start, period=period)
    inserted = store.save_prices(session, ticker, df)
    session.commit()
    log.info("%-8s %s -> %d new rows", symbol, f"from {start}" if start else f"backfill {period}", inserted)
    return inserted


def run(symbols: list[str], period: str = "5y") -> dict[str, int | str]:
    init_db()
    results: dict[str, int | str] = {}
    with SessionLocal() as session:
        for symbol in symbols:
            try:
                results[symbol] = ingest_symbol(session, symbol, period)
            except Exception as exc:  # one bad symbol shouldn't stop the rest
                session.rollback()
                log.error("%s failed: %s", symbol, exc)
                results[symbol] = f"error: {exc}"
    return results


def main() -> None:
    parser = argparse.ArgumentParser(description="Fetch daily market data into the DataVest DB.")
    parser.add_argument("symbols", nargs="*", default=ALL_SYMBOLS, help="default: website markets + research universe")
    parser.add_argument("--period", default="5y", help="first-time backfill length (e.g. 1y, 5y, max)")
    args = parser.parse_args()
    logging.basicConfig(level=logging.INFO, format="%(message)s")
    run([s.upper() for s in args.symbols], args.period)


if __name__ == "__main__":
    main()

"""Export stored prices as static JSON for the website (frontend/data/).

    python -m app.export_site            # writes ../frontend/data
    python -m app.export_site --out DIR
"""
import argparse
import json
from datetime import datetime, timezone
from pathlib import Path

from sqlalchemy import select
from sqlalchemy.orm import Session

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
    for ticker in session.scalars(select(Ticker).order_by(Ticker.symbol)):
        rows = session.execute(
            select(Price.date, Price.close, Price.adj_close)
            .where(Price.ticker_id == ticker.id)
            .order_by(Price.date)
        ).all()
        if len(rows) < 2:
            continue
        # [date, close, adjusted close]; adjusted close includes dividends, used for returns
        series = [[d.isoformat(), round(c, 4), round(a if a is not None else c, 4)] for d, c, a in rows]
        (out / "prices" / file_name(ticker.symbol)).write_text(json.dumps(series, separators=(",", ":")))

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
        })

    order = list(WATCHLIST_GROUPS) + ["Other"]
    tickers.sort(key=lambda t: (order.index(t["group"]), t["symbol"]))
    meta = {"generated_at": datetime.now(timezone.utc).isoformat(timespec="minutes"), "tickers": tickers}
    (out / "tickers.json").write_text(json.dumps(meta, indent=1))
    return len(tickers)


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

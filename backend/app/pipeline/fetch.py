"""Download daily prices from Yahoo Finance and normalise them."""
from datetime import date

import pandas as pd

COLUMNS = ["date", "open", "high", "low", "close", "adj_close", "volume"]


def clean_prices(raw: pd.DataFrame) -> pd.DataFrame:
    """Turn a raw yfinance frame into a tidy one with COLUMNS.

    - flattens yfinance's MultiIndex columns
    - lower/snake-cases names
    - drops rows with no close price and duplicate dates
    """
    if raw is None or raw.empty:
        return pd.DataFrame(columns=COLUMNS)

    df = raw.copy()
    if isinstance(df.columns, pd.MultiIndex):
        df.columns = df.columns.get_level_values(0)
    df = df.rename(columns=lambda c: str(c).strip().lower().replace(" ", "_"))
    df = df.reset_index().rename(columns={"Date": "date", "index": "date", "datetime": "date"})
    df["date"] = pd.to_datetime(df["date"]).dt.date

    if "adj_close" not in df.columns:
        df["adj_close"] = df["close"]
    for col in COLUMNS:
        if col not in df.columns:
            df[col] = None

    df = df[COLUMNS].dropna(subset=["close"])
    df = df.drop_duplicates(subset="date", keep="last").sort_values("date")
    df["volume"] = df["volume"].fillna(0).astype("int64")
    return df.reset_index(drop=True)


def fetch_prices(symbol: str, start: date | None = None, period: str = "5y") -> pd.DataFrame:
    """Fetch daily prices. Uses `start` for incremental updates, else `period`."""
    import yfinance as yf

    kwargs = {"start": start.isoformat()} if start else {"period": period}
    raw = yf.download(symbol, interval="1d", auto_adjust=False, progress=False, **kwargs)
    return clean_prices(raw)


def fetch_info(symbol: str) -> dict:
    """Best-effort name/currency lookup; never fails the pipeline."""
    try:
        import yfinance as yf

        info = yf.Ticker(symbol).info or {}
        return {"name": info.get("shortName") or info.get("longName"), "currency": info.get("currency")}
    except Exception:
        return {"name": None, "currency": None}

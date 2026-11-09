import os

from dotenv import load_dotenv

load_dotenv()

# Defaults to a local SQLite file so the project runs with zero setup.
# Point it at Postgres/TimescaleDB (see docker-compose.yml) when ready.
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./datavest.db")

# Default symbols to track, grouped for the website.
WATCHLIST_GROUPS = {
    "Indexes": {
        "^GSPC": "S&P 500",
        "^IXIC": "Nasdaq Composite",
        "^HSI": "Hang Seng Index",
    },
    "Index funds": {
        "SPY": "SPDR S&P 500 ETF",
        "2800.HK": "Tracker Fund of Hong Kong",
    },
    "US stocks": {
        "AAPL": "Apple",
        "MSFT": "Microsoft",
        "NVDA": "Nvidia",
    },
    "Hong Kong stocks": {
        "0700.HK": "Tencent",
        "0005.HK": "HSBC",
    },
}
DEFAULT_WATCHLIST = [symbol for group in WATCHLIST_GROUPS.values() for symbol in group]

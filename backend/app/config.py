import os

from dotenv import load_dotenv

load_dotenv()

# Defaults to a local SQLite file so the project runs with zero setup.
# Point it at Postgres/TimescaleDB (see docker-compose.yml) when ready.
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./datavest.db")

# Default symbols to track: US + Hong Kong indexes, ETFs and large caps.
DEFAULT_WATCHLIST = [
    "^GSPC",    # S&P 500
    "^IXIC",    # Nasdaq Composite
    "^HSI",     # Hang Seng Index
    "SPY",      # S&P 500 ETF
    "2800.HK",  # Tracker Fund of Hong Kong
    "AAPL",
    "MSFT",
    "NVDA",
    "0700.HK",  # Tencent
    "0005.HK",  # HSBC
]

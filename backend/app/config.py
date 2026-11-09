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

# Wider set of large US and Hong Kong stocks used only for research (market map, clustering).
# They are stored in the database but not listed on the Markets page. (symbol: (name, sector))
RESEARCH_UNIVERSE = {
    # United States
    "AAPL": ("Apple", "Technology"),
    "MSFT": ("Microsoft", "Technology"),
    "NVDA": ("Nvidia", "Technology"),
    "AMZN": ("Amazon", "Consumer"),
    "GOOGL": ("Alphabet", "Communication"),
    "META": ("Meta", "Communication"),
    "NFLX": ("Netflix", "Communication"),
    "DIS": ("Disney", "Communication"),
    "JPM": ("JPMorgan Chase", "Financials"),
    "BAC": ("Bank of America", "Financials"),
    "V": ("Visa", "Financials"),
    "MA": ("Mastercard", "Financials"),
    "XOM": ("Exxon Mobil", "Energy"),
    "CVX": ("Chevron", "Energy"),
    "JNJ": ("Johnson & Johnson", "Health care"),
    "PFE": ("Pfizer", "Health care"),
    "UNH": ("UnitedHealth", "Health care"),
    "PG": ("Procter & Gamble", "Consumer staples"),
    "KO": ("Coca-Cola", "Consumer staples"),
    "WMT": ("Walmart", "Consumer staples"),
    "HD": ("Home Depot", "Consumer"),
    "CAT": ("Caterpillar", "Industrials"),
    "BA": ("Boeing", "Industrials"),
    "NEE": ("NextEra Energy", "Utilities"),
    # Hong Kong
    "0700.HK": ("Tencent", "Communication"),
    "0941.HK": ("China Mobile", "Communication"),
    "9988.HK": ("Alibaba", "Consumer"),
    "3690.HK": ("Meituan", "Consumer"),
    "0027.HK": ("Galaxy Entertainment", "Consumer"),
    "1810.HK": ("Xiaomi", "Technology"),
    "0005.HK": ("HSBC", "Financials"),
    "1299.HK": ("AIA", "Financials"),
    "0939.HK": ("China Construction Bank", "Financials"),
    "1398.HK": ("ICBC", "Financials"),
    "2318.HK": ("Ping An Insurance", "Financials"),
    "0388.HK": ("HKEX", "Financials"),
    "0883.HK": ("CNOOC", "Energy"),
    "0857.HK": ("PetroChina", "Energy"),
    "0016.HK": ("Sun Hung Kai Properties", "Real estate"),
    "1109.HK": ("China Resources Land", "Real estate"),
    "0002.HK": ("CLP Holdings", "Utilities"),
    "0003.HK": ("HK and China Gas", "Utilities"),
    "1177.HK": ("Sino Biopharmaceutical", "Health care"),
}
ALL_SYMBOLS = list(dict.fromkeys(DEFAULT_WATCHLIST + list(RESEARCH_UNIVERSE)))

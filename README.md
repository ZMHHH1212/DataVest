# DataVest

A web app that teaches people how money works — budgeting, saving, building wealth —
and explains markets (stocks, indexes, ETFs, hedge funds) using **real, live market data**.

> Educational tool only. Not financial advice.

## Features (planned)
- **Learn**: bite-sized lessons from money basics to how hedge funds work, with quizzes
- **Money tools**: budget tracker, savings goals, compound-interest and retirement calculators
- **Market explorer**: live prices, index tracking, charts with indicators explained in plain language
- **Insights**: data collection + analysis turned into explainable, educational signals
- **AI tutor**: ask questions about any concept or chart

## Stack
- Backend: Python, FastAPI
- Data: PostgreSQL (+ TimescaleDB for price history), pandas
- Market data: yfinance / Alpha Vantage APIs
- Frontend: Next.js (React) + charts
- Deploy: Docker

## Roadmap
Data-first order, so the data science and AI work sits at the centre.

- [x] **Phase 0 — Foundations**: repo, stack, skeleton
- [x] **Phase 1 — Market data pipeline**: fetch daily prices (US + HK), clean, store incrementally, serve via API
- [ ] **Phase 2 — Exploratory analysis**: Jupyter notebooks on returns, volatility, drawdowns, correlations (US vs HK)
- [ ] **Phase 3 — Analytics API**: indicators (moving averages, RSI), risk metrics (volatility, Sharpe, max drawdown, VaR)
- [ ] **Phase 4 — Modelling + evaluation**: volatility forecasting (GARCH vs ML) and stock clustering, always compared against a simple baseline
- [ ] **Phase 5 — Dashboard**: Next.js charts with every metric explained in plain language
- [ ] **Phase 6 — Learn + money tools**: lessons, quizzes, budget tracker, savings / compound-interest calculators
- [ ] **Phase 7 — AI tutor + deploy**: ask questions about any concept or chart; Docker deployment; project write-up

## Run it
```bash
cd backend
pip install -r requirements.txt
python -m app.pipeline.ingest              # fetch the default watchlist (5 years)
python -m app.pipeline.ingest AAPL 0700.HK # or specific symbols
uvicorn app.main:app --reload              # API at http://localhost:8000/docs
```
Data goes into a local SQLite file by default. To use Postgres/TimescaleDB instead:
`docker compose up -d db`, then copy `backend/.env.example` to `backend/.env`.

Re-running the ingest only fetches days you don't have yet, so it's safe to schedule
(e.g. a daily cron job after market close).

### API
| Endpoint | What it returns |
|---|---|
| `GET /tickers` | tracked symbols with date range and row count |
| `GET /prices/{symbol}?start=&end=` | daily OHLCV prices |

### Tests
```bash
pip install -r requirements-dev.txt && pytest
```

## Project layout
```
backend/app/
  pipeline/fetch.py   download + clean (yfinance -> tidy DataFrame)
  pipeline/store.py   de-duplicated, incremental saves
  pipeline/ingest.py  CLI that runs fetch -> store
  api/prices.py       REST endpoints
  models.py           tickers + prices tables
```

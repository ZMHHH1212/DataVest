# DataVest

**Live site:** https://zmhhh1212.github.io/DataVest/

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
- [x] **Website**: markets page, Insights page, Google sign-in with a synced watchlist; rebuilt with fresh prices every weekday
- [x] **Phase 2 — Exploratory analysis**: [US vs Hong Kong notebook](analysis/01_us_vs_hk_markets.ipynb) on growth, volatility, drawdowns and correlations, including the time-zone effect ([read it on the site](https://zmhhh1212.github.io/DataVest/analysis/01_us_vs_hk_markets.html))
- [x] **Phase 3 — Analytics API**: indicators (SMA, EMA, RSI, MACD, Bollinger bands), risk metrics (volatility, Sharpe, max drawdown, VaR, expected shortfall, beta); moving averages, RSI and a "bad day" lesson on the site
- [x] **Phase 4 — Modelling + evaluation**: [volatility forecasting](analysis/02_volatility_forecasting.ipynb) (GARCH, EWMA, HAR vs baselines, walk-forward, QLIKE) and [does RSI work?](analysis/03_does_rsi_work.ipynb) (event study with bootstrap + backtest with costs); Models page on the site
- [x] **Phase 4b — Machine learning**: [global ML models](analysis/04_machine_learning_volatility.ipynb) (ridge, gradient boosting, neural network) on engineered features with purged walk-forward; benchmarked against GARCH; permutation importance
- [x] **Phase 4c — Unsupervised learning**: [clusters and regimes](analysis/05_clusters_and_regimes.ipynb): 43-stock US + HK research universe, PCA, hierarchical clustering (silhouette, ARI vs country/sector), two-state Gaussian HMM (Baum–Welch, from scratch); market map and regimes on the Insights page
- [ ] **Phase 5 — Dashboard**: Next.js charts with every metric explained in plain language
- [x] **Phase 6 — Learn + money tools**: two tracks of lessons with quizzes and saved progress. *Money foundations* (4) and *Stock investing* (11: returns and risk, how markets work, trading in Hong Kong, price drivers, company accounts, time value of money, valuation, technical analysis, funds and ETFs, ten strategies, behavioural finance) with built-in tools: HK trade-cost calculator, bear markets from real data, balance-sheet simulator, TVM and dividend-discount calculators, moving-average crosses tested, index vs fund, DCA vs lump sum on real prices. Tools page: growth, goals, cost of waiting, pay split with Hong Kong MPF and 50/30/20. All maths tested with `node --test`
- [ ] **v2 — AI tutor**: chat assistant grounded in DataVest's lessons and live numbers (RAG), on a free tier; project write-up

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

### Website locally
```bash
python -m app.export_site                 # writes frontend/data/
python -m http.server 8000 -d ../frontend # open http://localhost:8000
```
On GitHub, `.github/workflows/site.yml` does the same every weekday and publishes to Pages.

### Google sign-in (optional)
Sign-in uses Firebase Authentication, and watchlists are stored in Firestore.
1. Create a project at https://console.firebase.google.com
2. **Authentication** → Sign-in method → enable **Google**. Under Settings → Authorized domains, add `zmhhh1212.github.io`
3. **Firestore Database** → Create database, then paste `firestore.rules` into the Rules tab and publish
4. **Project settings** → Your apps → add a **Web** app, copy its config into `frontend/firebase-config.js`

Without a config the site still works, and the watchlist is kept in the browser.

### API
| Endpoint | What it returns |
|---|---|
| `GET /tickers` | tracked symbols with date range and row count |
| `GET /prices/{symbol}?start=&end=` | daily OHLCV prices |
| `GET /analytics/{symbol}/risk?start=&end=&benchmark=^GSPC` | growth, volatility, Sharpe, worst fall, 95% VaR, expected shortfall, beta |
| `GET /analytics/{symbol}/indicators?include=sma50,sma200,rsi14,macd,bb20` | daily close plus the chosen indicators |
| `GET /analytics/compare?symbols=^GSPC,^HSI,2800.HK` | side-by-side summary and weekly correlation |

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
  analytics.py        returns, risk (VaR, beta, drawdowns), indicators (SMA, EMA, RSI, MACD, Bollinger)
  forecast.py         GARCH(1,1) by maximum likelihood, EWMA, HAR; walk-forward evaluation
  backtest.py         RSI event study (bootstrap) and long-only backtest with costs
  ml_forecast.py      global ML volatility models (ridge, gradient boosting, neural net), purged walk-forward
  unsupervised.py     PCA, hierarchical clustering, Gaussian HMM (Baum–Welch)
  export_models.py    model results for the website
  api/analytics.py    risk, indicators and comparison endpoints
  export_site.py      DB -> static JSON for the website
analysis/             Jupyter notebooks + shared chart style (run by CI)
scripts/render_notebooks.py  executed notebooks -> site-styled pages
frontend/             the website (HTML, CSS, JS + Chart.js)
  js/finance.js, js/invest.js   personal-finance and investing maths (tested in frontend/tests)
  js/lessons*.js, js/widgets.js lesson content and interactive tools
scripts/check_site.py browser check of the live site after each deploy
  models.py           tickers + prices tables
```

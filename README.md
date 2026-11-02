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
- [x] Phase 0 — Foundations: repo, stack, skeleton
- [ ] Phase 1 — Accounts & money tools: login, budget tracker, savings goals, calculators
- [ ] Phase 2 — Market data pipeline: fetch & store prices, scheduled updates, API endpoints
- [ ] Phase 3 — Market explorer UI: charts, indexes, indicators explained
- [ ] Phase 4 — Learn: lessons, quizzes, progress tracking
- [ ] Phase 5 — Analysis & AI: portfolio simulator, educational insights, AI tutor, deploy

## Run the backend
```bash
docker compose up -d db
cd backend && pip install -r requirements.txt
uvicorn app.main:app --reload
```
Open http://localhost:8000/docs

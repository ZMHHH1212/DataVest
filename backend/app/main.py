from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.api import analytics, prices
from app.db import init_db


@asynccontextmanager
async def lifespan(_: FastAPI):
    init_db()
    yield


app = FastAPI(title="DataVest", description="Finance education with real market data. Not financial advice.", lifespan=lifespan)
app.include_router(prices.router)
app.include_router(analytics.router)


@app.get("/health")
def health():
    return {"status": "ok"}

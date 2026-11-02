from fastapi import FastAPI

app = FastAPI(title="DataVest")


@app.get("/health")
def health():
    return {"status": "ok"}

from fastapi import Depends, FastAPI

from app.db import db_healthy

app = FastAPI(title="__NAME__ API", docs_url="/api/docs", openapi_url="/api/openapi.json")


def get_db_check():
    return db_healthy


@app.get("/api/v1/health")
def health(check=Depends(get_db_check)):
    return {"ok": True, "db": check()}

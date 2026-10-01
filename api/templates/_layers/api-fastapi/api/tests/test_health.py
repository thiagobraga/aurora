from fastapi.testclient import TestClient

from app.main import app, get_db_check


def test_health():
    app.dependency_overrides[get_db_check] = lambda: (lambda: True)
    res = TestClient(app).get("/api/v1/health")
    assert res.status_code == 200
    assert res.json() == {"ok": True, "db": True}
    app.dependency_overrides.clear()

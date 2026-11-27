from fastapi.testclient import TestClient

from main import app

client = TestClient(app)


def grid():
    return {
        "buses": [{"id": "A", "name": "A", "generation": 1.0, "demand": 0},
                  {"id": "B", "name": "B", "generation": 0, "demand": 1.0}],
        "lines": [{"id": "L1", "from_bus": "A", "to_bus": "B", "reactance": 0.1, "capacity": 2.0}],
        "reference_bus": "A",
    }


def test_health():
    r = client.get("/api/health")
    assert r.status_code == 200 and r.json()["status"] == "ok"


def test_analyze_ok():
    r = client.post("/api/analyze", json=grid())
    assert r.status_code == 200
    body = r.json()
    assert abs(body["lines"][0]["signed_flow"] - 1.0) < 1e-9
    assert body["b_matrix"] == [[10.0, -10.0], [-10.0, 10.0]]


def test_analyze_pydantic_validation_error_format():
    g = grid(); g["lines"][0]["reactance"] = -1
    r = client.post("/api/analyze", json=g)
    assert r.status_code == 422
    assert r.json()["error"]["code"] == "validation_error"


def test_analyze_unbalanced():
    g = grid(); g["buses"][0]["generation"] = 5
    r = client.post("/api/analyze", json=g)
    assert r.status_code == 422 and r.json()["error"]["code"] == "unbalanced"


def test_contingency_islanding_is_200_with_flag():
    r = client.post("/api/contingency", json={"grid": grid(), "line_id": "L1"})
    assert r.status_code == 200
    body = r.json()
    assert body["islanded"] is True and body["outage"] is None


def test_cors_header_for_dev_server():
    r = client.options("/api/analyze", headers={"Origin": "http://localhost:5173",
                                                 "Access-Control-Request-Method": "POST"})
    assert r.headers.get("access-control-allow-origin") == "http://localhost:5173"

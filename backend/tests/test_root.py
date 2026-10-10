import pytest
from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_root_browser_returns_html():
    response = client.get(
        "/",
        headers={
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36",
        },
    )
    assert response.status_code == 200
    assert "text/html" in response.headers["content-type"]
    assert "Server Alive" in response.text
    assert "@chetancj" in response.text
    assert "...maintained by" in response.text


def test_root_curl_returns_plaintext():
    response = client.get(
        "/",
        headers={
            "Accept": "*/*",
            "User-Agent": "curl/8.4.0",
        },
    )
    assert response.status_code == 200
    assert "text/plain" in response.headers["content-type"]
    assert "SERVER ALIVE" in response.text
    assert "...maintained by @chetancj" in response.text


def test_root_json_negotiation():
    response = client.get(
        "/",
        headers={
            "Accept": "application/json",
            "User-Agent": "PostmanRuntime/7.32.3",
        },
    )
    assert response.status_code == 200
    assert "application/json" in response.headers["content-type"]
    data = response.json()
    assert data["status"] == "SERVER ALIVE"
    assert "...maintained by @chetancj" in data["maintained_by"]
    assert data["author"] == "@chetancj"
    assert data["endpoints"]["health"] == "/api/health"
    assert data["endpoints"]["docs"] == "/docs"


def test_favicon_endpoint():
    response = client.get("/favicon.ico")
    assert response.status_code == 200
    assert "image/svg+xml" in response.headers["content-type"]

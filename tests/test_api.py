from fastapi.testclient import TestClient

from server.main import app

client = TestClient(app)


class FakeResponse:
    def __init__(self, status_code=200, payload=None):
        self.status_code = status_code
        self._payload = payload or {}

    def json(self):
        return self._payload


class FakeAsyncClient:
    def __init__(self, *args, **kwargs):
        self.timeout = kwargs.get("timeout")

    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc, traceback):
        return False


def test_health_endpoint_reports_api_status():
    response = client.get("/api/health")

    assert response.status_code == 200
    body = response.json()
    assert body["ok"] is True
    assert isinstance(body["provider_configured"], bool)


def test_generate_rejects_unsupported_upload_type():
    response = client.post(
        "/api/generate",
        files={"image": ("notes.txt", b"not an image", "text/plain")},
        data={"prompt": "A gentle camera movement"},
    )

    assert response.status_code == 415
    assert "JPG, PNG, or WebP" in response.json()["detail"]


def test_generate_rejects_mismatched_image_signature():
    response = client.post(
        "/api/generate",
        files={"image": ("photo.png", b"not-really-a-png", "image/png")},
        data={"prompt": "A gentle camera movement"},
    )

    assert response.status_code == 415
    assert "contents do not match" in response.json()["detail"]


def test_generate_rejects_blank_prompt_before_provider_call():
    response = client.post(
        "/api/generate",
        files={"image": ("photo.jpg", b"\xff\xd8\xffsample", "image/jpeg")},
        data={"prompt": "   "},
    )

    assert response.status_code == 400
    assert "prompt is required" in response.json()["detail"]


def test_generate_rejects_oversized_image():
    oversized_jpeg = b"\xff\xd8\xff" + (b"x" * (3 * 1024 * 1024))

    response = client.post(
        "/api/generate",
        files={"image": ("large.jpg", oversized_jpeg, "image/jpeg")},
        data={"prompt": "A gentle camera movement"},
    )

    assert response.status_code == 413
    assert "3 MB or smaller" in response.json()["detail"]


def test_status_endpoint_rejects_invalid_task_id():
    response = client.get("/api/generate/invalid%20task%20id")

    assert response.status_code == 400
    assert "Invalid generation task ID" in response.json()["detail"]


def test_generate_returns_configuration_error_without_api_key(monkeypatch):
    monkeypatch.setattr("server.main.RUNWAY_API_KEY", "")

    response = client.post(
        "/api/generate",
        files={"image": ("photo.jpg", b"\xff\xd8\xffsample", "image/jpeg")},
        data={"prompt": "A gentle camera movement"},
    )

    assert response.status_code == 503
    assert "RUNWAY_API_KEY" in response.json()["detail"]


def test_generate_submits_validated_image_to_provider(monkeypatch):
    captured = {}

    class SuccessfulClient(FakeAsyncClient):
        async def post(self, url, headers, json):
            captured.update(url=url, headers=headers, payload=json)
            return FakeResponse(200, {"id": "task_123", "status": "PENDING"})

    monkeypatch.setattr("server.main.RUNWAY_API_KEY", "test-secret")
    monkeypatch.setattr("server.main.httpx.AsyncClient", SuccessfulClient)

    response = client.post(
        "/api/generate",
        files={"image": ("photo.jpg", b"\xff\xd8\xffsample", "image/jpeg")},
        data={
            "prompt": "A gentle camera movement",
            "scene": "A quiet beach",
            "template": "cinematic",
            "aspect_ratio": "9:16",
            "duration": "5",
        },
    )

    assert response.status_code == 200
    assert response.json() == {"task_id": "task_123", "status": "PENDING"}
    assert captured["url"].endswith("/image_to_video")
    assert captured["headers"]["Authorization"] == "Bearer test-secret"
    assert captured["payload"]["model"]
    assert captured["payload"]["promptImage"].startswith("data:image/jpeg;base64,")
    assert "A gentle camera movement" in captured["payload"]["promptText"]
    assert captured["payload"]["ratio"] == "720:1280"
    assert captured["payload"]["duration"] == 5


def test_generate_maps_provider_rate_limit_response(monkeypatch):
    class RateLimitedClient(FakeAsyncClient):
        async def post(self, url, headers, json):
            return FakeResponse(429, {"error": "Rate limit exceeded"})

    monkeypatch.setattr("server.main.RUNWAY_API_KEY", "test-secret")
    monkeypatch.setattr("server.main.httpx.AsyncClient", RateLimitedClient)

    response = client.post(
        "/api/generate",
        files={"image": ("photo.jpg", b"\xff\xd8\xffsample", "image/jpeg")},
        data={"prompt": "A gentle camera movement"},
    )

    assert response.status_code == 429
    assert response.json()["detail"] == "Rate limit exceeded"


def test_status_endpoint_normalizes_successful_provider_task(monkeypatch):
    class CompletedClient(FakeAsyncClient):
        async def get(self, url, headers):
            assert url.endswith("/tasks/task_123")
            return FakeResponse(
                200,
                {
                    "id": "task_123",
                    "status": "SUCCEEDED",
                    "output": ["https://cdn.example.test/video.mp4"],
                },
            )

    monkeypatch.setattr("server.main.RUNWAY_API_KEY", "test-secret")
    monkeypatch.setattr("server.main.httpx.AsyncClient", CompletedClient)

    response = client.get("/api/generate/task_123")

    assert response.status_code == 200
    assert response.json() == {
        "task_id": "task_123",
        "status": "SUCCEEDED",
        "video_url": "https://cdn.example.test/video.mp4",
        "error": None,
    }

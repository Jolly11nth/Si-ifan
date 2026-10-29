import base64
import os
from typing import Optional

import httpx
from dotenv import load_dotenv
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

load_dotenv()

app = FastAPI(title="Si'ifan Studio API", version="0.1.0")

allowed_origins = [
    origin.strip()
    for origin in os.getenv("ALLOWED_ORIGINS", "http://localhost:5173").split(",")
    if origin.strip()
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=False,
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type", "Authorization"],
)

RUNWAY_API_KEY = os.getenv("RUNWAY_API_KEY", "").strip()
RUNWAY_BASE_URL = "https://api.dev.runwayml.com/v1"
RUNWAY_VERSION = "2024-11-06"
MAX_IMAGE_BYTES = 5 * 1024 * 1024
ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/webp"}

TEMPLATE_DIRECTIONS = {
    "cinematic": "cinematic film language, restrained camera movement, realistic depth of field, natural color grading",
    "ugc": "authentic candid human moment, subtle natural body language, imperfect but believable movement, documentary feel",
    "product": "premium commercial lighting, careful product framing, controlled camera movement, realistic reflections and shadows",
    "travel": "immersive travel film atmosphere, natural environmental motion, rich but realistic light, gentle camera movement",
}

RATIO_MAP = {
    "9:16": "720:1280",
    "16:9": "1280:720",
    "1:1": "960:960",
}


@app.get("/api/health")
async def health():
    return {"ok": True, "provider_configured": bool(RUNWAY_API_KEY)}


def provider_headers():
    if not RUNWAY_API_KEY:
        raise HTTPException(
            status_code=503,
            detail="Video generation is not configured. Add RUNWAY_API_KEY to the server environment.",
        )
    return {
        "Authorization": f"Bearer {RUNWAY_API_KEY}",
        "X-Runway-Version": RUNWAY_VERSION,
        "Content-Type": "application/json",
    }


@app.post("/api/generate")
async def generate_video(
    image: UploadFile = File(...),
    template: str = Form("cinematic"),
    scene: str = Form(""),
    prompt: str = Form(...),
    aspect_ratio: str = Form("9:16"),
    duration: int = Form(5),
    quality: str = Form("720p"),
):
    if image.content_type not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(status_code=415, detail="Upload a JPG, PNG, or WebP image.")
    image_bytes = await image.read(MAX_IMAGE_BYTES + 1)
    if not image_bytes:
        raise HTTPException(status_code=400, detail="The uploaded image is empty.")
    if len(image_bytes) > MAX_IMAGE_BYTES:
        raise HTTPException(status_code=413, detail="Image must be 5 MB or smaller for this generation provider.")
    if not prompt.strip():
        raise HTTPException(status_code=400, detail="A video prompt is required.")
    if len(prompt) > 900:
        raise HTTPException(status_code=400, detail="Keep the prompt under 900 characters.")
    if aspect_ratio not in RATIO_MAP:
        raise HTTPException(status_code=400, detail="Unsupported aspect ratio.")
    if duration not in (5, 8, 10):
        raise HTTPException(status_code=400, detail="Choose a duration of 5, 8, or 10 seconds.")
    if template not in TEMPLATE_DIRECTIONS:
        raise HTTPException(status_code=400, detail="Choose one of the available visual templates.")

    headers = provider_headers()
    mime = image.content_type or "image/jpeg"
    data_uri = f"data:{mime};base64,{base64.b64encode(image_bytes).decode('ascii')}"
    prompt_parts = [
        prompt.strip(),
        f"Scene/location: {scene.strip()}." if scene.strip() else "",
        f"Visual direction: {TEMPLATE_DIRECTIONS[template]}.",
        "Aim for physically plausible motion, consistent subject identity and anatomy, natural lighting, subtle expressions, coherent background details, and no exaggerated movement.",
    ]
    combined_prompt = " ".join(part for part in prompt_parts if part)
    if len(combined_prompt) > 1000:
        combined_prompt = combined_prompt[:997].rstrip() + "..."

    # Provider pricing and available model features vary. This server-side adapter
    # uses a documented image-to-video task and never exposes the API key to the browser.
    payload = {
        "model": "gen4.5",
        "promptImage": data_uri,
        "promptText": combined_prompt,
        "ratio": RATIO_MAP[aspect_ratio],
        "duration": duration,
    }
    timeout = httpx.Timeout(30.0, connect=10.0)
    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            response = await client.post(
                f"{RUNWAY_BASE_URL}/image_to_video",
                headers=headers,
                json=payload,
            )
    except httpx.TimeoutException:
        raise HTTPException(status_code=504, detail="The video provider timed out while accepting the request. Please retry.")
    except httpx.HTTPError:
        raise HTTPException(status_code=502, detail="Could not reach the video provider. Please try again shortly.")

    if response.status_code >= 400:
        try:
            provider_error = response.json()
            message = provider_error.get("error") or provider_error.get("message") or "Video provider rejected the request."
        except ValueError:
            message = "Video provider rejected the request."
        raise HTTPException(status_code=response.status_code if response.status_code < 500 else 502, detail=str(message)[:300])

    try:
        task = response.json()
    except ValueError:
        raise HTTPException(status_code=502, detail="The video provider returned an unreadable response.")
    task_id = task.get("id") or task.get("taskId")
    if not task_id:
        raise HTTPException(status_code=502, detail="The provider did not return a generation task ID.")
    return {"task_id": task_id, "status": task.get("status", "PENDING")}


@app.get("/api/generate/{task_id}")
async def get_generation(task_id: str):
    if not task_id or len(task_id) > 160 or any(ch not in "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-_" for ch in task_id):
        raise HTTPException(status_code=400, detail="Invalid generation task ID.")
    headers = provider_headers()
    timeout = httpx.Timeout(20.0, connect=10.0)
    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            response = await client.get(f"{RUNWAY_BASE_URL}/tasks/{task_id}", headers=headers)
    except httpx.TimeoutException:
        raise HTTPException(status_code=504, detail="Timed out while checking generation status.")
    except httpx.HTTPError:
        raise HTTPException(status_code=502, detail="Could not reach the video provider.")

    if response.status_code >= 400:
        raise HTTPException(status_code=502, detail="Could not retrieve the generation status.")
    try:
        task = response.json()
    except ValueError:
        raise HTTPException(status_code=502, detail="The provider returned an unreadable task status.")

    status = str(task.get("status", "RUNNING")).upper()
    output = task.get("output")
    video_url: Optional[str] = None
    if isinstance(output, list) and output and isinstance(output[0], str):
        video_url = output[0]
    elif isinstance(output, dict):
        video_url = output.get("url") or output.get("video_url")
    if status in {"SUCCEEDED", "COMPLETED"} and not video_url:
        video_url = task.get("video_url")
    failure = task.get("failure") or task.get("error")
    error_message = failure if isinstance(failure, str) else (failure.get("message") if isinstance(failure, dict) else None)
    return JSONResponse({
        "task_id": task_id,
        "status": status,
        "video_url": video_url,
        "error": error_message,
    })

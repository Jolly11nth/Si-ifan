# Si'ifan Studio — AI Video Creator

Si'ifan Studio is a responsive image-to-video creator. Users upload a reference image, choose a visual template, describe the location/scene and motion, then request a video render through a server-side AI video provider.

## Features

- Drag-and-drop or browse to upload a JPG, PNG, or WebP image up to 3 MB, with preview and file-content/type checks
- Four visual directions: Cinematic, Human Story, Product Ad, and Travel Diary
- Scene/location field and detailed motion prompt
- Aspect ratio and duration controls
- Render status polling, output preview, and download/open link
- Responsive dark creator UI with accessible labels and clear error states
- FastAPI provider adapter; API credentials stay on the server

## Run locally

Requirements: Node.js 20+ and Python 3.10+.

1. Install frontend dependencies: `npm install`
2. Create a Python virtual environment and install the backend dependencies: `pip install -r requirements.txt`
3. Copy `.env.example` to `.env` and add your Runway API key as `RUNWAY_API_KEY`.
4. Start the API from the repository root: `uvicorn server.main:app --reload --port 8000`
5. In a second terminal, start the frontend: `npm run dev`
6. Open the local Vite URL printed in your terminal. Vite proxies `/api` to `http://127.0.0.1:8000` during local development.

Without a configured provider key, the UI will load, but generation requests return a clear configuration error rather than faking a result.

## Automated tests

Install the development dependencies with `pip install -r requirements-dev.txt`, then run `pytest -q` from the repository root. The suite checks API health, upload MIME/signature validation, oversized uploads, blank prompts, and invalid task IDs. CI runs these tests alongside the frontend build and backend import checks.

## Generation integration

The backend calls Runway's official image-to-video task endpoint, combines the user's prompt with scene and template direction, and polls task status through a same-origin frontend API:

- `POST /api/generate` — multipart upload + creative settings
- `GET /api/generate/{task_id}` — task status and output URL
- `GET /api/health` — basic API health and provider configuration status

For separate frontend/backend deployments, set the frontend build variable `VITE_API_BASE_URL` to the backend origin (for example, `https://your-api.example.com`) and set the backend variable `ALLOWED_ORIGINS` to the exact frontend origin. If both are served on one origin with `/api` routed to FastAPI, leave `VITE_API_BASE_URL` blank.

The API key must remain server-side. The current adapter uses Runway model `gen4.5`; provider model availability, supported durations, output ratios, and pricing can change. Check the official [Runway API reference](https://docs.dev.runwayml.com/api/) before production deployment.

## Before production

- Add authentication, per-user quotas, rate limiting, and cost/usage metering.
- Keep file-signature validation and strict upload limits enabled.
- Store generated outputs in private object storage with signed URLs and retention/deletion controls if long-term history is added.
- Add durable job records and a queue for long-running generations instead of relying only on browser polling.
- Add automated tests, monitoring, and graceful retry/cancellation behavior.
- Require users to confirm they have rights/consent for uploaded media and likenesses; clearly disclose generated content and prevent deceptive impersonation.
- Review the provider's terms, privacy policy, retention settings, and regional availability.

## Stack

- React + Vite
- FastAPI + HTTPX
- Lucide icons

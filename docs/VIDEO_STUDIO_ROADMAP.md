# Si'ifan Studio — AI generation and template editor roadmap

## Agreed product scope

Si'ifan Studio will support all three creation workflows:

1. **Image-to-video generation** — upload a still image, describe motion, choose an aspect ratio and generate a short clip.
2. **Reference-video motion transfer** — upload a subject image and a reference video, then use a compatible hosted or self-hosted model to animate the subject according to the reference motion.
3. **Editable video templates** — start from a template or uploaded video and customize text, images, video clips, audio, timing, and transitions before exporting the result.

## Proposed architecture

- **React + Vite frontend:** creation modes, uploads, template browser, editor timeline, render progress, preview, and export.
- **FastAPI backend on Railway:** validate uploads, authenticate/authorize requests when auth is added, create generation jobs, call provider adapters, and return job status.
- **Hugging Face ecosystem:** discover and evaluate compatible image-to-video and motion-transfer models and inference providers. Do not assume every model is available through a free hosted endpoint; verify endpoint capability, license, pricing, limits, and regional availability before production integration.
- **Wan-family model:** evaluate a compatible image-to-video model for image animation and a suitable Animate/motion-transfer model for reference-video workflows. Large models require an appropriate hosted GPU provider or dedicated GPU infrastructure, not a standard Railway web process.
- **VideoFlow:** evaluate its Apache-2.0-licensed core/renderers and React editor for editable timeline templates, transitions, effects, and export. Keep the editor integration isolated so it can be replaced if browser compatibility, bundle size, or export requirements are not met.
- **Object storage and job persistence:** use durable storage and a persistent job queue before offering production video uploads or long-running renders.

## Delivery phases

### Phase 1 — Reliable image-to-video provider adapter
- Replace the provider-specific assumptions with a server-side adapter interface.
- Select a supported inference provider after confirming its image-to-video endpoint, price, output format, task polling, and terms.
- Keep credentials on the backend and add clear provider-configuration health checks.
- Add tests for validation, provider errors, job status, and response normalization.

### Phase 2 — Template editor foundation
- Evaluate VideoFlow in the existing React/Vite build.
- Add a template gallery with editable text, image/video, audio, aspect ratio, and timing fields.
- Implement preview and export, with graceful fallback for browsers that do not support the required media APIs.
- Ensure uploaded assets are handled locally or through private storage; never trust arbitrary template JSON or remote media URLs.

### Phase 3 — Reference-video motion transfer
- Add a separate workflow for a subject image plus reference video.
- Enforce file-size, duration, format, and resolution limits on both client and server.
- Integrate only a provider/model that explicitly supports this task; image-to-video endpoints alone do not imply motion-transfer support.
- Display estimated wait/cost information where the provider exposes it.

### Phase 4 — Production safeguards
- Add authentication, per-user quotas, rate limits, usage/cost tracking, and abuse prevention before public launch.
- Store generation jobs and outputs durably, use signed URLs, and define deletion/retention controls.
- Require users to confirm they have rights and consent for uploaded images/videos and likenesses.
- Add cancellation/retry handling, monitoring, tests, and a documented provider fallback plan.

## Decisions and constraints

- **Do not claim the service is free** until a real provider's current free allowance is verified.
- Open-source model weights do not make hosted GPU inference free.
- Keep all provider secrets in Railway environment variables; never commit keys or expose them to Vite client variables.
- Keep the current pull request unmerged until implementation checks pass and deployment configuration is reviewed.
- The first release should prioritize a working, cost-controlled image-to-video flow; template editing and motion transfer can be delivered incrementally without pretending unsupported workflows are already functional.

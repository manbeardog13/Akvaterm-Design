# ADR 0006: VisionService adapter contract

- **Status:** Accepted (scoped; Codex ratification pending after 2026-08-18)
- **Date:** 2026-08-12
- **Decision:** All fixture detection flows through a pluggable adapter
  boundary in `src/services/vision.js`:

```
registerVisionAdapter(name, adapter)
useVisionAdapter(name)
VisionService.detect(request, { onProgress })
  -> { adapter, confidenceFloor, buckets, detections[] }
VisionService.requestSecondAngle(detection, photoMeta)
  -> { confidence }
```

`request` carries `{ walls, photosByWall }`. `onProgress` reports named
pipeline stages so the UI always shows progress with context, never a bare
spinner. The default adapter is a deterministic mock until a real backend is
ratified.

## Safety contract (binding on every adapter)

- Detections are returned in `pending` state; adapters can never pre-accept.
- Every item requires an explicit user decision (confirm / adjust / reject).
- The confidence floor (0.45) is part of the service response; items below it
  are flagged, offered a second-angle request with an explicit reason, and are
  never attached to recommendations without user verification.
- Photos and derived data stay on-device in the prototype; any future remote
  adapter requires a new ADR covering consent, retention and deletion.

## Consequences

- Milestones 4–5 build against a stable contract; swapping the mock for a real
  backend is an adapter registration, not a UI rewrite.
- The handoff packet can carry an honest, interpretable confidence map
  (buckets, verified/removed counts, second-angle requests).
- Backend failures isolate at the boundary — the UI degrades to guided-sketch
  mode, which already exists.

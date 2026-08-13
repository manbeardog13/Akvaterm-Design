// vision.js â€” VisionService: the pluggable adapter boundary for AI-assisted
// reconstruction (ADR 0006, milestone 4). Adapters are swappable; the mock
// adapter remains the local fallback. A remote adapter calls `/api/vision` and
// requires deployment env vars (publicly hosted, private key kept server-side).

import { CONFIDENCE_FLOOR, mockDetections } from "../data.js";

const adapters = new Map();
const ADAPTER_REMOTE = "remote-gemini";
const ADAPTER_MOCK = "mock";

let activeName = ADAPTER_MOCK;
let remoteProbeInFlight = null;
const API_TIMEOUT_MS = 12000;
const PIPELINE_STAGES = [
  "Ingesting photos",
  "Normalising perspective",
  "Detecting fixtures",
  "Scoring confidence",
];

function clampNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function safeDataURL(item) {
  return typeof item?.dataUrl === "string" && item.dataUrl.startsWith("data:") ? item.dataUrl : "";
}

export function registerVisionAdapter(name, adapter) {
  adapters.set(name, adapter);
}

export function useVisionAdapter(name) {
  if (!adapters.has(name)) throw new Error(`Unknown vision adapter: ${name}`);
  activeName = name;
}

export function activeVisionAdapter() {
  return activeName;
}

export function bucketize(detections) {
  return {
    high: detections.filter((d) => d.confidence >= 0.75).length,
    medium: detections.filter((d) => d.confidence >= CONFIDENCE_FLOOR && d.confidence < 0.75).length,
    low: detections.filter((d) => d.confidence < CONFIDENCE_FLOOR).length,
  };
}

function normalizeDetections(detections) {
  return detections.map((item, idx) => ({
    id: item.id || `remote-${idx + 1}`,
    type: item.type || "Fixture",
    confidence: clampNumber(item.confidence, 0),
    wall: item.wall || "north",
    at: clampNumber(item.at, 0.5),
    size: clampNumber(item.size, 0.12),
    status: item.status || "pending",
    userVerified: Boolean(item.userVerified),
  }));
}

function mockResult(request) {
  const detections = mockDetections(request.walls || []);
  return {
    adapter: ADAPTER_MOCK,
    confidenceFloor: CONFIDENCE_FLOOR,
    detections,
  };
}

async function callVisionEndpoint(payload) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), API_TIMEOUT_MS);
  try {
    const response = await fetch("/api/vision", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    if (!response.ok) {
      const text = await response.text();
      throw new Error(text || `Vision API responded ${response.status}`);
    }
    return response.json();
  } finally {
    clearTimeout(timeout);
  }
}

function buildPhotoPayload(request) {
  const payload = {};
  const photosByWall = request.photosByWall || {};
  for (const [wall, value] of Object.entries(photosByWall)) {
    payload[wall] = {
      name: value?.name || `photo-${wall}.jpg`,
      type: value?.type || "image/jpeg",
      dataUrl: safeDataURL(value),
    };
  }
  return payload;
}

async function tryRemoteDetect(request, { onProgress } = {}) {
  for (let i = 0; i < PIPELINE_STAGES.length; i += 1) {
    if (onProgress) onProgress({ stage: PIPELINE_STAGES[i], index: i + 1, total: PIPELINE_STAGES.length });
    await new Promise((resolve) => setTimeout(resolve, 80));
  }
  const result = await callVisionEndpoint({
    action: "detect",
    request: {
      walls: request.walls || [],
      photosByWall: buildPhotoPayload(request),
    },
  });
  return {
    adapter: ADAPTER_REMOTE,
    confidenceFloor: clampNumber(result.confidenceFloor, CONFIDENCE_FLOOR),
    detections: normalizeDetections(result.detections || []),
  };
}

export const VisionService = {
  async detect(request, { onProgress } = {}) {
    const adapter = adapters.get(activeName);
    if (!adapter) throw new Error("No vision adapter registered");

    try {
      const result = await adapter.detect(request, { onProgress });
      return {
        adapter: result.adapter || activeName,
        confidenceFloor: result.confidenceFloor ?? CONFIDENCE_FLOOR,
        buckets: bucketize(result.detections || []),
        detections: result.detections || [],
      };
    } catch (error) {
      if (activeName === ADAPTER_REMOTE) {
        const fallback = mockResult(request);
        return {
          adapter: fallback.adapter,
          confidenceFloor: fallback.confidenceFloor,
          buckets: bucketize(fallback.detections),
          detections: fallback.detections,
        };
      }
      throw error;
    }
  },

  async requestSecondAngle(detection, photoMeta) {
    const adapter = adapters.get(activeName);
    if (!adapter) throw new Error("No vision adapter registered");
    try {
      return adapter.secondAngle(detection, photoMeta);
    } catch (error) {
      if (activeName === ADAPTER_REMOTE) {
        return adapters.get(ADAPTER_MOCK).secondAngle(detection, photoMeta);
      }
      throw error;
    }
  },
};

export async function initializeVisionAdapter() {
  if (typeof window === "undefined") {
    return;
  }

  const params = new URLSearchParams(window.location.search);
  if (params.get("vision") === "mock") {
    activeName = ADAPTER_MOCK;
    return;
  }
  if (params.get("vision") === "remote") {
    activeName = ADAPTER_REMOTE;
    return;
  }

  const host = window.location.hostname || "";
  if (window.location.protocol === "file:" || host === "localhost" || host === "127.0.0.1" || host === "::1") {
    activeName = ADAPTER_MOCK;
    return;
  }

  if (!remoteProbeInFlight) {
    remoteProbeInFlight = (async () => {
      try {
        const result = await callVisionEndpoint({ action: "health" });
        activeName = result?.ok ? ADAPTER_REMOTE : ADAPTER_MOCK;
      } catch (_) {
        activeName = ADAPTER_MOCK;
      }
    })();
  }
  await remoteProbeInFlight;
  remoteProbeInFlight = null;
}

registerVisionAdapter(ADAPTER_MOCK, {
  stageDelay: () => new Promise((resolve) => setTimeout(resolve, 90)),
  detect: async (request) => mockResult(request),
  secondAngle: async (detection) => ({
    confidence: Math.min(0.97, clampNumber(detection.confidence, 0) + 0.34),
  }),
});

registerVisionAdapter(ADAPTER_REMOTE, {
  stageDelay: () => new Promise((resolve) => setTimeout(resolve, 120)),
  detect: tryRemoteDetect,
  secondAngle: async (detection, photoMeta) => {
    const result = await callVisionEndpoint({
      action: "second-angle",
      detection,
      photo: { name: photoMeta?.name || "capture.jpg" },
    });
    return {
      confidence: clampNumber(result.confidence, clampNumber(detection.confidence, 0)),
    };
  },
});

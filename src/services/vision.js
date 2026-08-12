// vision.js — VisionService: the pluggable adapter boundary for AI-assisted
// reconstruction (ADR 0006, milestone 4). Adapters are swappable; the mock
// adapter is the default until a real vision backend exists. Safety contract
// (docs/ai-vision-pipeline.md): adapters return detections in "pending" state,
// nothing is ever pre-accepted, and every item waits for an explicit user
// decision in the UI. Recommendations never attach below the confidence floor.

import { CONFIDENCE_FLOOR, mockDetections } from "../data.js";

const adapters = new Map();
let activeName = null;

export function registerVisionAdapter(name, adapter) {
  adapters.set(name, adapter);
  if (!activeName) activeName = name;
}

export function useVisionAdapter(name) {
  if (!adapters.has(name)) throw new Error(`Unknown vision adapter: ${name}`);
  activeName = name;
}

export function activeVisionAdapter() {
  return activeName;
}

const PIPELINE_STAGES = [
  "Ingesting photos",
  "Normalising perspective",
  "Detecting fixtures",
  "Scoring confidence",
];

export const VisionService = {
  // request: { walls: string[], photosByWall?: Record<wallId, fileName> }
  // Resolves to { adapter, confidenceFloor, buckets, detections[] }.
  // onProgress receives { stage, index, total } — the UI shows stage context,
  // never a context-free spinner (docs/motion-language.md anti-patterns).
  async detect(request, { onProgress } = {}) {
    const adapter = adapters.get(activeName);
    if (!adapter) throw new Error("No vision adapter registered");
    for (let i = 0; i < PIPELINE_STAGES.length; i += 1) {
      if (onProgress) onProgress({ stage: PIPELINE_STAGES[i], index: i + 1, total: PIPELINE_STAGES.length });
      await adapter.stageDelay(i);
    }
    const detections = await adapter.detect(request);
    return {
      adapter: activeName,
      confidenceFloor: CONFIDENCE_FLOOR,
      buckets: bucketize(detections),
      detections,
    };
  },

  // A second-angle photo for one low-confidence detection. Returns the new
  // confidence; the detection still requires an explicit user decision.
  async requestSecondAngle(detection, photoMeta) {
    const adapter = adapters.get(activeName);
    if (!adapter) throw new Error("No vision adapter registered");
    return adapter.secondAngle(detection, photoMeta);
  },
};

export function bucketize(detections) {
  return {
    high: detections.filter((d) => d.confidence >= 0.75).length,
    medium: detections.filter((d) => d.confidence >= CONFIDENCE_FLOOR && d.confidence < 0.75).length,
    low: detections.filter((d) => d.confidence < CONFIDENCE_FLOOR).length,
  };
}

// ---------------------------------------------------------------------------
// Mock adapter — deterministic stand-in until a real backend is ratified.

registerVisionAdapter("mock", {
  stageDelay: () => new Promise((resolve) => setTimeout(resolve, 90)),
  detect: async (request) => mockDetections(request.walls || []),
  secondAngle: async (detection) => ({
    confidence: Math.min(0.97, detection.confidence + 0.34),
  }),
});

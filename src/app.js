// app.js — journey flow state machine.
// Orchestrates: journey selection → guided steps (each with real controls and
// explicit interaction states) → structured handoff packet.
// Interaction states per step: idle → engaged → satisfied. Continue stays
// gated until the step's control reports satisfied (one decision per screen).

import { journeys } from "./data.js";
import { MotionDirector } from "./motion.js";
import { createControl } from "./controls.js";
import { initializeVisionAdapter } from "./services/vision.js";

const motion = new MotionDirector();
void initializeVisionAdapter();

const els = {
  stage: document.querySelector(".stage"),
  selector: document.getElementById("journey-selector"),
  workbench: document.getElementById("journey-workbench"),
  handoff: document.getElementById("handoff"),
  journeyTitle: document.getElementById("journey-title"),
  progress: document.getElementById("progress"),
  progressRail: document.getElementById("progress-rail"),
  stepState: document.getElementById("step-state"),
  stageTitle: document.getElementById("stage-title"),
  stageCopy: document.getElementById("stage-copy"),
  stepPanel: document.getElementById("step-panel"),
  stepTitle: document.getElementById("step-title"),
  stepCopy: document.getElementById("step-copy"),
  stepContent: document.getElementById("step-content"),
  nextBtn: document.getElementById("next-btn"),
  backBtn: document.getElementById("back-btn"),
  restartBtn: document.getElementById("restart-btn"),
  handoffSummary: document.getElementById("handoff-summary"),
  handoffJson: document.getElementById("handoff-json"),
  downloadBtn: document.getElementById("download-packet"),
  copyBtn: document.getElementById("copy-packet"),
};

let state = null;
let control = null;
let lastPacket = null;

function freshState(journeyKey) {
  return {
    journeyKey,
    stepIndex: 0,
    values: {}, // clean value snapshots per completed step
    working: {}, // live control state per step (survives Back/forward)
    meta: {}, // per-step confirmation records
    startedAt: new Date().toISOString(),
  };
}

function currentJourney() {
  return journeys[state.journeyKey];
}

function currentStep() {
  return currentJourney().steps[state.stepIndex];
}

// ---------------------------------------------------------------------------
// Progress rail — always-visible journey state.

function renderRail() {
  const j = currentJourney();
  els.progressRail.replaceChildren(
    ...j.steps.map((step, i) => {
      const li = document.createElement("li");
      li.className =
        i < state.stepIndex ? "rail-step rail-step--done" : i === state.stepIndex ? "rail-step rail-step--current" : "rail-step";
      if (i === state.stepIndex) li.setAttribute("aria-current", "step");
      const dot = document.createElement("span");
      dot.className = "rail-dot";
      dot.setAttribute("aria-hidden", "true");
      const label = document.createElement("span");
      label.className = "rail-label";
      label.textContent = step.title.includes("·") ? step.title.split("·").pop().trim() : step.title;
      li.append(dot, label);
      return li;
    })
  );
}

// ---------------------------------------------------------------------------
// Step lifecycle.

function updateGate() {
  const satisfied = control && control.isSatisfied();
  els.nextBtn.disabled = !satisfied;
  els.stepState.textContent = satisfied ? "Ready to continue" : "Waiting for your input";
  els.stepState.dataset.state = satisfied ? "satisfied" : "engaged";
}

function mountStep() {
  const j = currentJourney();
  const step = currentStep();

  els.progress.textContent = `${state.stepIndex + 1} / ${j.steps.length}`;
  renderRail();
  els.stageTitle.textContent = `${j.title} · ${step.title.includes("·") ? step.title.split("·").pop().trim() : step.title}`;
  els.stageCopy.textContent = step.stage || "";
  els.stepTitle.textContent = step.title;
  els.stepCopy.textContent = step.copy;

  if (step.kind !== "lighting") motion.clearLightingPreview();

  const ctx = {
    motion,
    values: { ...state.values },
    own: (defaults) => {
      if (!state.working[step.id]) state.working[step.id] = defaults;
      return state.working[step.id];
    },
    onChange: updateGate,
  };
  control = createControl(step, ctx);
  els.stepContent.replaceChildren(control.el);

  els.backBtn.disabled = state.stepIndex === 0;
  els.nextBtn.textContent = state.stepIndex === j.steps.length - 1 ? "Complete journey" : "Continue";
  updateGate();
}

function renderStep(direction = 1) {
  motion.stepTransition(els.stepPanel, mountStep, direction);
}

function completeStep() {
  if (!control || !control.isSatisfied()) return;
  const j = currentJourney();
  const step = currentStep();

  state.values[step.id] = control.value();
  state.meta[step.id] = {
    id: step.id,
    label: step.title,
    summary: control.summary(),
    confirmedAt: new Date().toISOString(),
  };
  motion.focusShift(els.stepPanel);

  if (state.stepIndex === j.steps.length - 1) {
    renderHandoff();
    return;
  }
  state.stepIndex += 1;
  renderStep(1);
}

function goBack() {
  if (state.stepIndex === 0) return;
  state.stepIndex -= 1;
  renderStep(-1);
}

// ---------------------------------------------------------------------------
// Journey selection and reset.

function pickJourney(key) {
  state = freshState(key);
  control = null;
  const j = currentJourney();

  motion.setAmbient(j.ambient); // color/lighting cues precede structural change
  els.selector.hidden = true;
  els.handoff.hidden = true;
  els.workbench.hidden = false;
  els.journeyTitle.textContent = j.title;
  motion.sceneShift(els.stage);
  renderStep(1);
}

function reset() {
  state = null;
  control = null;
  motion.clearLightingPreview();
  motion.setAmbient("neutral");
  els.selector.hidden = false;
  els.workbench.hidden = true;
  els.handoff.hidden = true;
  motion.panelBloom(els.selector);
}

// ---------------------------------------------------------------------------
// Handoff packet — structured per docs/information-architecture.md.

function buildPacket() {
  const j = currentJourney();
  const v = state.values;
  const dims = v.dimensions || null;
  const isExisting = state.journeyKey === "existing";

  const walls = dims
    ? [
        { id: "north", lengthCm: Number(dims.widthCm) },
        { id: "south", lengthCm: Number(dims.widthCm) },
        { id: "east", lengthCm: Number(dims.lengthCm) },
        { id: "west", lengthCm: Number(dims.lengthCm) },
      ]
    : null;

  return {
    project: {
      id: `akv-${Date.now().toString(36)}`,
      flowType: state.journeyKey,
      startedAt: state.startedAt,
      dimensionsCm: dims,
      locationContext: null,
    },
    space: dims
      ? {
          walls,
          openings: v.door ? [{ type: "door", wall: v.door.wall, offsetPct: v.door.offsetPct }] : [],
          baseline: { floor: "existing", ceilingCm: Number(dims.heightCm) },
        }
      : null,
    fixtureDetection: v.detect
      ? v.detect.items.map((i) => ({
          type: i.type,
          wall: i.wall,
          confidence: i.confidence,
          status: i.status,
          userVerified: i.userVerified,
          secondAngle: Boolean(i.secondAngle),
        }))
      : [],
    visionSummary: buildVisionSummary(v),
    styleProfile: isExisting
      ? { primaryStyle: "guided modernization", source: "existing-flow" }
      : {
          primaryStyle: v.inspiration && v.inspiration.mood ? v.inspiration.mood.name : null,
          layoutIntent: v.layout ? v.layout.layoutId : null,
          circulation: v.layout ? v.layout.circulation : null,
        },
    materialProfile: isExisting
      ? null
      : {
          wall: v.materials && v.materials.wall ? v.materials.wall.name : null,
          floor: v.materials && v.materials.floor ? v.materials.floor.name : null,
          fixtures: v.fixtures || null,
          lighting: v.lighting || null,
        },
    recommendations: isExisting
      ? (v.recommend && v.recommend.selected) || []
      : { conceptApproved: Boolean(v.recommend && v.recommend.approved), implementationOrder: (v.recommend && v.recommend.implementationOrder) || [] },
    handoffPacket: {
      journey: j.title,
      completedSteps: Object.values(state.meta),
      constraints:
        v.capture && v.capture.sketchMode ? ["guided-sketch mode — verify measurements on site"] : [],
      notes: [],
      status: "ready-for-handoff",
    },
  };
}

// Confidence-aware summary for the sales handoff (milestone 4):
// the sales team receives an interpretable confidence map, never raw guesses.
function buildVisionSummary(v) {
  if (v.detect && v.detect.mode === "vision" && v.detect.vision) {
    const items = v.detect.items || [];
    return {
      adapter: v.detect.vision.adapter,
      confidenceFloor: v.detect.vision.confidenceFloor,
      buckets: v.detect.vision.buckets,
      verified: items.filter((i) => i.userVerified && (i.status === "confirmed" || i.status === "adjusted")).length,
      removed: items.filter((i) => i.status === "rejected").length,
      excluded: items.filter((i) => i.status === "rejected").map((i) => i.type),
      secondAngleRequests: v.detect.secondAngleRequests || 0,
    };
  }
  if (v.detect && v.detect.mode === "sketch") {
    return {
      adapter: "manual-inventory",
      confidenceFloor: null,
      buckets: null,
      verified: (v.detect.items || []).length,
      removed: 0,
      excluded: [],
      secondAngleRequests: 0,
    };
  }
  return null;
}

function renderHandoff() {
  const packet = buildPacket();
  lastPacket = packet;

  els.workbench.hidden = true;
  els.handoff.hidden = false;
  motion.clearLightingPreview();

  els.handoffSummary.replaceChildren(
    ...Object.values(state.meta).flatMap((m) => {
      const dt = document.createElement("dt");
      dt.textContent = m.label;
      const dd = document.createElement("dd");
      dd.textContent = m.summary;
      return [dt, dd];
    })
  );
  els.handoffJson.textContent = JSON.stringify(packet, null, 2);
  motion.panelBloom(els.handoff);
}

// ---------------------------------------------------------------------------

document.querySelectorAll("[data-select]").forEach((button) => {
  button.addEventListener("click", (event) => {
    pickJourney(event.currentTarget.dataset.select);
  });
});

els.nextBtn.addEventListener("click", completeStep);
els.backBtn.addEventListener("click", goBack);
els.restartBtn.addEventListener("click", reset);

els.downloadBtn.addEventListener("click", () => {
  if (!lastPacket) return;
  const blob = new Blob([JSON.stringify(lastPacket, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `akvaterm-handoff-${lastPacket.project.id}.json`;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
});

els.copyBtn.addEventListener("click", async () => {
  if (!lastPacket) return;
  try {
    await navigator.clipboard.writeText(JSON.stringify(lastPacket, null, 2));
    els.copyBtn.textContent = "Copied";
  } catch (_) {
    els.copyBtn.textContent = "Copy blocked — use Download";
  }
  setTimeout(() => (els.copyBtn.textContent = "Copy JSON"), 1800);
});

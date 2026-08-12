const journeys = {
  existing: {
    id: "existing",
    title: "Existing Bathroom",
    subtitle: "We will rebuild your room from what already exists.",
    steps: [
      {
        id: "dimensions",
        title: "Step 1 · Room dimensions",
        copy: "Enter the room size and share the shape so we can build a gentle first draft.",
        actionLabel: "Set dimensions",
      },
      {
        id: "door",
        title: "Step 2 · Door placement",
        copy: "Drag your door onto the wall position. This creates your first visual anchor.",
        actionLabel: "Place door",
      },
      {
        id: "capture",
        title: "Step 3 · Capture walls",
        copy: "Upload a sequence of wall photos. Each upload expands what the model can understand.",
        actionLabel: "Upload wall photo",
      },
      {
        id: "detect",
        title: "Computer vision pass",
        copy: "We detect fixtures and openings. You confirm each item before we continue.",
        actionLabel: "Confirm detections",
      },
      {
        id: "rebuild",
        title: "Digital twin rebuild",
        copy: "The model reconstructs room geometry and fixture placement progressively.",
        actionLabel: "Review room model",
      },
      {
        id: "recommend",
        title: "Curated recommendations",
        copy: "Receive a focused expert set based on detected constraints and your style.",
        actionLabel: "Generate recommendations",
      },
    ],
  },
  new: {
    id: "new",
    title: "New Bathroom",
    subtitle: "Start with inspiration and turn it into a feasible concept.",
    steps: [
      {
        id: "inspiration",
        title: "Inspirational direction",
        copy: "Pick the mood that best matches your vision for the space.",
        actionLabel: "Select mood",
      },
      {
        id: "layout",
        title: "Layout vision",
        copy: "Choose layout intent and circulation preferences to shape the space early.",
        actionLabel: "Choose layout",
      },
      {
        id: "materials",
        title: "Material direction",
        copy: "Set palette, textures, and finish direction with fluid transitions.",
        actionLabel: "Set palette",
      },
      {
        id: "fixtures",
        title: "Fixture set selection",
        copy: "Curated products appear as grouped choices with practical fit logic.",
        actionLabel: "Review options",
      },
      {
        id: "lighting",
        title: "Lighting and atmosphere",
        copy: "Define brightness and ambiance, then preview the room.",
        actionLabel: "Set lighting",
      },
      {
        id: "recommend",
        title: "Execution-ready concept",
        copy: "Receive a realistic concept package and recommended implementation order.",
        actionLabel: "Create handoff",
      },
    ],
  },
};

const selector = document.getElementById("journey-selector");
const workbench = document.getElementById("journey-workbench");
const handoff = document.getElementById("handoff");
const journeyTitle = document.getElementById("journey-title");
const progress = document.getElementById("progress");
const stageTitle = document.getElementById("stage-title");
const stageCopy = document.getElementById("stage-copy");
const stepTitle = document.getElementById("step-title");
const stepCopy = document.getElementById("step-copy");
const stepContent = document.getElementById("step-content");
const nextBtn = document.getElementById("next-btn");
const backBtn = document.getElementById("back-btn");
const restartBtn = document.getElementById("restart-btn");
const handoffJson = document.getElementById("handoff-json");

let state = {
  journeyKey: null,
  stepIndex: 0,
  completed: {},
  confirmations: {},
};

const stageDefaults = {
  dimensions: "Measured area, wall lengths, and ceiling height are required for first draft.",
  door: "Use drag interaction to place the door on the nearest wall segment.",
  capture: "You can upload now or continue later; uncertainty stays gentle and visible.",
  detect: "The system highlights every detected fixture and asks for your confirmation.",
  rebuild: "You can correct fixture labels before moving to recommendations.",
  recommend: "Each recommendation includes rationale and feasibility notes.",
  inspiration: "Choose style direction from curated visual principles, not endless catalogs.",
  layout: "Select spatial intent and circulation priorities.",
  materials: "Pick textures with transition previews and settling animations.",
  fixtures: "Show only shortlists from real supplier groups.",
  lighting: "Preview warm-cool balance and evening atmosphere.",
};

function pickJourney(key) {
  const j = journeys[key];
  state = {
    journeyKey: key,
    stepIndex: 0,
    completed: {},
    confirmations: {
      journey: j.title,
      startedAt: new Date().toISOString(),
      steps: [],
      notes: [],
    },
  };

  selector.hidden = true;
  handoff.hidden = true;
  workbench.hidden = false;
  journeyTitle.textContent = j.title;
  stageTitle.textContent = j.subtitle;
  stageCopy.textContent = "You can move at your pace; we keep context and never rush the pace.";
  renderStep();
}

function currentJourney() {
  return journeys[state.journeyKey];
}

function renderStep() {
  const j = currentJourney();
  const step = j.steps[state.stepIndex];

  progress.textContent = `${state.stepIndex + 1} / ${j.steps.length}`;
  stageTitle.textContent = `${j.title} · ${step.title}`;
  stageCopy.textContent = stageDefaults[step.id] || "";
  stepTitle.textContent = "Ready for your choice";
  stepCopy.textContent = step.copy;

  stepContent.innerHTML = `
    <div class="step-tile">${step.actionLabel}</div>
  `;

  backBtn.disabled = state.stepIndex === 0;
  nextBtn.disabled = false;
}

function completeStep() {
  const j = currentJourney();
  const step = j.steps[state.stepIndex];
  state.confirmations.steps.push({
    id: step.id,
    label: step.title,
    confirmedAt: new Date().toISOString(),
  });

  if (state.stepIndex === j.steps.length - 1) {
    renderHandoff();
    return;
  }

  state.stepIndex += 1;
  renderStep();
}

function goBack() {
  if (state.stepIndex === 0) {
    return;
  }
  state.stepIndex -= 1;
  renderStep();
}

function renderHandoff() {
  state.completed[state.journeyKey] = true;
  const payload = {
    journey: currentJourney().title,
    completedSteps: state.confirmations.steps.length,
    timeline: state.confirmations,
    status: "ready-for-handoff",
  };

  workbench.hidden = true;
  handoff.hidden = false;
  handoffJson.textContent = JSON.stringify(payload, null, 2);
}

function reset() {
  selector.hidden = false;
  workbench.hidden = true;
  handoff.hidden = true;
}

document.querySelectorAll('[data-select]').forEach((button) => {
  button.addEventListener("click", (event) => {
    pickJourney(event.currentTarget.dataset.select);
  });
});

nextBtn.addEventListener("click", completeStep);
backBtn.addEventListener("click", goBack);
restartBtn.addEventListener("click", reset);


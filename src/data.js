// data.js — journey definitions, mock vision output, and curated recommendation sets.
// Copy is trust-first: explicit, calm, never pushy. Recommendation lists are capped
// (max 6 + 1 expert alternative) per docs/feroterm-integration-architecture.md.

export const journeys = {
  existing: {
    id: "existing",
    title: "Existing Bathroom",
    subtitle: "We will rebuild your room from what already exists.",
    ambient: "morning",
    steps: [
      {
        id: "dimensions",
        kind: "dimensions",
        title: "Step 1 · Room dimensions",
        copy: "Enter the room size and shape so we can build a gentle first draft.",
        stage: "Measured area, wall lengths, and ceiling height shape the first draft.",
        actionLabel: "Set dimensions",
      },
      {
        id: "door",
        kind: "door",
        title: "Step 2 · Door placement",
        copy: "Place your door on the wall where it belongs. This creates your first visual anchor.",
        stage: "Pick a wall, then slide the door along it — or drag the door directly.",
        actionLabel: "Place door",
      },
      {
        id: "capture",
        kind: "capture",
        title: "Step 3 · Capture walls",
        copy: "Add a photo per wall. Each photo expands what the model can understand.",
        stage: "You can add photos now or continue with a guided sketch; nothing is uploaded without your consent.",
        actionLabel: "Add wall photos",
      },
      {
        id: "detect",
        kind: "detect",
        title: "Step 4 · Computer vision pass",
        copy: "We detect fixtures and openings. You confirm every item before we continue.",
        stage: "Nothing is accepted automatically — each detection waits for your decision.",
        actionLabel: "Review detections",
      },
      {
        id: "rebuild",
        kind: "rebuild",
        title: "Step 5 · Digital twin rebuild",
        copy: "The model reconstructs room geometry and confirmed fixtures progressively.",
        stage: "Only elements you confirmed are placed. You can send corrections back at any time.",
        actionLabel: "Review room model",
      },
      {
        id: "recommend",
        kind: "recommend",
        title: "Step 6 · Curated recommendations",
        copy: "A focused expert set based on your confirmed room — grouped by urgency and impact.",
        stage: "Each recommendation carries its rationale and rule reference. Never a full catalogue.",
        actionLabel: "Choose your scope",
      },
    ],
  },
  new: {
    id: "new",
    title: "New Bathroom",
    subtitle: "Start with inspiration and turn it into a feasible concept.",
    ambient: "evening",
    steps: [
      {
        id: "inspiration",
        kind: "mood",
        title: "Step 1 · Inspirational direction",
        copy: "Pick the mood that best matches your vision for the space.",
        stage: "Curated visual principles, not endless catalogues.",
        actionLabel: "Select mood",
      },
      {
        id: "layout",
        kind: "layout",
        title: "Step 2 · Layout vision",
        copy: "Choose layout intent and circulation preference to shape the space early.",
        stage: "Spatial intent first; fixtures follow the movement of the room.",
        actionLabel: "Choose layout",
      },
      {
        id: "materials",
        kind: "materials",
        title: "Step 3 · Material direction",
        copy: "Set floor and wall direction with fluid, settling transitions.",
        stage: "Materials flow in like pigment and settle — cancel any time.",
        actionLabel: "Set palette",
      },
      {
        id: "fixtures",
        kind: "fixtures",
        title: "Step 4 · Fixture set selection",
        copy: "Curated products appear as grouped choices with practical fit logic.",
        stage: "Shortlists only, from trusted supplier groups.",
        actionLabel: "Review options",
      },
      {
        id: "lighting",
        kind: "lighting",
        title: "Step 5 · Lighting and atmosphere",
        copy: "Define warmth and brightness, then preview the room's evening mood.",
        stage: "Light decides how every material reads. Take your time.",
        actionLabel: "Set lighting",
      },
      {
        id: "recommend",
        kind: "concept",
        title: "Step 6 · Execution-ready concept",
        copy: "A realistic concept package with a recommended implementation order.",
        stage: "Your selections, resolved into one coherent, buildable direction.",
        actionLabel: "Approve concept",
      },
    ],
  },
};

// ---------------------------------------------------------------------------
// Walls — shared vocabulary between door placement, capture and detection.

export const WALLS = [
  { id: "north", label: "North wall" },
  { id: "east", label: "East wall" },
  { id: "south", label: "South wall" },
  { id: "west", label: "West wall" },
];

export const FIXTURE_TYPES = [
  "Toilet",
  "Washbasin",
  "Bathtub",
  "Shower",
  "Radiator",
  "Window",
  "Mirror",
  "Storage unit",
];

// ---------------------------------------------------------------------------
// Mock computer-vision pass. Deterministic so repeated runs feel stable.
// Confidence below CONFIDENCE_FLOOR is flagged and never silently attached
// to recommendations (docs/ai-vision-pipeline.md safety constraints).

export const CONFIDENCE_FLOOR = 0.45;

const DETECTION_BASE = [
  { type: "Toilet", confidence: 0.93, at: 0.22, size: 0.13 },
  { type: "Washbasin", confidence: 0.88, at: 0.55, size: 0.16 },
  { type: "Bathtub", confidence: 0.76, at: 0.5, size: 0.34 },
  { type: "Mirror", confidence: 0.83, at: 0.55, size: 0.14 },
  { type: "Radiator", confidence: 0.58, at: 0.8, size: 0.12 },
  { type: "Window", confidence: 0.41, at: 0.35, size: 0.2 },
];

export function mockDetections(capturedWallIds) {
  const walls = capturedWallIds.length ? capturedWallIds : WALLS.map((w) => w.id);
  const items = DETECTION_BASE.map((d, i) => ({
    id: `det-${i + 1}`,
    type: d.type,
    wall: walls[i % walls.length],
    confidence: d.confidence,
    at: d.at, // relative position along the wall, 0..1
    size: d.size, // relative footprint along the wall, 0..1
    status: "pending", // pending | confirmed | adjusted | rejected
    userVerified: false,
  }));
  // Spread items that share a wall evenly along it so plans stay readable.
  const byWall = new Map();
  for (const item of items) {
    if (!byWall.has(item.wall)) byWall.set(item.wall, []);
    byWall.get(item.wall).push(item);
  }
  for (const group of byWall.values()) {
    if (group.length > 1) {
      group.forEach((item, idx) => {
        item.at = (idx + 1) / (group.length + 1);
      });
    }
  }
  return items;
}

// ---------------------------------------------------------------------------
// Existing-flow scope recommendations, grouped by urgency and impact.
// Standard and premium lanes stay distinct (docs/recommendation-engine.md).

export const RECOMMENDATION_GROUPS = [
  { id: "urgent", label: "Address first", hint: "Protects everything you keep." },
  { id: "impact", label: "Highest impact", hint: "The biggest daily-life gains." },
  { id: "comfort", label: "Comfort upgrades", hint: "Worth adding while walls are open." },
];

export const scopeRecommendations = [
  {
    id: "seal-renew",
    group: "urgent",
    lane: "standard",
    title: "Renew silicone seals and grout lines",
    rationale: "Wet-zone seams are the most common failure point in existing bathrooms; renewing them protects every fixture you keep.",
    ruleRef: "R-URG-01",
    effort: "Low effort",
  },
  {
    id: "vent-upgrade",
    group: "urgent",
    lane: "standard",
    title: "Quiet extraction fan with humidity sensor",
    rationale: "Moisture control decides how every other upgrade ages. A sensor-driven fan works without you thinking about it.",
    ruleRef: "R-URG-02",
    effort: "Low effort",
  },
  {
    id: "walkin-shower",
    group: "impact",
    lane: "premium",
    title: "Walk-in shower conversion",
    rationale: "Replaces the highest-friction fixture in your confirmed layout with the strongest daily-comfort gain.",
    ruleRef: "R-IMP-03",
    effort: "High effort",
  },
  {
    id: "wall-hung-wc",
    group: "impact",
    lane: "standard",
    title: "Wall-hung WC with concealed cistern",
    rationale: "Frees the floor line and simplifies cleaning; compatible with the wall where your toilet was confirmed.",
    ruleRef: "R-IMP-04",
    effort: "Medium effort",
  },
  {
    id: "heated-floor",
    group: "comfort",
    lane: "premium",
    title: "Electric underfloor heating mat",
    rationale: "The best comfort-per-cost addition while the floor is already open.",
    ruleRef: "R-CMF-05",
    effort: "Medium effort",
  },
  {
    id: "niche-storage",
    group: "comfort",
    lane: "standard",
    title: "Recessed shower niche and mirror storage",
    rationale: "Adds storage without shrinking the room footprint.",
    ruleRef: "R-CMF-06",
    effort: "Low effort",
  },
];

export const expertAlternative = {
  id: "phased-plan",
  expert: true,
  lane: "standard",
  title: "Expert alternative: two-phase renovation plan",
  rationale: "If budget is tight, phase one covers seals, ventilation and the WC; phase two completes shower and floor without redoing any work.",
  ruleRef: "R-ALT-00",
  effort: "Planned in stages",
};

// ---------------------------------------------------------------------------
// New-flow curated options.

export const moods = [
  { id: "nordic", name: "Nordic Calm", desc: "Pale stone, soft daylight, quiet lines.", tones: ["#dfe6e9", "#aebfc9", "#7d8fa0"] },
  { id: "warmmin", name: "Warm Minimal", desc: "Sand, clay and matte black restraint.", tones: ["#e8ded2", "#c9b299", "#3a3733"] },
  { id: "spa", name: "Stone Spa", desc: "Deep slate, warm wood, low light.", tones: ["#4b5258", "#8a7b6a", "#2e3438"] },
  { id: "classic", name: "Classic Revival", desc: "Ceramic white, brass, framed forms.", tones: ["#f3efe7", "#cdb27a", "#5c6670"] },
];

export const layouts = [
  { id: "wet-zone", name: "Separated wet zone", desc: "Shower and bath grouped away from the door path." },
  { id: "open-line", name: "Open sight line", desc: "A clear axis from door to window, fixtures along one wall." },
  { id: "twin-side", name: "Twin-sided", desc: "Wash zone and wet zone face each other, made for two." },
];

export const circulationOptions = [
  { id: "generous", name: "Generous clearance", desc: "Open floor first, even if fixtures shrink." },
  { id: "maximal", name: "Maximal fixtures", desc: "Equipment first, tighter movement accepted." },
];

export const materialSets = {
  floor: [
    { id: "microcement", name: "Microcement", family: "stone", tone: "#b9b3a8" },
    { id: "oakplank", name: "Oak-effect plank", family: "wood", tone: "#a8845c" },
    { id: "slate-tile", name: "Slate tile", family: "tile", tone: "#565d63" },
    { id: "terrazzo", name: "Terrazzo", family: "stone", tone: "#cfc8bd" },
  ],
  wall: [
    { id: "zellige", name: "Zellige tile", family: "tile", tone: "#9fb6ba" },
    { id: "limewash", name: "Limewash plaster", family: "stone", tone: "#d9d2c5" },
    { id: "marble-slab", name: "Marble slab", family: "stone", tone: "#e6e3dd" },
    { id: "fluted-wood", name: "Fluted wood panel", family: "wood", tone: "#8d6b4b" },
  ],
};

export const fixtureGroups = [
  {
    id: "wash",
    name: "Wash zone",
    options: [
      { id: "single-60", name: "Single 60 cm console" },
      { id: "double-120", name: "Double 120 cm console" },
      { id: "pedestal", name: "Compact pedestal basin" },
    ],
  },
  {
    id: "wet",
    name: "Wet zone",
    options: [
      { id: "walkin", name: "Walk-in shower" },
      { id: "bath", name: "Freestanding bath" },
      { id: "combo", name: "Bath with shower screen" },
    ],
  },
  {
    id: "heat",
    name: "Heating",
    options: [
      { id: "towel-rail", name: "Heated towel rail" },
      { id: "underfloor", name: "Underfloor heating" },
      { id: "both", name: "Rail + underfloor" },
    ],
  },
];

export const lightingDefaults = { warmthK: 3400, brightnessPct: 65 };

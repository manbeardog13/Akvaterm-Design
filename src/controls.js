// controls.js — real, per-step interaction controls for the journey workbench.
// Every control follows the same contract:
//   createControl(step, ctx) -> { el, isSatisfied(), value(), summary() }
// ctx = { motion: MotionDirector, values: {stepId: value}, onChange() }
// Trust rules honoured here (docs/customer-journey.md, docs/ai-vision-pipeline.md):
// explicit confirmation for every automatic detection, no hidden defaults,
// reversible states, consent before any photo is used.

import {
  WALLS,
  FIXTURE_TYPES,
  CONFIDENCE_FLOOR,
  RECOMMENDATION_GROUPS,
  scopeRecommendations,
  expertAlternative,
  moods,
  layouts,
  circulationOptions,
  materialSets,
  fixtureGroups,
  lightingDefaults,
} from "./data.js";
import { VisionService } from "./services/vision.js";
import { renderIso } from "./isometric.js";

// ---------------------------------------------------------------------------
// Small DOM helper.

function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === null || v === undefined || v === false) continue;
    if (k === "class") el.className = v;
    else if (k === "dataset") Object.assign(el.dataset, v);
    else if (k.startsWith("on") && typeof v === "function") el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === "text") el.textContent = v;
    else if (v === true) el.setAttribute(k, "");
    else el.setAttribute(k, String(v));
  }
  for (const child of children.flat()) {
    if (child === null || child === undefined) continue;
    el.append(child.nodeType ? child : document.createTextNode(String(child)));
  }
  return el;
}

const wallLabel = (id) => (WALLS.find((w) => w.id === id) || { label: id }).label;

// ---------------------------------------------------------------------------
// Shared top-down room plan renderer (SVG).

const SVG_NS = "http://www.w3.org/2000/svg";

function svgEl(tag, attrs = {}) {
  const el = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, String(v));
  return el;
}

// Maps room cm into a fitted viewBox. Returns geometry helpers for walls.
function planGeometry(dims) {
  const w = Number(dims.widthCm) || 200;
  const l = Number(dims.lengthCm) || 260;
  const scale = Math.min(280 / w, 196 / l);
  const rw = w * scale;
  const rl = l * scale;
  const x0 = (320 - rw) / 2;
  const y0 = (240 - rl) / 2;
  const walls = {
    north: { x1: x0, y1: y0, x2: x0 + rw, y2: y0, horizontal: true },
    south: { x1: x0, y1: y0 + rl, x2: x0 + rw, y2: y0 + rl, horizontal: true },
    west: { x1: x0, y1: y0, x2: x0, y2: y0 + rl, horizontal: false },
    east: { x1: x0 + rw, y1: y0, x2: x0 + rw, y2: y0 + rl, horizontal: false },
  };
  return { x0, y0, rw, rl, walls };
}

function pointOnWall(geo, wall, t) {
  const seg = geo.walls[wall];
  return {
    x: seg.x1 + (seg.x2 - seg.x1) * t,
    y: seg.y1 + (seg.y2 - seg.y1) * t,
    horizontal: seg.horizontal,
  };
}

export function renderPlan(dims, { door = null, fixtures = [], interactive = false } = {}) {
  const geo = planGeometry(dims);
  const svg = svgEl("svg", {
    viewBox: "0 0 320 240",
    class: "room-plan",
    role: "img",
    "aria-label": `Room plan ${dims.widthCm} by ${dims.lengthCm} centimetres`,
  });
  svg.append(
    svgEl("rect", { x: geo.x0, y: geo.y0, width: geo.rw, height: geo.rl, class: "plan-floor", rx: 3 }),
    svgEl("rect", { x: geo.x0, y: geo.y0, width: geo.rw, height: geo.rl, class: "plan-walls", rx: 3 })
  );
  // Wall labels
  const labels = [
    ["N", geo.x0 + geo.rw / 2, geo.y0 - 8],
    ["S", geo.x0 + geo.rw / 2, geo.y0 + geo.rl + 16],
    ["W", geo.x0 - 12, geo.y0 + geo.rl / 2 + 4],
    ["E", geo.x0 + geo.rw + 12, geo.y0 + geo.rl / 2 + 4],
  ];
  for (const [t, x, y] of labels) {
    const lbl = svgEl("text", { x, y, class: "plan-label", "text-anchor": "middle" });
    lbl.textContent = t;
    svg.append(lbl);
  }
  // Door: a gap plus swing arc.
  if (door && door.wall) {
    const t = (door.offsetPct ?? 50) / 100;
    const p = pointOnWall(geo, door.wall, t);
    const doorLen = 26;
    const gap = svgEl("line", {
      class: "plan-door-gap",
      x1: p.horizontal ? p.x - doorLen / 2 : p.x,
      y1: p.horizontal ? p.y : p.y - doorLen / 2,
      x2: p.horizontal ? p.x + doorLen / 2 : p.x,
      y2: p.horizontal ? p.y : p.y + doorLen / 2,
    });
    const inward = door.wall === "north" ? 1 : door.wall === "south" ? -1 : door.wall === "west" ? 1 : -1;
    const arc = svgEl("path", { class: "plan-door-arc" });
    if (p.horizontal) {
      arc.setAttribute(
        "d",
        `M ${p.x - doorLen / 2} ${p.y} A ${doorLen} ${doorLen} 0 0 ${inward > 0 ? 1 : 0} ${p.x + doorLen / 2} ${p.y + inward * doorLen}`
      );
    } else {
      arc.setAttribute(
        "d",
        `M ${p.x} ${p.y - doorLen / 2} A ${doorLen} ${doorLen} 0 0 ${inward > 0 ? 0 : 1} ${p.x + inward * doorLen} ${p.y + doorLen / 2}`
      );
    }
    const handle = svgEl("circle", {
      class: `plan-door-handle${interactive ? " draggable" : ""}`,
      cx: p.x,
      cy: p.y,
      r: interactive ? 9 : 5,
      "data-door-handle": "1",
    });
    svg.append(gap, arc, handle);
  }
  // Fixtures placed along their wall, nudged inward. Labels stagger on two
  // rows so crowded walls (single-wall captures) stay readable.
  fixtures.forEach((f, fi) => {
    const p = pointOnWall(geo, f.wall, f.at ?? 0.5);
    const along = Math.max(14, (f.size ?? 0.12) * (p.horizontal ? geo.rw : geo.rl));
    const depth = 14;
    const inward = f.wall === "north" ? 1 : f.wall === "south" ? -1 : f.wall === "west" ? 1 : -1;
    const labelOffset = depth + 11 + (fi % 2) * 11;
    const rect = svgEl("rect", {
      class: `plan-fixture plan-fixture--${f.status || "confirmed"}`,
      x: p.horizontal ? p.x - along / 2 : p.x + (inward > 0 ? 1 : -depth - 1),
      y: p.horizontal ? p.y + (inward > 0 ? 1 : -depth - 1) : p.y - along / 2,
      width: p.horizontal ? along : depth,
      height: p.horizontal ? depth : along,
      rx: 2.5,
      "data-fixture-id": f.id,
    });
    const title = svgEl("title", {});
    title.textContent = `${f.type} — ${f.status || "confirmed"}`;
    rect.append(title);
    const label = svgEl("text", {
      class: "plan-fixture-label",
      x: p.horizontal ? p.x : p.x + inward * labelOffset,
      y: p.horizontal ? p.y + inward * labelOffset : p.y + 3,
      "text-anchor": "middle",
      "data-fixture-id": f.id,
    });
    label.textContent = f.type;
    svg.append(rect, label);
  });
  return { svg, geo };
}

// ---------------------------------------------------------------------------
// 1) Dimensions — numeric inputs with live plan preview.

function dimensionsControl(step, ctx) {
  const v = ctx.own({ widthCm: 200, lengthCm: 260, heightCm: 250, shape: "rectangle" });
  const limits = { widthCm: [100, 800], lengthCm: [100, 800], heightCm: [200, 350] };
  const errors = h("p", { class: "field-error", role: "alert", hidden: true });
  const preview = h("div", { class: "plan-wrap", "aria-hidden": "true" });

  const numField = (key, label) =>
    h(
      "label",
      { class: "field" },
      h("span", { class: "field-label", text: label }),
      h("input", {
        type: "number",
        inputmode: "numeric",
        min: limits[key][0],
        max: limits[key][1],
        step: 5,
        value: v[key],
        "data-key": key,
        onInput: (e) => {
          v[key] = e.target.value === "" ? "" : Number(e.target.value);
          update();
        },
      })
    );

  const shapeField = h(
    "label",
    { class: "field" },
    h("span", { class: "field-label", text: "Room shape" }),
    h(
      "select",
      {
        onChange: (e) => {
          v.shape = e.target.value;
          update();
        },
      },
      h("option", { value: "rectangle", selected: v.shape === "rectangle", text: "Rectangle" }),
      h("option", { value: "l-shape", selected: v.shape === "l-shape", text: "L-shape (approximate as rectangle for now)" })
    )
  );

  function problems() {
    const out = [];
    for (const [key, [lo, hi]] of Object.entries(limits)) {
      const n = Number(v[key]);
      if (!Number.isFinite(n) || v[key] === "") out.push(`${key.replace("Cm", "")} is required`);
      else if (n < lo || n > hi) out.push(`${key.replace("Cm", "")} must be ${lo}–${hi} cm`);
    }
    return out;
  }

  function update() {
    const errs = problems();
    errors.hidden = errs.length === 0;
    errors.textContent = errs.join(" · ");
    preview.replaceChildren();
    if (errs.length === 0) {
      preview.append(renderPlan(v).svg);
    }
    ctx.onChange();
  }

  const el = h(
    "div",
    { class: "control control-dimensions" },
    h("div", { class: "field-row" }, numField("widthCm", "Width (cm)"), numField("lengthCm", "Length (cm)"), numField("heightCm", "Ceiling height (cm)")),
    shapeField,
    errors,
    preview,
    h("p", { class: "control-note", text: "A first draft renders immediately — nothing is final, everything stays adjustable." })
  );
  update();

  return {
    el,
    isSatisfied: () => problems().length === 0,
    value: () => ({ ...v }),
    summary: () => `${v.widthCm} × ${v.lengthCm} cm, ceiling ${v.heightCm} cm (${v.shape})`,
  };
}

// ---------------------------------------------------------------------------
// 2) Door placement — pick a wall, slide or drag the door along it.

function doorControl(step, ctx) {
  const dims = ctx.values.dimensions || { widthCm: 200, lengthCm: 260 };
  const v = ctx.own({ wall: null, offsetPct: 50 });
  const planWrap = h("div", { class: "plan-wrap plan-wrap--interactive" });
  const status = h("p", { class: "control-note", role: "status" });

  const wallButtons = WALLS.map((w) =>
    h("button", {
      type: "button",
      class: "btn btn-chip",
      "data-wall": w.id,
      "aria-pressed": String(v.wall === w.id),
      text: w.label,
      onClick: () => {
        v.wall = w.id;
        update();
        ctx.motion.focusShift(planWrap);
      },
    })
  );

  const slider = h("input", {
    type: "range",
    min: 8,
    max: 92,
    value: v.offsetPct,
    "aria-label": "Door position along the selected wall",
    onInput: (e) => {
      v.offsetPct = Number(e.target.value);
      update();
    },
  });

  function attachDrag(svg, geo) {
    const handle = svg.querySelector("[data-door-handle]");
    if (!handle) return;
    const onMove = (ev) => {
      const rect = svg.getBoundingClientRect();
      const px = ((ev.clientX - rect.left) / rect.width) * 320;
      const py = ((ev.clientY - rect.top) / rect.height) * 240;
      // Project onto nearest wall.
      let best = null;
      for (const [id, seg] of Object.entries(geo.walls)) {
        const t = seg.horizontal
          ? (px - seg.x1) / (seg.x2 - seg.x1 || 1)
          : (py - seg.y1) / (seg.y2 - seg.y1 || 1);
        const tc = Math.min(0.92, Math.max(0.08, t));
        const p = { x: seg.x1 + (seg.x2 - seg.x1) * tc, y: seg.y1 + (seg.y2 - seg.y1) * tc };
        const d = Math.hypot(px - p.x, py - p.y);
        if (!best || d < best.d) best = { d, id, tc };
      }
      if (best) {
        v.wall = best.id;
        v.offsetPct = Math.round(best.tc * 100);
        update();
      }
    };
    handle.addEventListener("pointerdown", (ev) => {
      ev.preventDefault();
      handle.setPointerCapture(ev.pointerId);
      handle.addEventListener("pointermove", onMove);
      handle.addEventListener(
        "pointerup",
        () => handle.removeEventListener("pointermove", onMove),
        { once: true }
      );
    });
  }

  function update() {
    for (const b of wallButtons) b.setAttribute("aria-pressed", String(v.wall === b.dataset.wall));
    slider.value = v.offsetPct;
    slider.disabled = !v.wall;
    planWrap.replaceChildren();
    const { svg, geo } = renderPlan(dims, { door: v.wall ? v : null, interactive: true });
    planWrap.append(svg);
    if (v.wall) attachDrag(svg, geo);
    status.textContent = v.wall
      ? `Door on the ${wallLabel(v.wall).toLowerCase()}, ${v.offsetPct}% along. Drag the handle or use the slider to fine-tune.`
      : "Choose a wall to place your door — it becomes the room's first anchor.";
    ctx.onChange();
  }
  update();

  const el = h(
    "div",
    { class: "control control-door" },
    h("div", { class: "chip-row", role: "group", "aria-label": "Door wall" }, wallButtons),
    h("label", { class: "field" }, h("span", { class: "field-label", text: "Position along wall" }), slider),
    planWrap,
    status
  );

  return {
    el,
    isSatisfied: () => Boolean(v.wall),
    value: () => ({ ...v }),
    summary: () => (v.wall ? `${wallLabel(v.wall)}, ${v.offsetPct}% along` : "not placed"),
  };
}

// ---------------------------------------------------------------------------
// 3) Wall capture — consent-gated photo intake with guided-sketch fallback.

function captureControl(step, ctx) {
  const v = ctx.own({ consent: false, sketchMode: false, photos: {} });

  const consentBox = h("input", {
    type: "checkbox",
    id: "capture-consent",
    checked: v.consent,
    onChange: (e) => {
      v.consent = e.target.checked;
      update();
    },
  });

  const rows = WALLS.map((w) => {
    const thumb = h("span", { class: "capture-thumb", "aria-hidden": "true" });
    const nameEl = h("span", { class: "capture-name", text: "No photo yet" });
    const fileInput = h("input", {
      type: "file",
      accept: "image/*",
      class: "visually-hidden",
      id: `capture-${w.id}`,
    onChange: (e) => {
        const file = e.target.files && e.target.files[0];
        if (!file) return;
        if (v.photos[w.id] && v.photos[w.id].url) URL.revokeObjectURL(v.photos[w.id].url);
        const reader = new FileReader();
        reader.onload = () => {
          v.photos[w.id] = {
            name: file.name,
            type: file.type || "image/jpeg",
            size: file.size,
            dataUrl: typeof reader.result === "string" ? reader.result : "",
            url: URL.createObjectURL(file),
          };
          v.sketchMode = false;
          update();
        };
        reader.readAsDataURL(file);
      },
    });
    const removeBtn = h("button", {
      type: "button",
      class: "btn btn-ghost btn-small",
      text: "Delete",
      "data-remove": w.id,
      onClick: () => {
        if (v.photos[w.id] && v.photos[w.id].url) URL.revokeObjectURL(v.photos[w.id].url);
        delete v.photos[w.id];
        update();
      },
    });
    const addLabel = h("label", { class: "btn btn-outline btn-small", for: `capture-${w.id}`, text: "Add photo" });
    const row = h(
      "div",
      { class: "capture-row", "data-wall": w.id },
      h("span", { class: "capture-wall", text: w.label }),
      thumb,
      nameEl,
      h("span", { class: "capture-actions" }, addLabel, fileInput, removeBtn)
    );
    return { row, thumb, nameEl, removeBtn, addLabel, wall: w.id };
  });

  const sketchBtn = h("button", {
    type: "button",
    class: "btn btn-ghost",
    "aria-pressed": String(v.sketchMode),
    text: "Continue with a guided sketch instead",
    onClick: () => {
      v.sketchMode = !v.sketchMode;
      update();
    },
  });

  const status = h("p", { class: "control-note", role: "status" });

  function photoCount() {
    return Object.keys(v.photos).length;
  }

  function update() {
    const enabled = v.consent;
    for (const r of rows) {
      const photo = v.photos[r.wall];
      r.nameEl.textContent = photo ? photo.name : "No photo yet";
      r.thumb.style.backgroundImage = photo ? `url("${photo.url}")` : "none";
      r.thumb.classList.toggle("has-photo", Boolean(photo));
      r.removeBtn.hidden = !photo;
      r.addLabel.classList.toggle("is-disabled", !enabled);
      r.addLabel.setAttribute("aria-disabled", String(!enabled));
      if (enabled) r.addLabel.removeAttribute("tabindex");
      else r.addLabel.setAttribute("tabindex", "-1");
    }
    sketchBtn.setAttribute("aria-pressed", String(v.sketchMode));
    status.textContent = v.sketchMode
      ? "Guided sketch selected — we will build from your confirmed inventory instead of photos. Supportive, not lesser."
      : photoCount() > 0
        ? `${photoCount()} wall photo${photoCount() > 1 ? "s" : ""} ready. Add more angles any time — or continue now.`
        : "Photos stay on this device in this prototype. Add at least one wall, or choose the guided sketch.";
    ctx.onChange();
  }
  update();

  const el = h(
    "div",
    { class: "control control-capture" },
    h(
      "div",
      { class: "consent-row" },
      consentBox,
      h(
        "label",
        { for: "capture-consent", class: "consent-label" },
        "I agree that these photos are analysed to reconstruct my room. I can delete any capture at any time."
      )
    ),
    h("div", { class: "capture-list" }, rows.map((r) => r.row)),
    h("div", { class: "chip-row" }, sketchBtn),
    status
  );

  return {
    el,
    isSatisfied: () => v.sketchMode || (v.consent && photoCount() > 0),
    value: () => ({
      consent: v.consent,
      sketchMode: v.sketchMode,
      capturedWalls: Object.keys(v.photos),
      photoPayloads: Object.fromEntries(
        Object.entries(v.photos)
          .filter(([, p]) => !!p?.dataUrl)
          .map(([k, p]) => [k, { name: p.name, type: p.type, dataUrl: p.dataUrl }])
      ),
      photoNames: Object.fromEntries(Object.entries(v.photos).map(([k, p]) => [k, p.name])),
    }),
    summary: () => (v.sketchMode ? "guided sketch mode" : `${photoCount()} wall photo(s), consent given`),
  };
}

// ---------------------------------------------------------------------------
// 4) Detection review — every item needs an explicit decision.

function detectControl(step, ctx) {
  const capture = ctx.values.capture || { sketchMode: true, capturedWalls: [] };

  // Guided-sketch fallback: the user builds a verified inventory manually.
  if (capture.sketchMode) {
    const v = ctx.own({ mode: "sketch", items: [], complete: false });
    if (v.mode !== "sketch") {
      v.mode = "sketch";
      v.items = [];
      v.complete = false;
      v.detected = false;
      v.vision = null;
      v.secondAngles = 0;
    }
    const list = h("div", { class: "sketch-grid", role: "group", "aria-label": "Fixtures present in your bathroom" });
    const status = h("p", { class: "control-note", role: "status" });

    function toggle(type) {
      const idx = v.items.findIndex((i) => i.type === type);
      if (idx >= 0) v.items.splice(idx, 1);
      else
        v.items.push({
          id: `man-${type.toLowerCase().replace(/\s+/g, "-")}`,
          type,
          wall: "north",
          confidence: 1,
          at: 0.3 + 0.4 * Math.abs(Math.sin(type.length)),
          size: 0.14,
          status: "confirmed",
          userVerified: true,
        });
      v.complete = false;
      update();
    }

    const chips = FIXTURE_TYPES.map((type) =>
      h("button", {
        type: "button",
        class: "btn btn-chip",
        "aria-pressed": "false",
        dataset: { type },
        text: type,
        onClick: () => toggle(type),
      })
    );
    list.append(...chips);

    const completeBtn = h("button", {
      type: "button",
      class: "btn btn-outline",
      text: "My list is complete",
      "aria-pressed": "false",
      onClick: () => {
        v.complete = !v.complete;
        update();
      },
    });

    function update() {
      for (const chip of chips) {
        const active = v.items.some((i) => i.type === chip.dataset.type);
        chip.classList.toggle("is-active", active);
        chip.setAttribute("aria-pressed", String(active));
      }
      completeBtn.setAttribute("aria-pressed", String(v.complete));
      completeBtn.classList.toggle("is-active", v.complete);
      status.textContent = v.complete
        ? `Inventory confirmed: ${v.items.length} item(s). Everything here is user-verified.`
        : `${v.items.length} item(s) selected. Mark the list complete when it matches your room.`;
      ctx.onChange();
    }
    update();

    const el = h(
      "div",
      { class: "control control-detect" },
      h("p", { class: "control-note", text: "Guided sketch: tap everything that exists in your bathroom today. You are the sensor — nothing is inferred without you." }),
      list,
      h("div", { class: "chip-row" }, completeBtn),
      status
    );
    return {
      el,
      isSatisfied: () => v.complete && v.items.length > 0,
      value: () => ({ mode: "sketch", items: v.items.map((i) => ({ ...i })) }),
      summary: () => `manual inventory, ${v.items.length} item(s)`,
    };
  }

  // Photo mode: detection runs through the VisionService adapter boundary
  // (ADR 0006), then every item waits for an explicit per-item confirmation.
  const v = ctx.own({ mode: "vision", items: null, detected: false, vision: null, secondAngles: 0 });
  if (v.mode !== "vision") {
    v.mode = "vision";
    v.items = null;
    v.detected = false;
    v.vision = null;
    v.secondAngles = 0;
  }
  const listEl = h("div", { class: "detect-list" });
  const status = h("p", { class: "control-note", role: "status" });
  const progressLine = h("p", { class: "detect-progress", role: "status", "aria-live": "polite", hidden: true });

  function resolvedCount() {
    return v.items.filter((i) => i.status !== "pending").length;
  }

  function statusLabel(s) {
    return { pending: "Awaiting you", confirmed: "Confirmed", adjusted: "Adjusted", rejected: "Removed" }[s] || s;
  }

  function statusLine() {
    if (!v.detected) return;
    status.textContent = `${resolvedCount()} of ${v.items.length} detections resolved. Every item waits for your explicit decision.`;
  }

  // Rows are built once and synced in place — decisions never steal focus.
  function itemRow(item) {
    const chip = h("span", { class: "chip" });
    const typeEl = h("strong", { class: "detect-type", text: item.type });
    const confFill = h("span", { class: "conf-fill" });
    const confMeter = h("span", { class: "conf-meter", role: "img" }, confFill);
    const note = h("p", { class: "detect-flag", hidden: true });
    const angleInput = h("input", {
      type: "file",
      accept: "image/*",
      class: "visually-hidden",
      id: `angle-${item.id}`,
      onChange: async (e) => {
        const file = e.target.files && e.target.files[0];
        if (!file) return;
        const res = await VisionService.requestSecondAngle(item, { name: file.name });
        item.confidence = res.confidence;
        item.secondAngle = true;
        v.secondAngles += 1;
        sync();
        ctx.onChange();
      },
    });
    const angleLabel = h("label", { class: "btn btn-ghost btn-small", for: `angle-${item.id}`, hidden: true, text: "Add second angle" });
    const adjustSelect = h(
      "select",
      {
        class: "detect-adjust",
        hidden: true,
        "aria-label": "Correct the fixture type for this detection",
        onChange: (e) => {
          item.type = e.target.value;
          item.userVerified = true;
          typeEl.textContent = item.type;
        },
      },
      FIXTURE_TYPES.map((t) => h("option", { value: t, selected: t === item.type, text: t }))
    );
    const actions = [
      ["Confirm", "confirmed", "btn-outline"],
      ["Adjust", "adjusted", "btn-ghost"],
      ["Not there", "rejected", "btn-ghost"],
    ].map(([label, statusValue, cls]) =>
      h("button", {
        type: "button",
        class: `btn btn-small ${cls}`,
        dataset: { status: statusValue },
        "aria-pressed": "false",
        text: label,
        onClick: () => {
          item.status = item.status === statusValue ? "pending" : statusValue;
          item.userVerified = item.status !== "pending";
          sync();
          ctx.onChange();
        },
      })
    );
    const row = h(
      "div",
      { class: "detect-row", dataset: { id: item.id } },
      h(
        "div",
        { class: "detect-main" },
        chip,
        typeEl,
        h("span", { class: "detect-wall", text: wallLabel(item.wall) }),
        confMeter
      ),
      note,
      adjustSelect,
      h("div", { class: "detect-actions" }, actions, angleLabel, angleInput)
    );

    function sync() {
      row.className = `detect-row detect-row--${item.status}`;
      chip.textContent = statusLabel(item.status);
      chip.className = `chip chip--${item.status}`;
      confFill.style.width = `${(item.confidence * 100).toFixed(0)}%`;
      confMeter.setAttribute("aria-label", `Confidence ${(item.confidence * 100).toFixed(0)} percent`);
      const needsAngle = item.confidence < CONFIDENCE_FLOOR && item.status === "pending";
      angleLabel.hidden = !needsAngle;
      if (needsAngle) {
        note.hidden = false;
        note.className = "detect-flag";
        note.textContent = "Low confidence — a second-angle photo would help. You can still decide manually.";
      } else if (item.secondAngle) {
        note.hidden = false;
        note.className = "detect-flag detect-flag--ok";
        note.textContent = `Second angle received — confidence improved to ${(item.confidence * 100).toFixed(0)}%.`;
      } else {
        note.hidden = true;
      }
      adjustSelect.hidden = item.status !== "adjusted";
      for (const b of actions) {
        const active = item.status === b.dataset.status;
        b.classList.toggle("is-active", active);
        b.setAttribute("aria-pressed", String(active));
      }
      statusLine();
    }
    sync();
    return row;
  }

  function mountRows() {
    progressLine.hidden = true;
    listEl.replaceChildren(...v.items.map(itemRow));
    statusLine();
  }

  async function run() {
    if (v.detected) {
      mountRows();
      return;
    }
    progressLine.hidden = false;
    progressLine.textContent = "Preparing analysis…";
    const result = await VisionService.detect(
      {
        walls: capture.capturedWalls || [],
        photosByWall: capture.photoPayloads && Object.keys(capture.photoPayloads).length ? capture.photoPayloads : capture.photoNames || {},
      },
      {
        onProgress: (p) => {
          progressLine.textContent = `${p.stage} — step ${p.index} of ${p.total}. Nothing is accepted without you.`;
        },
      }
    );
    v.items = result.detections;
    v.detected = true;
    v.vision = { adapter: result.adapter, confidenceFloor: result.confidenceFloor, buckets: result.buckets };
    mountRows();
    ctx.onChange();
  }
  run();

  const el = h(
    "div",
    { class: "control control-detect" },
    progressLine,
    listEl,
    status
  );

  return {
    el,
    isSatisfied: () => v.detected && v.items.every((i) => i.status !== "pending"),
    value: () => ({
      mode: "vision",
      items: v.items.map((i) => ({ ...i })),
      vision: v.vision,
      secondAngleRequests: v.secondAngles,
    }),
    summary: () => {
      const c = v.items.filter((i) => i.status === "confirmed" || i.status === "adjusted").length;
      return `${c} fixture(s) verified, ${v.items.filter((i) => i.status === "rejected").length} removed`;
    },
  };
}

// ---------------------------------------------------------------------------
// 5) Reconstruction — progressive rebuild of confirmed elements only.

function rebuildControl(step, ctx) {
  const dims = ctx.values.dimensions || { widthCm: 200, lengthCm: 260 };
  const door = ctx.values.door || null;
  const detect = ctx.values.detect || { items: [] };
  const kept = detect.items.filter((i) => i.status === "confirmed" || i.status === "adjusted");
  const excluded = detect.items.filter((i) => i.status === "rejected");
  const v = ctx.own({ verified: false, view: "iso" });

  const planWrap = h("div", { class: "plan-wrap plan-wrap--tall" });
  const caption = h("p", { class: "control-note", role: "status", "aria-live": "polite" });

  const verifyBtn = h("button", {
    type: "button",
    class: "btn btn-outline",
    text: "This model matches my room",
    "aria-pressed": String(v.verified),
    onClick: () => {
      v.verified = !v.verified;
      verifyBtn.setAttribute("aria-pressed", String(v.verified));
      verifyBtn.classList.toggle("is-active", v.verified);
      ctx.onChange();
    },
  });

  const viewBtns = [
    ["iso", "Isometric"],
    ["plan", "Top-down"],
  ].map(([view, label]) =>
    h("button", {
      type: "button",
      class: "btn btn-chip",
      dataset: { view },
      "aria-pressed": "false",
      text: label,
      onClick: () => {
        if (v.view === view) return;
        v.view = view;
        build();
      },
    })
  );

  function build() {
    for (const b of viewBtns) {
      const active = b.dataset.view === v.view;
      b.classList.toggle("is-active", active);
      b.setAttribute("aria-pressed", String(active));
    }
    planWrap.replaceChildren();
    const { svg } =
      v.view === "iso" ? renderIso(dims, { door, fixtures: kept }) : renderPlan(dims, { door, fixtures: kept });
    planWrap.append(svg);
    // Progressive reveal: fixtures appear one by one (camera-choreography pacing,
    // no movement for elements below the confidence floor unless user-verified).
    const nodes =
      v.view === "iso"
        ? svg.querySelectorAll("g.iso-fixture")
        : svg.querySelectorAll(".plan-fixture, .plan-fixture-label");
    let idx = 0;
    const perStep = v.view === "iso" ? 1 : 2;
    for (const node of nodes) {
      const delay = ctx.motion.reduced ? 0 : 240 * Math.floor(idx / perStep);
      node.style.opacity = "0";
      const anim = node.animate ? ctx.motion.surfaceReveal(node, { delay }) : null;
      if (anim) anim.finished.then(() => (node.style.opacity = "1")).catch(() => (node.style.opacity = "1"));
      else node.style.opacity = "1";
      idx += 1;
    }
    caption.textContent = `${kept.length} confirmed element(s) placed progressively.` +
      (excluded.length ? ` ${excluded.length} removed item(s) stay out of the model.` : "") +
      " Corrections propagate back — use Back to revisit detection.";
  }
  build();

  const el = h(
    "div",
    { class: "control control-rebuild" },
    h("div", { class: "chip-row", role: "group", "aria-label": "Model view" }, viewBtns),
    planWrap,
    caption,
    h("div", { class: "chip-row" }, verifyBtn)
  );

  return {
    el,
    isSatisfied: () => v.verified,
    value: () => ({ verified: v.verified, placed: kept.length, excluded: excluded.length }),
    summary: () => `${kept.length} element(s) placed, model verified by you`,
  };
}

// ---------------------------------------------------------------------------
// 6) Recommendations — capped, grouped, rationale-first. Max 6 + 1 expert alt.

function recommendControl(step, ctx) {
  const v = ctx.own({ selected: [] });
  const cards = [...scopeRecommendations.slice(0, 6)];
  const status = h("p", { class: "control-note", role: "status" });
  const cardEls = new Map();

  // Cards are built once and updated in place — selection never steals focus.
  function makeCard(rec) {
    const btn = h(
      "button",
      {
        type: "button",
        class: `rec-card${rec.expert ? " rec-card--expert" : ""}`,
        "aria-pressed": "false",
        onClick: () => {
          const i = v.selected.indexOf(rec.id);
          if (i >= 0) v.selected.splice(i, 1);
          else v.selected.push(rec.id);
          update();
        },
      },
      h(
        "span",
        { class: "rec-head" },
        h("strong", { text: rec.title }),
        h("span", { class: `lane lane--${rec.lane}`, text: rec.lane === "premium" ? "Premium lane" : "Standard lane" })
      ),
      h("span", { class: "rec-rationale", text: rec.rationale }),
      h("span", { class: "rec-meta", text: `${rec.effort} · rule ${rec.ruleRef} · reversible` })
    );
    cardEls.set(rec.id, btn);
    return btn;
  }

  const wrap = h("div", { class: "control control-recommend" });
  for (const group of RECOMMENDATION_GROUPS) {
    const items = cards.filter((c) => c.group === group.id);
    if (!items.length) continue;
    wrap.append(
      h("h4", { class: "rec-group-title", text: group.label }),
      h("p", { class: "rec-group-hint", text: group.hint }),
      h("div", { class: "rec-grid" }, items.map(makeCard))
    );
  }
  wrap.append(
    h("h4", { class: "rec-group-title", text: "One expert alternative" }),
    h("div", { class: "rec-grid" }, makeCard(expertAlternative)),
    status
  );

  function update() {
    for (const [id, btn] of cardEls) {
      const active = v.selected.includes(id);
      btn.classList.toggle("is-active", active);
      btn.setAttribute("aria-pressed", String(active));
    }
    status.textContent = v.selected.length
      ? `${v.selected.length} selection(s) in your scope package. Adjust freely — nothing locks in.`
      : "Select at least one direction to build your scope package. The expert alternative counts too.";
    ctx.onChange();
  }
  update();

  const all = [...cards, expertAlternative];
  return {
    el: wrap,
    isSatisfied: () => v.selected.length > 0,
    value: () => ({
      selected: v.selected.map((id) => {
        const r = all.find((c) => c.id === id);
        return { id, title: r.title, lane: r.lane, ruleRef: r.ruleRef, effort: r.effort, rationale: r.rationale };
      }),
    }),
    summary: () => `${v.selected.length} scope item(s) selected`,
  };
}

// ---------------------------------------------------------------------------
// New flow controls.

function moodControl(step, ctx) {
  const v = ctx.own({ moodId: null });
  const wrap = h("div", { class: "control mood-grid" });
  const btns = moods.map((m) =>
    h(
      "button",
      {
        type: "button",
        class: "mood-card",
        "aria-pressed": "false",
        dataset: { mood: m.id },
        onClick: () => {
          v.moodId = m.id;
          update();
          ctx.onChange();
        },
      },
      h("span", { class: "mood-tones" }, m.tones.map((t) => h("span", { class: "tone-dot", style: `background:${t}` }))),
      h("strong", { text: m.name }),
      h("span", { class: "mood-desc", text: m.desc })
    )
  );
  wrap.append(...btns);

  function update() {
    for (const b of btns) {
      const active = b.dataset.mood === v.moodId;
      b.classList.toggle("is-active", active);
      b.setAttribute("aria-pressed", String(active));
    }
  }
  update();

  return {
    el: wrap,
    isSatisfied: () => Boolean(v.moodId),
    value: () => ({ moodId: v.moodId, mood: moods.find((m) => m.id === v.moodId) || null }),
    summary: () => (v.moodId ? (moods.find((m) => m.id === v.moodId) || {}).name : "not chosen"),
  };
}

function layoutControl(step, ctx) {
  const v = ctx.own({ layoutId: null, circulation: null });
  const wrap = h("div", { class: "control" });
  const btns = [];

  function optionRow(list, key, groupLabel) {
    return h(
      "div",
      { class: "option-block", role: "radiogroup", "aria-label": groupLabel },
      h("h4", { class: "rec-group-title", text: groupLabel }),
      h(
        "div",
        { class: "rec-grid" },
        list.map((o) => {
          const b = h(
            "button",
            {
              type: "button",
              role: "radio",
              class: "rec-card",
              "aria-checked": "false",
              dataset: { key, id: o.id },
              onClick: () => {
                v[key] = o.id;
                update();
                ctx.onChange();
              },
            },
            h("strong", { text: o.name }),
            h("span", { class: "rec-rationale", text: o.desc })
          );
          btns.push(b);
          return b;
        })
      )
    );
  }

  wrap.append(
    optionRow(layouts, "layoutId", "Layout intent"),
    optionRow(circulationOptions, "circulation", "Circulation priority")
  );

  function update() {
    for (const b of btns) {
      const active = v[b.dataset.key] === b.dataset.id;
      b.classList.toggle("is-active", active);
      b.setAttribute("aria-checked", String(active));
    }
  }
  update();

  return {
    el: wrap,
    isSatisfied: () => Boolean(v.layoutId && v.circulation),
    value: () => ({ ...v }),
    summary: () => `${v.layoutId || "?"} · ${v.circulation || "?"}`,
  };
}

function materialsControl(step, ctx) {
  const v = ctx.own({ floor: null, wall: null });
  const preview = h("div", { class: "material-preview", "aria-hidden": "true" });
  const previewFloor = h("div", { class: "material-preview-floor" });
  const previewWall = h("div", { class: "material-preview-wall" });
  preview.append(previewWall, previewFloor);
  let activeAnim = null;

  function swatchGroup(kind, label) {
    return h(
      "div",
      { class: "option-block" },
      h("h4", { class: "rec-group-title", text: label }),
      h(
        "div",
        { class: "swatch-row", role: "radiogroup", "aria-label": label },
        materialSets[kind].map((m) =>
          h(
            "button",
            {
              type: "button",
              role: "radio",
              class: `swatch${v[kind] === m.id ? " is-active" : ""}`,
              "aria-checked": String(v[kind] === m.id),
              onClick: () => {
                v[kind] = m.id;
                flow(kind, m);
                refreshGroups();
                ctx.onChange();
              },
            },
            h("span", { class: `swatch-fill swatch--${m.family}`, style: `--tone:${m.tone}` }),
            h("span", { class: "swatch-name", text: m.name })
          )
        )
      )
    );
  }

  // Material change flows in like pigment and settles; cancelable, and a
  // reopened control continues from the current frame (docs/material-transition-language.md).
  function flow(kind, m) {
    const target = kind === "floor" ? previewFloor : previewWall;
    if (activeAnim) activeAnim.cancel();
    target.style.setProperty("--tone", m.tone);
    target.dataset.family = m.family;
    activeAnim = ctx.motion.materialFlow(target, { seed: kind === "floor" ? [30, 82] : [64, 22], area: kind === "floor" ? 0.8 : 1.4 });
  }

  const groupsWrap = h("div", {});
  function refreshGroups() {
    groupsWrap.replaceChildren(swatchGroup("wall", "Wall direction"), swatchGroup("floor", "Floor direction"));
  }
  refreshGroups();

  const el = h(
    "div",
    { class: "control control-materials" },
    groupsWrap,
    preview,
    h("p", { class: "control-note", text: "Transitions settle like pigment — cancel by choosing again at any moment." })
  );

  const find = (kind) => materialSets[kind].find((m) => m.id === v[kind]) || null;
  return {
    el,
    isSatisfied: () => Boolean(v.floor && v.wall),
    value: () => ({ floor: find("floor"), wall: find("wall") }),
    summary: () => `${(find("wall") || {}).name || "?"} walls, ${(find("floor") || {}).name || "?"} floor`,
  };
}

function fixturesControl(step, ctx) {
  const v = ctx.own({ wash: null, wet: null, heat: null });
  const wrap = h("div", { class: "control" });
  const btns = [];

  wrap.append(
    ...fixtureGroups.map((g) =>
      h(
        "div",
        { class: "option-block", role: "radiogroup", "aria-label": g.name },
        h("h4", { class: "rec-group-title", text: g.name }),
        h(
          "div",
          { class: "chip-row" },
          g.options.map((o) => {
            const b = h("button", {
              type: "button",
              role: "radio",
              class: "btn btn-chip",
              "aria-checked": "false",
              dataset: { group: g.id, id: o.id },
              text: o.name,
              onClick: () => {
                v[g.id] = o.id;
                update();
                ctx.onChange();
              },
            });
            btns.push(b);
            return b;
          })
        )
      )
    ),
    h("p", { class: "control-note", text: "Shortlists only — three options per zone, each pre-checked for practical fit." })
  );

  function update() {
    for (const b of btns) {
      const active = v[b.dataset.group] === b.dataset.id;
      b.classList.toggle("is-active", active);
      b.setAttribute("aria-checked", String(active));
    }
  }
  update();

  return {
    el: wrap,
    isSatisfied: () => fixtureGroups.every((g) => Boolean(v[g.id])),
    value: () =>
      Object.fromEntries(
        fixtureGroups.map((g) => [g.id, (g.options.find((o) => o.id === v[g.id]) || { name: null }).name])
      ),
    summary: () => fixtureGroups.map((g) => (g.options.find((o) => o.id === v[g.id]) || { name: "?" }).name).join(", "),
  };
}

function lightingControl(step, ctx) {
  const v = ctx.own({ ...lightingDefaults, touched: false });
  const readout = h("p", { class: "control-note", role: "status" });

  const warmth = h("input", {
    type: "range",
    min: 2700,
    max: 6500,
    step: 100,
    value: v.warmthK,
    "aria-label": "Light warmth in kelvin",
    onInput: (e) => {
      v.warmthK = Number(e.target.value);
      v.touched = true;
      update();
    },
  });
  const brightness = h("input", {
    type: "range",
    min: 20,
    max: 100,
    step: 5,
    value: v.brightnessPct,
    "aria-label": "Brightness percentage",
    onInput: (e) => {
      v.brightnessPct = Number(e.target.value);
      v.touched = true;
      update();
    },
  });
  const keepBtn = h("button", {
    type: "button",
    class: "btn btn-outline",
    text: "Keep the suggested balance",
    onClick: () => {
      v.touched = true;
      update();
    },
  });

  function update() {
    ctx.motion.setLightingPreview(v.warmthK, v.brightnessPct);
    readout.textContent = `${v.warmthK} K · ${v.brightnessPct}% brightness — the room preview behind this card follows your light.`;
    ctx.onChange();
  }
  update();

  const el = h(
    "div",
    { class: "control control-lighting" },
    h("label", { class: "field" }, h("span", { class: "field-label", text: "Warmth (2700 K cosy – 6500 K daylight)" }), warmth),
    h("label", { class: "field" }, h("span", { class: "field-label", text: "Brightness" }), brightness),
    h("div", { class: "chip-row" }, keepBtn),
    readout
  );

  return {
    el,
    isSatisfied: () => v.touched,
    value: () => ({ warmthK: v.warmthK, brightnessPct: v.brightnessPct }),
    summary: () => `${v.warmthK} K, ${v.brightnessPct}%`,
  };
}

function conceptControl(step, ctx) {
  const v = ctx.own({ approved: false });
  const layoutName = (key, list) => {
    const sel = ctx.values.layout && ctx.values.layout[key];
    return (list.find((o) => o.id === sel) || { name: null }).name;
  };
  const rows = [
    ["Mood", (ctx.values.inspiration && ctx.values.inspiration.mood && ctx.values.inspiration.mood.name) || "—"],
    ["Layout", layoutName("layoutId", layouts) || "—"],
    ["Circulation", layoutName("circulation", circulationOptions) || "—"],
    ["Walls", (ctx.values.materials && ctx.values.materials.wall && ctx.values.materials.wall.name) || "—"],
    ["Floor", (ctx.values.materials && ctx.values.materials.floor && ctx.values.materials.floor.name) || "—"],
    ["Fixtures", ctx.values.fixtures ? Object.values(ctx.values.fixtures).filter(Boolean).join(", ") : "—"],
    ["Lighting", ctx.values.lighting ? `${ctx.values.lighting.warmthK} K, ${ctx.values.lighting.brightnessPct}%` : "—"],
  ];

  const approveBtn = h("button", {
    type: "button",
    class: `btn btn-outline${v.approved ? " is-active" : ""}`,
    "aria-pressed": String(v.approved),
    text: "Approve this concept direction",
    onClick: () => {
      v.approved = !v.approved;
      approveBtn.classList.toggle("is-active", v.approved);
      approveBtn.setAttribute("aria-pressed", String(v.approved));
      ctx.onChange();
    },
  });

  const el = h(
    "div",
    { class: "control control-concept" },
    h(
      "dl",
      { class: "concept-list" },
      rows.flatMap(([k, val]) => [h("dt", { text: k }), h("dd", { text: val })])
    ),
    h("p", { class: "control-note", text: "Implementation order: wet zone first, then surfaces, then fixtures, lighting last. Your consultant receives this exact package." }),
    h("div", { class: "chip-row" }, approveBtn)
  );

  return {
    el,
    isSatisfied: () => v.approved,
    value: () => ({ approved: v.approved, implementationOrder: ["wet zone", "surfaces", "fixtures", "lighting"] }),
    summary: () => (v.approved ? "concept approved" : "awaiting approval"),
  };
}

// ---------------------------------------------------------------------------

const FACTORIES = {
  dimensions: dimensionsControl,
  door: doorControl,
  capture: captureControl,
  detect: detectControl,
  rebuild: rebuildControl,
  recommend: recommendControl,
  mood: moodControl,
  layout: layoutControl,
  materials: materialsControl,
  fixtures: fixturesControl,
  lighting: lightingControl,
  concept: conceptControl,
};

export function createControl(step, ctx) {
  const factory = FACTORIES[step.kind];
  if (!factory) {
    return {
      el: h("p", { class: "control-note", text: step.copy }),
      isSatisfied: () => true,
      value: () => ({}),
      summary: () => "—",
    };
  }
  return factory(step, ctx);
}

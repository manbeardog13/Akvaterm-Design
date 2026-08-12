// isometric.js — dependency-free 2.5D room renderer (ADR 0005).
// A calm isometric projection of the reconstructed room: floor, two full back
// walls, low front parapets so the interior stays visible, fixtures as shaded
// boxes, and wall-mounted items (window, mirror, door) as panels. All SVG,
// no runtime dependencies; a true-3D engine stays deferred until a real
// vision backend defines the reconstruction data (see ADR 0005).

const SVG_NS = "http://www.w3.org/2000/svg";
const COS30 = 0.866;
const SIN30 = 0.5;

const WALL_PANEL_TYPES = new Set(["Window", "Mirror"]);
const FIXTURE_HEIGHTS = {
  Toilet: 42,
  Washbasin: 85,
  Bathtub: 58,
  Shower: 118,
  Radiator: 62,
  "Storage unit": 115,
};
const FIXTURE_DEPTH = 45; // cm inward from the wall face

function el(tag, attrs = {}) {
  const n = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, String(v));
  return n;
}

// Segment of a wall in room coordinates: start/end along the wall + inward unit.
function wallSegment(wall, W, L, t, spanCm) {
  const clampCenter = (c, span, len) => Math.min(len - span / 2, Math.max(span / 2, c));
  if (wall === "north" || wall === "south") {
    const y = wall === "north" ? 0 : L;
    const cx = clampCenter(t * W, spanCm, W);
    return { x0: cx - spanCm / 2, x1: cx + spanCm / 2, y0: y, y1: y, inward: wall === "north" ? [0, 1] : [0, -1] };
  }
  const x = wall === "west" ? 0 : W;
  const cy = clampCenter(t * L, spanCm, L);
  return { x0: x, x1: x, y0: cy - spanCm / 2, y1: cy + spanCm / 2, inward: wall === "west" ? [1, 0] : [-1, 0] };
}

export function renderIso(dims, { door = null, fixtures = [] } = {}) {
  const W = Number(dims.widthCm) || 200; // x axis, along the north/south walls
  const L = Number(dims.lengthCm) || 260; // y axis, along the west/east walls
  const H = Math.min(Number(dims.heightCm) || 250, 280) * 0.55; // visual wall height
  const VB_W = 380;
  const VB_H = 300;
  const M = 18;

  const s = Math.min((VB_W - 2 * M) / ((W + L) * COS30), (VB_H - 2 * M) / ((W + L) * SIN30 + H));
  const cx = M + L * COS30 * s;
  const cy = M + H * s;
  const P = (x, y, z = 0) => [cx + (x - y) * COS30 * s, cy + (x + y) * SIN30 * s - z * s];
  const pts = (list) => list.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ");
  const poly = (list, cls, extra = {}) => el("polygon", { points: pts(list), class: cls, ...extra });

  const svg = el("svg", {
    viewBox: `0 0 ${VB_W} ${VB_H}`,
    class: "room-plan iso-scene",
    role: "img",
    "aria-label": `Isometric room model, ${W} by ${L} centimetres`,
  });

  // Floor + back walls (west is the darker left face, north the lighter right face).
  svg.append(
    poly([P(0, 0), P(W, 0), P(W, L), P(0, L)], "iso-floor"),
    poly([P(0, 0), P(0, L), P(0, L, H), P(0, 0, H)], "iso-wall iso-wall--left"),
    poly([P(0, 0), P(W, 0), P(W, 0, H), P(0, 0, H)], "iso-wall iso-wall--right")
  );

  // Wall-mounted panels on the two back walls (door / window / mirror).
  function backPanel(wall, t, spanCm, z0, z1, cls, label) {
    const seg = wallSegment(wall, W, L, t, spanCm);
    const quad = poly(
      [P(seg.x0, seg.y0, z0), P(seg.x1, seg.y1, z0), P(seg.x1, seg.y1, z1), P(seg.x0, seg.y0, z1)],
      cls
    );
    const title = el("title");
    title.textContent = label;
    quad.append(title);
    svg.append(quad);
  }

  // Front-wall markers (south/east have no tall wall — mark on the floor line).
  function frontMarker(wall, t, spanCm, cls, label) {
    const seg = wallSegment(wall, W, L, t, spanCm);
    const [ix, iy] = seg.inward;
    const d = 10;
    const quad = poly(
      [
        P(seg.x0, seg.y0),
        P(seg.x1, seg.y1),
        P(seg.x1 + ix * d, seg.y1 + iy * d),
        P(seg.x0 + ix * d, seg.y0 + iy * d),
      ],
      cls
    );
    const title = el("title");
    title.textContent = label;
    quad.append(title);
    svg.append(quad);
  }

  if (door && door.wall) {
    const t = (door.offsetPct ?? 50) / 100;
    if (door.wall === "north" || door.wall === "west") backPanel(door.wall, t, 72, 0, H * 0.82, "iso-door", "Door");
    else frontMarker(door.wall, t, 72, "iso-door", "Door");
  }

  // Fixtures: boxes for floor-standing items, panels for wall-mounted ones.
  const boxes = [];
  for (const f of fixtures) {
    const t = f.at ?? 0.5;
    if (WALL_PANEL_TYPES.has(f.type)) {
      const span = Math.max(50, (f.size ?? 0.15) * (f.wall === "north" || f.wall === "south" ? W : L));
      if (f.wall === "north" || f.wall === "west") {
        backPanel(f.wall, t, span, H * 0.35, H * 0.75, `iso-panel iso-panel--${f.status || "confirmed"}`, f.type);
      } else {
        frontMarker(f.wall, t, span, `iso-panel iso-panel--${f.status || "confirmed"}`, f.type);
      }
      continue;
    }
    const along = Math.max(34, (f.size ?? 0.12) * (f.wall === "north" || f.wall === "south" ? W : L));
    const seg = wallSegment(f.wall, W, L, t, along);
    const [ix, iy] = seg.inward;
    const x0 = Math.min(seg.x0, seg.x1) + (ix < 0 ? ix * FIXTURE_DEPTH : 0);
    const x1 = Math.max(seg.x0, seg.x1) + (ix > 0 ? ix * FIXTURE_DEPTH : 0);
    const y0 = Math.min(seg.y0, seg.y1) + (iy < 0 ? iy * FIXTURE_DEPTH : 0);
    const y1 = Math.max(seg.y0, seg.y1) + (iy > 0 ? iy * FIXTURE_DEPTH : 0);
    const hgt = FIXTURE_HEIGHTS[f.type] || 60;
    boxes.push({ f, x0, x1, y0, y1, hgt });
  }

  // Painter's order: back to front.
  boxes.sort((a, b) => (a.x0 + a.x1 + a.y0 + a.y1) / 2 - (b.x0 + b.x1 + b.y0 + b.y1) / 2);

  for (const b of boxes) {
    const { f, x0, x1, y0, y1, hgt } = b;
    const g = el("g", { class: `iso-fixture iso-fixture--${f.status || "confirmed"}`, "data-fixture-id": f.id });
    const title = el("title");
    title.textContent = `${f.type} — ${f.status || "confirmed"}`;
    g.append(
      poly([P(x0, y0, hgt), P(x1, y0, hgt), P(x1, y1, hgt), P(x0, y1, hgt)], "iso-face iso-face--top"),
      poly([P(x0, y1, 0), P(x1, y1, 0), P(x1, y1, hgt), P(x0, y1, hgt)], "iso-face iso-face--front"),
      poly([P(x1, y0, 0), P(x1, y1, 0), P(x1, y1, hgt), P(x1, y0, hgt)], "iso-face iso-face--side"),
      title
    );
    const [lx, ly] = P((x0 + x1) / 2, (y0 + y1) / 2, hgt);
    const label = el("text", { class: "plan-fixture-label", x: lx.toFixed(1), y: (ly - 5).toFixed(1), "text-anchor": "middle" });
    label.textContent = f.type;
    g.append(label);
    svg.append(g);
  }

  // Front parapets last — they sit in front of everything.
  const ph = 9;
  svg.append(
    poly([P(0, L), P(W, L), P(W, L, ph), P(0, L, ph)], "iso-parapet"),
    poly([P(W, 0), P(W, L), P(W, L, ph), P(W, 0, ph)], "iso-parapet")
  );

  return { svg };
}

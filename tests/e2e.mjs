// e2e.mjs — end-to-end suite for the Akvaterm Signature Bathroom Journey.
// Dev-only tooling per ADR 0007: self-contained static server, Playwright
// Chromium, zero runtime dependencies touched. Run with `npm test`.
// Set PLAYWRIGHT_CHROMIUM_PATH to reuse a system Chromium build.

import { chromium } from "playwright";
import { createServer } from "http";
import { readFile, writeFile, mkdir } from "fs/promises";
import { extname, join, dirname } from "path";
import { fileURLToPath } from "url";
import { tmpdir } from "os";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SHOTS = join(ROOT, "tests", "screenshots");
await mkdir(SHOTS, { recursive: true });

// --- tiny static server -----------------------------------------------------
const MIME = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".mjs": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
};
const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, "http://localhost");
    const p = url.pathname === "/" ? "/index.html" : url.pathname;
    const file = await readFile(join(ROOT, p));
    res.writeHead(200, { "content-type": MIME[extname(p)] || "application/octet-stream" });
    res.end(file);
  } catch {
    res.writeHead(404);
    res.end("not found");
  }
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const BASE = `http://127.0.0.1:${server.address().port}`;

// --- harness -----------------------------------------------------------------
const errors = [];
let failures = 0;
function check(name, cond) {
  if (cond) console.log(`  ok  ${name}`);
  else {
    failures += 1;
    console.log(`FAIL  ${name}`);
  }
}

const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64"
);
const PHOTO = join(tmpdir(), "wall-north.png");
await writeFile(PHOTO, PNG);

const browser = await chromium.launch({
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined,
});

async function newPage(opts = {}) {
  const context = await browser.newContext({ viewport: { width: 1100, height: 900 }, ...opts });
  const page = await context.newPage();
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  page.on("console", (m) => {
    if (m.type() === "error" && !m.text().includes("favicon")) errors.push(`console: ${m.text()}`);
  });
  return { context, page };
}

// ---------------------------------------------------------------------------
console.log("— Existing Bathroom journey (vision adapter + second angle) —");
{
  const { context, page } = await newPage();
  await page.goto(`${BASE}/index.html`);
  check("hero renders", (await page.textContent("h1")).includes("Design your bathroom"));

  await page.click('[data-select="existing"]');
  await page.waitForSelector(".control-dimensions");
  check("rail shows 6 steps", (await page.$$("#progress-rail .rail-step")).length === 6);
  check("dimensions prefilled valid => Continue enabled", await page.isEnabled("#next-btn"));
  await page.fill('input[data-key="widthCm"]', "9999");
  await page.waitForTimeout(80);
  check("out-of-range disables Continue", !(await page.isEnabled("#next-btn")));
  await page.fill('input[data-key="widthCm"]', "240");
  await page.waitForTimeout(80);
  check("valid again => Continue enabled", await page.isEnabled("#next-btn"));
  check("plan preview renders", (await page.$$(".control-dimensions .room-plan")).length === 1);
  await page.click("#next-btn");

  // Door
  await page.waitForSelector(".control-door");
  check("door starts unsatisfied", !(await page.isEnabled("#next-btn")));
  await page.click('.control-door [data-wall="north"]');
  await page.waitForTimeout(80);
  check("wall chosen => Continue enabled", await page.isEnabled("#next-btn"));
  check("door arc drawn", (await page.$$(".plan-door-arc")).length === 1);
  await page.click("#next-btn");

  // Capture
  await page.waitForSelector(".control-capture");
  check("capture starts unsatisfied", !(await page.isEnabled("#next-btn")));
  await page.check("#capture-consent");
  await page.waitForTimeout(60);
  check("consent alone not enough", !(await page.isEnabled("#next-btn")));
  await page.setInputFiles("#capture-north", PHOTO);
  await page.waitForTimeout(120);
  check("photo added => Continue enabled", await page.isEnabled("#next-btn"));
  await page.click("#next-btn");

  // Detection through the VisionService boundary
  await page.waitForSelector(".detect-row");
  const progressText = await page.textContent(".detect-progress");
  check("analysis ran staged with context (no bare spinner)", progressText.includes("step 4 of 4"));
  check("progress line hidden after analysis", (await page.getAttribute(".detect-progress", "hidden")) !== null);
  check("6 detections listed", (await page.$$(".detect-row")).length === 6);
  check("detect starts unsatisfied", !(await page.isEnabled("#next-btn")));

  const rows = await page.$$(".detect-row");
  for (const i of [0, 1, 2]) await (await rows[i].$$(".detect-actions .btn"))[0].click(); // Confirm
  await (await rows[3].$$(".detect-actions .btn"))[1].click(); // Adjust Mirror
  await page.waitForTimeout(60);
  await (await rows[3].$("select.detect-adjust")).selectOption({ label: "Storage unit" });
  await (await rows[4].$$(".detect-actions .btn"))[2].click(); // Reject Radiator

  // Second angle on the low-confidence Window (det-6)
  check("second-angle offer visible on low-confidence item", await page.isVisible('label[for="angle-det-6"]'));
  await page.screenshot({ path: join(SHOTS, "10-second-angle-offer.png") });
  await page.setInputFiles("#angle-det-6", PHOTO);
  await page.waitForSelector(".detect-flag--ok");
  const okNote = await page.textContent(".detect-flag--ok");
  check("second angle improves confidence", okNote.includes("confidence improved to 75%"));
  check("second-angle offer withdrawn after boost", !(await page.isVisible('label[for="angle-det-6"]')));
  await (await rows[5].$$(".detect-actions .btn"))[0].click(); // Confirm Window
  await page.waitForTimeout(60);
  check("all resolved => Continue enabled", await page.isEnabled("#next-btn"));
  await page.click("#next-btn");

  // Reconstruction — isometric default with top-down toggle
  await page.waitForSelector(".control-rebuild .iso-scene");
  check("isometric scene renders by default", true);
  check("4 fixture boxes in iso view", (await page.$$(".iso-scene g.iso-fixture")).length === 4);
  check("wall panel rendered (window)", (await page.$$(".iso-scene .iso-panel")).length >= 1);
  check("door panel rendered", (await page.$$(".iso-scene .iso-door")).length === 1);
  await page.waitForTimeout(1300); // let the progressive reveal play
  await page.screenshot({ path: join(SHOTS, "11-rebuild-iso.png") });
  await page.click('.control-rebuild [data-view="plan"]');
  await page.waitForSelector(".control-rebuild .room-plan:not(.iso-scene)");
  check("top-down toggle works", (await page.$$(".control-rebuild .plan-fixture")).length === 5);
  await page.click('.control-rebuild [data-view="iso"]');
  await page.waitForSelector(".control-rebuild .iso-scene");
  await page.click('.control-rebuild .btn:has-text("matches my room")');
  await page.waitForTimeout(60);
  check("model verified => Continue enabled", await page.isEnabled("#next-btn"));
  await page.click("#next-btn");

  // Recommendations
  await page.waitForSelector(".control-recommend");
  const cards = await page.$$(".rec-card");
  check("6 + 1 expert cards", cards.length === 7);
  await cards[0].click();
  await cards[2].click();
  await (await page.$$(".rec-card--expert"))[0].click();
  await page.waitForTimeout(60);
  check("selections => Complete enabled", await page.isEnabled("#next-btn"));
  await page.click("#next-btn");

  // Handoff — confidence-aware export
  await page.waitForSelector("#handoff:not([hidden])");
  const packet = JSON.parse(await page.textContent("#handoff-json"));
  check("packet status ready", packet.handoffPacket.status === "ready-for-handoff");
  check("packet has 6 detections", packet.fixtureDetection.length === 6);
  check("visionSummary adapter is mock", packet.visionSummary && packet.visionSummary.adapter === "mock");
  check("visionSummary buckets recorded", packet.visionSummary.buckets && packet.visionSummary.buckets.low === 1);
  check("visionSummary verified count", packet.visionSummary.verified === 5);
  check("visionSummary excludes Radiator", JSON.stringify(packet.visionSummary.excluded) === '["Radiator"]');
  check("second-angle request counted", packet.visionSummary.secondAngleRequests === 1);
  check(
    "second angle flagged on the item",
    packet.fixtureDetection.some((f) => f.type === "Window" && f.secondAngle === true && f.confidence > 0.7)
  );
  check("adjusted item propagated", packet.fixtureDetection.some((f) => f.type === "Storage unit" && f.status === "adjusted"));
  check("3 recommendations selected", packet.recommendations.length === 3);

  const download = page.waitForEvent("download");
  await page.click("#download-packet");
  const dl = await download;
  check("packet downloads as .json", /^akvaterm-handoff-.+\.json$/.test(dl.suggestedFilename()));
  await page.screenshot({ path: join(SHOTS, "12-handoff-export.png") });
  await context.close();
}

// ---------------------------------------------------------------------------
console.log("— Guided-sketch fallback + Back navigation —");
{
  const { context, page } = await newPage();
  await page.goto(`${BASE}/index.html`);
  await page.click('[data-select="existing"]');
  await page.waitForSelector(".control-dimensions");
  await page.click("#next-btn");
  await page.waitForSelector(".control-door");
  await page.click('.control-door [data-wall="east"]');
  await page.click("#next-btn");
  await page.waitForSelector(".control-capture");
  await page.click('.control-capture .btn:has-text("guided sketch")');
  await page.waitForTimeout(60);
  check("sketch mode satisfies capture", await page.isEnabled("#next-btn"));
  await page.click("#next-btn");
  await page.waitForSelector(".sketch-grid");
  await page.click('.sketch-grid .btn:has-text("Toilet")');
  await page.click('.sketch-grid .btn:has-text("Washbasin")');
  await page.click('.control-detect .btn:has-text("list is complete")');
  await page.waitForTimeout(60);
  check("manual inventory satisfies detect", await page.isEnabled("#next-btn"));
  await page.click("#back-btn");
  await page.waitForSelector(".control-capture");
  check(
    "sketch toggle still active after Back",
    (await page.getAttribute('.control-capture .btn:has-text("guided sketch")', "aria-pressed")) === "true"
  );
  await page.click("#next-btn");
  await page.waitForSelector(".sketch-grid");
  check("manual items persist after Back/forward", (await page.$$('.sketch-grid .btn[aria-pressed="true"]')).length === 2);
  await context.close();
}

// ---------------------------------------------------------------------------
console.log("— New Bathroom journey —");
{
  const { context, page } = await newPage();
  await page.goto(`${BASE}/index.html`);
  await page.click('[data-select="new"]');
  await page.waitForSelector(".mood-grid");
  check("mood starts unsatisfied", !(await page.isEnabled("#next-btn")));
  await page.click('.mood-card:has-text("Stone Spa")');
  await page.waitForTimeout(60);
  await page.click("#next-btn");

  await page.waitForSelector(".control .option-block");
  await page.click('.rec-card:has-text("Separated wet zone")');
  await page.waitForTimeout(40);
  check("layout needs circulation too", !(await page.isEnabled("#next-btn")));
  await page.click('.rec-card:has-text("Generous clearance")');
  await page.waitForTimeout(40);
  await page.click("#next-btn");

  await page.waitForSelector(".control-materials");
  await page.click('.swatch:has-text("Zellige tile")');
  await page.waitForTimeout(40);
  check("materials need floor too", !(await page.isEnabled("#next-btn")));
  await page.click('.swatch:has-text("Oak-effect plank")');
  await page.waitForTimeout(300);
  check("material preview took tone", (await page.getAttribute(".material-preview-floor", "data-family")) === "wood");
  await page.click("#next-btn");

  await page.waitForSelector(".control .chip-row");
  await page.click('.btn-chip:has-text("Double 120 cm console")');
  await page.click('.btn-chip:has-text("Freestanding bath")');
  await page.click('.btn-chip:has-text("Rail + underfloor")');
  await page.waitForTimeout(60);
  await page.click("#next-btn");

  await page.waitForSelector(".control-lighting");
  await page.click('.control-lighting .btn:has-text("Keep the suggested balance")');
  await page.waitForTimeout(60);
  check("lighting preview overlay active", (await page.getAttribute(".ambient-layer", "data-lighting")) === "preview");
  await page.click("#next-btn");

  await page.waitForSelector(".control-concept");
  const conceptText = await page.textContent(".concept-list");
  check("concept shows mood name", conceptText.includes("Stone Spa"));
  check("concept shows layout name", conceptText.includes("Separated wet zone"));
  await page.click('.control-concept .btn:has-text("Approve this concept")');
  await page.waitForTimeout(60);
  await page.click("#next-btn");

  await page.waitForSelector("#handoff:not([hidden])");
  const packet = JSON.parse(await page.textContent("#handoff-json"));
  check("new-flow packet approved", packet.recommendations.conceptApproved === true);
  check(
    "materialProfile in packet",
    packet.materialProfile.wall === "Zellige tile" && packet.materialProfile.floor === "Oak-effect plank"
  );
  check("styleProfile mood", packet.styleProfile.primaryStyle === "Stone Spa");
  check("no visionSummary in new flow", packet.visionSummary === null);
  await context.close();
}

// ---------------------------------------------------------------------------
console.log("— Reduced motion —");
{
  const { context, page } = await newPage({ reducedMotion: "reduce" });
  await page.goto(`${BASE}/index.html`);
  check("html flagged reduced", (await page.getAttribute("html", "data-motion")) === "reduced");
  await page.click('[data-select="existing"]');
  await page.waitForSelector(".control-dimensions");
  check("journey still works reduced", await page.isEnabled("#next-btn"));
  await context.close();
}

await browser.close();
server.close();

console.log("");
if (errors.length) {
  console.log("Console/page errors:");
  for (const e of errors) console.log("  " + e);
}
console.log(errors.length === 0 ? "NO console errors" : `${errors.length} console error(s)`);
console.log(failures === 0 && errors.length === 0 ? "ALL CHECKS PASSED" : `${failures} check failure(s)`);
process.exit(failures === 0 && errors.length === 0 ? 0 : 1);

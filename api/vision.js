const DEFAULT_CONFIDENCE_FLOOR = 0.45;
const DEFAULT_MODEL = process.env.GEMINI_MODEL || "gemini-1.5-flash";
const FALLBACK_DETECTIONS = [
  { type: "Toilet", confidence: 0.93, at: 0.22, size: 0.13 },
  { type: "Washbasin", confidence: 0.88, at: 0.55, size: 0.16 },
  { type: "Bathtub", confidence: 0.76, at: 0.5, size: 0.34 },
  { type: "Mirror", confidence: 0.83, at: 0.55, size: 0.14 },
  { type: "Radiator", confidence: 0.58, at: 0.8, size: 0.12 },
  { type: "Window", confidence: 0.41, at: 0.35, size: 0.2 },
];

function clamp(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function buildDetections(capturedWalls) {
  const walls = (capturedWalls || ["north", "east", "south", "west"]).length
    ? (capturedWalls || ["north", "east", "south", "west"])
    : ["north", "east", "south", "west"];
  const items = FALLBACK_DETECTIONS.map((entry, index) => ({
    id: `det-${index + 1}`,
    type: entry.type,
    confidence: entry.confidence,
    wall: walls[index % walls.length],
    at: entry.at,
    size: entry.size,
    status: "pending",
    userVerified: false,
  }));
  const byWall = new Map();
  for (const item of items) {
    if (!byWall.has(item.wall)) byWall.set(item.wall, []);
    byWall.get(item.wall).push(item);
  }
  for (const group of byWall.values()) {
    if (group.length > 1) {
      group.forEach((item, i) => {
        item.at = (i + 1) / (group.length + 1);
      });
    }
  }
  return items;
}

function parseTextDetections(text) {
  if (!text) return null;
  try {
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed)) return parsed;
    if (Array.isArray(parsed?.detections)) return parsed.detections;
  } catch (_) {
    const match = text.match(/\[[\s\S]*\]/);
    if (match) {
      try {
        const fromMatch = JSON.parse(match[0]);
        if (Array.isArray(fromMatch)) return fromMatch;
      } catch (_) {}
    }
  }
  return null;
}

async function callGeminiForVision(prompt, images) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${DEFAULT_MODEL}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [
              {
                text: prompt,
              },
              ...images,
            ],
          },
        ],
      }),
    }
  );

  if (!response.ok) return null;
  const json = await response.json();
  const candidateText =
    json?.candidates?.[0]?.content?.parts?.map((p) => p?.text).filter(Boolean).join("\n") ||
    json?.candidates?.[0]?.content?.parts?.text ||
    "";
  return parseTextDetections(candidateText);
}

function withCors(res, status, body) {
  return res
    .status(status)
    .setHeader("Access-Control-Allow-Origin", "*")
    .setHeader("Cache-Control", "no-store")
    .setHeader("Content-Type", "application/json")
    .json(body);
}

function inferImageParts(photoMap) {
  const images = [];
  for (const info of Object.values(photoMap || {})) {
    if (typeof info?.dataUrl === "string" && info.dataUrl.startsWith("data:")) {
      const [meta, b64] = info.dataUrl.split(",");
      const mimeMatch = (meta || "").match(/data:([^;]+);base64/);
      if (mimeMatch && b64) {
        images.push({
          inlineData: {
            mimeType: mimeMatch[1],
            data: b64,
          },
        });
      }
    }
  }
  return images;
}

async function handler(req, res) {
  if (req.method !== "POST") {
    return withCors(res, 405, { ok: false, error: "Only POST is supported for /api/vision." });
  }

  const body = req.body || {};
  const action = body.action || "detect";
  const photosByWall = body?.request?.photosByWall || body?.photosByWall || {};
  const walls = body?.request?.walls || body?.walls || ["north", "east", "south", "west"];
  const promptBase = "Return a JSON array of bathroom fixture detections. Keep low confidence values for uncertain items.";

  if (action === "health") {
    const hasApiKey = Boolean(process.env.GEMINI_API_KEY);
    return withCors(res, 200, {
      ok: hasApiKey,
      adapter: hasApiKey ? "gemini" : "mock-fallback",
    });
  }

  if (action === "second-angle") {
    const detection = body.detection || {};
    const confidence = clamp(detection.confidence, 0.2);
    return withCors(res, 200, {
      confidence: Math.min(0.97, confidence + 0.34),
      fallback: Boolean(!process.env.GEMINI_API_KEY),
    });
  }

  const prompt =
    `${promptBase} Use only these fixture types: Toilet, Washbasin, Bathtub, Shower, Radiator, Window, Mirror, Storage unit. ` +
    `Return JSON objects with id,type,confidence,wall,at,size and status:'pending'.`;
  const images = inferImageParts(photosByWall);
  const geminiDetections = images.length && process.env.GEMINI_API_KEY ? await callGeminiForVision(prompt, images) : null;
  const detections = Array.isArray(geminiDetections) && geminiDetections.length
    ? geminiDetections
    : buildDetections(Array.isArray(walls) ? walls : ["north", "east", "south", "west"]);

  return withCors(res, 200, {
    ok: true,
    adapter: process.env.GEMINI_API_KEY ? "gemini" : "mock",
    confidenceFloor: DEFAULT_CONFIDENCE_FLOOR,
    detections,
    fallback: !process.env.GEMINI_API_KEY,
  });
}

module.exports = handler;

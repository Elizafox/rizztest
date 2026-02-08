// hypercube.js: colour-coded 5D hypercube projection with axis gradients

const raw = localStorage.getItem("rizzVector");
const vector = raw ? JSON.parse(raw) : { V: 0, W: 0, X: 0, Y: 0, Z: 0 };

const hypercubeSection = document.getElementById("hypercube");
if (!raw) {
  if (hypercubeSection) hypercubeSection.hidden = true;
  // Bail early: nothing to render
  throw new Error("No rizzVector found; hypercube hidden.");
} else {
  if (hypercubeSection) hypercubeSection.hidden = false;
}

const canvas = document.getElementById("cube");
const caption = document.getElementById("caption");
if (!canvas || !caption) {
  throw new Error("Missing #cube canvas or #caption element.");
}

const ctx = canvas.getContext("2d");
if (!ctx) throw new Error("2D canvas context unavailable.");

// Axis order, must match scoring keys
const AXIS_KEYS = ["V", "W", "X", "Y", "Z"];

// Opposing-ish pairs per axis: [negativeSide, positiveSide]
const AXIS_COLOURS = {
  V: ["#6b4eff", "#ff6bb5"], // authentic <-> performative
  W: ["#2ecc71", "#e67e22"], // harmless <-> powerful
  X: ["#3498db", "#e74c3c"], // cringe <-> based
  Y: ["#95a5a6", "#f1c40f"], // effortless <-> tryhard
  Z: ["#9b59b6", "#1abc9c"], // unhinged <-> calculated
};

// Normalise helper: map arbitrary axis ranges into [-1, 1]
function norm(v, maxAbs = 20) {
  const n = Number(v) || 0;
  const x = Math.max(-maxAbs, Math.min(maxAbs, n));
  return x / maxAbs;
}

// 5D point in [-1,1]^5
function getPoint5D() {
  return [
    norm(vector.V),
    norm(vector.W),
    norm(vector.X),
    norm(vector.Y),
    norm(vector.Z),
  ];
}

// 5D hypercube vertices: all 32 sign combinations
function vertices5D() {
  const verts = [];
  for (let mask = 0; mask < 32; mask++) {
    const v = [];
    for (let d = 0; d < 5; d++) v.push(mask & (1 << d) ? 1 : -1);
    verts.push(v);
  }
  return verts;
}

// Edges connect vertices differing by exactly one bit; keep axis index d
function edges5D() {
  const edges = [];
  for (let a = 0; a < 32; a++) {
    for (let d = 0; d < 5; d++) {
      const b = a ^ (1 << d);
      if (a < b) edges.push([a, b, d]);
    }
  }
  return edges;
}

// Projection: 5D -> 2D using a random-ish basis
function randomBasis2D() {
  const basis = [];
  const baseAngle = Math.random() * Math.PI * 2;
  for (let i = 0; i < 5; i++) {
    const ang =
      baseAngle + (i * (Math.PI * 2)) / 5 + (Math.random() - 0.5) * 0.25;
    basis.push([Math.cos(ang), Math.sin(ang)]);
  }
  return basis;
}

let BASIS = randomBasis2D();

function project2D(v5) {
  let x = 0,
    y = 0;
  for (let i = 0; i < 5; i++) {
    x += v5[i] * BASIS[i][0];
    y += v5[i] * BASIS[i][1];
  }
  return [x, y];
}

// Colour helpers
function hexToRgb(hex) {
  const m = hex.replace("#", "").match(/.{2}/g);
  if (!m) return [0, 0, 0];
  return m.map((h) => parseInt(h, 16));
}

function mixColours(hexes, weights) {
  let r = 0,
    g = 0,
    b = 0,
    total = 0;

  for (let i = 0; i < hexes.length; i++) {
    const w = Math.abs(Number(weights[i]) || 0);
    total += w;
    const [cr, cg, cb] = hexToRgb(hexes[i]);
    r += cr * w;
    g += cg * w;
    b += cb * w;
  }

  if (!total) return "rgba(0,0,0,0.9)";
  return `rgb(${(r / total) | 0}, ${(g / total) | 0}, ${(b / total) | 0})`;
}

function prefersDark() {
  return !!window.matchMedia?.("(prefers-color-scheme: dark)")?.matches;
}

// ----- Drawing -----
function draw() {
  // Background fill to survive Dark Reader / low-contrast themes
  const dark = prefersDark();
  ctx.save();
  ctx.globalAlpha = 1;
  ctx.fillStyle = dark ? "#0b0b0b" : "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.restore();

  const verts = vertices5D();
  const edges = edges5D();

  // Project all vertices
  const projected = verts.map(project2D);

  // Add the user's point
  const p5 = getPoint5D();
  const p2 = project2D(p5);

  // Find bounds for auto-scale
  let minX = Infinity,
    maxX = -Infinity,
    minY = Infinity,
    maxY = -Infinity;

  for (const [x, y] of projected) {
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
  }
  minX = Math.min(minX, p2[0]);
  maxX = Math.max(maxX, p2[0]);
  minY = Math.min(minY, p2[1]);
  maxY = Math.max(maxY, p2[1]);

  const pad = 60;
  const w = canvas.width - pad * 2;
  const h = canvas.height - pad * 2;
  const rangeX = maxX - minX || 1;
  const rangeY = maxY - minY || 1;
  const scale = Math.min(w / rangeX, h / rangeY);

  function toScreen([x, y]) {
    const sx = pad + (x - minX) * scale;
    const sy = pad + (y - minY) * scale;
    return [sx, canvas.height - sy];
  }

  // Title
  ctx.font = "14px system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
  ctx.fillStyle = dark ? "rgba(255,255,255,0.85)" : "rgba(0,0,0,0.75)";
  ctx.fillText("5D Rizz Hypercube (projected to 2D)", 16, 24);

  // Draw edges axis-by-axis with gradients
  // (Per edge: gradient from negative-side colour to positive-side colour)
  for (const [a, b, axisIndex] of edges) {
    const axisKey = AXIS_KEYS[axisIndex];
    const [negCol, posCol] = AXIS_COLOURS[axisKey];

    // Determine which endpoint is negative vs positive on that axis
    const colourA = verts[a][axisIndex] < 0 ? negCol : posCol;
    const colourB = verts[b][axisIndex] < 0 ? negCol : posCol;

    const A = toScreen(projected[a]);
    const B = toScreen(projected[b]);

    const grad = ctx.createLinearGradient(A[0], A[1], B[0], B[1]);
    grad.addColorStop(0, colourA);
    grad.addColorStop(1, colourB);

    // Contrast settings (tweakable)
    ctx.strokeStyle = grad;
    ctx.globalAlpha = 0.65;
    ctx.lineWidth = 1.7;

    ctx.beginPath();
    ctx.moveTo(A[0], A[1]);
    ctx.lineTo(B[0], B[1]);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  // Draw vertices (neutral, light)
  ctx.fillStyle = dark ? "rgba(255,255,255,0.35)" : "rgba(0,0,0,0.35)";
  for (let i = 0; i < projected.length; i++) {
    const [sx, sy] = toScreen(projected[i]);
    ctx.beginPath();
    ctx.arc(sx, sy, 2.2, 0, Math.PI * 2);
    ctx.fill();
  }

  // Draw point: colour derived from axis sides, weighted by magnitude
  const axisVals = [vector.V, vector.W, vector.X, vector.Y, vector.Z];
  const userAxisColours = axisVals.map((v, i) => {
    const key = AXIS_KEYS[i];
    const [negCol, posCol] = AXIS_COLOURS[key];
    return (Number(v) || 0) >= 0 ? posCol : negCol;
  });
  const userColour = mixColours(userAxisColours, axisVals);

  {
    const [sx, sy] = toScreen(p2);

    // Outer ring for contrast
    ctx.lineWidth = 3.5;
    ctx.strokeStyle = dark ? "rgba(255,255,255,0.85)" : "rgba(0,0,0,0.85)";
    ctx.beginPath();
    ctx.arc(sx, sy, 8, 0, Math.PI * 2);
    ctx.stroke();

    // Inner ring in blended “aura” colour
    ctx.lineWidth = 3;
    ctx.strokeStyle = userColour;
    ctx.beginPath();
    ctx.arc(sx, sy, 7, 0, Math.PI * 2);
    ctx.stroke();

    // Crosshair
    ctx.lineWidth = 2;
    ctx.strokeStyle = userColour;
    ctx.beginPath();
    ctx.moveTo(sx - 12, sy);
    ctx.lineTo(sx + 12, sy);
    ctx.moveTo(sx, sy - 12);
    ctx.lineTo(sx, sy + 12);
    ctx.stroke();
  }

  // Caption
  caption.textContent =
    `Vector: V=${vector.V}, W=${vector.W}, X=${vector.X}, Y=${vector.Y}, Z=${vector.Z}. ` +
    `Projection is randomised (hit “Reshuffle projection” to rotate reality).`;
}

// Initial draw
draw();

// Buttons
document.getElementById("regen")?.addEventListener("click", () => {
  BASIS = randomBasis2D();
  draw();
});

document.getElementById("save")?.addEventListener("click", () => {
  const url = canvas.toDataURL("image/png");
  const a = document.createElement("a");
  a.href = url;
  a.download = "rizz-hypercube.png";
  a.click();
});

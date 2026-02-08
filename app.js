// app.js: rizz test engine
//
// This module:
// - Shuffles questions once on load
// - Tracks per-question deltas so re-click overwrites (no double-counting)
// - Requires ALL questions answered before enabling “View results”
// - Optional debug mode (?debug=1) with wipe button
// - Apply quiet retake penalty on finish

// Config
const AXES = ["V", "W", "X", "Y", "Z"];
const DEBUG = new URLSearchParams(window.location.search).get("debug") === "1";

const WIPE_KEYS = [
  "rizzVector",
  "rizzTimestamp",
  "rizzLastSeen",
  "rizzChecks",
  "rizzRetakePenalty",
  "rizzAnsweredQids",
  // add future keys here
];

// State
const score = { V: 0, W: 0, X: 0, Y: 0, Z: 0 };

// qid -> [{axis, delta}, ...]
const perQuestion = new Map();

// qid set
const answered = new Set();

// DOM
const quizEl = document.getElementById("quiz");
if (!quizEl) throw new Error("No quiz found");

const finishBtn = document.getElementById("viewResults");
const progressEl = document.getElementById("progress"); // optional
const errorEl = document.getElementById("error"); // optional
const debugControls = document.querySelector(".debug-controls");
const wipeBtn = document.getElementById("wipeData");

// Helpers
function shuffle(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
}

function parseAxesSpec(spec) {
  // "V:1,W:-1" -> [{axis:"V",dir:1},{axis:"W",dir:-1}]
  return spec.split(",").map((pair) => {
    const [axisRaw, dirRaw] = pair.split(":");
    const axis = (axisRaw || "").trim();
    const dir = Number(dirRaw);
    if (!AXES.includes(axis) || !Number.isFinite(dir)) {
      throw new Error(`Invalid data-axes spec: "${spec}"`);
    }
    return { axis, dir };
  });
}

function updateProgress(total) {
  const n = answered.size;

  if (progressEl) progressEl.textContent = `Answered ${n} / ${total}`;
  if (finishBtn) finishBtn.disabled = n !== total;

  if (n === total && errorEl) errorEl.hidden = true;
}

function firstUnanswered(questionLis) {
  return questionLis.find((li) => !answered.has(li.dataset.qid));
}

// Optional debug hook if you already have it somewhere
function renderDebugMaybe() {
  if (typeof window.renderDebug === "function") window.renderDebug(score);
}

// Init: assign qids + shuffle
const questionLis = Array.from(quizEl.querySelectorAll("li[data-axes]"));
const total = questionLis.length;

// Stable qid per <li> (before shuffle)
questionLis.forEach((li, i) => {
  if (!li.dataset.qid) li.dataset.qid = String(i + 1);
});

// Shuffle questions once on DOM ready (or immediately if already ready)
function doShuffleOnce() {
  const items = Array.from(quizEl.querySelectorAll("li[data-axes]"));
  shuffle(items);
  quizEl.innerHTML = "";
  items.forEach((li) => quizEl.appendChild(li));
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", doShuffleOnce, { once: true });
} else {
  doShuffleOnce();
}

// Start with finish disabled until complete
if (finishBtn) finishBtn.disabled = true;
updateProgress(total);

// Event: answer click (delegated)
quizEl.addEventListener("click", (e) => {
  const btn = e.target.closest("button[data-value]");
  if (!btn) return;

  const li = btn.closest("li[data-axes][data-qid]");
  if (!li) return;

  const qid = li.dataset.qid;
  const value = Number(btn.dataset.value); // -2, -1, +1, +2
  if (!Number.isFinite(value)) return;

  let axes;
  try {
    axes = parseAxesSpec(li.dataset.axes || "");
  } catch (err) {
    console.error(err);
    return;
  }

  // Remove previous contribution for this question (if any)
  const prev = perQuestion.get(qid);
  if (prev) {
    prev.forEach(({ axis, delta }) => {
      score[axis] -= delta;
    });
  }

  // Compute and apply new deltas
  const deltas = axes.map(({ axis, dir }) => ({ axis, delta: dir * value }));
  deltas.forEach(({ axis, delta }) => {
    score[axis] += delta;
  });

  perQuestion.set(qid, deltas);
  answered.add(qid);

  // UI: mark chosen in that question
  li.querySelectorAll("button[data-value]").forEach((b) =>
    b.classList.remove("picked"),
  );
  btn.classList.add("picked");

  li.classList.remove("missing");
  updateProgress(total);

  localStorage.setItem("rizzAnsweredQids", JSON.stringify([...answered]));

  renderDebugMaybe();
});

// Debug controls
if (debugControls) debugControls.hidden = !DEBUG;

wipeBtn?.addEventListener("click", () => {
  WIPE_KEYS.forEach((k) => localStorage.removeItem(k));
  window.location.reload();
});

// Finish: gate + save
finishBtn?.addEventListener("click", () => {
  if (answered.size !== total) {
    if (errorEl) errorEl.hidden = false;

    const missing = firstUnanswered(
      Array.from(quizEl.querySelectorAll("li[data-axes][data-qid]")),
    );
    if (missing) {
      missing.classList.add("missing");
      missing.scrollIntoView({ behavior: "smooth", block: "center" });
    }
    return;
  }

  // Apply quiet retake penalty
  const penalty = Number(localStorage.getItem("rizzRetakePenalty") || "0");

  // Copy score so we don't mutate in-memory object unexpectedly
  const finalVector = { ...score };

  // Subtle: nudge toward performative/tryhard with each retake
  if (penalty > 0) {
    finalVector.V += Math.min(2, penalty);
    finalVector.Y += Math.min(2, penalty);
  }

  localStorage.setItem("rizzVector", JSON.stringify(finalVector));
  localStorage.setItem("rizzTimestamp", String(Date.now()));

  window.location.href = "results.html";
});

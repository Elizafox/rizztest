// app.js: main test scoring enumeration

// 5D rizz vector
const score = { V: 0, W: 0, X: 0, Y: 0, Z: 0 };

// Track per-question contribution so re-clicking a question overwrites instead of double-counting
// key = li index; value = { axis, delta }
const perQuestion = new Map();

const quizEl = document.getElementById("quiz");

quizEl.addEventListener("click", (e) => {
  const btn = e.target.closest("button[data-value]");
  if (!btn) return;

  const li = btn.closest("li[data-axes]");
  if (!li) return;

  const axesSpec = li.dataset.axes;
  const axes = axesSpec.split(",").map((pair) => {
    const [axis, dir] = pair.split(":");
    return { axis, dir: Number(dir) };
  });
  const value = Number(btn.dataset.value); // -2, -1, +1, +2

  const idx = Array.from(quizEl.children).indexOf(li);

  // Remove previous contribution for this question (if any)
  const prev = perQuestion.get(idx);
  if (prev) {
    prev.forEach(({ axis, delta }) => {
      score[axis] -= delta;
    });
  }

  const deltas = axes.map(({ axis, dir }) => ({
    axis,
    delta: dir * value,
  }));

  // apply
  deltas.forEach(({ axis, delta }) => {
    score[axis] += delta;
  });

  perQuestion.set(idx, deltas);

  // UI: mark chosen button set
  li.querySelectorAll("button").forEach((b) => b.classList.remove("picked"));
  btn.classList.add("picked");

  renderDebug();
});

function shuffle(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
}

document.addEventListener("DOMContentLoaded", () => {
  const quiz = document.getElementById("quiz");
  if (!quiz) return;

  // collect all <li> questions, even if they came from multiple <ol>s
  // useful later if we separate into blocks
  const items = Array.from(quiz.querySelectorAll("li"));

  shuffle(items);

  // clear and re-append
  quiz.innerHTML = "";
  items.forEach((li) => quiz.appendChild(li));
});

// Debug toggles
// Turn on by visiting: index.html?debug=1
const DEBUG = new URLSearchParams(window.location.search).get("debug") === "1";

const debugControls = document.querySelector(".debug-controls");
if (debugControls) debugControls.hidden = !DEBUG;

const WIPE_KEYS = [
  "rizzVector",
  "rizzTimestamp",
  "rizzLastSeen",
  "rizzChecks",
  "rizzRetakePenalty",
  // add any future keys here:
  // "mogBoardVisits", "sortByHighestClicks", etc
];

document.getElementById("wipeData")?.addEventListener("click", () => {
  WIPE_KEYS.forEach((k) => localStorage.removeItem(k));

  // Reload to reset the UI
  window.location.reload();
});

document.getElementById("finish").addEventListener("click", () => {
  // Apply quiet retake penalty
  const penalty = Number(localStorage.getItem("rizzRetakePenalty") || "0");

  // Copy score so we don't mutate the in-memory object unexpectedly
  const finalVector = { ...score };

  // Subtle: nudge toward performative/tryhard with each retake
  if (penalty > 0) {
    finalVector.V += Math.min(2, penalty); // performative drift
    finalVector.Y += Math.min(2, penalty); // tryhard drift
  }

  localStorage.setItem("rizzVector", JSON.stringify(finalVector));
  localStorage.setItem("rizzTimestamp", String(Date.now()));

  window.location.href = "results.html";
});

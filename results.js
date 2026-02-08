// results.js: scoring functions

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function signLabel(axisName, v) {
  // v < 0 -> left side, v > 0 -> right side
  if (axisName === "V") return v >= 0 ? "performative" : "authentic";
  if (axisName === "W") return v >= 0 ? "powerful" : "harmless";
  if (axisName === "X") return v >= 0 ? "based" : "cringe";
  if (axisName === "Y") return v >= 0 ? "tryhard" : "effortless";
  if (axisName === "Z") return v >= 0 ? "calculated" : "unhinged";
  return "unknown";
}

function intensity(v) {
  const a = Math.abs(v);
  if (a <= 1) return "mildly";
  if (a <= 3) return "notably";
  if (a <= 6) return "dangerously";
  return "catastrophically";
}

function auraLine(vector, meta) {
  // Fake “derivative” aura: reward time since last check, penalise repeated checking.
  // Keep it non-numeric in the UI.
  const now = Date.now();
  const lastSeen = Number(localStorage.getItem("rizzLastSeen") || "0");
  const checks = Number(localStorage.getItem("rizzChecks") || "0");
  const minutesSince = lastSeen ? (now - lastSeen) / 60000 : 9999;

  // Update observation metadata
  localStorage.setItem("rizzLastSeen", String(now));
  localStorage.setItem("rizzChecks", String(checks + 1));

  // Base aura “tone” from vector shape:
  // - big tryhard + performative tends to read as brittle
  // - authentic + effortless tends to read as stable
  const V = vector.V || 0;
  const Y = vector.Y || 0;
  const Z = vector.Z || 0;

  const anxious = (V > 0) + (Y > 0) + (checks >= 3);
  const grounded = (V < 0) + (Y < 0) + (minutesSince > 60);

  if (checks >= 6) return "Your aura is unstable due to repeated observation.";
  if (anxious >= 2) return "Your aura is brittle, but it still emits heat.";
  if (grounded >= 2)
    return "Your aura is stable. Stop checking and it improves.";
  if (Z < 0) return "Your aura is chaotic, but oddly compelling.";
  return "Your aura is coherent. Do not attempt optimisation.";
}

function alignmentText(vector) {
  // For now: one sentence with axis words + intensities.
  const parts = ["V", "W", "X", "Y", "Z"].map((k) => {
    const v = vector[k] ?? 0;
    return `${intensity(v)} ${signLabel(k, v)}`;
  });

  // Make it read like an ominous diagnosis
  return `You are: ${parts.join(", ")}.`;
}

// main

const raw = localStorage.getItem("rizzVector");
const missingEl = document.getElementById("missing");
const resultEl = document.getElementById("result");

if (!raw) {
  missingEl.hidden = false;
} else {
  let vector;
  try {
    vector = JSON.parse(raw);
  } catch {
    missingEl.hidden = false;
    throw new Error("Stored rizzVector was not valid JSON.");
  }

  resultEl.hidden = false;

  document.getElementById("alignment").textContent = alignmentText(vector);
  document.getElementById("aura").textContent = auraLine(vector);

  document.getElementById("vector").textContent = JSON.stringify(
    vector,
    null,
    2,
  );

  // “Retake lowers aura” mechanic (quietly)
  const retake = document.getElementById("retake");
  retake.addEventListener("click", () => {
    const penalty =
      Number(localStorage.getItem("rizzRetakePenalty") || "0") + 1;
    localStorage.setItem("rizzRetakePenalty", String(penalty));
    // Can actually apply the penalty later when saving new results.
    // Keep it quiet. Let them feel it.
  });
}

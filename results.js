// results.js: scoring functions

import { loadVectorWithSource, vectorAndAuraToHash } from "./loadresult.js";

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
  if (a <= 5) return "somewhat";
  if (a <= 10) return "notably";
  if (a <= 20) return "very";
  if (a <= 25) return "dangerously";
  return "catastrophically";
}

function auraLine(vector, isForeign) {
  if (isForeign) {
    return "Aura snapshot viewed. Your personal aura remains unobserved (for now).";
  }

  const now = Date.now();
  const lastSeen = Number(localStorage.getItem("rizzLastSeen") || "0");
  const checks = Number(localStorage.getItem("rizzChecks") || "0");
  const minutesSince = lastSeen ? (now - lastSeen) / 60000 : 9999;

  localStorage.setItem("rizzLastSeen", String(now));
  localStorage.setItem("rizzChecks", String(checks + 1));

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

function computeAuraScore(vector) {
  // Totally vibes-based: map “coherent authenticity” higher, “brittle performative tryhard” lower.
  const V = vector.V || 0;
  const Y = vector.Y || 0;
  const Z = vector.Z || 0;
  const W = vector.W || 0;
  const X = vector.X || 0;

  // Start at 50, then push around
  let score = 50;

  // grounded points
  score += -V * 0.8;
  score += -Y * 0.8;

  // controlled power / basedness nudges
  score += W * 0.3;
  score += X * 0.2;

  // too calculated can read as "optimized"; too unhinged can also wobble
  score -= Math.abs(Z) * 0.2;

  // retake penalty (quiet)
  const penalty = Number(localStorage.getItem("rizzRetakePenalty") || "0");
  score -= penalty * 5;

  return clamp(Math.round(score), 0, 100);
}

// main

const loaded = loadVectorWithSource();
const missingEl = document.getElementById("missing");
const resultEl = document.getElementById("result");
const permalinkSection = document.getElementById("permalink");

if (!loaded) {
  missingEl.hidden = false;
  permalinkSection.hidden = true;
} else {
  const { vector, source, aura: auraFromLink } = loaded;
  const isForeign = source === "hash";

  resultEl.hidden = false;

  // If this is the user's local result, stamp a permalink that includes an aura snapshot.
  // If it's a permalink view, DO NOT rewrite the hash (preserve what they shared).
  if (!isForeign) {
    const auraScore = computeAuraScore(vector);
    const hash = vectorAndAuraToHash(vector, auraScore);
    if (window.location.hash !== hash) history.replaceState(null, "", hash);
  }

  // Permalink UI
  permalinkSection.hidden = false;

  const input = document.getElementById("permalinkInput");
  const copyBtn = document.getElementById("copyPermalink");

  // Build permalink:
  // - If viewing foreign permalink: share exactly what’s in the URL (don’t re-author it)
  // - If local: build from current URL (already stamped above)
  const url = `${location.origin}${location.pathname}${location.hash || ""}`;

  if (input) input.value = url;

  copyBtn?.addEventListener("click", async () => {
    await navigator.clipboard.writeText(url);
    copyBtn.textContent = "Copied";
    setTimeout(() => (copyBtn.textContent = "Copy permalink"), 1200);
  });

  document.getElementById("alignment").textContent = alignmentText(vector);

  // Aura display:
  // - If foreign permalink and it included aura, show it as snapshot
  // - Otherwise show the local aura line (and only mutate local meta for local results)
  const auraEl = document.getElementById("aura");

  if (isForeign) {
    auraEl.textContent =
      auraFromLink === null
        ? "Aura not included in this snapshot."
        : `Snapshot aura: ${clamp(Number(auraFromLink), 0, 100)} (do not attempt optimisation).`;
  } else {
    auraEl.textContent = auraLine(vector, false);
  }

  document.getElementById("vector").textContent = JSON.stringify(
    vector,
    null,
    2,
  );

  // Retake lowers aura mechanic (only meaningful for local use)
  document.getElementById("retake")?.addEventListener("click", () => {
    const penalty =
      Number(localStorage.getItem("rizzRetakePenalty") || "0") + 1;
    localStorage.setItem("rizzRetakePenalty", String(penalty));
  });
}

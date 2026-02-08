// loadresult.js: load a result

export function parseFromHash() {
  const h = (window.location.hash || "").replace(/^#/, "").trim();
  if (!h) return null;

  // Support "V,W,X,Y,Z" and "V,W,X,Y,Z;a=NN"
  const [vecPart, metaPart] = h.split(";");

  const parts = vecPart.split(",").map((s) => Number(s.trim()));
  if (parts.length !== 5 || parts.some((n) => !Number.isFinite(n))) return null;

  let aura = null;
  if (metaPart) {
    const m = metaPart.match(/a\s*=\s*(-?\d+)/i);
    if (m) {
      const n = Number(m[1]);
      if (Number.isFinite(n)) aura = n;
    }
  }

  const [V, W, X, Y, Z] = parts;
  return { vector: { V, W, X, Y, Z }, aura };
}

export function loadVectorWithSource() {
  const fromHash = parseFromHash();
  if (fromHash) return { ...fromHash, source: "hash" };

  const raw = localStorage.getItem("rizzVector");
  if (!raw) return null;

  try {
    const v = JSON.parse(raw);
    const vector = {
      V: Number(v.V),
      W: Number(v.W),
      X: Number(v.X),
      Y: Number(v.Y),
      Z: Number(v.Z),
    };
    if (Object.values(vector).some((n) => !Number.isFinite(n))) return null;
    return { vector, aura: null, source: "local" };
  } catch {
    return null;
  }
}

export function vectorAndAuraToHash(vector, aura) {
  const base = `#${vector.V},${vector.W},${vector.X},${vector.Y},${vector.Z}`;
  if (aura === null || aura === undefined) return base;
  return `${base};a=${encodeURIComponent(String(aura))}`;
}

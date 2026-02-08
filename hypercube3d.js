// hypercube3d.js: 3D hypercube

import * as THREE from "three";
import { OrbitControls } from "https://cdn.jsdelivr.net/npm/three@0.182.0/examples/jsm/controls/OrbitControls.js";
import { loadVectorWithSource } from "./loadresult.js";

const hypercube3dSection = document.getElementById("hypercube3d");
const canvas = document.getElementById("cube3d");

if (!canvas) {
  // Not on a page that has the 3D canvas; silently no-op.
  console.warn("[3d] #cube3d not found; skipping WebGL");
} else {
  const loaded = loadVectorWithSource();
  if (!loaded) {
    hypercube3dSection?.setAttribute("hidden", "");
    canvas.setAttribute("hidden", "");
    console.log("[3d] no results; hiding 3D cube");
  } else {
    hypercube3dSection?.removeAttribute("hidden");
    canvas.removeAttribute("hidden");

    const { vector } = loaded;

    // 5D hypercube model
    const AXIS_KEYS = ["V", "W", "X", "Y", "Z"];

    const AXIS_COLOURS = {
      V: ["#6b4eff", "#ff6bb5"],
      W: ["#2ecc71", "#e67e22"],
      X: ["#3498db", "#e74c3c"],
      Y: ["#95a5a6", "#f1c40f"],
      Z: ["#9b59b6", "#1abc9c"],
    };

    function norm(v, maxAbs = 20) {
      const n = Number(v) || 0;
      const x = Math.max(-maxAbs, Math.min(maxAbs, n));
      return x / maxAbs;
    }

    function getPoint5D() {
      return [
        norm(vector.V),
        norm(vector.W),
        norm(vector.X),
        norm(vector.Y),
        norm(vector.Z),
      ];
    }

    function vertices5D() {
      const verts = [];
      for (let mask = 0; mask < 32; mask++) {
        const v = [];
        for (let d = 0; d < 5; d++) v.push(mask & (1 << d) ? 1 : -1);
        verts.push(v);
      }
      return verts;
    }

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

    // 5D -> 3D projection via 3D basis vectors
    // basis[i] is a THREE.Vector3; project = sum(v5[i] * basis[i])
    function randomBasis3D() {
      // Make 5 directions spread over the sphere-ish
      const basis = [];
      for (let i = 0; i < 5; i++) {
        // random unit vector
        const v = new THREE.Vector3(
          Math.random() * 2 - 1,
          Math.random() * 2 - 1,
          Math.random() * 2 - 1,
        );
        if (v.lengthSq() < 1e-6) v.set(1, 0, 0);
        v.normalize();
        // small jitter per axis so they aren't too symmetrical
        v.multiplyScalar(1.0 + (Math.random() - 0.5) * 0.15);
        basis.push(v);
      }
      return basis;
    }

    let BASIS3 = randomBasis3D();

    function project3D(v5) {
      const p = new THREE.Vector3(0, 0, 0);
      for (let i = 0; i < 5; i++) {
        p.addScaledVector(BASIS3[i], v5[i]);
      }
      return p;
    }

    // THREE.js setup
    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: false,
      powerPreference: "high-performance",
    });

    // Colours/background: keep simple; Dark Reader can’t invert WebGL output
    renderer.setClearColor(0x0b0b0b, 1);

    const scene = new THREE.Scene();

    const camera = new THREE.PerspectiveCamera(55, 1, 0.01, 100);
    camera.position.set(4.5, 3.5, 5.0);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.rotateSpeed = 0.6;
    controls.zoomSpeed = 0.7;
    controls.panSpeed = 0.6;

    // Light (subtle, mostly for the user point)
    const ambient = new THREE.AmbientLight(0xffffff, 0.8);
    scene.add(ambient);

    const dir = new THREE.DirectionalLight(0xffffff, 0.6);
    dir.position.set(2, 3, 1);
    scene.add(dir);

    // Resize handling (retina-safe)
    function resize() {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const w = canvas.clientWidth || canvas.width;
      const h = canvas.clientHeight || canvas.height;

      renderer.setPixelRatio(dpr);
      renderer.setSize(w, h, false);

      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    }

    // Build geometry groups per axis so each axis can be coloured
    const verts = vertices5D();
    const edges = edges5D();

    // Project all vertices once per basis
    function buildWireframe() {
      // Remove old wireframe groups
      for (let i = scene.children.length - 1; i >= 0; i--) {
        const obj = scene.children[i];
        if (obj.userData && obj.userData.kind === "wireframe") {
          scene.remove(obj);
          obj.geometry?.dispose?.();
          obj.material?.dispose?.();
        }
      }

      const projected = verts.map((v5) => project3D(v5));

      // Scale it to a nice size
      const scale = 1.15;
      projected.forEach((p) => p.multiplyScalar(scale));

      // Axis group lines
      for (let axisIndex = 0; axisIndex < 5; axisIndex++) {
        const axisKey = AXIS_KEYS[axisIndex];
        const [negCol, posCol] = AXIS_COLOURS[axisKey];

        const positions = [];
        const colours = [];

        for (const [a, b, d] of edges) {
          if (d !== axisIndex) continue;

          const A = projected[a];
          const B = projected[b];

          // Determine endpoint colours by polarity on that axis
          const colA = new THREE.Color(
            verts[a][axisIndex] < 0 ? negCol : posCol,
          );
          const colB = new THREE.Color(
            verts[b][axisIndex] < 0 ? negCol : posCol,
          );

          positions.push(A.x, A.y, A.z, B.x, B.y, B.z);
          colours.push(colA.r, colA.g, colA.b, colB.r, colB.g, colB.b);
        }

        const geom = new THREE.BufferGeometry();
        geom.setAttribute(
          "position",
          new THREE.Float32BufferAttribute(positions, 3),
        );
        geom.setAttribute(
          "color",
          new THREE.Float32BufferAttribute(colours, 3),
        );

        const mat = new THREE.LineBasicMaterial({
          vertexColors: true,
          transparent: true,
          opacity: 0.75,
        });

        const lines = new THREE.LineSegments(geom, mat);
        lines.userData.kind = "wireframe";
        scene.add(lines);
      }

      // Vertices (tiny points)
      {
        const pos = [];
        projected.forEach((p) => pos.push(p.x, p.y, p.z));

        const g = new THREE.BufferGeometry();
        g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));

        const m = new THREE.PointsMaterial({
          size: 0.03,
          opacity: 0.6,
          transparent: true,
          color: 0xffffff,
          depthWrite: false,
        });

        const pts = new THREE.Points(g, m);
        pts.userData.kind = "wireframe";
        scene.add(pts);
      }

      // User point
      {
        const p5 = getPoint5D();
        const p3 = project3D(p5).multiplyScalar(scale);

        // Colour based on axis leaning (blend)
        const axisVals = [vector.V, vector.W, vector.X, vector.Y, vector.Z];
        const axisColours = axisVals.map((v, i) => {
          const key = AXIS_KEYS[i];
          const [negCol, posCol] = AXIS_COLOURS[key];
          return new THREE.Color((Number(v) || 0) >= 0 ? posCol : negCol);
        });

        let total = 0;
        const mixed = new THREE.Color(0x000000);
        axisVals.forEach((v, i) => {
          const w = Math.abs(Number(v) || 0);
          total += w;
          mixed.r += axisColours[i].r * w;
          mixed.g += axisColours[i].g * w;
          mixed.b += axisColours[i].b * w;
        });
        if (total > 0) {
          mixed.r /= total;
          mixed.g /= total;
          mixed.b /= total;
        } else {
          mixed.set(0xffffff);
        }

        const sphereG = new THREE.SphereGeometry(0.065, 20, 20);
        const sphereM = new THREE.MeshStandardMaterial({
          color: mixed,
          emissive: mixed,
          emissiveIntensity: 0.6,
          roughness: 0.35,
          metalness: 0.1,
        });

        const sphere = new THREE.Mesh(sphereG, sphereM);
        sphere.position.copy(p3);
        sphere.userData.kind = "wireframe";
        scene.add(sphere);
      }
    }

    buildWireframe();
    resize();
    window.addEventListener("resize", () => resize());

    // "Reshuffle" button to change 5D -> 3D basis
    document.getElementById("regen3d")?.addEventListener("click", () => {
      BASIS3 = randomBasis3D();
      buildWireframe();
    });

    // Render loop
    function tick() {
      controls.update();
      renderer.render(scene, camera);
      requestAnimationFrame(tick);
    }
    tick();
  }
}
